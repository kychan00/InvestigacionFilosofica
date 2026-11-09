import { SITE_VISITOR_COUNTER_CONFIG } from "./site-visitor-counter-config.js";

const STORAGE_KEY = "investigacion-filosofica-visitor-v1";
const COUNTER_SELECTOR = "[data-site-visitor-counter]";
const VALUE_SELECTOR = "[data-site-visitor-count]";

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
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function getVisitorId() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      return saved;
    }

    const created = randomUuid();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return randomUuid();
  }
}

function isConfigured(config) {
  return (
    typeof config?.supabaseUrl === "string" &&
    config.supabaseUrl.startsWith("https://") &&
    typeof config?.publishableKey === "string" &&
    config.publishableKey.startsWith("sb_publishable_") &&
    typeof config?.rpcName === "string" &&
    config.rpcName.length > 0
  );
}

async function registerVisitor() {
  if (!isConfigured(SITE_VISITOR_COUNTER_CONFIG)) {
    return null;
  }

  const url = SITE_VISITOR_COUNTER_CONFIG.supabaseUrl.replace(/\/$/, "");
  const visitorId = getVisitorId();

  const response = await fetch(
    `${url}/rest/v1/rpc/${encodeURIComponent(
      SITE_VISITOR_COUNTER_CONFIG.rpcName,
    )}`,
    {
      method: "POST",
      headers: {
        apikey: SITE_VISITOR_COUNTER_CONFIG.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_visitor_id: visitorId,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`visitor counter request failed: ${response.status}`);
  }

  const payload = await response.json();
  const total = Number(payload);

  if (!Number.isFinite(total) || total < 0) {
    throw new Error("visitor counter returned an invalid value");
  }

  return Math.trunc(total);
}

async function renderVisitorCounter() {
  const counter = document.querySelector(COUNTER_SELECTOR);
  const valueNode = counter?.querySelector(VALUE_SELECTOR);

  if (!counter || !valueNode) {
    return;
  }

  try {
    const total = await registerVisitor();

    if (total === null) {
      return;
    }

    valueNode.textContent = new Intl.NumberFormat("es-MX").format(total);
    counter.hidden = false;
  } catch (error) {
    console.warn("[visitor-counter]", error);
  }
}

renderVisitorCounter();
