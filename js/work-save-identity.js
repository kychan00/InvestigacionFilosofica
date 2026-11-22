/**
 * Public, Firebase-free identity for a research bookmark. The same key is
 * produced from the search result and from its normalized private-library
 * record, so dynamically rendered buttons can reflect saved state.
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

function normalizedDoi(value) {
  const doi = String(value || "").trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  return /^10\.\d{4,9}\/\S+$/i.test(doi) ? doi.toLowerCase() : "";
}

function normalizedSourceId(value) {
  return String(value || "").trim()
    .replace(/^https?:\/\/(?:api\.)?openalex\.org\/(?:works\/)?/i, "")
    .toLowerCase();
}

function firstAuthor(work) {
  const author = Array.isArray(work?.authors) ? work.authors[0] : null;
  return fold(typeof author === "string"
    ? author
    : author?.name || author?.displayName);
}

export function workSaveKey(work) {
  const doi = normalizedDoi(work?.doi);
  if (doi) return "doi:" + doi;

  const sourceId = normalizedSourceId(
    work?.sourceRecordId || work?.openalexId || work?.id
  );
  // A Firestore stable ID is not the original external identifier.
  if (sourceId && !/^work-[a-z0-9-]+$/i.test(sourceId)) {
    return "source:" + sourceId;
  }

  const title = fold(work?.title);
  if (!title) return "";
  return "title:" + title + "|author:" + firstAuthor(work) +
    "|year:" + (work?.year || "");
}

/**
 * Prefer the stored record when an existing bookmark is selected: IDs remain
 * stable and project assignments cannot silently fork into duplicate works.
 */
export function findSavedWork(work, library) {
  const key = workSaveKey(work);
  if (!key || !Array.isArray(library)) return null;
  return library.find(item => workSaveKey(item) === key) || null;
}
