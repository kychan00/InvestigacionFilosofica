const DATA_URL =
  new URL(
    "../data/cucsh-filosofia.json",
    import.meta.url
  );


let datasetPromise =
  null;


const PROVIDER =
  "CUCSH Filosofía";


const STOPWORDS =
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
    "from",

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
    "sobre",
    "como",
    "que"
  ]);


function normalizeSearchText(
  value
) {
  return String(
    value || ""
  )
    .normalize("NFKD")
    .replace(
      /\p{M}/gu,
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


function fieldTokenSet(
  value
) {
  return new Set(
    normalizeSearchText(
      value
    )
      .split(" ")
      .filter(Boolean)
  );
}


function tokenMatchesField(
  token,
  fieldTokens
) {
  if (
    !token ||
    !fieldTokens?.size
  ) {
    return false;
  }


  /*
   * Coincidencia exacta:
   *
   * ética -> ética
   * Kant  -> Kant
   */
  if (
    fieldTokens.has(
      token
    )
  ) {
    return true;
  }


  /*
   * Permite derivados razonables:
   *
   * kant -> kantiano
   * hegel -> hegeliano
   *
   * pero NO:
   *
   * ética -> estética
   * ética -> erotética
   *
   * porque esas palabras no comienzan
   * con "etica".
   */
  if (
    token.length < 4
  ) {
    return false;
  }


  for (
    const candidate of fieldTokens
  ) {
    if (
      candidate.startsWith(
        token
      )
    ) {
      return true;
    }
  }


  return false;
}


function phraseMatchesField(
  fieldText,
  queryText
) {
  const field =
    normalizeSearchText(
      fieldText
    );

  const query =
    normalizeSearchText(
      queryText
    );


  if (
    !field ||
    !query
  ) {
    return false;
  }


  /*
   * Espacios centinela para evitar
   * coincidencias internas de palabra.
   */
  return (
    ` ${field} `
      .includes(
        ` ${query} `
      )
  );
}


function queryMatchesField(
  fieldText,
  queryText,
  fieldTokens
) {
  const tokens =
    queryTokens(
      queryText
    );


  if (!tokens.length) {
    return false;
  }


  if (
    tokens.length === 1
  ) {
    return tokenMatchesField(
      tokens[0],
      fieldTokens
    );
  }


  return phraseMatchesField(
    fieldText,
    queryText
  );
}


function queryTokens(
  value
) {
  const seen =
    new Set();

  const output = [];

  for (
    const token of
    normalizeSearchText(
      value
    ).split(" ")
  ) {
    if (
      !token ||
      token.length < 2 ||
      STOPWORDS.has(token) ||
      seen.has(token)
    ) {
      continue;
    }

    seen.add(token);

    output.push(
      token
    );

    if (
      output.length >= 12
    ) {
      break;
    }
  }

  return output;
}


function joinedText(
  values
) {
  return normalizeSearchText(
    (values || [])
      .filter(Boolean)
      .join(" ")
  );
}


function authorText(
  record
) {
  return joinedText(
    (record.authors || [])
      .map(
        author =>
          author?.name ||
          author?.sourceName ||
          ""
      )
  );
}


function topicText(
  record
) {
  return joinedText(
    record.subjects || []
  );
}


function titleText(
  record
) {
  return joinedText([
    record.title,
    ...(
      record.titleVariants ||
      []
    )
  ]);
}


function abstractText(
  record
) {
  return joinedText([
    record.abstract,
    ...(
      record.abstractVariants ||
      []
    )
  ]);
}


function sourceText(
  record
) {
  return joinedText([
    record.journal,
    record.publisher,
    ...(
      record.bibliographicSources ||
      []
    )
  ]);
}


export function cucshRetrievalScore(
  record,
  query
) {
  const normalizedQuery =
    normalizeSearchText(
      query
    );

  if (!normalizedQuery) {
    return 0;
  }


  const tokens =
    queryTokens(
      query
    );


  const titles =
    titleText(
      record
    );

  const primaryTitle =
    normalizeSearchText(
      record.title
    );

  const authors =
    authorText(
      record
    );

  const topics =
    topicText(
      record
    );

  const abstracts =
    abstractText(
      record
    );

  const sources =
    sourceText(
      record
    );

  const doi =
    normalizeSearchText(
      record.doi
    );


  const titleTokens =
    fieldTokenSet(
      titles
    );

  const authorTokens =
    fieldTokenSet(
      authors
    );

  const topicTokens =
    fieldTokenSet(
      topics
    );

  const abstractTokens =
    fieldTokenSet(
      abstracts
    );

  const sourceTokens =
    fieldTokenSet(
      sources
    );


  let score = 0;


  /*
   * Coincidencia directa con DOI.
   */
  if (
    doi &&
    doi === normalizedQuery
  ) {
    score += 120;
  }


  /*
   * Coincidencia por frase.
   */
  if (
    primaryTitle ===
    normalizedQuery
  ) {
    score += 90;
  } else if (
    queryMatchesField(
      titles,
      normalizedQuery,
      titleTokens
    )
  ) {
    score += 55;
  }


  if (
    queryMatchesField(
      authors,
      normalizedQuery,
      authorTokens
    )
  ) {
    score += 35;
  }


  if (
    queryMatchesField(
      topics,
      normalizedQuery,
      topicTokens
    )
  ) {
    score += 20;
  }


  let matchedTokens = 0;


  for (
    const token of tokens
  ) {
    let matched = false;


    if (
      tokenMatchesField(
        token,
        titleTokens
      )
    ) {
      score += 14;
      matched = true;
    }


    if (
      tokenMatchesField(
        token,
        authorTokens
      )
    ) {
      score += 10;
      matched = true;
    }


    if (
      tokenMatchesField(
        token,
        topicTokens
      )
    ) {
      score += 7;
      matched = true;
    }


    if (
      tokenMatchesField(
        token,
        abstractTokens
      )
    ) {
      score += 2;
      matched = true;
    }


    if (
      tokenMatchesField(
        token,
        sourceTokens
      )
    ) {
      score += 2;
      matched = true;
    }


    if (matched) {
      matchedTokens++;
    }
  }


  if (
    tokens.length
  ) {
    const coverage =
      matchedTokens /
      tokens.length;

    score +=
      coverage *
      22;


    if (
      tokens.every(
        token =>
          tokenMatchesField(
            token,
            titleTokens
          )
      )
    ) {
      score += 22;
    }
  }


  return Number(
    score.toFixed(3)
  );
}


export function normalizeCucshRecord(
  record,
  context = {}
) {
  const canonical =
    record.urls?.canonical ||
    null;

  const doi =
    record.doi ||
    null;


  return {
    id:
      record.id ||
      (
        record.sourceId
          ? `cucsh:${record.sourceId}`
          : null
      ),

    title:
      record.title ||
      "",

    authors:
      (record.authors || [])
        .filter(
          author =>
            author?.name ||
            author?.sourceName
        )
        .map(
          author => ({
            id: null,

            name:
              author.name ||
              author.sourceName
          })
        ),

    year:
      record.year ??
      null,

    type:
      record.type ||
      "journal-article",

    language:
      record.language ||
      null,

    doi,

    isbn: [],

    journal:
      record.journal ||
      null,

    publisher:
      record.publisher ||
      null,

    abstract:
      record.abstract ||
      null,

    citedBy:
      null,

    /*
     * No inferimos estado OA únicamente
     * porque OJS exponga una URL pública.
     */
    openAccess:
      null,

    topics:
      (record.subjects || [])
        .filter(Boolean)
        .map(
          name => ({
            id: null,
            name,
            score: null
          })
        ),

    philosophers: [],
    traditions: [],

    providers: [
      PROVIDER
    ],

    sourceRecords: [
      {
        provider:
          PROVIDER,

        sourceId:
          record.sourceId ||
          record.id ||
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
          null,

        retrievalScore:
          context.retrievalScore ??
          null,

        journal:
          record.journal ||
          null,

        oaiDatestamp:
          record.oaiDatestamp ||
          null,

        relations:
          (
            record.urls?.relations ||
            []
          ).slice(
            0,
            8
          )
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

    relevanceScore:
      0,

    relevanceLevel:
      null,

    metadataConfidence:
      0,

    urls: {
      canonical,

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


export function searchCucshRecords(
  records,
  expansion,
  options = {}
) {
  const query =
    typeof expansion ===
      "string"
      ? expansion
      : expansion?.query;


  const queryWeight =
    typeof expansion ===
      "string"
      ? 1
      : (
          expansion?.weight ??
          1
        );


  const queryType =
    typeof expansion ===
      "string"
      ? "unknown"
      : (
          expansion?.type ||
          "unknown"
        );


  const rows =
    Math.max(
      1,
      Number(
        options.rows ||
        10
      )
    );


  const page =
    Math.max(
      1,
      Number(
        options.page ||
        1
      )
    );


  const offset =
    (
      page - 1
    ) *
    rows;


  const candidates =
    (records || [])
      .map(
        record => ({
          record,

          score:
            cucshRetrievalScore(
              record,
              query
            )
        })
      )
      .filter(
        item =>
          item.score > 0
      )
      .sort(
        (a, b) => {
          const scoreDifference =
            b.score -
            a.score;

          if (
            scoreDifference
          ) {
            return scoreDifference;
          }


          const yearDifference =
            (
              b.record.year ||
              0
            ) -
            (
              a.record.year ||
              0
            );

          if (
            yearDifference
          ) {
            return yearDifference;
          }


          return String(
            a.record.title ||
            ""
          ).localeCompare(
            String(
              b.record.title ||
              ""
            ),
            "es"
          );
        }
      );


  return candidates
    .slice(
      offset,
      offset + rows
    )
    .map(
      (
        candidate,
        index
      ) =>
        normalizeCucshRecord(
          candidate.record,
          {
            query,
            queryWeight,
            queryType,

            rank:
              offset +
              index +
              1,

            retrievalScore:
              candidate.score
          }
        )
    );
}


async function loadCucshDataset() {
  if (!datasetPromise) {
    datasetPromise =
      fetch(
        DATA_URL
      )
        .then(
          response => {
            if (
              !response.ok
            ) {
              throw new Error(
                (
                  "CUCSH Filosofía "
                  + `HTTP ${response.status}`
                )
              );
            }

            return response.json();
          }
        )
        .then(
          data => {
            if (
              !Array.isArray(
                data?.records
              )
            ) {
              throw new Error(
                "CUCSH Filosofía: invalid dataset"
              );
            }

            return data;
          }
        )
        .catch(
          error => {
            datasetPromise =
              null;

            throw error;
          }
        );
  }


  return datasetPromise;
}


export async function searchCucshFilosofia(
  expansion,
  options = {}
) {
  if (
    options.signal?.aborted
  ) {
    throw new DOMException(
      "Search aborted",
      "AbortError"
    );
  }


  const dataset =
    await loadCucshDataset();


  if (
    options.signal?.aborted
  ) {
    throw new DOMException(
      "Search aborted",
      "AbortError"
    );
  }


  return searchCucshRecords(
    dataset.records,
    expansion,
    options
  );
}
