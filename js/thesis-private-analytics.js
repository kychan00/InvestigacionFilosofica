import { SITE_VISITOR_COUNTER_CONFIG } from "./site-visitor-counter-config.js";

const STORAGE_KEY = "investigacion-filosofica-visitor-v1";
let fallbackVisitorId = null;

function randomUuid() {
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(
    bytes,
    byte => byte.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function visitorId() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      return saved;
    }

    const created = randomUuid();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    fallbackVisitorId ||= randomUuid();
    return fallbackVisitorId;
  }
}

function configured() {
  return (
    SITE_VISITOR_COUNTER_CONFIG?.supabaseUrl?.startsWith("https://") &&
    SITE_VISITOR_COUNTER_CONFIG?.publishableKey?.startsWith("sb_publishable_")
  );
}

async function logThesisClick(detail = {}) {
  if (!configured()) {
    return false;
  }

  const title = String(detail.title || "").trim();
  const discoverySource = String(detail.discoverySource || "").trim();
  const interactionSource = String(detail.interactionSource || "").trim();

  if (
    !title ||
    !["search", "atlas"].includes(discoverySource) ||
    !interactionSource
  ) {
    return false;
  }

  const base = SITE_VISITOR_COUNTER_CONFIG.supabaseUrl.replace(/\/$/, "");

  try {
    const response = await fetch(
      `${base}/rest/v1/rpc/log_thesis_click`,
      {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: SITE_VISITOR_COUNTER_CONFIG.publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_visitor_id: visitorId(),
          p_thesis_id: detail.thesisId ? String(detail.thesisId).slice(0, 500) : null,
          p_thesis_title: title.slice(0, 2000),
          p_discovery_source: discoverySource,
          p_interaction_source: interactionSource.slice(0, 100),
          p_query_text: detail.queryText ? String(detail.queryText).slice(0, 2000) : null,
          p_institution: detail.institution ? String(detail.institution).slice(0, 100) : null,
          p_scope: detail.scope ? String(detail.scope).slice(0, 100) : null,
        }),
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}

function activeThesisInstitution() {
  return document
    .querySelector('[data-thesis-institution][aria-pressed="true"]')
    ?.dataset?.thesisInstitution || null;
}

function activeThesisScope() {
  return document
    .querySelector('[data-thesis-scope][aria-pressed="true"]:not([hidden])')
    ?.dataset?.thesisScope || null;
}

function thesisIdFromCard(card) {
  const ids = [...card.querySelectorAll(".td-source-id")]
    .map(node => node.textContent?.trim() || "");

  const canonical = ids.find(text => text.startsWith("ID canónico V2:"));
  const fallback = ids.find(text => text.startsWith("ID:"));
  const raw = canonical || fallback || "";

  return raw.includes(":")
    ? raw.slice(raw.indexOf(":") + 1).trim()
    : null;
}

function bindThesisSearchClicks() {
  const root = document.querySelector("#thesis-demo");

  if (!root) {
    return;
  }

  root.addEventListener(
    "click",
    event => {
      const link = event.target?.closest?.(
        "#thesis-results .td-result a.td-primary-action"
      );

      if (!link) {
        return;
      }

      const card = link.closest(".td-result");

      if (!card || card.classList.contains("td-result-editorial")) {
        return;
      }

      const title = card
        .querySelector(".td-result-title")
        ?.textContent?.trim();

      if (!title) {
        return;
      }

      void logThesisClick({
        thesisId: thesisIdFromCard(card),
        title,
        discoverySource: "search",
        interactionSource: "search-result",
        queryText:
          document.querySelector("#thesis-query")
            ?.value?.trim() || null,
        institution: activeThesisInstitution(),
        scope: activeThesisScope(),
      });
    },
    true,
  );
}

function atlasDetailSnapshot() {
  const detail = document.querySelector("#atlas-detail");
  const title = detail
    ?.querySelector(".ta-detail-title")
    ?.textContent?.trim();

  if (!title) {
    return null;
  }

  let thesisId = null;

  for (const box of detail.querySelectorAll(".ta-detail-meta > div")) {
    const label = box.querySelector("span")?.textContent?.trim();
    const value = box.querySelector("strong")?.textContent?.trim();

    if (label === "ID" && value) {
      thesisId = value.startsWith("#")
        ? `thesis:work:${value.slice(1)}`
        : value;
      break;
    }
  }

  return {
    thesisId,
    title,
  };
}

function bindAtlasClicks() {
  const canvas = document.querySelector("#atlas-canvas");
  const detail = document.querySelector("#atlas-detail");

  if (!canvas || !detail) {
    return;
  }

  let pendingSource = null;

  function recordAfterSelection(source) {
    window.setTimeout(() => {
      const thesis = atlasDetailSnapshot();

      if (!thesis) {
        return;
      }

      void logThesisClick({
        ...thesis,
        discoverySource: "atlas",
        interactionSource: source,
        queryText:
          document.querySelector("#atlas-query")
            ?.value?.trim() || null,
        institution: "udg",
        scope: "humanities",
      });
    }, 0);
  }

  canvas.addEventListener(
    "pointerup",
    () => {
      pendingSource = "atlas-node";
      recordAfterSelection(pendingSource);
    },
    true,
  );

  document.addEventListener(
    "click",
    event => {
      if (!event.target?.closest?.("#atlas-detail .ta-neighbor")) {
        return;
      }

      pendingSource = "atlas-neighbor";
      recordAfterSelection(pendingSource);
    },
    true,
  );
}

bindThesisSearchClicks();
bindAtlasClicks();
