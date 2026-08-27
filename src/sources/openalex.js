const OPENALEX_BASE = "https://api.openalex.org/works";

let openAlexCooldownUntil = 0;

const OPENALEX_COOLDOWN_MS =
  60_000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildUrl(query, options = {}) {
  const {
    perPage = 10,
    page = 1
  } = options;

  const url = new URL(OPENALEX_BASE);

  url.searchParams.set(
    "search",
    query
  );

  url.searchParams.set(
    "per-page",
    String(perPage)
  );

  url.searchParams.set(
    "page",
    String(page)
  );

  return url;
}

function normalizeDoi(doi) {
  if (!doi) {
    return null;
  }

  return String(doi)
    .replace(/^https?:\/\/doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .trim()
    .toLowerCase() || null;
}

function normalizeAuthors(authorships = []) {
  return authorships
    .map(item => {
      const author = item.author;

      if (!author?.display_name) {
        return null;
      }

      return {
        id: author.id || null,
        name: author.display_name
      };
    })
    .filter(Boolean);
}

function normalizeTopics(topics = []) {
  return topics
    .map(topic => ({
      id: topic.id || null,
      name: topic.display_name || null,
      score: topic.score ?? null
    }))
    .filter(topic => topic.name);
}

function normalizeOpenAlexWork(work, context = {}) {
  const primaryLocation =
    work.primary_location || {};

  const source =
    primaryLocation.source || {};

  const bestOpenAccessUrl =
    work.best_oa_location?.landing_page_url ||
    work.best_oa_location?.pdf_url ||
    null;

  return {
    id: work.id || null,

    title:
      work.display_name ||
      work.title ||
      "",

    authors:
      normalizeAuthors(
        work.authorships || []
      ),

    year:
      work.publication_year ?? null,

    type:
      work.type || null,

    language:
      work.language || null,

    doi:
      normalizeDoi(work.doi),

    isbn: [],

    journal:
      source.display_name || null,

    publisher:
      source.host_organization_name ||
      null,

    abstract:
      null,

    citedBy:
      work.cited_by_count ?? null,

    openAccess:
      work.open_access
        ? {
            isOpen:
              work.open_access.is_oa ??
              false,

            status:
              work.open_access.oa_status ??
              null,

            url:
              work.open_access.oa_url ||
              bestOpenAccessUrl
          }
        : null,

    topics:
      normalizeTopics(
        work.topics || []
      ),

    philosophers: [],
    traditions: [],

    providers: [
      "OpenAlex"
    ],

    sourceRecords: [
      {
        provider:
          "OpenAlex",

        sourceId:
          work.id || null,

        rank:
          context.rank ?? null,

        query:
          context.query || null,

        queryWeight:
          context.queryWeight ?? null,

        queryType:
          context.queryType || null
      }
    ],

    matchedQueries:
      context.query
        ? [
            {
              query:
                context.query,

              weight:
                context.queryWeight ??
                null,

              type:
                context.queryType ||
                null
            }
          ]
        : [],

    relevanceScore: 0,

    relevanceLevel: null,

    metadataConfidence: 0,

    urls: {
      canonical:
        work.id || null,

      doi:
        work.doi || null,

      openAccess:
        bestOpenAccessUrl
    },

    institutionalLinks: []
  };
}

function openAlexRateLimitError() {
  const error =
    new Error(
      "OpenAlex temporalmente limitado (HTTP 429). " +
      "La búsqueda continuará con las demás fuentes."
    );

  error.code =
    "OPENALEX_RATE_LIMITED";

  error.status =
    429;

  return error;
}


async function fetchWithRetry(
  url,
  options = {}
) {
  const {
    retries = 1,
    signal
  } = options;


  /*
   * Circuit breaker:
   * después de un 429 evitamos golpear
   * repetidamente OpenAlex durante
   * la misma sesión.
   */
  if (
    Date.now() <
    openAlexCooldownUntil
  ) {
    throw openAlexRateLimitError();
  }


  for (
    let attempt = 0;
    attempt <= retries;
    attempt++
  ) {
    if (
      signal?.aborted
    ) {
      throw new DOMException(
        "Search aborted",
        "AbortError"
      );
    }


    const response =
      await fetch(
        url,
        {
          signal,

          headers: {
            Accept:
              "application/json"
          }
        }
      );


    if (
      response.ok
    ) {
      return response;
    }


    /*
     * Un 429 probablemente no se arregla
     * golpeando inmediatamente la API
     * cinco veces más.
     */
    if (
      response.status === 429
    ) {
      const retryAfter =
        Number(
          response.headers.get(
            "retry-after"
          )
        );


      const waitMs =
        Number.isFinite(
          retryAfter
        ) &&
        retryAfter > 0
          ? retryAfter * 1000
          : 1500;


      /*
       * Ponemos un cooldown mínimo de
       * 60 segundos.
       */
      openAlexCooldownUntil =
        Date.now() +
        Math.max(
          OPENALEX_COOLDOWN_MS,
          waitMs
        );


      /*
       * Sólo hacemos un reintento si
       * OpenAlex pide una espera corta.
       */
      if (
        attempt < retries &&
        waitMs <= 2500
      ) {
        await sleep(
          waitMs
        );

        continue;
      }


      throw openAlexRateLimitError();
    }


    /*
     * Errores temporales del servidor:
     * un reintento corto.
     */
    if (
      response.status >= 500 &&
      attempt < retries
    ) {
      await sleep(
        800 *
        (
          attempt + 1
        )
      );

      continue;
    }


    throw new Error(
      `OpenAlex HTTP ${response.status}`
    );
  }


  throw new Error(
    "OpenAlex request failed"
  );
}


export async function searchOpenAlex(
  expansion,
  options = {}
) {
  const query =
    typeof expansion === "string"
      ? expansion
      : expansion.query;

  const queryWeight =
    typeof expansion === "string"
      ? 1
      : expansion.weight;

  const queryType =
    typeof expansion === "string"
      ? "unknown"
      : expansion.type;

  const url =
    buildUrl(
      query,
      options
    );

  const response =
    await fetchWithRetry(
      url,
      options
    );

  const data =
    await response.json();

  const works =
    data.results || [];

  return works.map(
    (work, index) =>
      normalizeOpenAlexWork(
        work,
        {
          query,
          queryWeight,
          queryType,
          rank: index + 1
        }
      )
  );
}
