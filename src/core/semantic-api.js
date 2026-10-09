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

  return {
    id:
      item.id,

    title:
      item.title ||
      "Sin título",

    abstract:
      item.abstract ||
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

    sourceRecords: [
      {
        provider:
          source,

        sourceId:
          item.openalex_id ||
          item.crossref_id ||
          item.id,

        query,

        rank:
          null
      }
    ],

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
      null
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
                false
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
