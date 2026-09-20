#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";

const EXPERIMENT_ID =
  "qwen3-ranking-512-development-v1";

const PREREG_PATH =
  "benchmark/qwen3/ranking/512-development/qwen3-ranking-512-development-v1.preregistered.json";

const CANDIDATE_PATH =
  "benchmark/qwen3/ranking/512-development/scores/qwen3-ranking-512-development-v1.raw.jsonl";

const CANDIDATE_META_PATH =
  "benchmark/qwen3/ranking/512-development/scores/qwen3-ranking-512-development-v1.raw.meta.json";

const REFERENCE_PATH =
  "benchmark/qwen3/ranking/scores/qwen3-ranking-v1.raw.jsonl";

const POOL_PATH =
  "benchmark/qwen3/ranking/runs/qwen3-ranking-v1-production-pool-c2ca5ed.jsonl";

const REPORT_PATH =
  "benchmark/qwen3/ranking/512-development/reports/qwen3-ranking-512-development-v1.report.json";

const MARKDOWN_PATH =
  "benchmark/qwen3/ranking/512-development/reports/qwen3-ranking-512-development-v1.report.md";

const EXPECTED = {
  prereg:
    "dc68ff205aceecd2972b0fdcce4d906c9e190e0d3b51bb77dbb4a93d97054eb8",
  candidate:
    "45e236befd52e438acc46825e2b6a8ac523462ce4cc6dbdb45759f8da0366d23",
  candidateMeta:
    "6fb8ac5a7a9d28f58dc8cfea66a710556c00dd4614ddf45d20a3802e500d5008",
  reference:
    "09483050c0c327c3fb9115c245a0584ac9f38107133e0363fa255d23a0b4b29c",
  pool:
    "596dcb74f786a4e4ff40a705ec9f440accdfebca1ffcdadcdad2548ef7003b4c",
};

function sha256(buffer) {
  return createHash("sha256")
    .update(buffer)
    .digest("hex");
}

function parseJsonl(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function pairKey(row) {
  return `${row.query_id}\u0000${row.record_id}`;
}

function groupByQuery(rows) {
  const groups = new Map();

  for (const row of rows) {
    if (!groups.has(row.query_id)) {
      groups.set(row.query_id, []);
    }

    groups.get(row.query_id).push(row);
  }

  return groups;
}

export function averageRanks(values) {
  const indexed = values.map(
    (value, index) => ({ value, index }),
  );

  indexed.sort((a, b) =>
    a.value - b.value || a.index - b.index
  );

  const ranks = new Array(values.length);

  let i = 0;

  while (i < indexed.length) {
    let j = i + 1;

    while (
      j < indexed.length &&
      indexed[j].value === indexed[i].value
    ) {
      j += 1;
    }

    const averageRank =
      ((i + 1) + j) / 2;

    for (let k = i; k < j; k += 1) {
      ranks[indexed[k].index] = averageRank;
    }

    i = j;
  }

  return ranks;
}

export function pearson(xs, ys) {
  assert.equal(xs.length, ys.length);
  assert.ok(xs.length > 1);

  const n = xs.length;
  const meanX =
    xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY =
    ys.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let xx = 0;
  let yy = 0;

  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;

    numerator += dx * dy;
    xx += dx * dx;
    yy += dy * dy;
  }

  if (xx === 0 || yy === 0) {
    return xs.every(
      (value, index) => value === ys[index],
    )
      ? 1
      : null;
  }

  return numerator / Math.sqrt(xx * yy);
}

export function spearman(xs, ys) {
  return pearson(
    averageRanks(xs),
    averageRanks(ys),
  );
}

function symmetricDifferenceSize(a, b) {
  let count = 0;

  for (const value of a) {
    if (!b.has(value)) {
      count += 1;
    }
  }

  for (const value of b) {
    if (!a.has(value)) {
      count += 1;
    }
  }

  return count;
}

function intersectionSize(a, b) {
  let count = 0;

  for (const value of a) {
    if (b.has(value)) {
      count += 1;
    }
  }

  return count;
}

export function rankQuery(
  scoreRows,
  originalRankByPair,
) {
  return [...scoreRows].sort((a, b) => {
    const scoreDelta =
      Number(b.raw_score) - Number(a.raw_score);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const aRank = originalRankByPair.get(
      pairKey(a),
    );

    const bRank = originalRankByPair.get(
      pairKey(b),
    );

    assert.ok(Number.isInteger(aRank));
    assert.ok(Number.isInteger(bRank));

    return aRank - bRank;
  });
}

