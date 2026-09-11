const PARQUET_URL =
  "https://huggingface.co/datasets/" +
  "CristianPelayo/openalex-philosophy/" +
  "resolve/09c329326ed24ccf986c4b4c47c9794f055516dc/v3.2/" +
  "philosophy-corpus-v3-2-search.parquet";


const PARQUET_NAME =
  "openalex-philosophy.parquet";


let databasePromise =
  null;


const STOPWORDS =
  new Set([
    "the",
    "and",
    "for",
    "from",
    "with",
    "into",
    "about",
    "sobre",
    "para",
    "por",
    "con",
    "del",
    "las",
    "los",
    "una",
    "uno",
    "que",
    "como"
  ]);


function normalizeText(
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
      /[^a-z0-9\s-]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function queryTokens(
  value
) {
  const output = [];

  const seen =
    new Set();

  for (
    const token of
    normalizeText(value)
      .split(/\s+/)
  ) {
    if (
      token.length < 3 ||
      STOPWORDS.has(token) ||
      seen.has(token)
    ) {
      continue;
    }

    seen.add(token);
    output.push(token);

    if (
      output.length >= 7
    ) {
      break;
    }
  }

  return output;
}


function sqlLiteral(
  value
) {
  return String(
    value || ""
  ).replace(
    /'/g,
    "''"
  );
}


function withTimeout(
  promise,
  milliseconds,
  label
) {
  let timer;

  const watchdog =
    new Promise(
      (_, reject) => {
        timer =
          setTimeout(
            () => {
              reject(
                new Error(
                  `${label}: timeout`
                )
              );
            },
            milliseconds
          );
      }
    );

  return Promise.race([
    promise,
    watchdog
  ]).finally(
    () => {
      clearTimeout(timer);
    }
  );
}


async function initialize() {
  const moduleUrl =
    new URL(
      "../../vendor/duckdb/" +
      "duckdb-browser.bundle.mjs",
      import.meta.url
    );

  const wasmUrl =
    new URL(
      "../../vendor/duckdb/" +
      "duckdb-mvp.wasm",
      import.meta.url
    );

  const workerUrl =
    new URL(
      "../../vendor/duckdb/" +
      "duckdb-browser-mvp.worker.js",
      import.meta.url
    );


  const duckdb =
    await withTimeout(
      import(
        moduleUrl.href
      ),
      30_000,
      "DuckDB import"
    );


  const worker =
    new Worker(
      workerUrl.href
    );


  const logger =
    new duckdb.ConsoleLogger(
      duckdb.LogLevel.WARNING
    );


  const db =
    new duckdb.AsyncDuckDB(
      logger,
      worker
    );


  await withTimeout(
    db.instantiate(
      wasmUrl.href
    ),
    90_000,
    "DuckDB instantiate"
  );


  await withTimeout(
    db.open({
      path: ":memory:",

      query: {
        castBigIntToDouble:
          true
      }
    }),
    30_000,
    "DuckDB open"
  );


  await withTimeout(
    db.registerFileURL(
      PARQUET_NAME,
      PARQUET_URL,
      duckdb.DuckDBDataProtocol.HTTP,
      false
    ),
    30_000,
    "OpenAlex Philosophy register"
  );


  const connection =
    await db.connect();


  return {
    duckdb,
    db,
    connection
  };
}


function getDatabase() {
  if (!databasePromise) {
    databasePromise =
      initialize().catch(
        error => {
          databasePromise =
            null;

          throw error;
        }
      );
  }

  return databasePromise;
}


function buildSearchSql(
  query,
  options = {}
) {
  const {
    rows = 12,
    page = 1
  } = options;


  const tokens =
    queryTokens(query);


  if (!tokens.length) {
    return null;
  }


  const safeTokens =
    tokens.map(
      sqlLiteral
    );


  const normalizedPhrase =
    sqlLiteral(
      normalizeText(query)
    );


  const titleExpression =
    "strip_accents(" +
    "lower(coalesce(title, ''))" +
    ")";


  const where =
    safeTokens
      .map(
        token =>
          `${titleExpression} ` +
          `LIKE '%${token}%'`
      )
      .join(
        "\nOR "
      );


  const tokenScore =
    safeTokens
      .map(
        token =>
          `CASE WHEN ` +
          `${titleExpression} ` +
          `LIKE '%${token}%' ` +
          `THEN 8 ELSE 0 END`
      )
      .join(
        "\n+ "
      );


  const keywordScore =
    safeTokens
      .map(
        token =>
          `CASE WHEN ` +
          `coalesce(ontology_keyword_id, '') ` +
          `LIKE '%${token}%' ` +
          `THEN 3 ELSE 0 END`
      )
      .join(
        "\n+ "
      );


  const phraseScore =
    normalizedPhrase
      ? (
          `CASE WHEN ` +
          `${titleExpression} ` +
          `LIKE '%${normalizedPhrase}%' ` +
          `THEN 30 ELSE 0 END`
        )
      : "0";


  const limit =
    Math.max(
      1,
      Math.min(
        50,
        Number(rows) || 12
      )
    );


  const safePage =
    Math.max(
      1,
      Number(page) || 1
    );


  const offset =
    (
      safePage - 1
    ) *
    limit;


  return `
    SELECT
      work_id,
      tier,
      document_role,
      evidence_score,
      primary_concept_id,
      concept_score,
      nonduplicate_philosophy_score,
      ontology_keyword_id,
      ontology_keyword_score,
      publication_year,
      language,
      type,
      title,

      (
        ${phraseScore}
        + ${tokenScore}
        + ${keywordScore}
        + CASE
            WHEN tier = 'CORE'
              THEN 18
            WHEN tier = 'PROBABLE'
              THEN 8
            ELSE 0
          END
        + coalesce(
            evidence_score,
            0
          )
      ) AS source_score

    FROM '${PARQUET_NAME}'

    WHERE
      ${where}

    ORDER BY
      source_score DESC,
      evidence_score DESC,
      publication_year DESC
        NULLS LAST

    LIMIT ${limit}
    OFFSET ${offset}
  `;
}


function normalizeRow(
  row,
  context
) {
  const workId =
    Number(
      row.work_id
    );


  const canonical =
    `https://openalex.org/W${workId}`;


  return {
    id:
      canonical,

    title:
      row.title || "",

    authors: [],

    year:
      row.publication_year ??
      null,

    type:
      row.type || null,

    language:
      row.language || null,

    doi:
      null,

    isbn: [],

    journal:
      null,

    publisher:
      null,

    abstract:
      null,

    citedBy:
      null,

    openAccess:
      null,

    topics: [],

    philosophers: [],
    traditions: [],

    providers: [
      "OpenAlex Philosophy"
    ],

    philosophyCorpus: {
      version:
        "3.2",

      tier:
        row.tier || null,

      documentRole:
        row.document_role || null,

      evidenceScore:
        Number(
          row.evidence_score || 0
        ),

      conceptId:
        row.primary_concept_id ??
        null,

      conceptScore:
        row.concept_score ??
        null,

      ontologyKeyword:
        row.ontology_keyword_id ||
        null,

      ontologyKeywordScore:
        row.ontology_keyword_score ??
        null,

      sourceScore:
        Number(
          row.source_score || 0
        )
    },

    sourceRecords: [
      {
        provider:
          "OpenAlex Philosophy",

        sourceId:
          canonical,

        rank:
          context.rank,

        query:
          context.query,

        queryWeight:
          context.queryWeight,

        queryType:
          context.queryType
      }
    ],

    matchedQueries: [
      {
        query:
          context.query,

        weight:
          context.queryWeight,

        type:
          context.queryType
      }
    ],

    relevanceScore: 0,

    relevanceLevel:
      null,

    metadataConfidence: 0,

    urls: {
      canonical,

      doi:
        null,

      openAccess:
        null
    },

    institutionalLinks: []
  };
}


export async function
searchOpenAlexPhilosophy(
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
      : (
          expansion.weight ??
          1
        );


  const queryType =
    typeof expansion ===
    "string"
      ? "unknown"
      : (
          expansion.type ||
          "unknown"
        );


  const sql =
    buildSearchSql(
      query,
      options
    );


  if (!sql) {
    return [];
  }


  const {
    connection
  } =
    await getDatabase();


  const table =
    await withTimeout(
      connection.query(
        sql
      ),
      60_000,
      "OpenAlex Philosophy query"
    );


  return table
    .toArray()
    .map(
      (row, index) =>
        normalizeRow(
          row,
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
