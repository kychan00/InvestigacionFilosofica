
import {
  resultIdentityKey
} from "./merge-results.js";

import {
  assertRelatedWorkEdge
} from "./related-work-contract.js";

import {
  fetchSnapshotAuthorWorksById,
  AUTHOR_INDEX_RUNTIME_REVISION
} from "./remote-author-resolution.js";


export const RESEARCH_ATLAS_RUNTIME_RELATED_REVISION =
  "2026-11-07.ra10-authority-l1-v1";


function array(value) {
  return Array.isArray(value)
    ? value
    : value == null
      ? []
      : [value];
}


function normalizeOpenAlexAuthorId(value) {
  return String(value || "")
    .match(
      /(?:openalex\.org\/A|^A?)(\d+)$/i
    )?.[1] || null;
}


function normalizeOpenAlexWorkId(value) {
  return String(value || "")
    .match(
      /(?:openalex\.org\/W|^W?)(\d+)$/i
    )?.[1] || null;
}


function openAlexWorkIdFromResult(
  result
) {
  const candidates = [
    result?.openalexId,
    result?.openalex_id,
    result?.id,
    result?.urls?.canonical,
    result?.urls?.landing,
    ...array(
      result?.sourceRecords
    ).map(
      item =>
        item?.sourceId
    )
  ];

  for (
    const candidate of
    candidates
  ) {
    const id =
      normalizeOpenAlexWorkId(
        candidate
      );

    if (id) {
      return id;
    }
  }

  return null;
}


function normalizeOrcid(value) {
  const normalized =
    String(value || "")
      .replace(
        /^https?:\/\/orcid\.org\//i,
        ""
      )
      .trim()
      .toUpperCase();

  return /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/
    .test(normalized)
      ? normalized
      : null;
}


function uniqueStrings(values = []) {
  return [
    ...new Set(
      array(values)
        .map(value =>
          String(value || "")
            .trim()
        )
        .filter(Boolean)
    )
  ].sort();
}


function fnv1a64(value) {
  let hash =
    0xcbf29ce484222325n;

  const prime =
    0x100000001b3n;

  for (
    const byte of
    new TextEncoder().encode(
      String(value || "")
    )
  ) {
    hash ^=
      BigInt(byte);

    hash =
      BigInt.asUintN(
        64,
        hash *
          prime
      );
  }

  return hash
    .toString(16)
    .padStart(16, "0");
}


function stableId(
  prefix,
  value
) {
  return (
    prefix +
    ":" +
    fnv1a64(
      value
    )
  );
}


function authorityRefForAuthor(
  author,
  authorityGraph
) {
  const registry =
    authorityGraph
      ?.identifierRegistry ||
    {};

  const refs = [];

  const openAlexId =
    normalizeOpenAlexAuthorId(
      author?.id ||
      author?.openalexId ||
      author?.openAlexId
    );

  const orcid =
    normalizeOrcid(
      author?.orcid ||
      author?.o
    );

  if (
    openAlexId
  ) {
    refs.push(
      registry[
        "openalex-author:" +
        openAlexId
      ]
    );
  }

  if (
    orcid
  ) {
    refs.push(
      registry[
        "orcid:" +
        orcid
      ]
    );
  }

  const resolved =
    uniqueStrings(
      refs
    );

  return resolved.length ===
    1
      ? resolved[0]
      : null;
}


function exactAuthor(
  author,
  authorityGraph
) {
  const openAlexId =
    normalizeOpenAlexAuthorId(
      author?.id ||
      author?.openalexId ||
      author?.openAlexId
    );

  if (!openAlexId) {
    return null;
  }

  const authorityRef =
    authorityRefForAuthor(
      author,
      authorityGraph
    );

  if (!authorityRef) {
    return null;
  }

  return {
    openAlexId,
    authorityRef,
    name:
      String(
        author?.name ||
        author?.displayName ||
        "A" +
        openAlexId
      ).trim(),
    orcid:
      normalizeOrcid(
        author?.orcid ||
        author?.o
      )
  };
}


function canonicalIdentityByOpenAlex(
  searchResponse
) {
  const map =
    new Map();

  for (
    const result of
    array(
      searchResponse
        ?.results
    )
  ) {
    const workId =
      openAlexWorkIdFromResult(
        result
      );

    if (!workId) {
      continue;
    }

    map.set(
      workId,
      resultIdentityKey(
        result
      )
    );
  }

  return map;
}


