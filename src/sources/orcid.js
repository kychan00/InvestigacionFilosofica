import { normalizedAuthorOrcid } from "../core/author-provenance.js";
import { normalizeText } from "../core/parser.js";

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

  // Keep year and month from the SAME dated summary; never combine
  // different registry assertions into a date that nobody supplied.
  const dated = members.find(summary =>
    publishedNumber(summary?.["publication-date"]?.year, 1, 3000));
  const year = dated
    ? publishedNumber(dated["publication-date"]?.year, 1, 3000) : null;
  const month = dated
    ? publishedNumber(dated["publication-date"]?.month, 1, 12) : null;
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
    type: best?.type || best?.["publication-type"] || best?.["work-type"] || null,
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


function publicItem(item) {
  return item && typeof item === "object" &&
    item.visibility !== "limited" && item.visibility !== "private";
}

function dateParts(value) {
  if (!value || typeof value !== "object") return null;
  const year = publishedNumber(value.year, 1, 3000);
  const month = publishedNumber(value.month, 1, 12);
  const day = publishedNumber(value.day, 1, 31);
  if (!year) return null;
  return {
    year,
    month,
    day,
    label: [year, month ? String(month).padStart(2, "0") : null,
      day ? String(day).padStart(2, "0") : null].filter(Boolean).join("-")
  };
}

function affiliationSummaries(section, key) {
  if (!section || typeof section !== "object") return [];
  const direct = Array.isArray(section[key]) ? section[key] : [];
  const grouped = Array.isArray(section["affiliation-group"])
    ? section["affiliation-group"].flatMap(group => {
        if (Array.isArray(group?.summaries)) {
          return group.summaries.flatMap(summary =>
            summary?.[key] ? [summary[key]] : []);
        }
        return [];
      })
    : [];
  return [...direct, ...grouped].filter(publicItem);
}

function normalizeAffiliation(item, kind) {
  const organization = item?.organization || {};
  const name = textValue(organization.name);
  if (!name) return null;
  return {
    kind,
    organization: name,
    department: textValue(item?.["department-name"]) || null,
    role: textValue(item?.["role-title"]) || null,
    startDate: dateParts(item?.["start-date"]),
    endDate: dateParts(item?.["end-date"]),
    city: textValue(organization?.address?.city) || null,
    region: textValue(organization?.address?.region) || null,
    country: textValue(organization?.address?.country) || null,
    putCode: Number.isInteger(Number(item?.["put-code"]))
      ? Number(item["put-code"]) : null,
    sourceName: textValue(item?.source?.["source-name"]) || null
  };
}

function researcherUrls(person) {
  const rows = person?.["researcher-urls"]?.["researcher-url"] || [];
  return (Array.isArray(rows) ? rows : [])
    .filter(publicItem)
    .map(item => ({
      name: textValue(item?.["url-name"]) || "Sitio del investigador",
      url: safeUrl(item?.url)
    }))
    .filter(item => item.url);
}

function publicKeywords(person) {
  const rows = person?.keywords?.keyword || [];
  return [...new Set((Array.isArray(rows) ? rows : [])
    .filter(publicItem)
    .map(item => textValue(item?.content))
    .filter(Boolean))];
}

function publicCountries(person) {
  const rows = person?.address?.address || [];
  return [...new Set((Array.isArray(rows) ? rows : [])
    .filter(publicItem)
    .map(item => textValue(item?.country?.value || item?.country))
    .filter(Boolean))];
}

function publicOtherNames(person) {
  const rows = person?.["other-names"]?.["other-name"] || [];
  return [...new Set((Array.isArray(rows) ? rows : [])
    .filter(publicItem)
    .map(item => textValue(item?.content))
    .filter(Boolean))];
}

function fundingSummaries(activities) {
  const groups = activities?.fundings?.group || [];
  return (Array.isArray(groups) ? groups : []).flatMap(group =>
    (Array.isArray(group?.["funding-summary"])
      ? group["funding-summary"] : []))
    .filter(publicItem)
    .map(item => ({
      title: textValue(item?.title?.title),
      type: textValue(item?.type) || null,
      organization: textValue(item?.organization?.name) || null,
      startDate: dateParts(item?.["start-date"]),
      endDate: dateParts(item?.["end-date"])
    }))
    .filter(item => item.title || item.organization);
}

