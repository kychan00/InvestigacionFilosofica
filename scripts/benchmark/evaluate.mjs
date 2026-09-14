import fs from "node:fs";

const runPath =
  process.argv[2] ||
  "benchmark/runs/current.jsonl";

function readJsonl(path) {
  if (!fs.existsSync(path)) {
    throw new Error(
      `File not found: ${path}`
    );
  }

  const text =
    fs.readFileSync(path, "utf8").trim();

  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map(
      (line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(
            `${path}:${index + 1}: ${error.message}`
          );
        }
      }
    );
}

function mean(values) {
  const usable =
    values.filter(Number.isFinite);

  if (!usable.length) {
    return null;
  }

  return (
    usable.reduce(
      (sum, value) => sum + value,
      0
    ) / usable.length
  );
}

function round(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number(
    value.toFixed(4)
  );
}

function dcg(grades) {
  return grades.reduce(
    (total, grade, index) => {
      const gain =
        (2 ** grade) - 1;

      const discount =
        Math.log2(index + 2);

      return total + gain / discount;
    },
    0
  );
}

const benchmark =
  JSON.parse(
    fs.readFileSync(
      "benchmark/queries.json",
      "utf8"
    )
  );

const run =
  readJsonl(runPath);

const judgments =
  readJsonl(
    "benchmark/judgments.jsonl"
  );

if (!judgments.length) {
  throw new Error(
    "No human judgments available yet."
  );
}

const judgmentMap =
  new Map();

const judgmentsByQuery =
  new Map();

for (const judgment of judgments) {
  const key =
    `${judgment.query_id}\u0000${judgment.record_id}`;

  judgmentMap.set(
    key,
    judgment
  );

  if (!judgmentsByQuery.has(judgment.query_id)) {
    judgmentsByQuery.set(
      judgment.query_id,
      []
    );
  }

  judgmentsByQuery
    .get(judgment.query_id)
    .push(judgment);
}

const runByQuery =
  new Map();

for (const row of run) {
  if (!runByQuery.has(row.query_id)) {
    runByQuery.set(
      row.query_id,
      []
    );
  }

  runByQuery
    .get(row.query_id)
    .push(row);
}

for (const rows of runByQuery.values()) {
  rows.sort(
    (a, b) =>
      Number(a.rank) -
      Number(b.rank)
  );
}

const perQuery =
  [];

for (const query of benchmark.queries) {
  const rows =
    (runByQuery.get(query.id) || [])
      .slice(0, 10);

  const evaluated =
    rows.map(
      row => {
        const key =
          `${query.id}\u0000${row.record_id}`;

        return {
          row,
          judgment:
            judgmentMap.get(key) || null
        };
      }
    );

  const unjudged =
    evaluated.filter(
      item =>
        !item.judgment
    ).length;

  const coverage =
    rows.length
      ? (rows.length - unjudged) / rows.length
      : 0;

  const complete =
    rows.length > 0 &&
    unjudged === 0;

  let p5 = null;
  let p10 = null;
  let recall10 = null;
  let ndcg10 = null;
  let mrr10 = null;
  let philosophyPrecision10 = null;

  if (complete) {
    const top5 =
      evaluated.slice(0, 5);

    p5 =
      top5.filter(
        item =>
          item.judgment.relevance >= 2
      ).length /
      top5.length;

    const relevant10 =
      evaluated.filter(
        item =>
          item.judgment.relevance >= 2
      ).length;

    p10 =
      relevant10 /
      evaluated.length;

    const judgedRelevant =
      (judgmentsByQuery.get(query.id) || [])
        .filter(
          judgment =>
            judgment.relevance >= 2
        )
        .length;

    recall10 =
      judgedRelevant
        ? relevant10 / judgedRelevant
        : null;

    const grades =
      evaluated.map(
        item =>
          item.judgment.relevance
      );

    const ideal =
      (judgmentsByQuery.get(query.id) || [])
        .map(
          judgment =>
            judgment.relevance
        )
        .sort(
          (a, b) =>
            b - a
        )
        .slice(0, 10);

    const idealDcg =
      dcg(ideal);

    ndcg10 =
      idealDcg > 0
        ? dcg(grades) / idealDcg
        : null;

    const firstRelevant =
      evaluated.findIndex(
        item =>
          item.judgment.relevance >= 2
      );

    mrr10 =
      firstRelevant >= 0
        ? 1 / (firstRelevant + 1)
        : 0;

    philosophyPrecision10 =
      evaluated.filter(
        item =>
          item.judgment.discipline === 2
      ).length /
      evaluated.length;
  }

  perQuery.push({
    id: query.id,
    language: query.language,
    family: query.family,
    intent: query.intent,
    returned: rows.length,
    unjudged,
    coverage: round(coverage),
    precision5: round(p5),
    precision10: round(p10),
    recall10: round(recall10),
    ndcg10: round(ndcg10),
    mrr10: round(mrr10),
    philosophyPrecision10:
      round(philosophyPrecision10)
  });
}

function summarize(rows) {
  return {
    queries: rows.length,
    complete:
      rows.filter(
        row =>
          row.coverage === 1
      ).length,
    precision5:
      round(
        mean(
          rows.map(
            row =>
              row.precision5
          )
        )
      ),
    precision10:
      round(
        mean(
          rows.map(
            row =>
              row.precision10
          )
        )
      ),
    recall10:
      round(
        mean(
          rows.map(
            row =>
              row.recall10
          )
        )
      ),
    ndcg10:
      round(
        mean(
          rows.map(
            row =>
              row.ndcg10
          )
        )
      ),
    mrr10:
      round(
        mean(
          rows.map(
            row =>
              row.mrr10
          )
        )
      ),
    philosophyPrecision10:
      round(
        mean(
          rows.map(
            row =>
              row.philosophyPrecision10
          )
        )
      )
  };
}

const byLanguage =
  {};

for (const language of benchmark.languages) {
  byLanguage[language] =
    summarize(
      perQuery.filter(
        row =>
          row.language === language
      )
    );
}

const report = {
  benchmarkVersion:
    benchmark.version,
  run:
    runPath,
  judgments:
    judgments.length,
  overall:
    summarize(perQuery),
  byLanguage,
  perQuery
};

console.log(
  JSON.stringify(
    report,
    null,
    2
  )
);