async function fetchInBatches(
  authors,
  {
    fetchAuthorWorksImpl,
    signal,
    worksPerAuthor,
    concurrency
  }
) {
  const output =
    new Map();

  for (
    let offset = 0;
    offset <
      authors.length;
    offset +=
      concurrency
  ) {
    if (
      signal?.aborted
    ) {
      throw new DOMException(
        "Authority L1 aborted",
        "AbortError"
      );
    }

    const batch =
      authors.slice(
        offset,
        offset +
          concurrency
      );

    const rows =
      await Promise.all(
        batch.map(
          async author => {
            const works =
              await fetchAuthorWorksImpl(
                {
                  id:
                    "https://openalex.org/A" +
                    author.openAlexId,
                  name:
                    author.name,
                  orcid:
                    author.orcid
                },
                {
                  signal,
                  limit:
                    worksPerAuthor
                }
              );

            return [
              author.openAlexId,
              array(works)
            ];
          }
        )
      );

    for (
      const [
        authorId,
        works
      ] of rows
    ) {
      output.set(
        authorId,
        works
      );
    }
  }

  return output;
}


function relatedEdge(
  seedIdentity,
  targetIdentity,
  authorityRefs
) {
  const refs =
    uniqueStrings(
      authorityRefs
    );

  const evidenceId =
    stableId(
      "evidence:authority-l1",
      seedIdentity +
      "|" +
      targetIdentity +
      "|" +
      refs.join("|")
    );

  const edge = {
    schemaVersion:
      "related-work-v1",
    id:
      stableId(
        "rw:authority-l1",
        seedIdentity +
        "|" +
        targetIdentity
      ),
    seed: {
      identity:
        seedIdentity
    },
    target: {
      identity:
        targetIdentity
    },
    relationTypes: [
      "same-author"
    ],
    signals: {
      author:
        1
    },
    evidence: [
      {
        id:
          evidenceId,
        class:
          "bibliographic",
        strength:
          "strong",
        source:
          "author-index-v3 + author-authority-graph-v1",
        structuredIdentity:
          true,
        authorityRefs:
          refs
      }
    ],
    reasons: [
      {
        code:
          "same-author",
        relationType:
          "same-author",
        evidenceRefs: [
          evidenceId
        ]
      }
    ],
    identity: {
      sameIntellectualWork:
        false
    }
  };

  assertRelatedWorkEdge(
    edge
  );

  return edge;
}


function documentForTarget(
  work
) {
  return {
    id:
      work.id,
    title:
      work.title,
    authors:
      array(
        work.authors
      ),
    year:
      work.year ??
      null,
    language:
      work.language ||
      null,
    type:
      work.type ||
      null,
    providers:
      array(
        work.providers
      ).length
        ? array(
            work.providers
          )
        : [
            "OpenAlex Philosophy"
          ],
    source:
      "OpenAlex Philosophy",
    urls:
      {
        ...(
          work.urls ||
          {}
        )
      }
  };
}


