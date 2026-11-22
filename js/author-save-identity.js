/**
 * Stable public identity for saved authors without importing Firebase.
 * Multiple source signals are retained, but a shared name alone never
 * merges two authors with distinct source identifiers.
 */
function fold(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function orcidId(value) {
  const id = String(value || "").trim()
    .replace(/^https?:\/\/(?:www\.)?orcid\.org\//i, "")
    .toUpperCase();
  return /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/.test(id) ? id.toLowerCase() : "";
}

function sourceId(value) {
  return String(value || "").trim()
    .replace(/^https?:\/\/(?:www\.)?openalex\.org\/(?:authors\/)?/i, "")
    .replace(/^https?:\/\/api\.openalex\.org\/authors\//i, "")
    .replace(/\/$/, "").toLowerCase();
}

export function authorSaveKeys(author) {
  if (!author) return [];
  const keys = [];
  const orcid = orcidId(author.orcid || author.orcidId);
  if (orcid) keys.push("orcid:" + orcid);
  const source = sourceId(author.sourceId || author.openalexId || author.id);
  if (source && !/^author-[a-z0-9-]+$/i.test(source)) {
    keys.push("source:" + source);
  }
  if (!keys.length) {
    const name = fold(author.name || author.displayName);
    if (name) keys.push("name:" + name);
  }
  return keys;
}

export function authorSaveKey(author) {
  return authorSaveKeys(author)[0] || "";
}

export function findSavedAuthor(author, library) {
  const target = new Set(authorSaveKeys(author));
  if (!target.size) return null;
  return (library || []).find(item =>
    authorSaveKeys(item).some(key => target.has(key))
  ) || null;
}
