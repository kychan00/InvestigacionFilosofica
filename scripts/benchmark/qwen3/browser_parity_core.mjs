import { createHash } from 'node:crypto';

import {
  QWEN3_SCORE_SCHEMA,
  buildQwen3DocumentText,
  validateQwen3DatasetRecord,
  validateQwen3ScoreRecord,
} from './contracts.mjs';

export const BROWSER_PARITY_EXPERIMENT_ID = 'qwen3-browser-parity-v1';
export const BROWSER_SCORE_OUTPUT =
  'benchmark/qwen3/browser/scores/qwen3-browser-parity-v1.raw.jsonl';
export const BROWSER_SCORE_METADATA_OUTPUT =
  'benchmark/qwen3/browser/scores/qwen3-browser-parity-v1.raw.meta.json';
export const BROWSER_PARITY_REPORT_OUTPUT =
  'benchmark/qwen3/browser/reports/qwen3-browser-parity-v1.report.json';
export const BROWSER_PARITY_LOG_OUTPUT =
  'benchmark/qwen3/browser/logs/qwen3-browser-parity-v1.log';
export const BROWSER_CHECKPOINT =
  'benchmark/qwen3/cache/qwen3-browser-parity-v1.partial.jsonl';

export const SYSTEM_PREFIX =
  '<|im_start|>system\n' +
  'Judge whether the Document meets the requirements based on the Query and the Instruct provided. ' +
  'Note that the answer can only be "yes" or "no".' +
  '<|im_end|>\n<|im_start|>user\n';

export const SYSTEM_SUFFIX = '<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n';

export function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function formatQwen3Instruction(instruction, query, document) {
  const separator = instruction.endsWith('\n') ? '' : '\n';
  return `<Instruct>: ${instruction}${separator}<Query>: ${query}\n<Document>: ${document}`;
}

export function buildQwen3InputFingerprint(instruction, query, document) {
  return sha256Bytes(Buffer.from(`${instruction}\0${query}\0${document}`, 'utf8'));
}

export function assertFrozenBrowserParityPreregistration(prereg) {
  const checks = [
    [prereg.experiment_id, BROWSER_PARITY_EXPERIMENT_ID, 'experiment_id'],
    [prereg.status, 'preregistered-before-browser-model-execution', 'status'],
    [prereg.browser_model.model_id, 'onnx-community/Qwen3-Reranker-0.6B-ONNX', 'model_id'],
    [
      prereg.browser_model.revision,
      '9995c50e2310679108a55f5ccd16ba8be9f17c20',
      'browser revision',
    ],
    [prereg.browser_model.artifact, 'onnx/model_q4.onnx', 'browser artifact'],
    [prereg.browser_model.dtype, 'q4', 'browser dtype'],
    [prereg.browser_model.primary_device, 'webgpu', 'primary device'],
    [prereg.browser_model.transformers_js_version, '4.3.0', 'Transformers.js version'],
    [prereg.prompt_contract.max_length, 4096, 'max length'],
    [prereg.prompt_contract.padding_side, 'left', 'padding side'],
    [prereg.prompt_contract.system_prefix, SYSTEM_PREFIX.replaceAll('\n', '\\n'), 'system prefix'],
    [prereg.prompt_contract.system_suffix, SYSTEM_SUFFIX.replaceAll('\n', '\\n'), 'system suffix'],
    [prereg.model_input.rows, 500, 'dataset rows'],
    [prereg.model_input.queries, 25, 'dataset queries'],
    [prereg.primary_parity_gate.required_queries_equal, 25, 'parity gate'],
  ];

  for (const [actual, expected, label] of checks) {
    if (actual !== expected) {
      throw new Error(`frozen preregistration mismatch for ${label}: expected ${expected}, got ${actual}`);
    }
  }

  if (
    prereg.ranking_contract.threshold_used ||
    prereg.ranking_contract.score_blending ||
    prereg.ranking_contract.retrieval_changes ||
    prereg.ranking_contract.candidate_pool_changes
  ) {
    throw new Error('frozen ranking contract unexpectedly permits tuning or candidate changes');
  }

  return prereg;
}

