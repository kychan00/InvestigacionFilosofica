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

  const requestedOrcid =
    normalizeOrcid(author.orcid || identity?.orcid);

  const key = requestedOrcid || normalizeOrcid(identity?.orcid);
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
