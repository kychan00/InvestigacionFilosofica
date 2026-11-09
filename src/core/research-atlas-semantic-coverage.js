// RA12-C4 — source-agnostic semantic identity and overlay eligibility.
// Pure functions only. No network, no model loading, no production wiring.

const OPENALEX_RE = /(?:^|openalex[-:/]|openalex\.org\/)(W[1-9][0-9]*)/i;
const DOI_RE = /^10\.\d{4,9}\/\S+$/i;

export function normalizeSemanticOpenAlexId(value) {
  const text = String(value || "").trim();
  const match = OPENALEX_RE.exec(text);
  return match ? match[1].toUpperCase() : null;
}

export function normalizeSemanticDoi(value) {
  if (!value) return null;
  const text = String(value)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
    .toLowerCase()
    .replace(/[ .;,]+$/g, "");
  return DOI_RE.test(text) ? text : null;
}

export function semanticAliases(result = {}) {
  const aliases = new Set();
  for (const value of [
    result.openalexId,
    result.openalex_id,
    result.id,
    result.urls?.canonical,
    ...(result.sourceRecords || []).map(item => item.sourceId)
  ]) {
    const work = normalizeSemanticOpenAlexId(value);
    if (work) aliases.add("openalex:" + work);
  }
  for (const value of [
    result.doi,
    result.crossrefId,
    result.crossref_id,
    result.urls?.doi,
    result.urls?.canonical,
    ...(result.sourceRecords || []).map(item => item.sourceId)
  ]) {
    const doi = normalizeSemanticDoi(value);
    if (doi) {
      aliases.add("doi:" + doi);
      aliases.add("crossref:" + doi);
    }
  }
  return [...aliases].sort();
}

export function overlayDocumentText(result = {}) {
  const title = String(result.title || "").replace(/\s+/g, " ").trim();
  const abstract = String(result.abstract || "").replace(/\s+/g, " ").trim();
  if (!title) return null;
  // Exact field contract is deliberately simple and versionable. The future
  // batch embedder must use this exact text under a frozen schema.
  return abstract ? title + "\n\n" + abstract : title;
}

export function overlayStableIdentity(result = {}) {
  const doi = normalizeSemanticDoi(result.doi || result.urls?.doi);
  if (doi) return "doi:" + doi;
  const providers = [...new Set((result.providers || []).map(String).filter(Boolean))].sort();
  if (providers.length === 1 && result.id) {
    return "provider:" + providers[0].toLowerCase().replace(/\s+/g, "-") + ":" + String(result.id);
  }
  return null;
}

/**
 * Resolver callback receives an alias and returns:
 * { workId, vectorId, cluster, ordinal, alias } or null.
 */
export function classifySemanticCoverage(result, resolveAlias) {
  if (typeof resolveAlias !== "function") {
    throw new TypeError("resolveAlias must be a function");
  }
  const aliases = semanticAliases(result);
  for (const alias of aliases) {
    const resolved = resolveAlias(alias);
    if (resolved) {
      return {
        state: alias.startsWith("openalex:") ? "base-direct" : "base-alias",
        alias,
        location: resolved,
        requiresEmbedding: false
      };
    }
  }
  const documentText = overlayDocumentText(result);
  const identity = overlayStableIdentity(result);
  if (!documentText || !identity) {
    return {
      state: "unresolved",
      aliases,
      requiresEmbedding: false,
      reason: !documentText ? "missing-title" : "no-stable-cross-source-identity"
    };
  }
  return {
    state: "overlay-candidate",
    aliases,
    overlayIdentity: identity,
    documentText,
    providers: [...(result.providers || [])],
    requiresEmbedding: true
  };
}