export function compareRankings({
  candidateRows,
  referenceRows,
  poolRows,
}) {
  assert.equal(candidateRows.length, 1000);
  assert.equal(referenceRows.length, 1000);
  assert.equal(poolRows.length, 1000);

  const poolKeys =
    new Set(poolRows.map(pairKey));

  assert.equal(poolKeys.size, 1000);

  const candidateKeys =
    new Set(candidateRows.map(pairKey));

  const referenceKeys =
    new Set(referenceRows.map(pairKey));

  assert.equal(candidateKeys.size, 1000);
  assert.equal(referenceKeys.size, 1000);

  assert.deepEqual(
    [...candidateKeys].sort(),
    [...poolKeys].sort(),
  );

  assert.deepEqual(
    [...referenceKeys].sort(),
    [...poolKeys].sort(),
  );

  const originalRankByPair = new Map();

  for (const row of poolRows) {
    assert.ok(
      Number.isInteger(row.rank) &&
      row.rank >= 1 &&
      row.rank <= 20,
    );

    originalRankByPair.set(
      pairKey(row),
      row.rank,
    );
  }

  const candidateByQuery =
    groupByQuery(candidateRows);

  const referenceByQuery =
    groupByQuery(referenceRows);

  assert.equal(candidateByQuery.size, 50);
  assert.equal(referenceByQuery.size, 50);

  const queryIds =
    [...candidateByQuery.keys()].sort();

  assert.deepEqual(
    queryIds,
    [...referenceByQuery.keys()].sort(),
  );

  let top5EqualQueries = 0;
  let top10EqualQueries = 0;
  let top5SymmetricDifference = 0;
  let top10SymmetricDifference = 0;
  let rankShiftTotal = 0;
  let maxRankShift = 0;
  let sameRankCount = 0;

  const perQuery = [];

  for (const queryId of queryIds) {
    const candidate =
      rankQuery(
        candidateByQuery.get(queryId),
        originalRankByPair,
      );

    const reference =
      rankQuery(
        referenceByQuery.get(queryId),
        originalRankByPair,
      );

    assert.equal(candidate.length, 20);
    assert.equal(reference.length, 20);

    const candidateIds =
      new Set(candidate.map((row) => row.record_id));

    const referenceIds =
      new Set(reference.map((row) => row.record_id));

    assert.deepEqual(
      [...candidateIds].sort(),
      [...referenceIds].sort(),
    );

    const candidateTop5 =
      new Set(
        candidate
          .slice(0, 5)
          .map((row) => row.record_id),
      );

    const referenceTop5 =
      new Set(
        reference
          .slice(0, 5)
          .map((row) => row.record_id),
      );

    const candidateTop10 =
      new Set(
        candidate
          .slice(0, 10)
          .map((row) => row.record_id),
      );

    const referenceTop10 =
      new Set(
        reference
          .slice(0, 10)
          .map((row) => row.record_id),
      );

    const top5Difference =
      symmetricDifferenceSize(
        candidateTop5,
        referenceTop5,
      );

    const top10Difference =
      symmetricDifferenceSize(
        candidateTop10,
        referenceTop10,
      );

    const top10Overlap =
      intersectionSize(
        candidateTop10,
        referenceTop10,
      );

    if (top5Difference === 0) {
      top5EqualQueries += 1;
    }

    if (top10Difference === 0) {
      top10EqualQueries += 1;
    }

    top5SymmetricDifference += top5Difference;
    top10SymmetricDifference +=
      top10Difference;

    const referenceRanks = new Map(
      reference.map(
        (row, index) => [
          row.record_id,
          index + 1,
        ],
      ),
    );

    let queryShiftTotal = 0;
    let queryMaxShift = 0;

    for (
      let candidateIndex = 0;
      candidateIndex < candidate.length;
      candidateIndex += 1
    ) {
      const row = candidate[candidateIndex];
      const candidateRank = candidateIndex + 1;
      const referenceRank =
        referenceRanks.get(row.record_id);

      assert.ok(
        Number.isInteger(referenceRank),
      );

      const shift =
        Math.abs(
          candidateRank - referenceRank,
        );

      queryShiftTotal += shift;
      rankShiftTotal += shift;

      queryMaxShift =
        Math.max(queryMaxShift, shift);

      maxRankShift =
        Math.max(maxRankShift, shift);

      if (shift === 0) {
        sameRankCount += 1;
      }
    }

    perQuery.push({
      query_id: queryId,
      top5_membership_equal:
        top5Difference === 0,
      top10_membership_equal:
        top10Difference === 0,
      top10_overlap_count: top10Overlap,
      top10_symmetric_difference_memberships:
        top10Difference,
      mean_absolute_rank_shift:
        queryShiftTotal / 20,
      max_absolute_rank_shift:
        queryMaxShift,
    });
  }

  const referenceByPair =
    new Map(
      referenceRows.map(
        (row) => [
          pairKey(row),
          Number(row.raw_score),
        ],
      ),
    );

  const sortedCandidate =
    [...candidateRows].sort(
      (a, b) =>
        pairKey(a).localeCompare(pairKey(b)),
    );

  const candidateScores =
    sortedCandidate.map(
      (row) => Number(row.raw_score),
    );

  const referenceScores =
    sortedCandidate.map((row) => {
      const value =
        referenceByPair.get(pairKey(row));

      assert.ok(Number.isFinite(value));

      return value;
    });

  assert.ok(
    candidateScores.every(
      (value) => Number.isFinite(value),
    ),
  );

  const scorePearson =
    pearson(
      referenceScores,
      candidateScores,
    );

  const scoreSpearman =
    spearman(
      referenceScores,
      candidateScores,
    );

  return {
    query_count: 50,
    pair_count: 1000,
    pool_depth: 20,
    primary_gate: {
      metric:
        "exact Top-10 membership equality",
      required_queries_equal: 50,
      queries_equal: top10EqualQueries,
      total_queries: 50,
      passed:
        top10EqualQueries === 50,
    },
    secondary_metrics: {
      top5_membership_equal_queries:
        top5EqualQueries,
      top5_membership_changed_queries:
        50 - top5EqualQueries,
      top5_symmetric_difference_memberships:
        top5SymmetricDifference,
      top10_membership_equal_queries:
        top10EqualQueries,
      top10_membership_changed_queries:
        50 - top10EqualQueries,
      top10_symmetric_difference_memberships:
        top10SymmetricDifference,
      mean_top10_overlap:
        perQuery.reduce(
          (sum, row) =>
            sum + row.top10_overlap_count,
          0,
        ) / 50,
      minimum_top10_overlap:
        Math.min(
          ...perQuery.map(
            (row) =>
              row.top10_overlap_count,
          ),
        ),
      mean_absolute_rank_shift:
        rankShiftTotal / 1000,
      max_absolute_rank_shift:
        maxRankShift,
      same_rank_count:
        sameRankCount,
      score_pearson:
        scorePearson,
      score_spearman:
        scoreSpearman,
    },
    per_query: perQuery,
  };
}

