/**
 * Deep links from the private research library to the *existing* public
 * "Ver ficha" record modal. This module never looks up or discloses private
 * Firestore data: the URL contains only public bibliographic identifiers.
 */

export function normalizeRecordDoi(value) {
  const candidate = String(value || "").trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  return /^10\.\d{4,9}\/\S+$/i.test(candidate) ? candidate.toLowerCase() : "";
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("und")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedSourceId(value) {
  return String(value || "").trim()
    .replace(/^https?:\/\/(?:www\.)?openalex\.org\//i, "")
    .replace(/^https?:\/\/api\.openalex\.org\/works\//i, "")
    .toLowerCase();
}

function firstAuthorName(work) {
  const first = Array.isArray(work?.authors) ? work.authors[0] : null;
  return typeof first === "string"
    ? first.trim()
    : String(first?.name || first?.sourceName || "").trim();
}

export function savedWorkRecordUrl(work) {
  if (work?.privateOnly) return "";

  const title = String(work?.title || "").trim();
  const doi = normalizeRecordDoi(work?.doi);
  const sourceId = String(work?.sourceRecordId || work?.openalexId || "").trim();
  if (!title && !doi) return "";

  const params = new URLSearchParams({ view: "record" });
  if (title) params.set("workTitle", title.slice(0, 600));
  if (doi) params.set("workDoi", doi);
  if (sourceId && !/^work-[a-z0-9-]+$/i.test(sourceId)) {
    params.set("workId", sourceId.slice(0, 700));
  }
  const author = firstAuthorName(work);
  if (author) params.set("workAuthor", author.slice(0, 300));
  if (Number.isInteger(Number(work?.year)) &&
      Number(work.year) >= 1000 && Number(work.year) <= 3000) {
    params.set("workYear", String(work.year));
  }
  return "./?" + params.toString() + "#results";
}

export function recordRequestFromLocation(search) {
  const params = new URLSearchParams(search);
  if (params.get("view") !== "record") return null;

  const title = String(params.get("workTitle") || "").trim().slice(0, 600);
  const doi = normalizeRecordDoi(params.get("workDoi"));
  const sourceId = String(params.get("workId") || "").trim().slice(0, 700);
  const author = String(params.get("workAuthor") || "").trim().slice(0, 300);
  const yearValue = Number(params.get("workYear"));
  const year = Number.isInteger(yearValue) && yearValue >= 1000 && yearValue <= 3000
    ? yearValue : null;

  return title || doi ? { title, doi, sourceId, author, year } : null;
}

export function findExactRecordForDeepLink(request, records) {
  if (!request || !Array.isArray(records)) return null;

  if (request.doi) {
    const byDoi = records.find(item =>
      normalizeRecordDoi(item?.doi) === request.doi
    );
    if (byDoi) return byDoi;
  }

  if (request.sourceId) {
    const wanted = normalizedSourceId(request.sourceId);
    const byId = records.find(item =>
      [
        item?.id,
        item?.openalexId,
        ...(Array.isArray(item?.sourceRecords)
          ? item.sourceRecords.map(source => source?.id || source?.recordId)
          : [])
      ].some(id => id && normalizedSourceId(id) === wanted)
    );
    if (byId) return byId;
  }

  const wantedTitle = normalizedText(request.title);
  if (!wantedTitle) return null;

  let candidates = records.filter(item =>
    normalizedText(item?.title) === wantedTitle &&
    (!request.doi || !normalizeRecordDoi(item?.doi) ||
      normalizeRecordDoi(item.doi) === request.doi)
  );

  if (request.author) {
    const wantedAuthor = normalizedText(request.author);
    candidates = candidates.filter(item =>
      (item.authors || []).some(author =>
        normalizedText(typeof author === "string" ? author : author?.name) === wantedAuthor
      )
    );
  }

  if (request.year && candidates.length > 1) {
    const yearMatches = candidates.filter(item => Number(item?.year) === request.year);
    if (yearMatches.length) candidates = yearMatches;
  }

  // An uncertain edition or homonymous title must never open the wrong work.
  return candidates.length === 1 ? candidates[0] : null;
}