export function normalizeOrcidPublicProfile(payload, { orcid } = {}) {
  const id = normalizedAuthorOrcid(orcid);
  if (!id) throw new Error("ORCID inválido");
  if (!payload || typeof payload !== "object")
    throw new Error("La respuesta pública de ORCID no contiene un registro");
  const person = payload.person || {};
  const activities = payload["activities-summary"] || {};
  const name = person.name || {};
  const givenName = textValue(name?.["given-names"]);
  const familyName = textValue(name?.["family-name"]);
  const creditName = textValue(name?.["credit-name"]);
  const biography = textValue(person?.biography?.content || person?.biography);
  const affiliations = {
    employments: affiliationSummaries(
      activities.employments, "employment-summary")
      .map(item => normalizeAffiliation(item, "employment")).filter(Boolean),
    educations: affiliationSummaries(
      activities.educations, "education-summary")
      .map(item => normalizeAffiliation(item, "education")).filter(Boolean),
    distinctions: affiliationSummaries(
      activities.distinctions, "distinction-summary")
      .map(item => normalizeAffiliation(item, "distinction")).filter(Boolean),
    qualifications: affiliationSummaries(
      activities.qualifications, "qualification-summary")
      .map(item => normalizeAffiliation(item, "qualification")).filter(Boolean),
    memberships: affiliationSummaries(
      activities.memberships, "membership-summary")
      .map(item => normalizeAffiliation(item, "membership")).filter(Boolean),
    services: affiliationSummaries(
      activities.services, "service-summary")
      .map(item => normalizeAffiliation(item, "service")).filter(Boolean),
    invitedPositions: affiliationSummaries(
      activities["invited-positions"], "invited-position-summary")
      .map(item => normalizeAffiliation(item, "invited-position")).filter(Boolean)
  };
  const keywords = publicKeywords(person);
  const countries = publicCountries(person);
  const otherNames = publicOtherNames(person);
  const websites = researcherUrls(person);
  const fundings = fundingSummaries(activities);
  const displayName = creditName ||
    [givenName, familyName].filter(Boolean).join(" ") || null;
  const allAffiliations = Object.values(affiliations).flat();
  return {
    orcid: id,
    profileUrl: "https://orcid.org/" + id,
    displayName,
    givenName: givenName || null,
    familyName: familyName || null,
    creditName: creditName || null,
    biography: biography || null,
    keywords,
    countries,
    otherNames,
    websites,
    ...affiliations,
    fundings,
    hasPublicProfileData: Boolean(
      biography || keywords.length || countries.length || otherNames.length ||
      websites.length || allAffiliations.length || fundings.length
    ),
    source: "ORCID"
  };
}

export async function fetchOrcidPublicProfile(orcid, {
  signal,
  fetchImpl = fetch,
  apiBase = ORCID_PUBLIC_API
} = {}) {
  const id = normalizedAuthorOrcid(orcid);
  if (!id) return {
    orcid: null, hasPublicProfileData: false, skipped: "invalid-orcid"
  };
  const endpoint = String(apiBase).replace(/\/$/, "") + "/" + id + "/record";
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: { Accept: "application/vnd.orcid+json" },
    signal,
    mode: "cors"
  });
  if (!response?.ok)
    throw new Error("ORCID profile HTTP " +
      (response?.status || "desconocido"));
  const data = await response.json();
  return normalizeOrcidPublicProfile(data, { orcid: id });
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


const ORCID_SEARCH_STOPWORDS = new Set([
  "a","al","an","and","de","del","el","en","for","from","in","la","las",
  "los","of","on","or","para","por","sobre","the","to","un","una","with","y"
]);

function embeddedOrcid(value) {
  const found = String(value || "").match(
    /(?:https?:\/\/(?:www\.)?orcid\.org\/)?(\d{4}-\d{4}-\d{4}-[\dX]{4})/i
  );
  return found ? normalizedAuthorOrcid(found[1]) : null;
}

function orcidSearchTokens(value) {
  return [...new Set(
    normalizeText(String(value || ""))
      .replace(/-/g, " ")
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token =>
        token.length >= 3 &&
        !ORCID_SEARCH_STOPWORDS.has(token) &&
        !/^\d+$/.test(token)
      )
  )].slice(0, 10);
}

