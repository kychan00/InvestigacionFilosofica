export const SEMANTIC_API_ORIGIN =
  "https://filosofia-semantic.tail829c9b.ts.net";


export class SemanticApiError extends Error {
  constructor(
    message,
    {
      status = null,
      retryAfter = null
    } = {}
  ) {
    super(message);
    this.name = "SemanticApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}


export async function checkPublicSemanticHealth(
  {
    signal,
    fetchImpl = globalThis.fetch
  } = {}
) {
  if (
    typeof fetchImpl !==
    "function"
  ) {
    throw new SemanticApiError(
      "El navegador no dispone de fetch."
    );
  }

  let response;

  try {
    response =
      await fetchImpl(
        `${SEMANTIC_API_ORIGIN}/health`,
        {
          method:
            "GET",
          headers: {
            Accept:
              "application/json"
          },
          signal
        }
      );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw error;
    }

    throw new SemanticApiError(
      "El servidor semántico no está disponible."
    );
  }

  if (!response.ok) {
    throw new SemanticApiError(
      `El servidor semántico respondió HTTP ${response.status}.`,
      {
        status:
          response.status,
        retryAfter:
          response.headers.get(
            "Retry-After"
          )
      }
    );
  }

  let payload;

  try {
    payload =
      await response.json();
  } catch {
    throw new SemanticApiError(
      "El estado del servidor semántico no es válido."
    );
  }

  const documents =
    Number(
      payload?.documents
    );

  if (
    payload?.status !==
      "ready" ||
    !Number.isFinite(
      documents
    )
  ) {
    throw new SemanticApiError(
      "El índice semántico todavía no está listo.",
      {
        status:
          503
      }
    );
  }

  return {
    status:
      "ready",
    documents:
      Math.max(
        0,
        Math.trunc(
          documents
        )
      ),
    indexBuildId:
      payload.index_build_id ||
      null,
    rerankerAvailable:
      Boolean(
        payload.reranker_available
      ),
    presentationHygieneAvailable:
      Boolean(
        payload.presentation_hygiene_available
      )
  };
}


function normalizedAuthors(authors) {
  return (authors || [])
    .map(
      author => {
        if (
          author &&
          typeof author === "object"
        ) {
          return author;
        }

        const name =
          String(author || "")
            .trim();

        return name
          ? {
              name
            }
          : null;
      }
    )
    .filter(Boolean);
}


function normalizedTopics(topics) {
  return (topics || [])
    .map(
      topic => {
        if (
          topic &&
          typeof topic === "object"
        ) {
          return topic;
        }

        const name =
          String(topic || "")
            .trim();

        return name
          ? {
              name
            }
          : null;
      }
    )
    .filter(Boolean);
}


function percentage(score) {
  const value =
    Number(score);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(
    Math.max(
      0,
      Math.min(
        1,
        value
      )
    ) * 100
  );
}


export function normalizeSemanticResult(
  item,
  query
) {
  const source =
    String(
      item.source ||
      "Corpus propio"
    );

  const semanticScore =
    Number.isFinite(
      Number(item.semantic_score)
    )
      ? Number(item.semantic_score)
      : null;

  const relevanceScore =
    percentage(
      semanticScore
    );

  const doiUrl =
    item.doi
      ? `https://doi.org/${item.doi}`
      : null;

  const display =
    item.display &&
    typeof item.display ===
      "object"
      ? item.display
      : {};

  const workIdentity =
    item.work_identity &&
    typeof item.work_identity ===
      "object"
      ? item.work_identity
      : {};

  const identityMembers =
    Array.isArray(
      workIdentity.members
    ) &&
    workIdentity.members.length
      ? workIdentity.members
      : [
          {
            id:
              item.id,
            source_rank:
              item.source_rank ??
              null,
            semantic_score:
              semanticScore,
            lexical_score:
              item.lexical_score ??
              null,
            rerank_score:
              item.rerank_score ??
              null
          }
        ];

  const presentationMemberCount =
    Math.max(
      1,
      Number(
        workIdentity.member_count
      ) || identityMembers.length
    );

  return {
    id:
      item.id,

    title:
      display.title ||
      item.title ||
      "Sin título",

    abstract:
      display.abstract ??
      item.abstract ??
      null,

    authors:
      normalizedAuthors(
        item.authors
      ),

    year:
      item.year ||
      null,

    topics:
      normalizedTopics(
        item.topics
      ),

    keywords:
      item.keywords ||
      [],

    journal:
      item.journal ||
      null,

    language:
      item.language ||
      null,

    doi:
      item.doi ||
      null,

    type:
      item.publication_type ||
      "article",

    providers: [source],

    sourceRecords:
      identityMembers.map(
        member => ({
          provider:
            source,

          sourceId:
            member.id ||
            item.openalex_id ||
            item.crossref_id ||
            item.id,

          query,

          rank:
            member.source_rank ??
            null,

          semanticScore:
            member.semantic_score ??
            null,

          lexicalScore:
            member.lexical_score ??
            null,

          rerankScore:
            member.rerank_score ??
            null
        })
      ),

    urls: {
      canonical:
        item.url ||
        doiUrl,

      doi:
        doiUrl,

      openAccess:
        null
    },

    openAccess: {
      isOpen:
        false
    },

    citedBy:
      null,

    matchedQueries: [
      {
        query,
        weight:
          semanticScore,
        type:
          "semantic"
      }
    ],

    ranking: {
      query:
        relevanceScore,
      philosophy:
        0,
      discipline:
        0,
      consensus:
        0,
      bibliography:
        0,
      impact:
        0
    },

    relevanceScore,
    relevanceLevel:
      "Semántica",
    retrievalMode:
      "semantic",
    semanticScore,
    lexicalScore:
      item.lexical_score ??
      null,
    rerankScore:
      item.rerank_score ??
      null,
    openalexId:
      item.openalex_id ||
      null,
    crossrefId:
      item.crossref_id ||
      null,
    presentationMemberCount,
    presentationCollapsed:
      workIdentity.classification ===
        "exact_identity" &&
      presentationMemberCount > 1,
    presentationRank:
      item.presentation_rank ??
      null,
    sourceRank:
      item.source_rank ??
      null,
    workIdentity: {
      classification:
        workIdentity.classification ||
        "singleton",
      representativeId:
        workIdentity.representative_id ||
        item.id,
      memberIds:
        Array.isArray(
          workIdentity.member_ids
        )
          ? [
              ...workIdentity.member_ids
            ]
          : identityMembers
            .map(
              member =>
                member.id
            )
            .filter(Boolean)
    },
    metadataFindings:
      Array.isArray(
        item.metadata_findings
      )
        ? [
            ...item.metadata_findings
          ]
        : []
  };
}


function emptyParsedQuery() {
  return {
    philosophers: [],
    concepts: [],
    works: [],
    areas: []
  };
}


export function normalizeSemanticResponse(
  payload
) {
  const query =
    String(
      payload.query ||
      ""
    );

  const results =
    (payload.results || [])
      .map(
        item =>
          normalizeSemanticResult(
            item,
            query
          )
      );

  const providers = {};

  for (const item of results) {
    for (
      const provider of
      item.providers
    ) {
      providers[provider] =
        (providers[provider] || 0) +
        1;
    }
  }

  return {
    query,
    parsed:
      emptyParsedQuery(),
    results,
    errors: [],
    stats: {
      unique:
        results.length,
      merged:
        0,
      multiProvider:
        0,
      providers
    },
    searchMode:
      "semantic",
    semantic: {
      candidateCount:
        payload.candidate_count ||
        null,
      rerankerEnabled:
        Boolean(
          payload.reranker_enabled
        ),
      presentation: {
        requested:
          Boolean(
            payload.presentation
              ?.requested
          ),
        available:
          Boolean(
            payload.presentation
              ?.available
          ),
        enabled:
          Boolean(
            payload.presentation
              ?.enabled
          ),
        applied:
          Boolean(
            payload.presentation
              ?.applied
          ),
        fallback:
          Boolean(
            payload.presentation
              ?.fallback
          ),
        sourceResultCount:
          Number(
            payload.presentation
              ?.source_result_count
          ) || results.length,
        presentedResultCount:
          Number(
            payload.presentation
              ?.presented_result_count
          ) || results.length,
        collapsedResultCount:
          Number(
            payload.presentation
              ?.collapsed_result_count
          ) || 0
      },
      mode:
        payload.mode ||
        "semantic"
    }
  };
}


async function responseDetail(
  response
) {
  try {
    const payload =
      await response.json();

    return String(
      payload.detail ||
      ""
    ).trim();
  } catch {
    return "";
  }
}


export async function searchPublicSemantic(
  query,
  {
    limit = 15,
    signal,
    fetchImpl = globalThis.fetch
  } = {}
) {
  if (
    typeof fetchImpl !==
    "function"
  ) {
    throw new SemanticApiError(
      "El navegador no dispone de fetch."
    );
  }

  let response;

  try {
    response =
      await fetchImpl(
        `${SEMANTIC_API_ORIGIN}/api/search/semantic`,
        {
          method:
            "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              query,
              limit:
                Math.max(
                  1,
                  Math.min(
                    20,
                    Number(limit) ||
                    15
                  )
                ),
              filters: {},
              enable_reranker:
                false,
              enable_presentation_hygiene:
                true
            }),
          signal
        }
      );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw error;
    }

    throw new SemanticApiError(
      "El servidor semántico no está disponible."
    );
  }

  if (!response.ok) {
    const detail =
      await responseDetail(
        response
      );

    throw new SemanticApiError(
      detail ||
      `El servidor semántico respondió HTTP ${response.status}.`,
      {
        status:
          response.status,
        retryAfter:
          response.headers.get(
            "Retry-After"
          )
      }
    );
  }

  const payload =
    await response.json();

  if (
    !payload ||
    !Array.isArray(
      payload.results
    )
  ) {
    throw new SemanticApiError(
      "El servidor semántico devolvió una respuesta inválida."
    );
  }

  return normalizeSemanticResponse(
    payload
  );
}
