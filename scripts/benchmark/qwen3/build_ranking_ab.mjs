import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sha256Text } from '../core/hashing.mjs';
import { readJsonl, serializeJsonl, writeJsonlAtomic } from '../core/jsonl.mjs';

const POOL_PATH = 'benchmark/qwen3/ranking/runs/qwen3-ranking-v1-production-pool-c2ca5ed.jsonl';
const POOL_SHA256 = '596dcb74f786a4e4ff40a705ec9f440accdfebca1ffcdadcdad2548ef7003b4c';
const DATASET_PATH = 'benchmark/qwen3/ranking/datasets/qwen3-ranking-v1.jsonl';
const DATASET_SHA256 = 'd0f6b29834053615b44f823c7cb61f14478965eb72409ba1ab98742da224c548';
const SCORES_PATH = 'benchmark/qwen3/ranking/scores/qwen3-ranking-v1.raw.jsonl';
const SCORES_SHA256 = '09483050c0c327c3fb9115c245a0584ac9f38107133e0363fa255d23a0b4b29c';

const OUTPUT_PATH = 'benchmark/qwen3/ranking/runs/qwen3-ranking-v1-ab.jsonl';
const META_PATH = 'benchmark/qwen3/ranking/runs/qwen3-ranking-v1-ab.meta.json';
const REPORT_PATH = 'benchmark/qwen3/ranking/reports/qwen3-ranking-v1-movement.json';
const REPORT_MD_PATH = 'benchmark/qwen3/ranking/reports/qwen3-ranking-v1-movement.md';

const EXPECTED_ROWS = 1000;
const EXPECTED_QUERIES = 50;
const POOL_DEPTH = 20;

