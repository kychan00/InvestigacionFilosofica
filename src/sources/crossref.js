const CROSSREF_BASE =
  "https://api.crossref.org/v1/works";


function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


function normalizeDoi(doi) {
  if (!doi) {
    return null;
  }

  return String(doi)
    .replace(
      /^https?:\/\/doi\.org\//i,
      ""
    )
    .replace(
      /^doi:/i,
      ""
    )
    .trim()
    .toLowerCase() || null;
}


function firstString(value) {
  if (
    Array.isArray(value)
  ) {
    return value[0] || null;
  }

  return value || null;
}


function normalizeAuthors(
  authors = []
) {
  return authors
    .map(author => {
      const name = [
        author.given,
        author.family
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!name) {
        return null;
      }

      return {
        id:
          author.ORCID ||
          null,

        name
      };
    })
    .filter(Boolean);
}


function extractYear(item) {
  const candidates = [
    item.published,
    item["published-print"],
    item["published-online"],
    item.issued,
    item.created
  ];

  for (const value of candidates) {
    const year =
      value?.["date-parts"]
        ?.[0]?.[0];

    if (
      Number.isInteger(year)
    ) {
      return year;
    }
  }

  return null;
}


function normalizeIsbn(
  isbn = []
) {
  return [
    ...new Set(
      isbn
        .map(String)
        .map(
          value =>
            value.replace(
              /[-\s]/g,
              ""
            )
        )
        .filter(Boolean)
    )
  ];
}


function decodeXmlEntities(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, hex) => {
        try {
          return String.fromCodePoint(
            parseInt(
              hex,
              16
            )
          );
        } catch {
          return "";
        }
      }
    )
    .replace(
      /&#([0-9]+);/g,
      (_, decimal) => {
        try {
          return String.fromCodePoint(
            parseInt(
              decimal,
              10
            )
          );
        } catch {
          return "";
        }
      }
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&apos;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&amp;/gi,
      "&"
    );
}


function cleanCrossrefAbstract(
  value
) {
  if (!value) {
    return null;
  }


  let text =
    String(value)
      .replace(
        /<!\[CDATA\[([\s\S]*?)\]\]>/gi,
        "$1"
      );


  /*
   * Algunos registros devuelven el
   * markup XML codificado como entidades.
   */
  text =
    decodeXmlEntities(
      text
    );


  /*
   * Crossref puede entregar abstracts
   * JATS como:
   *
   * <jats:p>Texto...</jats:p>
   * <jats:italic>...</jats:italic>
   *
   * Conservamos el contenido y quitamos
   * únicamente el markup.
   */
  text =
    text
      .replace(
        /<[^>]*>/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  return text || null;
}


export function normalizeCrossrefWork(
  item,
  context = {}
) {
  const doi =
    normalizeDoi(
      item.DOI
    );

  const url =
    item.URL ||
    (
      doi
        ? `https://doi.org/${doi}`
        : null
    );

  return {
    /*
     * El ID de Crossref queda separado
     * del ID de OpenAlex.
     *
     * merge-results.js fusionará por DOI
     * cuando ambas fuentes describan
     * el mismo trabajo.
     */
    id:
      doi
        ? `crossref:${doi}`
        : (
            item.URL
              ? `crossref:${item.URL}`
              : null
          ),

    title:
      firstString(
        item.title
      ) || "",

    authors:
      normalizeAuthors(
        item.author || []
      ),

    year:
      extractYear(item),

    type:
      item.type || null,

    language:
      item.language || null,

    doi,

    isbn:
      normalizeIsbn(
        item.ISBN || []
      ),

    journal:
      firstString(
        item["container-title"]
      ),

    publisher:
      item.publisher ||
      null,

    abstract:
      cleanCrossrefAbstract(
        item.abstract
      ),

    /*
     * Crossref no ofrece un equivalente
     * directamente comparable al
     * cited_by_count de OpenAlex.
     *
     * No mezclamos métricas distintas.
     */
    citedBy:
      null,

    openAccess:
      null,

    /*
     * Crossref no tiene los topics de
     * OpenAlex en esta respuesta.
     */
    topics: [],

    philosophers: [],
    traditions: [],

    providers: [
      "Crossref"
    ],

    sourceRecords: [
      {
        provider:
          "Crossref",

        sourceId:
          doi ||
          item.URL ||
          null,

        rank:
          context.rank ??
          null,

        query:
          context.query ||
          null,

        queryWeight:
          context.queryWeight ??
          null,

        queryType:
          context.queryType ||
          null
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
        url,

      doi:
        doi
          ? `https://doi.org/${doi}`
          : null,

      openAccess:
        null
    },

    institutionalLinks: []
  };
}


function buildUrl(
  query,
  options = {}
) {
  const {
    rows = 10,
    offset = 0,
    mailto = null
  } = options;

  const url =
    new URL(
      CROSSREF_BASE
    );

  url.searchParams.set(
    "query.bibliographic",
    query
  );

  url.searchParams.set(
    "rows",
    String(rows)
  );

  url.searchParams.set(
    "offset",
    String(offset)
  );

  if (mailto) {
    url.searchParams.set(
      "mailto",
      mailto
    );
  }

  return url;
}


async function fetchWithRetry(
  url,
  options = {}
) {
  const {
    retries = 2,
    signal
  } = options;

  for (
    let attempt = 0;
    attempt <= retries;
    attempt++
  ) {
    let response;

    try {
      response =
        await fetch(
          url,
          {
            method: "GET",

            headers: {
              Accept:
                "application/json"
            },

            signal,

            mode: "cors"
          }
        );
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        throw error;
      }

      if (
        attempt === retries
      ) {
        throw new Error(
          `Crossref network/CORS error: ${
            error?.message ||
            "Failed to fetch"
          }`
        );
      }

      await sleep(
        1000 *
        (attempt + 1)
      );

      continue;
    }


    if (response.ok) {
      return response;
    }


    const retryable =
      response.status === 429 ||
      response.status >= 500;


    if (
      !retryable ||
      attempt === retries
    ) {
      let detail = "";

      try {
        detail =
          await response.text();
      } catch {
        // Sin detalle accesible.
      }

      throw new Error(
        `Crossref HTTP ${response.status}` +
        (
          detail
            ? `: ${detail.slice(0, 180)}`
            : ""
        )
      );
    }


    const retryAfter =
      response.headers.get(
        "retry-after"
      );


    const waitMs =
      retryAfter &&
      Number.isFinite(
        Number(retryAfter)
      )
        ? Number(retryAfter) *
          1000
        : 1500 *
          (attempt + 1);


    await sleep(waitMs);
  }


  throw new Error(
    "Crossref request failed"
  );
}


export async function searchCrossref(
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

  const items =
    data?.message?.items ||
    [];

  return items.map(
    (item, index) =>
      normalizeCrossrefWork(
        item,
        {
          query,
          queryWeight,
          queryType,
          rank:
            index + 1
        }
      )
  );
}
