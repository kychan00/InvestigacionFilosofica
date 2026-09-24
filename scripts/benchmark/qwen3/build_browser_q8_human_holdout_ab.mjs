#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sha256Text } from '../core/hashing.mjs';
import { readJsonl, serializeJsonl, writeJsonlAtomic } from '../core/jsonl.mjs';

const EXPERIMENT_ID = 'qwen3-browser-q8-human-holdout-v1';
const SCORE_FREEZE_COMMIT = '604214b2e9f76e960b2488d6a8fd3dec3b1946b5';

const POOL_PATH =
  'benchmark/qwen3/browser/q8-human-holdout/runs/qwen3-browser-q8-human-holdout-v1-production-pool.jsonl';
const POOL_SHA256 =
  '938322b67d543780a0489e0b5b0d63658c18b0fb32562f27f57fb7277c9711dd';
const DATASET_PATH =
  'benchmark/qwen3/browser/q8-human-holdout/datasets/qwen3-browser-q8-human-holdout-v1.jsonl';
const DATASET_SHA256 =
  '52fa2d0c863c69270de5f77006b42106dcfb6ed7d998d9209934018e96edb4c4';
const SCORES_PATH =
  'benchmark/qwen3/browser/q8-human-holdout/scores/qwen3-browser-q8-human-holdout-v1.raw.jsonl';
const SCORES_SHA256 =
  'c260c2f3194cda9cef91c9efc1b1cf7a0c0adee4c2b2d5a1e56c0855c35cd518';

const OUTPUT_PATH =
  'benchmark/qwen3/browser/q8-human-holdout/runs/qwen3-browser-q8-human-holdout-v1-ab.jsonl';
const META_PATH =
  'benchmark/qwen3/browser/q8-human-holdout/runs/qwen3-browser-q8-human-holdout-v1-ab.meta.json';

const EXPECTED_ROWS = 500;
const EXPECTED_QUERIES = 25;
const POOL_DEPTH = 20;

function pairKey(row) {
  return `${row.query_id}\u0000${row.record_id}`;
}

