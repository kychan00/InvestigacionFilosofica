import fs from "node:fs";

const benchmark =
  JSON.parse(
    fs.readFileSync(
      "benchmark/queries.json",
      "utf8"
    )
  );

const queries =
  benchmark.queries || [];

const expectedLanguages =
  ["es", "en", "de", "fr", "pt"];

if (queries.length !== 50) {
  throw new Error(
    `Expected 50 queries, got ${queries.length}`
  );
}

const ids =
  new Set();

const languageCounts =
  new Map();

const familyLanguages =
  new Map();

for (const query of queries) {
  if (
    !query.id ||
    !query.language ||
    !query.family ||
    !query.intent ||
    !query.query
  ) {
    throw new Error(
      `Incomplete query: ${JSON.stringify(query)}`
    );
  }

  if (ids.has(query.id)) {
    throw new Error(
      `Duplicate query id: ${query.id}`
    );
  }

  ids.add(query.id);

  languageCounts.set(
    query.language,
    (languageCounts.get(query.language) || 0) + 1
  );

  if (!familyLanguages.has(query.family)) {
    familyLanguages.set(
      query.family,
      new Set()
    );
  }

  familyLanguages
    .get(query.family)
    .add(query.language);
}

for (const language of expectedLanguages) {
  const count =
    languageCounts.get(language) || 0;

  if (count !== 10) {
    throw new Error(
      `${language}: expected 10 queries, got ${count}`
    );
  }
}

if (familyLanguages.size !== 10) {
  throw new Error(
    `Expected 10 families, got ${familyLanguages.size}`
  );
}

for (const [family, languages] of familyLanguages) {
  if (languages.size !== 5) {
    throw new Error(
      `${family}: expected 5 language variants, got ${languages.size}`
    );
  }
}

const allowedRoles =
  new Set([
    "PRIMARY",
    "SCHOLARLY",
    "REVIEW",
    "EMPIRICAL_ADJACENT",
    "PARATEXT",
    "NOISE",
    "UNSURE"
  ]);

const judgmentPath =
  "benchmark/judgments.jsonl";

const raw =
  fs.existsSync(judgmentPath)
    ? fs.readFileSync(judgmentPath, "utf8").trim()
    : "";

const judgments =
  raw
    ? raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map(
          (line, index) => {
            try {
              return JSON.parse(line);
            } catch (error) {
              throw new Error(
                `Invalid JSONL at line ${index + 1}: ${error.message}`
              );
            }
          }
        )
    : [];

const judgmentKeys =
  new Set();

for (const judgment of judgments) {
  if (!ids.has(judgment.query_id)) {
    throw new Error(
      `Unknown query_id: ${judgment.query_id}`
    );
  }

  if (!judgment.record_id) {
    throw new Error(
      `Missing record_id for ${judgment.query_id}`
    );
  }

  if (
    !Number.isInteger(judgment.relevance) ||
    judgment.relevance < 0 ||
    judgment.relevance > 3
  ) {
    throw new Error(
      `Invalid relevance: ${judgment.query_id}/${judgment.record_id}`
    );
  }

  if (
    !Number.isInteger(judgment.discipline) ||
    judgment.discipline < 0 ||
    judgment.discipline > 2
  ) {
    throw new Error(
      `Invalid discipline: ${judgment.query_id}/${judgment.record_id}`
    );
  }

  if (!allowedRoles.has(judgment.role)) {
    throw new Error(
      `Invalid role: ${judgment.role}`
    );
  }

  const key =
    `${judgment.query_id}\u0000${judgment.record_id}`;

  if (judgmentKeys.has(key)) {
    throw new Error(
      `Duplicate judgment: ${judgment.query_id}/${judgment.record_id}`
    );
  }

  judgmentKeys.add(key);
}

console.log("BENCHMARK VALIDATION: PASS");
console.log(`queries=${queries.length}`);
console.log(`families=${familyLanguages.size}`);
console.log(
  "languages=" +
  JSON.stringify(
    Object.fromEntries(
      [...languageCounts].sort()
    )
  )
);
console.log(`judgments=${judgments.length}`);