function pairKey(row) {
  return `${row.query_id}\u0000${row.record_id}`;
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

function topSet(rows, depth) {
  return new Set(rows.filter((row) => row.rank <= depth).map((row) => row.record_id));
}

function symmetricDifferenceCount(a, b) {
  let count = 0;
  for (const value of a) if (!b.has(value)) count += 1;
  for (const value of b) if (!a.has(value)) count += 1;
  return count;
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function renderMarkdown(report) {
  const lines = [
    '# Qwen3 ranking v1 — structural movement',
    '',
    '> Development-only structural comparison on the exact same frozen Top-20 pool. This report does not use relevance labels and therefore does not claim a quality improvement.',
    '',
    `- Queries: ${report.queries}`,
    `- Documents per query: ${report.pool_depth}`,
    `- Query-document pairs: ${report.pairs}`,
    `- A/B rows: ${report.ab_rows}`,
    `- Queries with Top-5 membership change: ${report.top5.queries_changed}`,
    `- Top-5 changed query-document memberships: ${report.top5.symmetric_difference_pairs}`,
    `- Queries with Top-10 membership change: ${report.top10.queries_changed}`,
    `- Top-10 changed query-document memberships: ${report.top10.symmetric_difference_pairs}`,
    `- Blind human audit candidates (Top-10 symmetric difference): ${report.top10.symmetric_difference_pairs}`,
    `- Mean absolute rank shift: ${report.rank_movement.mean_absolute_shift}`,
    `- Maximum absolute rank shift: ${report.rank_movement.max_absolute_shift}`,
    `- Documents staying at the same rank: ${report.rank_movement.unchanged_rank_count}`,
    `- Within-query equal-score pairs: ${report.score_ties.equal_score_pairs}`,
    '',
    '## Boundaries',
    '',
    '- A is the original production order from the frozen pool.',
    '- B sorts the same 20 documents by Qwen raw score descending.',
    '- Exact Qwen-score ties preserve original production rank.',
    '- No threshold, score blend, relevance label, new retrieval, or production code change is used.',
    '- Structural movement alone is not evidence that B is better; relevance must be judged independently and blind to condition.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export async function buildRankingAB() {
  const [
    poolFile,
    datasetFile,
    scoresFile,
  ] = await Promise.all([
    readJsonl(resolve(POOL_PATH)),
    readJsonl(resolve(DATASET_PATH)),
    readJsonl(resolve(SCORES_PATH)),
  ]);

  assertSha('production pool', sha256Text(poolFile.text), POOL_SHA256);
  assertSha('model-input dataset', sha256Text(datasetFile.text), DATASET_SHA256);
  assertSha('Qwen raw scores', sha256Text(scoresFile.text), SCORES_SHA256);

  if (poolFile.records.length !== EXPECTED_ROWS) throw new Error('production pool must contain 1000 rows');
  if (datasetFile.records.length !== EXPECTED_ROWS) throw new Error('model-input dataset must contain 1000 rows');
  if (scoresFile.records.length !== EXPECTED_ROWS) throw new Error('raw scores must contain 1000 rows');

  const poolPairs = assertUniquePairs(poolFile.records, 'production pool');
  const datasetPairs = assertUniquePairs(datasetFile.records, 'dataset');
  const scorePairs = assertUniquePairs(scoresFile.records, 'scores');

  for (const key of poolPairs) {
    if (!datasetPairs.has(key)) throw new Error(`dataset missing pair ${key}`);
    if (!scorePairs.has(key)) throw new Error(`scores missing pair ${key}`);
  }

  const scoreByPair = new Map();
  for (const score of scoresFile.records) {
    const raw = Number(score.raw_score);
    if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
      throw new Error(`invalid raw score for ${pairKey(score)}`);
    }
    scoreByPair.set(pairKey(score), raw);
  }

  const byQuery = new Map();
  for (const row of poolFile.records) {
    if (!byQuery.has(row.query_id)) byQuery.set(row.query_id, []);
    byQuery.get(row.query_id).push(row);
  }

  if (byQuery.size !== EXPECTED_QUERIES) {
    throw new Error(`expected ${EXPECTED_QUERIES} queries, got ${byQuery.size}`);
  }

  const abRows = [];
  const perQuery = [];
  let totalAbsoluteShift = 0;
  let unchangedRankCount = 0;
  let maxAbsoluteShift = 0;
  let equalScorePairs = 0;

  for (const [queryId, sourceRowsUnsorted] of byQuery) {
    const sourceRows = [...sourceRowsUnsorted].sort((a, b) => Number(a.rank) - Number(b.rank));
    if (sourceRows.length !== POOL_DEPTH) {
      throw new Error(`${queryId}: expected ${POOL_DEPTH} source rows`);
    }
    for (let index = 0; index < POOL_DEPTH; index += 1) {
      if (Number(sourceRows[index].rank) !== index + 1) {
        throw new Error(`${queryId}: source ranks are not 1..20`);
      }
    }

    const scored = sourceRows.map((row) => ({
      row,
      original_rank: Number(row.rank),
      qwen_raw_score: scoreByPair.get(pairKey(row)),
    }));

    const bOrder = [...scored].sort((left, right) => {
      const scoreDelta = right.qwen_raw_score - left.qwen_raw_score;
      if (scoreDelta !== 0) return scoreDelta;
      return left.original_rank - right.original_rank;
    });

    for (let i = 0; i < scored.length; i += 1) {
      for (let j = i + 1; j < scored.length; j += 1) {
        if (scored[i].qwen_raw_score === scored[j].qwen_raw_score) equalScorePairs += 1;
      }
    }

    const bRankById = new Map(bOrder.map((item, index) => [item.row.record_id, index + 1]));

    for (const item of scored) {
      abRows.push({
        condition: 'A',
        rank: item.original_rank,
        original_rank: item.original_rank,
        qwen_raw_score: item.qwen_raw_score,
        ...item.row,
        rank: item.original_rank,
      });
    }

    for (let index = 0; index < bOrder.length; index += 1) {
      const item = bOrder[index];
      abRows.push({
        condition: 'B',
        rank: index + 1,
        original_rank: item.original_rank,
        qwen_raw_score: item.qwen_raw_score,
        ...item.row,
        rank: index + 1,
      });
    }

    let queryAbsShift = 0;
    let queryMaxShift = 0;
    let queryUnchanged = 0;
    for (const item of scored) {
      const newRank = bRankById.get(item.row.record_id);
      const shift = Math.abs(newRank - item.original_rank);
      totalAbsoluteShift += shift;
      queryAbsShift += shift;
      maxAbsoluteShift = Math.max(maxAbsoluteShift, shift);
      queryMaxShift = Math.max(queryMaxShift, shift);
      if (shift === 0) {
        unchangedRankCount += 1;
        queryUnchanged += 1;
      }
    }

    const aRows = scored.map((item) => ({ rank: item.original_rank, record_id: item.row.record_id }));
    const bRows = bOrder.map((item, index) => ({ rank: index + 1, record_id: item.row.record_id }));
    const a5 = topSet(aRows, 5);
    const b5 = topSet(bRows, 5);
    const a10 = topSet(aRows, 10);
    const b10 = topSet(bRows, 10);

    perQuery.push({
      query_id: queryId,
      query: sourceRows[0].query,
      query_language: sourceRows[0].query_language,
      family: sourceRows[0].family,
      intent: sourceRows[0].intent,
      top5_symmetric_difference_pairs: symmetricDifferenceCount(a5, b5),
      top10_symmetric_difference_pairs: symmetricDifferenceCount(a10, b10),
      mean_absolute_rank_shift: round(queryAbsShift / POOL_DEPTH),
      max_absolute_rank_shift: queryMaxShift,
      unchanged_rank_count: queryUnchanged,
    });
  }

  const outputText = serializeJsonl(abRows);
  await writeJsonlAtomic(resolve(OUTPUT_PATH), abRows);

  const top5Sym = perQuery.reduce((sum, row) => sum + row.top5_symmetric_difference_pairs, 0);
  const top10Sym = perQuery.reduce((sum, row) => sum + row.top10_symmetric_difference_pairs, 0);

  const report = {
    schema_version: 'qwen3-ranking-movement-report-v1',
    ranking_experiment_id: 'qwen3-ranking-v1',
    purpose: 'development-structural-ranking-analysis',
    queries: EXPECTED_QUERIES,
    pool_depth: POOL_DEPTH,
    pairs: EXPECTED_ROWS,
    ab_rows: abRows.length,
    policy: {
      A: 'original production order',
      B: 'qwen_raw_score descending',
      tie_breaker: 'original production rank ascending',
      binary_threshold_used: false,
      score_blending: false,
      pool_membership_changes: false,
    },
    top5: {
      queries_changed: perQuery.filter((row) => row.top5_symmetric_difference_pairs > 0).length,
      symmetric_difference_pairs: top5Sym,
      entrants_to_B: top5Sym / 2,
      exits_from_A: top5Sym / 2,
    },
    top10: {
      queries_changed: perQuery.filter((row) => row.top10_symmetric_difference_pairs > 0).length,
      symmetric_difference_pairs: top10Sym,
      entrants_to_B: top10Sym / 2,
      exits_from_A: top10Sym / 2,
    },
    rank_movement: {
      mean_absolute_shift: round(totalAbsoluteShift / EXPECTED_ROWS),
      max_absolute_shift: maxAbsoluteShift,
      unchanged_rank_count: unchangedRankCount,
      changed_rank_count: EXPECTED_ROWS - unchangedRankCount,
    },
    score_ties: {
      equal_score_pairs: equalScorePairs,
      tie_breaker: 'original production rank ascending',
    },
    audit: {
      planned_scope: 'all query-document pairs in the Top-10 symmetric difference',
      candidate_pairs: top10Sym,
      must_hide: [
        'condition',
        'rank',
        'original_rank',
        'qwen_raw_score',
        'production score',
        'providers',
        'matchedQueries',
        'ranking provenance',
      ],
    },
    sources: {
      production_pool: { path: POOL_PATH, sha256: POOL_SHA256 },
      model_input_dataset: { path: DATASET_PATH, sha256: DATASET_SHA256 },
      raw_scores: { path: SCORES_PATH, sha256: SCORES_SHA256 },
    },
    output: {
      ab_run: OUTPUT_PATH,
      ab_run_sha256: sha256Text(outputText),
    },
    per_query: perQuery,
  };

  const meta = {
    schema_version: 'qwen3-ranking-ab-meta-v1',
    ranking_experiment_id: 'qwen3-ranking-v1',
    purpose: 'development-ranking-ab',
    row_count: abRows.length,
    condition_rows: { A: EXPECTED_ROWS, B: EXPECTED_ROWS },
    query_count: EXPECTED_QUERIES,
    pool_depth: POOL_DEPTH,
    same_pool_per_condition: true,
    qwen_model_called_during_ab_build: false,
    human_labels_used: false,
    binary_threshold_used: false,
    score_blending: false,
    sources: report.sources,
    output_sha256: report.output.ab_run_sha256,
  };

  await mkdir(dirname(resolve(META_PATH)), { recursive: true });
  await writeFile(resolve(META_PATH), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  await mkdir(dirname(resolve(REPORT_PATH)), { recursive: true });
  await writeFile(resolve(REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(resolve(REPORT_MD_PATH), renderMarkdown(report), 'utf8');

  return { report, meta };
}

async function main() {
  const { report } = await buildRankingAB();
  console.log('Qwen3 ranking A/B build complete');
  console.log(`queries=${report.queries}`);
  console.log(`pairs=${report.pairs}`);
  console.log(`ab_rows=${report.ab_rows}`);
  console.log(`top5_queries_changed=${report.top5.queries_changed}`);
  console.log(`top5_changed_pairs=${report.top5.symmetric_difference_pairs}`);
  console.log(`top10_queries_changed=${report.top10.queries_changed}`);
  console.log(`top10_changed_pairs=${report.top10.symmetric_difference_pairs}`);
  console.log(`mean_absolute_rank_shift=${report.rank_movement.mean_absolute_shift}`);
  console.log(`max_absolute_rank_shift=${report.rank_movement.max_absolute_shift}`);
  console.log(`same_rank=${report.rank_movement.unchanged_rank_count}`);
  console.log(`equal_score_pairs=${report.score_ties.equal_score_pairs}`);
  console.log(`ab_sha256=${report.output.ab_run_sha256}`);
  console.log(`ab=${OUTPUT_PATH}`);
  console.log(`meta=${META_PATH}`);
  console.log(`report=${REPORT_PATH}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
