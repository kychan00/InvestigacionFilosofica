import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { parseJsonlText } from '../scripts/benchmark/core/jsonl.mjs';
import {
  BROWSER_PARITY_EXPERIMENT_ID,
  SYSTEM_PREFIX,
  SYSTEM_SUFFIX,
  assertFrozenBrowserParityPreregistration,
  buildBrowserParityReport,
  buildQwen3InputFingerprint,
  formatQwen3Instruction,
  makeBrowserScoreRecord,
  validateFrozenDatasetRows,
} from '../scripts/benchmark/qwen3/browser_parity_core.mjs';
import {
  buildAndAuditBrowserBundle,
  runPreflight,
} from '../scripts/benchmark/qwen3/run_browser_parity.mjs';
import { buildQwen3DocumentText } from '../scripts/benchmark/qwen3/contracts.mjs';

const preregPath = new URL('../benchmark/qwen3/browser/qwen3-browser-parity-v1.preregistered.json', import.meta.url);
const datasetPath = new URL('../benchmark/qwen3/ranking/validation/datasets/qwen3-ranking-holdout-v1.jsonl', import.meta.url);
const instructionPath = new URL('../benchmark/qwen3/configs/qwen3-reranker-v1.instruction.txt', import.meta.url);
const referencePath = new URL('../benchmark/qwen3/ranking/validation/scores/qwen3-ranking-holdout-v1.raw.jsonl', import.meta.url);

async function fixtures() {
  const prereg = assertFrozenBrowserParityPreregistration(
    JSON.parse(await readFile(preregPath, 'utf8')),
  );
  const rows = validateFrozenDatasetRows(
    parseJsonlText(await readFile(datasetPath, 'utf8')),
    prereg,
  );
  return {
    prereg,
    rows,
    instruction: await readFile(instructionPath, 'utf8'),
    referenceScores: parseJsonlText(await readFile(referencePath, 'utf8')),
  };
}

test('browser parity prompt construction mirrors the frozen Python adapter bytes', async () => {
  const { instruction, rows } = await fixtures();
  const document = buildQwen3DocumentText(rows[0]);
  const content = formatQwen3Instruction(instruction, rows[0].query, document);

  assert.equal(
    content,
    `<Instruct>: ${instruction}<Query>: ${rows[0].query}\n<Document>: ${document}`,
  );
  assert.equal(
    buildQwen3InputFingerprint(instruction, rows[0].query, document),
    '843af92bf5333da41f91213dfc3c20292477f28bb7a334482287494d1bb3823a',
  );
  assert.equal(SYSTEM_PREFIX.endsWith('<|im_start|>user\n'), true);
  assert.equal(SYSTEM_SUFFIX, '<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n');
});

test('browser score rows contain only clean identifiers, raw score and frozen runtime metadata', async () => {
  const { prereg, rows, instruction } = await fixtures();
  const score = makeBrowserScoreRecord({
    row: rows[0],
    prereg,
    instruction,
    rawScore: 0.75,
    latencyMs: 12.5,
  });

  assert.equal(score.experiment_id, BROWSER_PARITY_EXPERIMENT_ID);
  assert.equal(score.device, 'webgpu');
  assert.equal(score.dtype, 'q4');
  assert.equal(score.max_length, 4096);
  assert.equal(score.raw_score, 0.75);
  assert.equal('human_relevance' in score, false);
  assert.equal('provider' in score, false);
  assert.equal('rank' in score, false);
});

test('identical browser/reference scores pass the preregistered 25/25 membership gate', async () => {
  const { prereg, rows, instruction, referenceScores } = await fixtures();
  const referenceByPair = new Map(
    referenceScores.map((record) => [`${record.query_id}\0${record.record_id}`, record]),
  );
  const browserScores = rows.map((row) => makeBrowserScoreRecord({
    row,
    prereg,
    instruction,
    rawScore: referenceByPair.get(`${row.query_id}\0${row.record_id}`).raw_score,
    latencyMs: 1,
  }));
  const report = buildBrowserParityReport({ rows, browserScores, referenceScores, prereg });

  assert.deepEqual(report.primary_gate, {
    required_queries_equal: 25,
    queries_equal: 25,
    total_queries: 25,
    passed: true,
  });
  assert.equal(report.secondary_metrics.exact_top10_order_queries, 25);
  assert.equal(report.secondary_metrics.raw_score_spearman, 1);
  assert.equal(report.secondary_metrics.raw_score_pearson, 1);
  assert.equal(report.secondary_metrics.max_absolute_score_difference, 0);
});

test('one changed Top-10 membership fails the primary gate without tuning', async () => {
  const { prereg, rows, instruction, referenceScores } = await fixtures();
  const referenceByPair = new Map(
    referenceScores.map((record) => [`${record.query_id}\0${record.record_id}`, record]),
  );
  const browserScores = rows.map((row) => makeBrowserScoreRecord({
    row,
    prereg,
    instruction,
    rawScore: referenceByPair.get(`${row.query_id}\0${row.record_id}`).raw_score,
    latencyMs: 1,
  }));
  const firstQuery = rows[0].query_id;
  const referenceFirstQuery = referenceScores
    .filter((record) => record.query_id === firstQuery)
    .sort((a, b) => b.raw_score - a.raw_score || rows.findIndex((row) => row.record_id === a.record_id) - rows.findIndex((row) => row.record_id === b.record_id));
  const tenth = browserScores.find((record) => record.query_id === firstQuery && record.record_id === referenceFirstQuery[9].record_id);
  const eleventh = browserScores.find((record) => record.query_id === firstQuery && record.record_id === referenceFirstQuery[10].record_id);
  tenth.raw_score = 0;
  eleventh.raw_score = 1;

  const report = buildBrowserParityReport({ rows, browserScores, referenceScores, prereg });
  assert.equal(report.primary_gate.queries_equal, 24);
  assert.equal(report.primary_gate.passed, false);
});

test('browser bundle selects Transformers.js web export and excludes onnxruntime-node', async () => {
  const bundle = await buildAndAuditBrowserBundle();

  assert.match(bundle.transformersWebEntry, /transformers\.web\.js$/u);
  assert.ok(bundle.onnxWebInputCount > 0);
  assert.match(bundle.code, /executionProviders:\s*\["webgpu"\]/u);
  assert.match(bundle.code, /Node\.js runtime is forbidden/u);
  assert.match(bundle.code, /session .* did not select WebGPU/u);
  assert.match(bundle.code, /wasm\.numThreads\s*=\s*1/u);
  assert.match(bundle.code, /wasm_host_threads:\s*1/u);
  assert.match(bundle.code, /num_logits_to_keep:\s*numLogitsToKeep/u);
  assert.match(bundle.code, /num_logits_to_keep:\s*1/u);
  assert.match(bundle.code, /return originalRun\(feeds, \["logits"\]\)/u);
  assert.match(bundle.code, /fetches:\s*\["logits"\]/u);
});

test('preflight verifies frozen inputs without executing inference or downloading a model', async () => {
  const result = await runPreflight();

  assert.equal(result.status, 'preflight-passed-no-model-execution');
  assert.equal(result.dataset.rows, 500);
  assert.equal(result.browser_bundle.forbidden_node_backend_inputs, 0);
  assert.equal(result.inference_executed, false);
  assert.equal(result.model_downloaded, false);
});
