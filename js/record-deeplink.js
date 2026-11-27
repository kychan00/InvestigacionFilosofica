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
  const savedId = String(work?.id || "");
  if (/^work-[a-z0-9-]{1,180}$/i.test(savedId)) {
    return "./?" + new URLSearchParams({ view: "record", savedWork: savedId }).toString();
  }

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

  const savedId = String(params.get("savedWork") || "");
  if (params.has("savedWork")) {
    return { savedId: /^work-[a-z0-9-]{1,180}$/i.test(savedId) ? savedId : "", privateRecord: true };
  }

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

/** A bounded, Firestore-safe copy of the bibliographic fields used by the public modal.
 * Never save private annotations, arbitrary HTML, or search session state.
 */
const textField = (value, max = 1000) => typeof value === "string" ? value.slice(0, max) : "";
const numberField = value => typeof value === "number" && Number.isFinite(value) ? value : null;
const list = (value, limit = 30) => Array.isArray(value) ? value.slice(0, limit) : [];
function httpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}
function availability(value) {
  if (!value || typeof value !== "object") return null;
  return { status: textField(value.status, 120), originalUrl: httpUrl(value.originalUrl),
    archiveUrl: httpUrl(value.archiveUrl), reason: textField(value.reason, 800) };
}

export function capturePublicRecord(work) {
  if (!work || work.privateOnly) return null;
  const item = work.recordSnapshot || work;
  const sourceId = String(work.sourceRecordId || item.openalexId || item.id || "");
  const legacy = item.version === 1 ? Boolean(item.legacy) : /^work-[a-z0-9-]+$/i.test(String(item.id || ""));
  const urls = {};
  for (const key of ["canonical", "reference", "primary", "openAccess", "doi", "pdf"]) {
    const url = httpUrl(item.urls?.[key]);
    if (url) urls[key] = url;
  }
  const reference = httpUrl(work.referenceUrl);
  if (!urls.reference && reference) urls.reference = reference;
  // Earlier saved records discarded canonical URLs. Reconstruct only from
  // exact provider identifiers, never from a title search or guessed edition.
  if (!urls.canonical) {
    const archive = /^internetarchive:([a-z0-9_.-]+)$/i.exec(sourceId);
    const openalex = /^(?:https?:\/\/(?:api\.)?openalex\.org\/(?:works\/)?)?(W\d+)$/i.exec(sourceId);
    if (archive) urls.canonical = "https://archive.org/details/" + encodeURIComponent(archive[1]);
    else if (openalex) urls.canonical = "https://openalex.org/" + openalex[1].toUpperCase();
  }
  const sourceRecords = list(item.sourceRecords, 24).map(source => ({
    provider: textField(source?.provider, 120),
    sourceId: textField(source?.sourceId || source?.id || source?.recordId, 700),
    externalDescription: textField(source?.externalDescription, 8000),
    rank: numberField(source?.rank),
    query: textField(source?.query, 600),
    accessStatus: availability(source?.accessStatus)
  }));
  return {
    version: 1, legacy,
    id: textField(item.id, 700) || sourceId.slice(0, 700),
    openalexId: textField(item.openalexId, 700),
    title: textField(item.title || work.title, 600),
    authors: list(item.authors, 40).map(author => typeof author === "string" ? { name: textField(author, 300) } : ({
      name: textField(author?.name || author?.displayName, 300),
      id: textField(author?.id, 500), orcid: textField(author?.orcid, 120),
      sourceName: textField(author?.sourceName, 300),
      openalexId: textField(author?.openalexId, 500)
    })).filter(author => author.name),
    year: numberField(item.year), doi: normalizeRecordDoi(item.doi || work.doi),
    journal: textField(item.journal, 500), type: textField(item.type || item.workType, 120),
    language: textField(item.language, 40), abstract: textField(item.abstract, 24000),
    citedBy: numberField(item.citedBy),
    isbn: list(item.isbn, 30).map(value => textField(value, 120)).filter(Boolean),
    providers: list(item.providers, 20).map(value => textField(value, 120)).filter(Boolean),
    topics: list(item.topics, 40).map(topic => ({ name: textField(typeof topic === "string" ? topic : topic?.name || topic?.display_name, 300) })).filter(topic => topic.name),
    sourceRecords,
    sourceLinks: list(item.sourceLinks, 40).map(link => ({
      url: httpUrl(link?.url), provider: textField(link?.provider, 120),
      kind: textField(link?.kind, 120), year: numberField(link?.year)
    })).filter(link => link.url),
    sourceAvailability: availability(item.sourceAvailability),
    urls,
    relevanceScore: numberField(item.relevanceScore),
    relevanceLevel: textField(item.relevanceLevel, 120),
    retrievalMode: textField(item.retrievalMode, 120)
  };
}

/** Restore the exact stored work, including records created before snapshots existed. */
export function restoreSavedPublicRecord(work) {
  if (!work || work.privateOnly || !work.title) return null;
  const snapshot = capturePublicRecord(work);
  return { ...snapshot, savedRecordView: true,
    id: work.sourceRecordId || snapshot.id || work.id,
    title: work.title, year: snapshot.year ?? numberField(work.year),
    doi: snapshot.doi || normalizeRecordDoi(work.doi),
    authors: snapshot.authors.length ? snapshot.authors : list(work.authors).map(author =>
      typeof author === "string" ? {name: author} : author),
    providers: snapshot.providers.length ? snapshot.providers : list(work.providers),
    abstract: snapshot.abstract || textField(work.abstract, 24000),
    journal: snapshot.journal || textField(work.journal, 500),
    type: snapshot.type || textField(work.type, 120)
  };
}
