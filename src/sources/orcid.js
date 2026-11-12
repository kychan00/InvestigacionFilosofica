import { normalizedAuthorOrcid } from "../core/author-provenance.js";

/*
 * The ORCID public registry's /works endpoint returns every publicly
 * visible work group for one identified person. It is NOT the Crossref
 * search-by-ORCID endpoint and needs no author-name matching.
 *
 * No credential is embedded in this public static application. Anonymous
 * public requests have ORCID rate limits and can fail with network/CORS.
 */
const ORCID_PUBLIC_API = "https://pub.orcid.org/v3.0";

function textValue(value) {
  if (typeof value === "string" || typeof value === "number")
    return String(value).trim();
  return typeof value?.value === "string" ? value.value.trim() : "";
}

function publishedNumber(value, min, max) {
  const number = Number(textValue(value));
  return Number.isInteger(number) && number >= min && number <= max
    ? number : null;
}

function externalIds(summary) {
  const collection = summary?.["external-ids"]?.["external-id"] || [];
  return Array.isArray(collection) ? collection : [];
}

function normalizedDoi(value) {
  const doi = String(value || "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:/i, "").trim().toLowerCase();
  return /^10\.\d{4,9}\/\S+$/i.test(doi) ? doi : null;
}

function safeUrl(value) {
  try {
    const url = new URL(textValue(value));
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function summaryTitle(summary) {
  return textValue(summary?.title?.title) ||
    textValue(summary?.["journal-title"]) ||
    "";
}

function preferredSummary(group) {
  return [...group].sort((a, b) => {
    const score = summary => [
      summaryTitle(summary) ? 1 : 0,
      normalizedDoi(externalIds(summary).find(id =>
        String(id?.["external-id-type"] || "").toLowerCase() === "doi" &&
        String(id?.["external-id-relationship"] || "self").toLowerCase() !== "part-of"
      )?.["external-id-value"]) ? 1 : 0,
      textValue(summary?.["publication-date"]?.year) ? 1 : 0,
      safeUrl(summary?.url) ? 1 : 0
    ].reduce((sum, value) => sum + value, 0);
    return score(b) - score(a);
  })[0];
}

function groupWork(summaries, id, authorName) {
  const members = (summaries || []).filter(summary =>
    summary && typeof summary === "object" &&
    summary.visibility !== "limited" && summary.visibility !== "private"
  );
  if (!members.length) return null;
  const best = preferredSummary(members);
  const title = summaryTitle(best) ||
    members.map(summaryTitle).find(Boolean);
  if (!title) return null;

  const distinctIds = members.flatMap(externalIds);
  const doiCandidates = distinctIds
    .filter(item => String(item?.["external-id-type"] || "").toLowerCase() === "doi")
    .filter(item => String(item?.["external-id-relationship"] || "self").toLowerCase() !== "part-of")
    .map(item => normalizedDoi(item?.["external-id-value"]))
    .filter(Boolean);
  const doi = doiCandidates[0] || null;

  const year = members
    .map(summary => publishedNumber(summary?.["publication-date"]?.year, 1, 3000))
    .find(Boolean) || null;
  const month = members
    .map(summary => publishedNumber(summary?.["publication-date"]?.month, 1, 12))
    .find(Boolean) || null;
  const publicationDate = year && month
    ? String(year).padStart(4, "0") + "-" + String(month).padStart(2, "0")
    : null;

  const profileUrl = "https://orcid.org/" + id;
  const sourceIds = [...new Set(members
    .map(summary => Number(summary["put-code"]))
    .filter(Number.isInteger))];
  const link = members.map(summary => safeUrl(summary?.url))
    .find(Boolean) ||
    distinctIds.map(externalId => safeUrl(externalId["external-id-url"]))
      .find(Boolean) ||
    (doi ? "https://doi.org/" + doi : profileUrl);
  const isbn = [...new Set(distinctIds
    .filter(item => ["isbn", "isbn-13", "isbn-10"].includes(
      String(item?.["external-id-type"] || "").toLowerCase()))
    .map(item => textValue(item?.["external-id-value"]))
    .filter(Boolean))];

  return {
    id: sourceIds.length
      ? "orcid:" + id + ":" + sourceIds[0]
      : "orcid:" + id + ":" + String(title).toLowerCase() + ":" + (year || ""),
    title,
    year, month, publicationDate,
    type: best?.["publication-type"] || best?.["work-type"] || null,
    language: null,
    doi,
    isbn,
    journal: textValue(best?.["journal-title"]) || null,
    abstract: null,
    authors: [{ name: authorName || "Investigador identificado por ORCID",
      id: profileUrl, orcid: profileUrl }],
    providers: ["ORCID"],
    sourceRecords: (sourceIds.length ? sourceIds : [null]).map(putCode => ({
      provider: "ORCID", sourceId: putCode === null
        ? id : id + "/work/" + putCode,
      query: "Registro público ORCID " + id,
      orcidRecord: true
    })),
    sourceLinks: [{
      provider: "ORCID", url: profileUrl,
      sourceId: sourceIds.length ? id + "/work/" + sourceIds[0] : id
    }],
    urls: { landing: link, canonical: doi ? "https://doi.org/" + doi : link },
    orcidRecord: true,
    orcidEvidence: id,
    authorIdentity: { orcid: profileUrl, evidence: "orcid-public-record" },
    relevanceLevel: "Autor",
    relevanceScore: 98,
    retrievalMode: "author-orcid-registry"
  };
}

export function normalizeOrcidPublicWorks(payload, { orcid, displayName = "" } = {}) {
  const id = normalizedAuthorOrcid(orcid);
  if (!id) throw new Error("ORCID inválido");
  // ORCID v3 returns {group:[{work-summary:[...]}, ...]}. A malformed
  // or blocked response must not masquerade as an empty bibliography.
  if (!payload || !Array.isArray(payload.group))
    throw new Error("La respuesta pública de ORCID no contiene grupos de obras");
  const works = payload.group
    .map(group => groupWork(group?.["work-summary"], id, displayName))
    .filter(Boolean);
  return {
    works,
    totalGroups: payload.group.length,
    returnedWorks: works.length,
    complete: true,
    source: "ORCID",
    profileUrl: "https://orcid.org/" + id
  };
}

export async function fetchOrcidPublicWorks(orcid, {
  displayName = "",
  signal,
  fetchImpl = fetch,
  apiBase = ORCID_PUBLIC_API
} = {}) {
  const id = normalizedAuthorOrcid(orcid);
  if (!id) return { works: [], totalGroups: 0, returnedWorks: 0,
    complete: false, skipped: "invalid-orcid" };
  const endpoint = String(apiBase).replace(/\/$/, "") + "/" + id + "/works";
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: { Accept: "application/vnd.orcid+json" },
    signal,
    mode: "cors"
  });
  if (!response?.ok)
    throw new Error("ORCID HTTP " + (response?.status || "desconocido"));
  const data = await response.json();
  return normalizeOrcidPublicWorks(data, { orcid: id, displayName });
}
