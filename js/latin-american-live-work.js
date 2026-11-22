/**
 * Map a federated result to the same work payload used by the general search.
 * Never write to the curated philosopher dossier or infer missing evidence.
 */
export function liveResultBookmarkPayload(item, sourceUrl = "") {
  const result = item && typeof item === "object" ? item : {};
  const doi = String(result.doi || result.urls?.doi || "")
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  return {
    ...result,
    doi,
    referenceUrl: sourceUrl || result.referenceUrl ||
      result.urls?.reference || result.url || ""
  };
}