export function validateFrozenDatasetRows(rows, prereg) {
  if (!Array.isArray(rows) || rows.length !== prereg.model_input.rows) {
    throw new Error(`dataset must contain exactly ${prereg.model_input.rows} rows`);
  }

  const counts = new Map();
  const recordKeys = new Set();
  for (const row of rows) {
    validateQwen3DatasetRecord(row);
    counts.set(row.query_id, (counts.get(row.query_id) ?? 0) + 1);
    const key = `${row.query_id}\0${row.record_id}`;
    if (recordKeys.has(key)) throw new Error(`duplicate dataset pair: ${row.query_id}/${row.record_id}`);
    recordKeys.add(key);
  }

  if (counts.size !== prereg.model_input.queries) {
    throw new Error(`dataset must contain exactly ${prereg.model_input.queries} queries`);
  }
  for (const [queryId, count] of counts) {
    if (count !== 20) throw new Error(`query ${queryId} must contain exactly 20 records`);
  }
  return rows;
}

export function makeBrowserScoreRecord({ row, prereg, instruction, rawScore, latencyMs }) {
  const document = buildQwen3DocumentText(row);
  return validateQwen3ScoreRecord({
    schema_version: QWEN3_SCORE_SCHEMA,
    experiment_id: BROWSER_PARITY_EXPERIMENT_ID,
    query_id: row.query_id,
    record_id: row.record_id,
    model: prereg.browser_model.model_id,
    revision: prereg.browser_model.revision,
    instruction_sha256: prereg.prompt_contract.instruction_sha256,
    input_sha256: buildQwen3InputFingerprint(instruction, row.query, document),
    raw_score: rawScore,
    latency_ms: latencyMs,
    device: 'webgpu',
    dtype: prereg.browser_model.dtype,
    max_length: prereg.prompt_contract.max_length,
    cache_hit: false,
  });
}

function keyOf(record) {
  return `${record.query_id}\0${record.record_id}`;
}

export function validateScoreSequence(scores, rows, prereg) {
  if (!Array.isArray(scores) || scores.length > rows.length) {
    throw new Error('score sequence is not a valid dataset prefix');
  }
  for (let index = 0; index < scores.length; index += 1) {
    validateQwen3ScoreRecord(scores[index]);
    if (keyOf(scores[index]) !== keyOf(rows[index])) {
      throw new Error(`score row ${index + 1} does not match frozen dataset order`);
    }
    if (
      scores[index].experiment_id !== BROWSER_PARITY_EXPERIMENT_ID ||
      scores[index].model !== prereg.browser_model.model_id ||
      scores[index].revision !== prereg.browser_model.revision ||
      scores[index].device !== 'webgpu' ||
      scores[index].dtype !== prereg.browser_model.dtype
    ) {
      throw new Error(`score row ${index + 1} violates frozen browser runtime contract`);
    }
  }
  return scores;
}

function groupRankings(rows, scores) {
  const scoreByKey = new Map(scores.map((record) => [keyOf(record), record.raw_score]));
  const groups = new Map();
  for (const [originalIndex, row] of rows.entries()) {
    const rawScore = scoreByKey.get(keyOf(row));
    if (!Number.isFinite(rawScore)) throw new Error(`missing score for ${keyOf(row)}`);
    const group = groups.get(row.query_id) ?? [];
    group.push({ query_id: row.query_id, record_id: row.record_id, raw_score: rawScore, original_rank: group.length + 1, original_index: originalIndex });
    groups.set(row.query_id, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.raw_score - a.raw_score || a.original_rank - b.original_rank);
  }
  return groups;
}

function pearson(xs, ys) {
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const dx = xs[index] - meanX;
    const dy = ys[index] - meanY;
    numerator += dx * dy;
    sumX += dx * dx;
    sumY += dy * dy;
  }
  return numerator / Math.sqrt(sumX * sumY);
}

function averageRanks(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = Array(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end += 1;
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) ranks[sorted[index].index] = rank;
    start = end;
  }
  return ranks;
}

function spearman(xs, ys) {
  return pearson(averageRanks(xs), averageRanks(ys));
}

function rankCorrelation(reference, browser) {
  const browserRank = new Map(browser.map((item, index) => [item.record_id, index + 1]));
  const n = reference.length;
  const squaredDifference = reference.reduce((sum, item, index) => {
    const difference = index + 1 - browserRank.get(item.record_id);
    return sum + difference * difference;
  }, 0);
  return 1 - (6 * squaredDifference) / (n * (n * n - 1));
}