export async function buildResearchAtlasAuthorityL1Responses(
  searchResponse,
  authorityGraph,
  {
    signal = null,
    maxSeeds = 6,
    maxAuthorsPerSeed = 2,
    worksPerAuthor = 8,
    maxNeighborsPerSeed = 3,
    maxUniqueAuthors = 12,
    concurrency = 4,
    fetchAuthorWorksImpl =
      fetchSnapshotAuthorWorksById
  } = {}
) {
  const results =
    array(
      searchResponse?.results
    );

  const directByWorkId =
    canonicalIdentityByOpenAlex(
      searchResponse
    );

  const seedEntries =
    results
      .map(
        result => ({
          result,
          canonicalIdentity:
            resultIdentityKey(
              result
            ),
          openAlexWorkId:
            openAlexWorkIdFromResult(
              result
            ),
          authors:
            array(
              result?.authors
            )
              .map(
                author =>
                  exactAuthor(
                    author,
                    authorityGraph
                  )
              )
              .filter(Boolean)
              .slice(
                0,
                Math.max(
                  0,
                  maxAuthorsPerSeed
                )
              )
        })
      )
      .filter(
        item =>
          item.openAlexWorkId &&
          item.authors.length
      )
      .slice(
        0,
        Math.max(
          0,
          maxSeeds
        )
      );

  const uniqueAuthorMap =
    new Map();

  for (
    const seed of
    seedEntries
  ) {
    for (
      const author of
      seed.authors
    ) {
      if (
        uniqueAuthorMap.size >=
          maxUniqueAuthors &&
        !uniqueAuthorMap.has(
          author.openAlexId
        )
      ) {
        continue;
      }

      uniqueAuthorMap.set(
        author.openAlexId,
        author
      );
    }
  }

  const authorWorks =
    await fetchInBatches(
      [
        ...uniqueAuthorMap
          .values()
      ],
      {
        fetchAuthorWorksImpl,
        signal,
        worksPerAuthor:
          Math.max(
            1,
            Math.min(
              20,
              Number(
                worksPerAuthor
              ) ||
              8
            )
          ),
        concurrency:
          Math.max(
            1,
            Math.min(
              6,
              Number(
                concurrency
              ) ||
              4
            )
          )
      }
    );

  const responses = [];

  for (
    const seed of
    seedEntries
  ) {
    const candidates =
      new Map();

    for (
      const author of
      seed.authors
    ) {
      const works =
        authorWorks.get(
          author.openAlexId
        ) ||
        [];

      for (
        const work of
        works
      ) {
        const targetWorkId =
          openAlexWorkIdFromResult(
            work
          );

        if (
          !targetWorkId ||
          targetWorkId ===
            seed.openAlexWorkId
        ) {
          continue;
        }

        const targetIdentity =
          directByWorkId.get(
            targetWorkId
          ) ||
          (
            "openalex:w" +
            targetWorkId
          );

        const previous =
          candidates.get(
            targetIdentity
          ) ||
          {
            targetIdentity,
            work,
            authorityRefs:
              new Set()
          };

        previous
          .authorityRefs
          .add(
            author.authorityRef
          );

        candidates.set(
          targetIdentity,
          previous
        );
      }
    }

    const selected =
      [
        ...candidates
          .values()
      ]
        .sort(
          (
            left,
            right
          ) =>
            right
              .authorityRefs
              .size -
              left
                .authorityRefs
                .size ||
            Number(
              right.work
                ?.year ||
              0
            ) -
            Number(
              left.work
                ?.year ||
              0
            ) ||
            String(
              left.targetIdentity
            ).localeCompare(
              String(
                right.targetIdentity
              )
            )
        )
        .slice(
          0,
          Math.max(
            0,
            maxNeighborsPerSeed
          )
        );

    const edges =
      selected.map(
        item =>
          relatedEdge(
            seed.canonicalIdentity,
            item.targetIdentity,
            [
              ...item
                .authorityRefs
            ]
          )
      );

    const items =
      selected.map(
        (
          item,
          index
        ) => ({
          edge: {
            id:
              edges[index]
                .id
          },
          document:
            directByWorkId.has(
              openAlexWorkIdFromResult(
                item.work
              )
            )
              ? null
              : documentForTarget(
                  item.work
                )
        })
      );

    responses.push({
      schemaVersion:
        "related-work-response-v1",
      seed: {
        identity:
          seed.canonicalIdentity
      },
      coverage: {
        indexed:
          true,
        partial:
          true,
        reason:
          "author-index-v3-authority-l1"
      },
      provenance: {
        indexSchema:
          "authority-l1-runtime-v1",
        generatorVersion:
          RESEARCH_ATLAS_RUNTIME_RELATED_REVISION,
        indexRevision:
          AUTHOR_INDEX_RUNTIME_REVISION +
          ":authority-l1",
        source: {
          authorIndexRevision:
            AUTHOR_INDEX_RUNTIME_REVISION,
          authorityGraphRevision:
            authorityGraph
              ?.buildRevision ||
            null
        }
      },
      edges,
      items
    });
  }

  return {
    revision:
      RESEARCH_ATLAS_RUNTIME_RELATED_REVISION,
    responses,
    diagnostics: {
      seedsConsidered:
        seedEntries.length,
      uniqueAuthorsFetched:
        uniqueAuthorMap.size,
      responses:
        responses.length,
      relatedEdges:
        responses.reduce(
          (
            sum,
            response
          ) =>
            sum +
            response.edges.length,
          0
        )
    }
  };
}
