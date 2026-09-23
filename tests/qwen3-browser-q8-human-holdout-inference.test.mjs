import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildAndAuditBrowserBundle,
} from '../scripts/benchmark/qwen3/run_browser_q8_human_holdout_inference.mjs';

const runnerPath =
  'scripts/benchmark/qwen3/run_browser_q8_human_holdout_inference.mjs';
const scorerPath =
  'scripts/benchmark/qwen3/browser_q8_1024_parity_pilot.js';
const freshPreregPath =
  'benchmark/qwen3/browser/q8-human-holdout/qwen3-browser-q8-human-holdout-v1.preregistered.json';
const sourceQ8PreregPath =
  'benchmark/qwen3/browser/q8-1024-parity-pilot/qwen3-browser-q8-1024-parity-pilot-v1.preregistered.json';
const datasetPath =
  'benchmark/qwen3/browser/q8-human-holdout/datasets/qwen3-browser-q8-human-holdout-v1.jsonl';
const packagePath = 'package.json';

const jsonl = (text) =>
  text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));

test('fresh q8 human holdout inference pins frozen preregistrations, dataset and scorer bytes', async () => {
  const runner = await readFile(runnerPath, 'utf8');
  for (const token of [
    '9575c35e5914dd7c6f48f1b03e12f31f381b91f52625f56155206d25ecd2b7ff',
    '5c4fd21aa9414048fe6c045350a773d661e316c902c13a225cc28ba5a976a79b',
    '52fa2d0c863c69270de5f77006b42106dcfb6ed7d998d9209934018e96edb4c4',
    '06d6ecb076113f2e2d77a47499a8f60e8d600ca49b34bc54dd6654e9f536b97c',
    'eb9e7147e94a194032fdd94045f03053374fe532',
    '34fd13a',
  ]) {
    assert.ok(runner.includes(token), token);
  }
});

test('fresh holdout browser model and prompt exactly inherit the closed q8 source contract', async () => {
  const fresh = JSON.parse(await readFile(freshPreregPath, 'utf8'));
  const source = JSON.parse(await readFile(sourceQ8PreregPath, 'utf8'));
  assert.deepEqual(fresh.browser_candidate.browser_model, source.browser_model);
  assert.deepEqual(fresh.browser_candidate.prompt_contract, source.prompt_contract);
  assert.equal(fresh.browser_candidate.browser_model.dtype, 'q8');
  assert.equal(fresh.browser_candidate.browser_model.device, 'webgpu');
  assert.equal(fresh.browser_candidate.prompt_contract.max_length, 1024);
  assert.equal(fresh.browser_candidate.binary_threshold_used_for_ranking, false);
});

test('fresh holdout inference dataset is exactly 500 clean ordered pairs', async () => {
  const rows = jsonl(await readFile(datasetPath, 'utf8'));
  assert.equal(rows.length, 500);
  assert.equal(new Set(rows.map((row) => row.query_id)).size, 25);
  assert.equal(new Set(rows.map((row) => `${row.query_id}\0${row.record_id}`)).size, 500);
  const allowed = [
    'abstract',
    'authors',
    'document_language',
    'query',
    'query_id',
    'record_id',
    'schema_version',
    'title',
    'year',
  ];
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), allowed);
  }
});

test('fresh holdout inference reuses the exact closed browser scorer and WebGPU bundle', async () => {
  const [runner, scorer] = await Promise.all([
    readFile(runnerPath, 'utf8'),
    readFile(scorerPath, 'utf8'),
  ]);
  assert.match(runner, /BROWSER_ENTRY_PATH[\s\S]*browser_q8_1024_parity_pilot\.js/u);
  assert.doesNotMatch(runner, /buildBrowserParityReport/u);
  assert.doesNotMatch(runner, /referenceScores/u);
  assert.match(scorer, /device:\s*'webgpu'/u);
  assert.match(scorer, /dtype:\s*'q8'/u);
  assert.match(scorer, /executionProviders:\s*\['webgpu'\]/u);
  assert.match(scorer, /originalRun\(feeds, \['logits'\]\)/u);
  assert.match(scorer, /num_logits_to_keep/u);

  const bundle = await buildAndAuditBrowserBundle();
  assert.equal(bundle.forbiddenNodeBackendInputs, 0);
  assert.match(bundle.transformersWebEntry, /transformers\.web\.js$/u);
  assert.ok(bundle.onnxWebInputCount > 0);
});

test('fresh holdout runner permits only preflight or one resumable official run', async () => {
  const runner = await readFile(runnerPath, 'utf8');
  assert.match(runner, /diagnostic inference is forbidden for the fresh human holdout/u);
  assert.match(runner, /preflight-passed-no-model-execution/u);
  assert.match(runner, /inference_executed:\s*false/u);
  assert.match(runner, /model_downloaded:\s*false/u);
  assert.match(runner, /writeJsonlAtomic\(checkpointPath, scores\)/u);
  assert.match(runner, /validateScoreSequence\(scores, frozen\.rows, frozen\)/u);
  assert.match(runner, /human_labels_used_during_inference:\s*false/u);
  assert.match(runner, /threshold_used_during_scoring:\s*false/u);
  assert.match(runner, /score_blending_used_during_scoring:\s*false/u);
  assert.match(runner, /candidate_pool_changed_during_scoring:\s*false/u);
  assert.match(runner, /production_changed:\s*false/u);
});

test('fresh holdout inference package commands isolate preflight from official scoring', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-human-holdout:infer:preflight'],
    'node scripts/benchmark/qwen3/run_browser_q8_human_holdout_inference.mjs --preflight',
  );
  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-human-holdout:infer:run'],
    'node scripts/benchmark/qwen3/run_browser_q8_human_holdout_inference.mjs --run',
  );
});
