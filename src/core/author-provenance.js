/*
 * Provenance for a resolved author view. ORCID identifies the researcher;
 * it is NOT a bibliographic provider or proof that every similarly named
 * record belongs to that person.
 */
export function normalizedAuthorOrcid(value) {
  const raw = String(value || "").trim();
  const match = /^(?:https?:\/\/(?:www\.)?orcid\.org\/)?(\d{4}-\d{4}-\d{4}-[\dX]{4})\/?$/i.exec(raw);
  return match ? match[1].toUpperCase() : null;
}

export function authorOrcidUrl(value) {
  const orcid = normalizedAuthorOrcid(value);
  return orcid ? "https://orcid.org/" + orcid : null;
}

export function authorWorkSources(work = {}) {
  const sources = [
    ...(Array.isArray(work.providers) ? work.providers : []),
    ...(Array.isArray(work.sourceRecords)
      ? work.sourceRecords.map(record => record?.provider) : []),
    ...(Array.isArray(work.sourceLinks)
      ? work.sourceLinks.map(link => link?.provider) : [])
  ];
  const seen = new Set();
  return sources.filter(source => {
    if (typeof source !== "string" || !source.trim()) return false;
    const key = source.trim().toLocaleLowerCase("und");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(source => source.trim());
}

export function workHasAuthorOrcidEvidence(work = {}, authorOrcid) {
  const expected = normalizedAuthorOrcid(authorOrcid);
  if (!expected) return false;
  const candidates = [
    work.orcidEvidence,
    work.authorIdentity?.orcid,
    ...(Array.isArray(work.authors)
      ? work.authors.flatMap(author => [author?.orcid, author?.id])
      : [])
  ];
  return candidates.some(candidate =>
    normalizedAuthorOrcid(candidate) === expected
  );
}
