import fs from "node:fs";

const runPath =
  process.argv[2] ||
  "benchmark/runs/current.jsonl";

const judgmentsPath =
  process.argv[3] ||
  "benchmark/judgments.jsonl";

function readJsonl(path) {
  if (!fs.existsSync(path)) {
    throw new Error(
      `File not found: ${path}`
    );
  }

  const text =
    fs
      .readFileSync(
        path,
        "utf8"
      )
      .trim();

  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map(
      (line, index) => {
        try {
          return JSON.parse(
            line
          );
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
    values.filter(
      Number.isFinite
    );

  if (!usable.length) {
    return null;
  }

  return (
    usable.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    usable.length
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
        Math.log2(
          index + 2
        );

      return (
        total +
        gain / discount
      );
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

const rankingDepth =
  benchmark.evaluation
    ?.rankingDepth || 10;

const poolDepth =
  benchmark.evaluation
    ?.poolDepth || 20;

const relevantThreshold =
  benchmark.evaluation
    ?.relevantThreshold || 2;

const run =
  readJsonl(
    runPath
  );

const judgments =
  readJsonl(
    judgmentsPath
  );

if (!judgments.length) {
  throw new Error(
    `No judgments available in ${judgmentsPath}.`
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

  if (
    !judgmentsByQuery.has(
      judgment.query_id
    )
  ) {
    judgmentsByQuery.set(
      judgment.query_id,
      []
    );
  }

  judgmentsByQuery
    .get(
      judgment.query_id
    )
    .push(
      judgment
    );
}

const runByQuery =
  new Map();

for (const row of run) {
  if (
    !runByQuery.has(
      row.query_id
    )
  ) {
    runByQuery.set(
      row.query_id,
      []
    );
  }

  runByQuery
    .get(
      row.query_id
    )
    .push(
      row
    );
}

for (
  const rows of
  runByQuery.values()
) {
  rows.sort(
    (a, b) =>
      Number(a.rank) -
      Number(b.rank)
  );
}

const perQuery =
  [];

for (
  const query of
  benchmark.queries
) {
  const poolRows =
    (
      runByQuery.get(
        query.id
      ) || []
    )
      .slice(
        0,
        poolDepth
      );

  const rankedRows =
    poolRows.slice(
      0,
      rankingDepth
    );

  const evaluateRows =
    rows =>
      rows.map(
        row => {
          const key =
            `${query.id}\u0000${row.record_id}`;

          return {
            row,
            judgment:
              judgmentMap.get(
                key
              ) || null
          };
        }
      );

  const ranked =
    evaluateRows(
      rankedRows
    );

  const pool =
    evaluateRows(
      poolRows
    );

  const top10Unjudged =
    ranked.filter(
      item =>
        !item.judgment
    ).length;

  const poolUnjudged =
    pool.filter(
      item =>
        !item.judgment
    ).length;

  const top10Coverage =
    ranked.length
      ? (
          ranked.length -
          top10Unjudged
        ) /
        ranked.length
      : 0;

  const poolCoverage =
    pool.length
      ? (
          pool.length -
          poolUnjudged
        ) /
        pool.length
      : 0;

  const top10Complete =
    ranked.length > 0 &&
    top10Unjudged === 0;

  const poolComplete =
    pool.length > 0 &&
    poolUnjudged === 0;

  let precision5 = null;
  let precision10 = null;
  let recall10 = null;
  let ndcg10 = null;
  let mrr10 = null;
  let philosophyPrecision10 =
    null;

  if (top10Complete) {
    const top5 =
      ranked.slice(
        0,
        5
      );

    precision5 =
      top5.length
        ? (
            top5.filter(
              item =>
                item.judgment
                  .relevance >=
                relevantThreshold
            ).length /
            top5.length
          )
        : null;

    const relevant10 =
      ranked.filter(
        item =>
          item.judgment
            .relevance >=
          relevantThreshold
      ).length;

    precision10 =
      ranked.length
        ? (
            relevant10 /
            ranked.length
          )
        : null;

    const firstRelevant =
      ranked.findIndex(
        item =>
          item.judgment
            .relevance >=
          relevantThreshold
      );

    mrr10 =
      firstRelevant >= 0
        ? (
            1 /
            (
              firstRelevant +
              1
            )
          )
        : 0;

    philosophyPrecision10 =
      ranked.length
        ? (
            ranked.filter(
              item =>
                item.judgment
                  .discipline === 2
            ).length /
            ranked.length
          )
        : null;
  }

  if (poolComplete) {
    const relevant10 =
      ranked.filter(
        item =>
          item.judgment
            .relevance >=
          relevantThreshold
      ).length;

    const allRelevantJudged =
      (
        judgmentsByQuery.get(
          query.id
        ) || []
      )
        .filter(
          judgment =>
            judgment.relevance >=
            relevantThreshold
        )
        .length;

    recall10 =
      allRelevantJudged
        ? (
            relevant10 /
            allRelevantJudged
          )
        : null;

    const actualGrades =
      ranked.map(
        item =>
          item.judgment
            .relevance
      );

    const idealGrades =
      (
        judgmentsByQuery.get(
          query.id
        ) || []
      )
        .map(
          judgment =>
            judgment.relevance
        )
        .sort(
          (a, b) =>
            b - a
        )
        .slice(
          0,
          rankingDepth
        );

    const idealDcg =
      dcg(
        idealGrades
      );

    ndcg10 =
      idealDcg > 0
        ? (
            dcg(
              actualGrades
            ) /
            idealDcg
          )
        : null;
  }

  perQuery.push({
    id:
      query.id,

    language:
      query.language,

    family:
      query.family,

    intent:
      query.intent,

    returned:
      poolRows.length,

    top10Unjudged,
    poolUnjudged,

    top10Coverage:
      round(
        top10Coverage
      ),

    poolCoverage:
      round(
        poolCoverage
      ),

    precision5:
      round(
        precision5
      ),

    precision10:
      round(
        precision10
      ),

    recall10:
      round(
        recall10
      ),

    ndcg10:
      round(
        ndcg10
      ),

    mrr10:
      round(
        mrr10
      ),

    philosophyPrecision10:
      round(
        philosophyPrecision10
      )
  });
}

function summarize(rows) {
  return {
    queries:
      rows.length,

    top10Complete:
      rows.filter(
        row =>
          row.top10Coverage === 1
      ).length,

    poolComplete:
      rows.filter(
        row =>
          row.poolCoverage === 1
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

for (
  const language of
  benchmark.languages
) {
  byLanguage[language] =
    summarize(
      perQuery.filter(
        row =>
          row.language ===
          language
      )
    );
}

const byIntent =
  {};

for (
  const intent of
  [...new Set(
    benchmark.queries.map(
      query =>
        query.intent
    )
  )]
) {
  byIntent[intent] =
    summarize(
      perQuery.filter(
        row =>
          row.intent ===
          intent
      )
    );
}

const report = {
  benchmarkVersion:
    benchmark.version,

  evaluation: {
    rankingDepth,
    poolDepth,
    relevantThreshold
  },

  run:
    runPath,

  judgmentsSource:
    judgmentsPath,

  judgments:
    judgments.length,

  overall:
    summarize(
      perQuery
    ),

  byLanguage,
  byIntent,
  perQuery
};

console.log(
  JSON.stringify(
    report,
    null,
    2
  )
);
