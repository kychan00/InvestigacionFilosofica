const INTERNET_ARCHIVE_SEARCH =
  "https://archive.org/advancedsearch.php";

const INTERNET_ARCHIVE_DETAILS =
  "https://archive.org/details/";


function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


function firstValue(value) {
  if (
    Array.isArray(value)
  ) {
    return value[0] ?? null;
  }

  return value ?? null;
}


function valuesOf(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return [];
  }

  return Array.isArray(value)
    ? value
    : [value];
}


function decodeEntities(value) {
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


function cleanText(value) {
  const combined =
    valuesOf(value)
      .map(String)
      .join(" ");

  const cleaned =
    decodeEntities(
      combined
    )
      .replace(
        /<[^>]*>/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  return cleaned || null;
}


function normalizeCreators(
  creator
) {
  return valuesOf(
    creator
  )
    .map(cleanText)
    .filter(Boolean)
    .map(name => ({
      id: null,
      name
    }));
}


function normalizeSubjects(
  subject
) {
  return valuesOf(
    subject
  )
    .map(cleanText)
    .filter(Boolean)
    .slice(
      0,
      20
    )
    .map(name => ({
      id: null,
      name,
      score: null
    }));
}


function normalizeIsbn(
  isbn
) {
  return [
    ...new Set(
      valuesOf(isbn)
        .flatMap(
          value =>
            String(value)
              .split(
                /[,;|]/
              )
        )
        .map(
          value =>
            value
              .replace(
                /[-\s]/g,
                ""
              )
              .trim()
        )
        .filter(Boolean)
    )
  ];
}


function normalizeYear(
  item
) {
  const direct =
    Number(
      firstValue(
        item.year
      )
    );

  if (
    Number.isInteger(
      direct
    ) &&
    direct >= 1000 &&
    direct <= 2200
  ) {
    return direct;
  }


  const date =
    String(
      firstValue(
        item.date
      ) || ""
    );


  const match =
    date.match(
      /\b(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})\b/
    );


  return match
    ? Number(
        match[1]
      )
    : null;
}


function normalizeLanguage(
  value
) {
  const language =
    cleanText(
      firstValue(value)
    );

  if (!language) {
    return null;
  }


  const normalized =
    language
      .toLowerCase()
      .trim();


  const aliases = {
    en: "en",
    eng: "en",
    english: "en",

    es: "es",
    spa: "es",
    spanish: "es",
    español: "es",
    espanol: "es",

    fr: "fr",
    fre: "fr",
    fra: "fr",
    french: "fr",

    de: "de",
    ger: "de",
    deu: "de",
    german: "de",

    it: "it",
    ita: "it",
    italian: "it",

    pt: "pt",
    por: "pt",
    portuguese: "pt",

    la: "la",
    lat: "la",
    latin: "la"
  };


  return (
    aliases[normalized] ||
    (
      /^[a-z]{2}$/
        .test(normalized)
        ? normalized
        : null
    )
  );
}


function safeSearchQuery(
  query
) {
  return String(
    query || ""
  )
    .replace(
      /[+\-!(){}\[\]^"~*?:\\/]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


const ARCHIVE_STOPWORDS =
  new Set([
    "a",
    "an",
    "and",
    "the",
    "of",
    "in",
    "on",
    "for",
    "to",
    "with",

    "de",
    "del",
    "la",
    "las",
    "el",
    "los",
    "en",
    "y",
    "por",
    "para",
    "un",
    "una",
    "sobre"
  ]);


function normalizeSearchText(
  value
) {
  return String(
    value || ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function archiveQueryTokens(
  query
) {
  return [
    ...new Set(
      normalizeSearchText(
        query
      )
        .split(" ")
        .filter(
          token =>
            token.length > 1 &&
            !ARCHIVE_STOPWORDS.has(
              token
            )
        )
    )
  ].slice(
    0,
    12
  );
}


function archiveRetrievalScore(
  item,
  query
) {
  const tokens =
    archiveQueryTokens(
      query
    );


  if (!tokens.length) {
    return 0;
  }


  const title =
    normalizeSearchText(
      item.title
    );


  const authors =
    normalizeSearchText(
      (item.authors || [])
        .map(
          author =>
            author.name
        )
        .join(" ")
    );


  const subjects =
    normalizeSearchText(
      (item.topics || [])
        .map(
          topic =>
            topic.name
        )
        .join(" ")
    );


  const description =
    normalizeSearchText(
      item.abstract
    );


  let score = 0;
  let matched = 0;


  for (
    const token of tokens
  ) {
    let tokenMatched =
      false;


    if (
      title.includes(
        token
      )
    ) {
      score += 6;
      tokenMatched = true;
    }


    if (
      authors.includes(
        token
      )
    ) {
      score += 5;
      tokenMatched = true;
    }


    if (
      subjects.includes(
        token
      )
    ) {
      score += 3;
      tokenMatched = true;
    }


    if (
      description.includes(
        token
      )
    ) {
      score += 1;
      tokenMatched = true;
    }


    if (
      tokenMatched
    ) {
      matched += 1;
    }
  }


  const coverage =
    matched /
    tokens.length;


  score +=
    coverage *
    12;


  const bibliographicText =
    [
      title,
      authors,
      subjects
    ].join(" ");


  if (
    tokens.every(
      token =>
        bibliographicText.includes(
          token
        )
    )
  ) {
    score += 15;
  }


  const titleMatches =
    tokens.filter(
      token =>
        title.includes(
          token
        )
    ).length;


  if (
    titleMatches >= 2
  ) {
    score +=
      titleMatches * 3;
  }


  /*
   * 1. Alineación con autor.
   *
   * Si uno de los términos de la consulta
   * aparece realmente en el campo creator,
   * damos un premio fuerte.
   *
   * Esto ayuda a:
   *   Kant -> Immanuel Kant
   *   Heidegger -> Martin Heidegger
   *   Plato -> Plato
   *
   * y evita que un comentario SOBRE Kant
   * supere tan fácilmente a una obra DE Kant.
   */
  const authorMatches =
    tokens.filter(
      token =>
        authors.includes(
          token
        )
    ).length;


  if (
    authorMatches > 0
  ) {
    score +=
      16 +
      (
        authorMatches *
        3
      );
  }


  /*
   * 2. Pureza / concentración del título.
   *
   * "Critique of Pure Reason"
   * debe recibir más que:
   *
   * "An Introduction and Interpretation
   *  of Kant's Critique of Pure Reason"
   *
   * aunque ambos contengan los términos.
   */
  const titleTokens =
    normalizeSearchText(
      item.title
    )
      .split(" ")
      .filter(Boolean);


  if (
    titleTokens.length &&
    titleMatches
  ) {
    const concentration =
      titleMatches /
      titleTokens.length;


    score +=
      concentration *
      20;
  }


  /*
   * 3. Indicadores de literatura secundaria.
   *
   * No son malos resultados: simplemente
   * deben quedar después de la obra primaria
   * cuando el usuario no pidió explícitamente
   * "commentary", "introduction", etc.
   */
  const secondaryMarkers = [
    "introduction",
    "interpretation",
    "commentary",
    "companion",
    "essays",
    "reflections",
    "guide",
    "note",
    "notes",
    "study",
    "studies",

    "introduccion",
    "interpretacion",
    "comentario",
    "comentarios",
    "ensayos",
    "reflexiones",
    "guia",
    "estudio",
    "estudios"
  ];


  const queryText =
    normalizeSearchText(
      query
    );


  let secondaryPenalty =
    0;


  for (
    const marker of secondaryMarkers
  ) {
    if (
      title.includes(
        marker
      ) &&
      !queryText.includes(
        marker
      )
    ) {
      secondaryPenalty +=
        12;
    }
  }


  score -=
    Math.min(
      secondaryPenalty,
      24
    );


  return Number(
    Math.max(
      0,
      score
    ).toFixed(3)
  );
}



export function buildInternetArchiveSearchUrl(
  query,
  options = {}
) {
  const {
    rows = 10,
    page = 1
  } = options;


  const safeQuery =
    safeSearchQuery(
      query
    );


  const url =
    new URL(
      INTERNET_ARCHIVE_SEARCH
    );


  url.searchParams.set(
    "q",
    safeQuery
      ? `mediatype:texts AND (${safeQuery})`
      : "mediatype:texts"
  );


  const fields = [
    "identifier",
    "title",
    "creator",
    "date",
    "year",
    "language",
    "subject",
    "description",
    "publisher",
    "isbn",
    "collection",
    "downloads",
    "mediatype"
  ];


  for (
    const field of fields
  ) {
    url.searchParams.append(
      "fl[]",
      field
    );
  }


  url.searchParams.set(
    "rows",
    String(rows)
  );


  url.searchParams.set(
    "page",
    String(page)
  );


  url.searchParams.set(
    "output",
    "json"
  );


  return url;
}


export function normalizeInternetArchiveItem(
  item,
  context = {}
) {
  const identifier =
    cleanText(
      firstValue(
        item.identifier
      )
    );


  const title =
    cleanText(
      firstValue(
        item.title
      )
    ) || "";


  const description =
    cleanText(
      item.description
    );


  const publisher =
    cleanText(
      firstValue(
        item.publisher
      )
    );


  const downloads =
    Number(
      firstValue(
        item.downloads
      )
    );


  return {
    id:
      identifier
        ? `internetarchive:${identifier}`
        : null,

    title,

    authors:
      normalizeCreators(
        item.creator
      ),

    year:
      normalizeYear(
        item
      ),

    /*
     * En esta primera fase no intentamos
     * adivinar si es libro, revista,
     * tesis, etc. El item pertenece al
     * mediatype "texts".
     */
    type:
      "archive-text",

    language:
      normalizeLanguage(
        item.language
      ),

    doi:
      null,

    isbn:
      normalizeIsbn(
        item.isbn
      ),

    journal:
      null,

    publisher,

    abstract:
      description,

    citedBy:
      null,

    /*
     * Que un item sea visible en Archive.org
     * no significa necesariamente que todos
     * sus archivos sean de acceso abierto.
     *
     * Eso se inspeccionará en una fase
     * posterior mediante los metadatos
     * específicos del item.
     */
    openAccess:
      null,

    topics:
      normalizeSubjects(
        item.subject
      ),

    philosophers: [],
    traditions: [],

    providers: [
      "Internet Archive"
    ],

    sourceRecords: [
      {
        provider:
          "Internet Archive",

        sourceId:
          identifier,

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
          null,

        downloads:
          Number.isFinite(
            downloads
          )
            ? downloads
            : null,

        collections:
          valuesOf(
            item.collection
          )
            .map(cleanText)
            .filter(Boolean)
            .slice(0, 8)
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

    relevanceLevel:
      null,

    metadataConfidence:
      0,

    urls: {
      canonical:
        identifier
          ? (
              INTERNET_ARCHIVE_DETAILS +
              encodeURIComponent(
                identifier
              )
            )
          : null,

      doi:
        null,

      openAccess:
        null
    },

    institutionalLinks: []
  };
}


async function fetchWithRetry(
  url,
  options = {}
) {
  const {
    retries = 1,
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
            method:
              "GET",

            headers: {
              Accept:
                "application/json"
            },

            signal,

            mode:
              "cors"
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
          `Internet Archive network/CORS error: ${
            error?.message ||
            "Failed to fetch"
          }`
        );
      }


      await sleep(
        900 *
        (
          attempt + 1
        )
      );

      continue;
    }


    if (
      response.ok
    ) {
      return response;
    }


    const retryable =
      response.status === 429 ||
      response.status >= 500;


    if (
      !retryable ||
      attempt === retries
    ) {
      throw new Error(
        `Internet Archive HTTP ${response.status}`
      );
    }


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
        : 1200 *
          (
            attempt + 1
          );


    await sleep(
      waitMs
    );
  }


  throw new Error(
    "Internet Archive request failed"
  );
}


export async function searchInternetArchive(
  expansion,
  options = {}
) {
  const query =
    typeof expansion ===
      "string"
      ? expansion
      : expansion.query;


  const queryWeight =
    typeof expansion ===
      "string"
      ? 1
      : expansion.weight;


  const queryType =
    typeof expansion ===
      "string"
      ? "unknown"
      : expansion.type;


  /*
   * Internet Archive contiene muchísimo
   * material y el orden remoto no siempre
   * es bibliográficamente óptimo.
   *
   * Recuperamos varios candidatos en UNA
   * sola petición y los reordenamos
   * localmente.
   */
  const requestedRows =
    Math.max(
      1,
      Number(
        options.rows ||
        10
      )
    );


  const candidateRows =
    Math.min(
      50,
      Math.max(
        requestedRows,
        requestedRows * 4
      )
    );


  const url =
    buildInternetArchiveSearchUrl(
      query,
      {
        ...options,

        rows:
          candidateRows
      }
    );


  const response =
    await fetchWithRetry(
      url,
      options
    );


  const data =
    await response.json();


  const docs =
    data?.response?.docs ||
    [];


  const normalized =
    docs.map(
      (item, index) =>
        normalizeInternetArchiveItem(
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


  const ranked =
    normalized
      .map(
        item => {
          const score =
            archiveRetrievalScore(
              item,
              query
            );


          if (
            item.sourceRecords?.[0]
          ) {
            item.sourceRecords[0]
              .retrievalScore =
              score;
          }


          return {
            item,
            score
          };
        }
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      )
      .slice(
        0,
        requestedRows
      )
      .map(
        entry =>
          entry.item
      );


  /*
   * Reescribimos rank para que refleje
   * la posición después del preranking.
   */
  ranked.forEach(
    (item, index) => {
      if (
        item.sourceRecords?.[0]
      ) {
        item.sourceRecords[0]
          .rank =
          index + 1;
      }
    }
  );


  return ranked;
}