function tokenCoverage(needle, haystack) {
  if (!needle.length || !haystack.length) return 0;
  const available = new Set(haystack);
  let hits = 0;
  for (const token of needle) {
    if (available.has(token)) hits += 1;
  }
  return hits / needle.length;
}

function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text || "").replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter(item => item.some(value => String(value).trim()));
}

export function normalizeOrcidSearchCsv(text) {
  const rows = csvRows(text);
  if (!rows.length) return [];

  const headers = rows[0].map(value =>
    String(value || "").trim().toLowerCase()
  );

  return rows.slice(1).map(values => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = String(values[index] || "").trim();
    });

    const orcid = normalizedAuthorOrcid(
      record.orcid || record["orcid-id"] || record["orcid-identifier"]
    );
    if (!orcid) return null;

    const given = record["given-names"] || record["given-name"] || "";
    const family = record["family-name"] || record["family-names"] || "";
    const credit = record["credit-name"] || "";
    const displayName = credit || [given, family].filter(Boolean).join(" ") || orcid;
    const institutions = [
      record["current-institution-affiliation-name"],
      record["past-institution-affiliation-name"],
      record["institution-name"]
    ].filter(Boolean);

    return {
      orcid,
      displayName,
      givenNames: given || null,
      familyName: family || null,
      creditName: credit || null,
      institutions: [...new Set(institutions)]
    };
  }).filter(Boolean);
}

function orcidCsvSearchUrl(query, {
  start = 0,
  rows = 2,
  apiBase = ORCID_PUBLIC_API
} = {}) {
  const url = new URL(
    String(apiBase).replace(/\/$/, "") + "/csv-search/"
  );
  url.searchParams.set("q", String(query || "").trim());
  url.searchParams.set(
    "fl",
    [
      "orcid",
      "given-names",
      "family-name",
      "credit-name",
      "current-institution-affiliation-name",
      "past-institution-affiliation-name"
    ].join(",")
  );
  url.searchParams.set("start", String(Math.max(0, Number(start) || 0)));
  url.searchParams.set("rows", String(Math.max(1, Math.min(10, Number(rows) || 2))));
  return url;
}

export async function searchOrcidProfiles(query, {
  start = 0,
  rows = 2,
  signal,
  fetchImpl = fetch,
  apiBase = ORCID_PUBLIC_API
} = {}) {
  const exact = embeddedOrcid(query);
  if (exact) {
    return [{
      orcid: exact,
      displayName: exact,
      givenNames: null,
      familyName: null,
      creditName: null,
      institutions: []
    }];
  }

  const cleaned = String(query || "").trim();
  if (!cleaned) return [];

  const url = orcidCsvSearchUrl(cleaned, {
    start, rows, apiBase
  });
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "text/csv" },
    signal,
    mode: "cors"
  });

  if (!response?.ok) {
    throw new Error(
      "ORCID search HTTP " + (response?.status || "desconocido")
    );
  }

  return normalizeOrcidSearchCsv(await response.text());
}

function orcidWorkSearchScore(work, queryTokens) {
  const textTokens = orcidSearchTokens([
    work.title,
    work.journal,
    work.publisher
  ].filter(Boolean).join(" "));
  const coverage = tokenCoverage(queryTokens, textTokens);
  const precision = tokenCoverage(textTokens, queryTokens);
  return coverage * 0.75 + precision * 0.25;
}

function profileMatchesAuthorQuery(profile, queryTokens) {
  if (!queryTokens.length) return false;
  const identityTokens = orcidSearchTokens([
    profile.displayName,
    profile.givenNames,
    profile.familyName,
    profile.creditName
  ].filter(Boolean).join(" "));
  const coverage = tokenCoverage(queryTokens, identityTokens);
  return queryTokens.length >= 2 && coverage >= 0.60;
}

function qualifyingOrcidWork(work, queryTokens, authorQuery, exactOrcid) {
  if (authorQuery || exactOrcid) return true;
  if (!queryTokens.length) return false;
  const textTokens = orcidSearchTokens([
    work.title,
    work.journal,
    work.publisher
  ].filter(Boolean).join(" "));
  const overlap = queryTokens.filter(token => textTokens.includes(token)).length;
  if (queryTokens.length <= 2) return overlap >= 1;
  return overlap >= 2 || overlap / queryTokens.length >= 0.5;
}