async function verifyFrozenInputs() {
  const paths = {
    prereg: PREREG_PATH,
    candidate: CANDIDATE_PATH,
    candidateMeta: CANDIDATE_META_PATH,
    reference: REFERENCE_PATH,
    pool: POOL_PATH,
  };

  const verified = {};

  for (const [name, path] of Object.entries(paths)) {
    const bytes = await readFile(path);
    const actual = sha256(bytes);

    assert.equal(
      actual,
      EXPECTED[name],
      `${name} SHA mismatch`,
    );

    verified[name] = {
      path,
      sha256: actual,
    };
  }

  return verified;
}

async function preflight() {
  const verified =
    await verifyFrozenInputs();

  console.log(
    JSON.stringify(
      {
        experiment_id: EXPERIMENT_ID,
        status:
          "comparison-preflight-passed",
        frozen_inputs: verified,
        primary_gate: {
          metric:
            "exact Top-10 membership equality",
          required_queries_equal: 50,
          total_queries: 50,
        },
        comparison_executed: false,
        human_labels_used: false,
        ranking_holdout_accessed: false,
        model_inference_executed: false,
        production_changed: false,
      },
      null,
      2,
    ),
  );
}

async function analyze() {
  const verified =
    await verifyFrozenInputs();

  const [
    candidateText,
    referenceText,
    poolText,
  ] = await Promise.all([
    readFile(CANDIDATE_PATH, "utf8"),
    readFile(REFERENCE_PATH, "utf8"),
    readFile(POOL_PATH, "utf8"),
  ]);

  const comparison =
    compareRankings({
      candidateRows:
        parseJsonl(candidateText),
      referenceRows:
        parseJsonl(referenceText),
      poolRows:
        parseJsonl(poolText),
    });

  const report = {
    schema_version:
      "qwen3-ranking-512-development-report-v1",
    experiment_id: EXPERIMENT_ID,
    status:
      comparison.primary_gate.passed
        ? "passed"
        : "failed",
    comparison: {
      reference_max_length: 4096,
      candidate_max_length: 512,
      ranking_rule:
        "raw_score descending; exact score ties use original production rank ascending",
    },
    frozen_inputs: verified,
    ...comparison,
    boundaries: {
      development_only: true,
      human_labels_used: false,
      ranking_holdout_accessed: false,
      model_inference_executed_during_analysis:
        false,
      production_changed: false,
      browser_q8_quality_established:
        false,
    },
  };

  await mkdir(
    "benchmark/qwen3/ranking/512-development/reports",
    { recursive: true },
  );

  await writeFile(
    REPORT_PATH,
    `${JSON.stringify(report, null, 2)}\n`,
    { flag: "wx" },
  );

  const m = report.secondary_metrics;

  const markdown = `# Qwen3 512-token development ranking comparison

- Status: ${report.status}
- Reference max length: 4096
- Candidate max length: 512
- Queries: 50
- Query-document pairs: 1000

## Primary gate

Exact Top-10 membership equality: ${report.primary_gate.queries_equal}/50

PASS requires: 50/50

Primary gate passed: ${report.primary_gate.passed}

## Secondary metrics

- Top-5 membership equal queries: ${m.top5_membership_equal_queries}/50
- Top-5 changed queries: ${m.top5_membership_changed_queries}/50
- Top-5 symmetric-difference memberships: ${m.top5_symmetric_difference_memberships}
- Top-10 membership equal queries: ${m.top10_membership_equal_queries}/50
- Top-10 changed queries: ${m.top10_membership_changed_queries}/50
- Top-10 symmetric-difference memberships: ${m.top10_symmetric_difference_memberships}
- Mean Top-10 overlap: ${m.mean_top10_overlap}
- Minimum Top-10 overlap: ${m.minimum_top10_overlap}
- Mean absolute rank shift: ${m.mean_absolute_rank_shift}
- Maximum absolute rank shift: ${m.max_absolute_rank_shift}
- Same-rank documents: ${m.same_rank_count}/1000
- Score Pearson correlation: ${m.score_pearson}
- Score Spearman correlation: ${m.score_spearman}

## Boundaries

This is a development-only truncation comparison. No human relevance labels, fresh ranking holdout, model inference, browser q8 inference, or production ranking changes are part of this analysis.
`;

  await writeFile(
    MARKDOWN_PATH,
    markdown,
    { flag: "wx" },
  );

  const reportSha =
    sha256(await readFile(REPORT_PATH));

  const markdownSha =
    sha256(await readFile(MARKDOWN_PATH));

  console.log(
    "Qwen3 512 development comparison complete",
  );

  console.log(
    `status=${report.status}`,
  );

  console.log(
    `top10_equal_queries=${report.primary_gate.queries_equal}/50`,
  );

  console.log(
    `primary_gate_passed=${report.primary_gate.passed}`,
  );

  console.log(
    `top5_equal_queries=${m.top5_membership_equal_queries}/50`,
  );

  console.log(
    `top10_changed_memberships=${m.top10_symmetric_difference_memberships}`,
  );

  console.log(
    `mean_top10_overlap=${m.mean_top10_overlap}`,
  );

  console.log(
    `minimum_top10_overlap=${m.minimum_top10_overlap}`,
  );

  console.log(
    `mean_absolute_rank_shift=${m.mean_absolute_rank_shift}`,
  );

  console.log(
    `max_absolute_rank_shift=${m.max_absolute_rank_shift}`,
  );

  console.log(
    `same_rank_count=${m.same_rank_count}`,
  );

  console.log(
    `score_pearson=${m.score_pearson}`,
  );

  console.log(
    `score_spearman=${m.score_spearman}`,
  );

  console.log(
    `report_sha256=${reportSha}`,
  );

  console.log(
    `markdown_sha256=${markdownSha}`,
  );

  console.log(
    `report=${REPORT_PATH}`,
  );

  console.log(
    `markdown=${MARKDOWN_PATH}`,
  );
}

const isMain =
  Boolean(
    process.argv[1] &&
    import.meta.url ===
      pathToFileURL(process.argv[1]).href,
  );

if (isMain) {
  const mode = process.argv[2];

  if (mode === "--preflight") {
    await preflight();
  } else if (mode === "--run") {
    await analyze();
  } else {
    throw new Error(
      "expected --preflight or --run",
    );
  }
}
