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

async function postRpc(name, body) {
  if (!configured()) {
    return false;
  }

  const base = SITE_VISITOR_COUNTER_CONFIG.supabaseUrl.replace(/\/$/, "");

  try {
    const response = await fetch(
      `${base}/rest/v1/rpc/${encodeURIComponent(name)}`,
      {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: SITE_VISITOR_COUNTER_CONFIG.publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}

export function logSearchQuery(query, { mode = "unknown" } = {}) {
  const normalized = String(query || "").trim();

  if (!normalized) {
    return Promise.resolve(false);
  }

  return postRpc("log_search_event", {
    p_visitor_id: visitorId(),
    p_query_text: normalized.slice(0, 2000),
    p_search_mode: mode,
  });
}

export function logAuthorEvent(
  author,
  {
    eventType = "clicked",
    source = null,
  } = {},
) {
  const name = String(author?.name || "").trim();

  if (!name) {
    return Promise.resolve(false);
  }

  return postRpc("log_author_event", {
    p_visitor_id: visitorId(),
    p_author_name: name.slice(0, 500),
    p_author_id: author?.id ? String(author.id).slice(0, 500) : null,
    p_orcid: author?.orcid ? String(author.orcid).slice(0, 100) : null,
    p_event_type: eventType,
    p_interaction_source: source,
  });
}