export function buildBrowserParityReport({ rows, browserScores, referenceScores, prereg }) {
  validateScoreSequence(browserScores, rows, prereg);
  if (browserScores.length !== rows.length) throw new Error('browser output is incomplete');

  const referenceByKey = new Map(referenceScores.map((record) => [keyOf(record), record]));
  if (referenceByKey.size !== rows.length) throw new Error('reference score set is incomplete');
  const orderedReferenceScores = rows.map((row) => {
    const score = referenceByKey.get(keyOf(row));
    if (!score) throw new Error(`reference score missing for ${keyOf(row)}`);
    return score;
  });

  const browserGroups = groupRankings(rows, browserScores);
  const referenceGroups = groupRankings(rows, orderedReferenceScores);
  const perQuery = [];
  for (const [queryId, reference] of referenceGroups) {
    const browser = browserGroups.get(queryId);
    const referenceTop10 = reference.slice(0, 10).map((item) => item.record_id);
    const browserTop10 = browser.slice(0, 10).map((item) => item.record_id);
    const browserMembers = new Set(browserTop10);
    const overlap = referenceTop10.filter((recordId) => browserMembers.has(recordId)).length;
    perQuery.push({
      query_id: queryId,
      top10_membership_equal: overlap === 10,
      top10_order_equal: referenceTop10.every((recordId, index) => recordId === browserTop10[index]),
      top10_overlap: overlap,
      full_top20_spearman: rankCorrelation(reference, browser),
      reference_top10_record_ids: referenceTop10,
      browser_top10_record_ids: browserTop10,
    });
  }

  const browserRaw = browserScores.map((record) => record.raw_score);
  const referenceRaw = orderedReferenceScores.map((record) => record.raw_score);
  const absoluteDifferences = browserRaw.map((score, index) => Math.abs(score - referenceRaw[index]));
  const membershipsEqual = perQuery.filter((item) => item.top10_membership_equal).length;

  return {
    schema_version: 'qwen3-browser-parity-report-v1',
    experiment_id: BROWSER_PARITY_EXPERIMENT_ID,
    primary_gate: {
      required_queries_equal: prereg.primary_parity_gate.required_queries_equal,
      queries_equal: membershipsEqual,
      total_queries: perQuery.length,
      passed: membershipsEqual === prereg.primary_parity_gate.required_queries_equal,
    },
    secondary_metrics: {
      exact_top10_order_queries: perQuery.filter((item) => item.top10_order_equal).length,
      raw_score_spearman: spearman(referenceRaw, browserRaw),
      raw_score_pearson: pearson(referenceRaw, browserRaw),
      mean_absolute_score_difference:
        absoluteDifferences.reduce((sum, value) => sum + value, 0) / absoluteDifferences.length,
      max_absolute_score_difference: Math.max(...absoluteDifferences),
    },
    per_query: perQuery,
  };
}

export function formatParityLog({ report, runtimeMetadata, outputHashes }) {
  const lines = [
    `experiment_id=${BROWSER_PARITY_EXPERIMENT_ID}`,
    `runtime=browser`,
    `onnx_backend=${runtimeMetadata.onnx_backend}`,
    `execution_provider=${runtimeMetadata.execution_provider}`,
    `device=${runtimeMetadata.device}`,
    `dtype=${runtimeMetadata.dtype}`,
    `adapter=${JSON.stringify(runtimeMetadata.adapter_info)}`,
    `scores_sha256=${outputHashes.scores}`,
    `metadata_sha256=${outputHashes.metadata}`,
    `queries_equal=${report.primary_gate.queries_equal}/${report.primary_gate.total_queries}`,
    `primary_gate=${report.primary_gate.passed ? 'PASS' : 'FAIL'}`,
    `exact_top10_order_queries=${report.secondary_metrics.exact_top10_order_queries}`,
    `raw_score_spearman=${report.secondary_metrics.raw_score_spearman}`,
    `raw_score_pearson=${report.secondary_metrics.raw_score_pearson}`,
    `mean_absolute_score_difference=${report.secondary_metrics.mean_absolute_score_difference}`,
    `max_absolute_score_difference=${report.secondary_metrics.max_absolute_score_difference}`,
  ];
  for (const item of report.per_query) {
    lines.push(
      `${item.query_id} membership=${item.top10_membership_equal ? 'equal' : 'different'} ` +
      `order=${item.top10_order_equal ? 'equal' : 'different'} overlap=${item.top10_overlap}/10 ` +
      `top20_spearman=${item.full_top20_spearman}`,
    );
  }
  return `${lines.join('\n')}\n`;
}