function parseMode(argv) {
  let mode = null;
  for (const argument of argv) {
    if (argument === '--preflight' || argument === '--run') {
      if (mode) throw new Error('choose exactly one mode');
      mode = argument.slice(2);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (!mode) throw new Error('choose exactly one mode: --preflight or --run');
  return mode;
}

function assertSha(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label} SHA mismatch: expected ${expected}, got ${actual}`);
  }
}

function assertUniquePairs(records, label) {
  const seen = new Set();
  for (const row of records) {
    const key = pairKey(row);
    if (seen.has(key)) throw new Error(`${label}: duplicate pair ${key}`);
    seen.add(key);
  }
  return seen;
}

function sameSet(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function topSet(rows, depth) {
  return new Set(
    rows
      .filter((row) => row.rank <= depth)
      .map((row) => row.record_id),
  );
}

function symmetricDifferenceCount(left, right) {
  let count = 0;
  for (const value of left) if (!right.has(value)) count += 1;
  for (const value of right) if (!left.has(value)) count += 1;
  return count;
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function assertOutputsAbsent() {
  for (const path of [OUTPUT_PATH, META_PATH]) {
    if (existsSync(resolve(path))) {
      throw new Error(`refusing to overwrite frozen A/B output: ${path}`);
    }
  }
}

async function readFrozenInputs() {
  execFileSync(
    'git',
    ['merge-base', '--is-ancestor', SCORE_FREEZE_COMMIT, 'HEAD'],
    { stdio: 'ignore' },
  );

  const [poolFile, datasetFile, scoresFile] = await Promise.all([
    readJsonl(resolve(POOL_PATH)),
    readJsonl(resolve(DATASET_PATH)),
    readJsonl(resolve(SCORES_PATH)),
  ]);

  assertSha('production pool', sha256Text(poolFile.text), POOL_SHA256);
  assertSha('model-input dataset', sha256Text(datasetFile.text), DATASET_SHA256);
  assertSha('browser q8 raw scores', sha256Text(scoresFile.text), SCORES_SHA256);

  for (const [label, records] of [
    ['production pool', poolFile.records],
    ['model-input dataset', datasetFile.records],
    ['browser q8 raw scores', scoresFile.records],
  ]) {
    if (records.length !== EXPECTED_ROWS) {
      throw new Error(`${label} must contain exactly ${EXPECTED_ROWS} rows`);
    }
  }

  const poolPairs = assertUniquePairs(poolFile.records, 'production pool');
  const datasetPairs = assertUniquePairs(datasetFile.records, 'model-input dataset');
  const scorePairs = assertUniquePairs(scoresFile.records, 'browser q8 raw scores');

  if (!sameSet(poolPairs, datasetPairs) || !sameSet(poolPairs, scorePairs)) {
    throw new Error('frozen pool, dataset and browser q8 scores do not contain identical pair membership');
  }

  const datasetSequence = datasetFile.records.map(pairKey);
  const scoreSequence = scoresFile.records.map(pairKey);
  if (
    datasetSequence.length !== scoreSequence.length ||
    datasetSequence.some((key, index) => key !== scoreSequence[index])
  ) {
    throw new Error('browser q8 score sequence differs from frozen model-input dataset order');
  }

  return {
    pool: poolFile.records,
    scores: scoresFile.records,
  };
}

function buildConditions(pool, scores) {
  const scoreByPair = new Map();
  for (const score of scores) {
    const raw = Number(score.raw_score);
    if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
      throw new Error(`invalid browser q8 raw score for ${pairKey(score)}`);
    }
    scoreByPair.set(pairKey(score), raw);
  }

  const byQuery = new Map();
  for (const row of pool) {
    const group = byQuery.get(row.query_id) ?? [];
    group.push(row);
    byQuery.set(row.query_id, group);
  }
  if (byQuery.size !== EXPECTED_QUERIES) {
    throw new Error(`expected ${EXPECTED_QUERIES} queries, got ${byQuery.size}`);
  }

  const abRows = [];
  const perQuery = [];
  let totalAbsoluteShift = 0;
  let maxAbsoluteShift = 0;
  let unchangedRankCount = 0;
  let equalScorePairs = 0;

  for (const [queryId, unsorted] of byQuery) {
    const sourceRows = [...unsorted].sort(
      (left, right) => Number(left.rank) - Number(right.rank),
    );

    if (sourceRows.length !== POOL_DEPTH) {
      throw new Error(`${queryId}: expected ${POOL_DEPTH} source rows`);
    }
    for (let index = 0; index < POOL_DEPTH; index += 1) {
      if (Number(sourceRows[index].rank) !== index + 1) {
        throw new Error(`${queryId}: production ranks are not exactly 1..20`);
      }
    }

    const scored = sourceRows.map((row) => {
      const browserQ8RawScore = scoreByPair.get(pairKey(row));
      if (!Number.isFinite(browserQ8RawScore)) {
        throw new Error(`missing browser q8 score for ${pairKey(row)}`);
      }
      return {
        row,
        original_rank: Number(row.rank),
        browser_q8_raw_score: browserQ8RawScore,
      };
    });

    const bOrder = [...scored].sort((left, right) => {
      const scoreDelta =
        right.browser_q8_raw_score - left.browser_q8_raw_score;
      if (scoreDelta !== 0) return scoreDelta;
      return left.original_rank - right.original_rank;
    });

    for (let i = 0; i < scored.length; i += 1) {
      for (let j = i + 1; j < scored.length; j += 1) {
        if (
          scored[i].browser_q8_raw_score ===
          scored[j].browser_q8_raw_score
        ) {
          equalScorePairs += 1;
        }
      }
    }

    const bRankById = new Map(
      bOrder.map((item, index) => [item.row.record_id, index + 1]),
    );

    for (const item of scored) {
      abRows.push({
        ...item.row,
        condition: 'A',
        rank: item.original_rank,
        original_rank: item.original_rank,
        browser_q8_raw_score: item.browser_q8_raw_score,
      });
    }

    for (let index = 0; index < bOrder.length; index += 1) {
      const item = bOrder[index];
      abRows.push({
        ...item.row,
        condition: 'B',
        rank: index + 1,
        original_rank: item.original_rank,
        browser_q8_raw_score: item.browser_q8_raw_score,
      });
    }

    let queryAbsoluteShift = 0;
    let queryMaxShift = 0;
    let queryUnchanged = 0;

    for (const item of scored) {
      const shift = Math.abs(
        bRankById.get(item.row.record_id) - item.original_rank,
      );
      totalAbsoluteShift += shift;
      queryAbsoluteShift += shift;
      maxAbsoluteShift = Math.max(maxAbsoluteShift, shift);
      queryMaxShift = Math.max(queryMaxShift, shift);
      if (shift === 0) {
        unchangedRankCount += 1;
        queryUnchanged += 1;
      }
    }

    const aRankRows = scored.map((item) => ({
      rank: item.original_rank,
      record_id: item.row.record_id,
    }));
    const bRankRows = bOrder.map((item, index) => ({
      rank: index + 1,
      record_id: item.row.record_id,
    }));

    const a5 = topSet(aRankRows, 5);
    const b5 = topSet(bRankRows, 5);
    const a10 = topSet(aRankRows, 10);
    const b10 = topSet(bRankRows, 10);

    perQuery.push({
      query_id: queryId,
      top5_symmetric_difference_pairs: symmetricDifferenceCount(a5, b5),
      top10_symmetric_difference_pairs: symmetricDifferenceCount(a10, b10),
      mean_absolute_rank_shift: round(queryAbsoluteShift / POOL_DEPTH),
      max_absolute_rank_shift: queryMaxShift,
      unchanged_rank_count: queryUnchanged,
    });
  }

  const conditionA = abRows.filter((row) => row.condition === 'A');
  const conditionB = abRows.filter((row) => row.condition === 'B');
  if (
    conditionA.length !== EXPECTED_ROWS ||
    conditionB.length !== EXPECTED_ROWS
  ) {
    throw new Error('A/B condition pair counts are not exactly 500/500');
  }

  const conditionAPairs = new Set(conditionA.map(pairKey));
  const conditionBPairs = new Set(conditionB.map(pairKey));
  if (
    conditionAPairs.size !== EXPECTED_ROWS ||
    conditionBPairs.size !== EXPECTED_ROWS ||
    !sameSet(conditionAPairs, conditionBPairs)
  ) {
    throw new Error('A and B do not contain the exact same candidate pool');
  }

  const top5ChangedPairs = perQuery.reduce(
    (sum, row) => sum + row.top5_symmetric_difference_pairs,
    0,
  );
  const top10ChangedPairs = perQuery.reduce(
    (sum, row) => sum + row.top10_symmetric_difference_pairs,
    0,
  );

  return {
    abRows,
    summary: {
      queries: EXPECTED_QUERIES,
      pool_depth: POOL_DEPTH,
      pairs: EXPECTED_ROWS,
      ab_rows: abRows.length,
      top5_queries_changed:
        perQuery.filter(
          (row) => row.top5_symmetric_difference_pairs > 0,
        ).length,
      top5_changed_pairs: top5ChangedPairs,
      top10_queries_changed:
        perQuery.filter(
          (row) => row.top10_symmetric_difference_pairs > 0,
        ).length,
      top10_changed_pairs: top10ChangedPairs,
      blind_audit_candidates: top10ChangedPairs,
      mean_absolute_rank_shift: round(
        totalAbsoluteShift / EXPECTED_ROWS,
      ),
      max_absolute_rank_shift: maxAbsoluteShift,
      unchanged_rank_count: unchangedRankCount,
      equal_score_pairs: equalScorePairs,
    },
  };
}

export async function buildBrowserQ8HumanHoldoutAB({
  writeOutput = false,
} = {}) {
  assertOutputsAbsent();
  const frozen = await readFrozenInputs();
  const { abRows, summary } = buildConditions(
    frozen.pool,
    frozen.scores,
  );

  const outputText = serializeJsonl(abRows);
  const outputSha256 = sha256Text(outputText);

  const meta = {
    schema_version: 'qwen3-browser-q8-human-holdout-ab-meta-v1',
    validation_id: EXPERIMENT_ID,
    row_count: abRows.length,
    condition_rows: { A: EXPECTED_ROWS, B: EXPECTED_ROWS },
    query_count: EXPECTED_QUERIES,
    pool_depth: POOL_DEPTH,
    same_pool_per_condition: true,
    qwen_model_called_during_ab_build: false,
    human_labels_used: false,
    binary_threshold_used: false,
    score_blending: false,
    pool_membership_changes: false,
    policy: {
      A: 'original production order',
      B: 'browser_q8_raw_score descending',
      tie_breaker: 'original production rank ascending',
    },
    sources: {
      production_pool: {
        path: POOL_PATH,
        sha256: POOL_SHA256,
      },
      model_input_dataset: {
        path: DATASET_PATH,
        sha256: DATASET_SHA256,
      },
      browser_q8_raw_scores: {
        path: SCORES_PATH,
        sha256: SCORES_SHA256,
        freeze_commit: SCORE_FREEZE_COMMIT,
      },
    },
    output: {
      path: OUTPUT_PATH,
      sha256: outputSha256,
    },
    structural_summary: summary,
  };

  if (writeOutput) {
    await writeJsonlAtomic(resolve(OUTPUT_PATH), abRows);
    await mkdir(dirname(resolve(META_PATH)), { recursive: true });
    await writeFile(
      resolve(META_PATH),
      `${JSON.stringify(meta, null, 2)}\n`,
      'utf8',
    );
  }

  return {
    summary,
    outputSha256,
    outputWritten: writeOutput,
  };
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const result = await buildBrowserQ8HumanHoldoutAB({
    writeOutput: mode === 'run',
  });

  console.log(JSON.stringify({
    experiment_id: EXPERIMENT_ID,
    status:
      mode === 'preflight'
        ? 'preflight-passed-no-output'
        : 'ab-built',
    ...result.summary,
    ab_sha256: result.outputSha256,
    output: OUTPUT_PATH,
    metadata: META_PATH,
    output_written: result.outputWritten,
    human_labels_used: false,
    qwen_model_called_during_ab_build: false,
    binary_threshold_used: false,
    score_blending: false,
    pool_membership_changes: false,
  }, null, 2));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
