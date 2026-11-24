import { SITE_VISITOR_COUNTER_CONFIG } from "./site-visitor-counter-config.js";

// Only these enumerated values leave the browser. No persistent identifier,
// URL, referrer, query, amount, or payment information is sent.
export function supportSource(value) {
  return value === "menu" || value === "acerca" ? value : "directo";
}

export function validSupportEvent(eventType, source) {
  return ["entry_click", "page_view", "checkout_click"].includes(eventType) &&
    ["menu", "acerca", "directo"].includes(source) &&
    (eventType !== "entry_click" || source !== "directo");
}

export async function logSupportEvent(eventType, source, {
  config = SITE_VISITOR_COUNTER_CONFIG,
  fetcher = globalThis.fetch,
  privacy = globalThis.navigator
} = {}) {
  if (!validSupportEvent(eventType, source) ||
      privacy?.globalPrivacyControl === true ||
      privacy?.doNotTrack === "1" ||
      typeof fetcher !== "function" ||
      !config?.supabaseUrl?.startsWith("https://") ||
      !config?.publishableKey?.startsWith("sb_publishable_")) return false;
  try {
    const response = await fetcher(
      config.supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/log_support_event",
      {
        method: "POST",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: true,
        headers: {
          apikey: config.publishableKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({p_event_type: eventType, p_source: source})
      }
    );
    return response.ok;
  } catch {
    // Analytics must never interrupt navigation or payment.
    return false;
  }
}

let initialized = false;
export function initSupportAnalytics() {
  if (initialized) return;
  initialized = true;
  const isSupport = document.body.classList.contains("support-page");
  const pageSource = supportSource(new URLSearchParams(location.search).get("origen"));
  if (isSupport) void logSupportEvent("page_view", pageSource);
  const onClick = event => {
    const link = event.target?.closest?.("a[data-support-event]");
    if (!link || link.hidden || event.defaultPrevented) return;
    const eventType = link.dataset.supportEvent;
    const source = link.dataset.supportSource === "page" && isSupport
      ? pageSource
      : supportSource(link.dataset.supportSource);
    void logSupportEvent(eventType, source);
  };
  document.addEventListener("click", onClick, true);
  document.addEventListener("auxclick", event => {
    if (event.button === 1) onClick(event);
  }, true);
}
