const OPENALEX_BASE = "https://api.openalex.org/works";

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

async function fetchWithRetry(
  url,
  options = {}
) {
  const {
    retries = 3
  } = options;

  for (
    let attempt = 0;
    attempt <= retries;
    attempt++
  ) {
    const response =
      await fetch(url, {
        headers: {
          Accept:
            "application/json"
        }
      });

    if (response.ok) {
      return response;
    }

    if (
      response.status !== 429 ||
      attempt === retries
    ) {
      throw new Error(
        `OpenAlex HTTP ${response.status}`
      );
    }

    const retryAfter =
      response.headers.get(
        "retry-after"
      );

    const waitMs =
      retryAfter
        ? Number(retryAfter) * 1000
        : 1000 * (attempt + 1);

    await sleep(waitMs);
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