export async function searchOrcid(expansion, options = {}) {
  const query = typeof expansion === "string"
    ? expansion
    : expansion?.query;
  const queryWeight = typeof expansion === "string"
    ? 1
    : (expansion?.weight ?? 1);
  const queryType = typeof expansion === "string"
    ? "unknown"
    : (expansion?.type || "unknown");
  const cleanedQuery = String(query || "").trim();
  if (!cleanedQuery) return [];

  const rows = Math.max(1, Math.min(20, Number(options.rows) || 6));
  const page = Math.max(1, Number(options.page) || 1);
  const profilesPerPage = Math.max(
    1,
    Math.min(4, Number(options.profilesPerPage) || 2)
  );
  const exactOrcid = embeddedOrcid(cleanedQuery);
  const queryTokens = orcidSearchTokens(cleanedQuery);
  const searchProfilesImpl = options.searchProfilesImpl || searchOrcidProfiles;
  const worksImpl = options.worksImpl || fetchOrcidPublicWorks;
  const profileImpl = options.profileImpl || fetchOrcidPublicProfile;

  let profiles;
  if (exactOrcid) {
    let profile = null;
    try {
      profile = await profileImpl(exactOrcid, {
        signal: options.signal,
        fetchImpl: options.fetchImpl,
        apiBase: options.apiBase
      });
    } catch {
      // Exact ORCID remains enough to read its public works.
    }
    profiles = [{
      orcid: exactOrcid,
      displayName: profile?.displayName || exactOrcid,
      givenNames: profile?.givenName || null,
      familyName: profile?.familyName || null,
      creditName: profile?.creditName || null,
      institutions: (profile?.employments || [])
        .map(item => item.organization)
        .filter(Boolean)
    }];
  } else {
    profiles = await searchProfilesImpl(cleanedQuery, {
      start: (page - 1) * profilesPerPage,
      rows: profilesPerPage,
      signal: options.signal,
      fetchImpl: options.fetchImpl,
      apiBase: options.apiBase
    });
  }

  const settled = await Promise.allSettled(
    profiles.map(async profile => {
      const response = await worksImpl(profile.orcid, {
        displayName: profile.displayName,
        signal: options.signal,
        fetchImpl: options.fetchImpl,
        apiBase: options.apiBase
      });
      return {
        profile,
        works: response?.works || []
      };
    })
  );

  const successful = settled
    .filter(state => state.status === "fulfilled")
    .map(state => state.value);

  if (!successful.length && settled.some(state => state.status === "rejected")) {
    const failure = settled.find(state => state.status === "rejected");
    throw failure.reason;
  }

  const candidates = [];
  for (const { profile, works } of successful) {
    const authorQuery = profileMatchesAuthorQuery(profile, queryTokens);

    for (const work of works) {
      if (!qualifyingOrcidWork(work, queryTokens, authorQuery, Boolean(exactOrcid))) {
        continue;
      }

      const searchScore = authorQuery || exactOrcid
        ? 1
        : orcidWorkSearchScore(work, queryTokens);

      candidates.push({
        ...work,
        authors: (work.authors || []).map((author, index) =>
          index === 0
            ? {
                ...author,
                name: profile.displayName || author.name,
                id: "https://orcid.org/" + profile.orcid,
                orcid: "https://orcid.org/" + profile.orcid
              }
            : author
        ),
        matchedQueries: [
          ...(work.matchedQueries || []),
          {
            query: cleanedQuery,
            weight: queryWeight,
            type: queryType,
            provider: "ORCID",
            score: searchScore
          }
        ],
        retrievalMode: "orcid-registry-search",
        orcidSearch: {
          profile: profile.orcid,
          displayName: profile.displayName,
          institutions: profile.institutions || [],
          authorQuery,
          score: searchScore
        }
      });
    }
  }

  candidates.sort((a, b) =>
    Number(b.orcidSearch?.score || 0) - Number(a.orcidSearch?.score || 0) ||
    Number(b.year || 0) - Number(a.year || 0) ||
    String(a.title || "").localeCompare(String(b.title || ""), "es")
  );

  if (exactOrcid) {
    const offset = (page - 1) * rows;
    return candidates.slice(offset, offset + rows);
  }

  return candidates.slice(0, rows);
}
