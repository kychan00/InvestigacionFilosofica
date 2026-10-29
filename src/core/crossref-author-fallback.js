import {
  authorNameSignature
} from "./remote-author-resolution.js?v=20261029-author-reliability-v1";

import {
  searchCrossref
} from "../sources/crossref.js";


function normalizeOrcid(value) {
  return String(value || "")
    .replace(/^https?:\/\/orcid\.org\//i, "")
    .trim()
    .toUpperCase();
}


function matchingAuthor(
  authors,
  expectedName,
  expectedOrcid
) {
  const expectedSignature =
    authorNameSignature(expectedName);
  const orcid =
    normalizeOrcid(expectedOrcid);

  return (authors || []).find(author => {
    const authorOrcid =
      normalizeOrcid(author?.id);
    const sameOrcid =
      Boolean(orcid) &&
      authorOrcid === orcid;
    const sameName =
      Boolean(expectedSignature) &&
      authorNameSignature(author?.name) ===
        expectedSignature;

    if (
      orcid &&
      authorOrcid &&
      authorOrcid !== orcid
    ) {
      return false;
    }

    return sameOrcid || sameName;
  }) || null;
}


export async function resolveCrossrefAuthor(
  name,
  options = {}
) {
  const displayName = String(name || "")
    .trim();

  if (!displayName) {
    return {
      status: "none",
      works: []
    };
  }

  const searchImpl =
    options.searchImpl ||
    searchCrossref;
  const works = await searchImpl(
    {
      query: displayName,
      weight: 1,
      type: "author"
    },
    {
      rows:
        options.limit || 50,
      signal: options.signal,
      retries: 1
    }
  );
  const matches = [];
  let identity = null;

  for (const work of works || []) {
    const author = matchingAuthor(
      work.authors,
      displayName,
      options.orcid
    );

    if (!author) {
      continue;
    }

    if (
      !identity ||
      (
        !identity.id &&
        author.id
      )
    ) {
      identity = author;
    }
    matches.push(work);
  }

  if (!matches.length) {
    return {
      status: "none",
      works: []
    };
  }

  const orcid =
    options.orcid ||
    identity?.id ||
    null;

  return {
    status: "resolved",
    resolution: "crossref-author",
    author: {
      id: null,
      displayName:
        identity?.name ||
        displayName,
      sourceDisplayName:
        identity?.name ||
        displayName,
      orcid,
      wikidataId: null,
      biography: null,
      wikipediaUrl: null,
      corpusWorks:
        matches.length,
      catalog: "federated"
    },
    works: matches.map((work, index) => ({
      ...work,
      authors: (work.authors || []).map(author => {
        const match = matchingAuthor(
          [author],
          displayName,
          orcid
        );

        if (!match || author.id || !orcid) {
          return author;
        }

        return {
          ...author,
          id: orcid
        };
      }),
      relevanceScore:
        Math.max(
          90,
          100 - index * 0.2
        ),
      relevanceLevel: "Autor",
      retrievalMode:
        "author-crossref",
      authorIdentity: {
        exact: true,
        orcid:
          normalizeOrcid(orcid) ||
          null
      }
    }))
  };
}

