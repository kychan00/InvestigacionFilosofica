import {
  CURATED_AUTHOR_BIBLIOGRAPHIES
} from "../data/curated-author-bibliography.js";
import {
  findCuratedAuthorIdentity
} from "./author-curated-identities.js";

function normalizeOrcid(value) {
  return String(value || "")
    .replace(/^https?:\/\/orcid\.org\//i, "")
    .trim()
    .toUpperCase();
}

function cloneWork(work) {
  return {
    ...work,
    authors: (work.authors || []).map(author => ({...author})),
    isbn: [...(work.isbn || [])],
    topics: (work.topics || []).map(topic => ({...topic})),
    providers: [...(work.providers || [])],
    sourceRecords: (work.sourceRecords || []).map(source => ({...source})),
    matchedQueries: [...(work.matchedQueries || [])],
    urls: {...(work.urls || {})},
    authorIdentity: {...(work.authorIdentity || {})},
    alternativeTitles: [...(work.alternativeTitles || [])]
  };
}

export function getCuratedAuthorBibliography(author = {}) {
  const identity =
    findCuratedAuthorIdentity(
      author.displayName ||
      author.sourceDisplayName ||
      (author.aliases || [])[0] ||
      ""
    );

  const explicitOrcid = normalizeOrcid(author.orcid);
  const curatedOrcid = normalizeOrcid(identity?.orcid);
  const hasExactCatalogId = Boolean(
    String(author.id || "").match(/(?:openalex\.org\/)?A?\d+$/i)
  );

  // An explicit catalogue identity remains authoritative. A matching name
  // alone must never replace an exact ID belonging to a namesake.
  if (hasExactCatalogId && !explicitOrcid) {
    return {author: identity, works: [], source: null};
  }

  if (explicitOrcid && curatedOrcid && explicitOrcid !== curatedOrcid) {
    return {author: identity, works: [], source: null};
  }

  const requestedOrcid = explicitOrcid || curatedOrcid;
  const key = requestedOrcid;
  const works = key ? CURATED_AUTHOR_BIBLIOGRAPHIES[key] : null;

  if (!works?.length) {
    return {
      author: identity,
      works: [],
      source: null
    };
  }

  return {
    author: identity,
    works: works.map(cloneWork),
    source: "Bibliografía verificada"
  };
}
