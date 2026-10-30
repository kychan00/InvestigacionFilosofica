import {
  authorNameSignature
} from "./remote-author-resolution.js?v=20261029-author-reliability-v1";

import {
  searchCrossref
} from "../sources/crossref.js";

import {
  searchInternetArchive
} from "../sources/internet-archive.js";


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


function normalizedText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("und")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function workFingerprint(work) {
  const doi = String(work?.doi || "")
    .replace(/^https?:\/\/doi\.org\//i, "")
    .toLocaleLowerCase("und")
    .trim();

  if (doi) {
    return `doi:${doi}`;
  }

  const isbn = (work?.isbn || [])
    .map(value => String(value).replace(/[-\s]/g, ""))
    .filter(Boolean)
    .sort()
    .join("|");

  if (isbn) {
    return `isbn:${isbn}`;
  }

  return [
    normalizedText(work?.title),
    work?.year || "",
    (work?.authors || [])
      .map(author => authorNameSignature(author?.name))
      .filter(Boolean)
      .sort()
      .join("|")
  ].join("::");
}


function providerLabel(work) {
  return String(
    work?.providers?.[0] ||
    work?.sourceRecords?.[0]?.provider ||
    "Fuente federada"
  );
}


function exactAuthorWorks(
  works,
  displayName,
  expectedOrcid,
  retrievalMode
) {
  return (works || [])
    .map(work => ({
      work,
      author: matchingAuthor(
        work.authors,
        displayName,
        expectedOrcid
      )
    }))
    .filter(entry => entry.author)
    .map(entry => ({
      ...entry.work,
      retrievalMode,
      matchedAuthor: entry.author
    }));
}


function dedupeWorks(works) {
  const unique = new Map();

  for (const work of works) {
    const key = workFingerprint(work);

    if (!key || unique.has(key)) {
      continue;
    }

    unique.set(key, work);
  }

  return [...unique.values()].sort((a, b) =>
    (Number(b.year) || 0) - (Number(a.year) || 0) ||
    String(a.title || "").localeCompare(
      String(b.title || ""),
      "und"
    )
  );
}


async function settledSearch(search) {
  try {
    return {
      status: "fulfilled",
      value: await search()
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    return {
      status: "rejected",
      reason: error
    };
  }
}


export async function resolveFederatedAuthor(
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

  const limit = Math.max(
    1,
    Number(options.limit || 50)
  );
  const searches = [];

  if (!options.disableCrossref) {
    const searchImpl =
      options.crossrefSearchImpl ||
      searchCrossref;

    searches.push(
      settledSearch(async () => ({
        source: "Crossref",
        retrievalMode: "author-crossref",
        works: await searchImpl(
          {
            query: displayName,
            weight: 1,
            type: "author"
          },
          {
            rows: limit,
            signal: options.signal,
            retries: 1
          }
        )
      }))
    );
  }

  if (!options.disableInternetArchive) {
    const searchImpl =
      options.archiveSearchImpl ||
      searchInternetArchive;

    searches.push(
      settledSearch(async () => ({
        source: "Internet Archive",
        retrievalMode:
          "author-internet-archive",
        works: await searchImpl(
          {
            query: displayName,
            weight: 1,
            type: "author"
          },
          {
            rows: limit,
            signal: options.signal,
            retries: 1
          }
        )
      }))
    );
  }

  const settled = await Promise.all(searches);
  const fulfilled = settled
    .filter(result => result.status === "fulfilled")
    .map(result => result.value);

  if (!fulfilled.length) {
    return {
      status: "unavailable",
      works: [],
      errors: settled
        .filter(result => result.status === "rejected")
        .map(result => result.reason?.message || "Error federado")
    };
  }

  const matches = dedupeWorks(
    fulfilled.flatMap(result =>
      exactAuthorWorks(
        result.works,
        displayName,
        options.orcid,
        result.retrievalMode
      )
    )
  );

  if (!matches.length) {
    return {
      status: "none",
      works: []
    };
  }

  const identity = matches
    .map(work => work.matchedAuthor)
    .find(author => author?.id) ||
    matches[0].matchedAuthor;
  const orcid =
    options.orcid ||
    identity?.id ||
    null;
  const catalogSources = [
    ...new Set(matches.map(providerLabel))
  ];

  return {
    status: "resolved",
    resolution: "federated-author",
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
      corpusWorks: matches.length,
      catalog: "federated",
      catalogSources
    },
    works: matches.map((work, index) => {
      const {
        matchedAuthor,
        ...publicWork
      } = work;

      return {
        ...publicWork,
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
        authorIdentity: {
          exact: true,
          orcid:
            normalizeOrcid(orcid) ||
            null
        }
      };
    })
  };
}


export async function resolveCrossrefAuthor(
  name,
  options = {}
) {
  const result = await resolveFederatedAuthor(
    name,
    {
      ...options,
      crossrefSearchImpl:
        options.searchImpl ||
        options.crossrefSearchImpl,
      disableInternetArchive: true
    }
  );

  if (result.status === "resolved") {
    return {
      ...result,
      resolution: "crossref-author"
    };
  }

  return result;
}

