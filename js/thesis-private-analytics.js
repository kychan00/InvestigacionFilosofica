import { SITE_VISITOR_COUNTER_CONFIG } from "./site-visitor-counter-config.js";

const STORAGE_KEY = "investigacion-filosofica-visitor-v1";
const EVENT_NAME = "investigacionfilosofica:thesis-click";
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

window.addEventListener(
  EVENT_NAME,
  event => {
    void logThesisClick(event.detail);
  },
);
