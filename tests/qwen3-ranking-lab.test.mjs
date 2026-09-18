import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const preregPath = new URL('../benchmark/qwen3/ranking/qwen3-ranking-v1.preregistered.json', import.meta.url);
const serverPath = new URL('../scripts/benchmark/qwen3/run_ranking_lab_server.mjs', import.meta.url);
const browserPath = new URL('../scripts/benchmark/qwen3/runner-browser-ranking-lab.js', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 ranking lab preregisters a development-only pure rerank policy', async () => {
  const prereg = JSON.parse(await readFile(preregPath, 'utf8'));

  assert.equal(prereg.ranking_experiment_id, 'qwen3-ranking-v1');
  assert.equal(prereg.purpose, 'development-ranking-experiment');
  assert.equal(prereg.development_only, true);
  assert.equal(prereg.production_base_commit, 'bb9689da2016ca26a08359e8655eca7a5b771937');
  assert.equal(prereg.qwen_validation_freeze_commit, '86c7fe2');
  assert.equal(prereg.query_set.query_count, 50);
  assert.equal(prereg.retrieval.pool_depth, 20);
  assert.equal(prereg.retrieval.minimum_results_per_query, 20);
  assert.equal(prereg.candidate_ranking_policy.binary_threshold_used_for_ranking, false);
  assert.equal(prereg.candidate_ranking_policy.score_blending, false);
  assert.equal(prereg.candidate_ranking_policy.pool_membership_changes, false);
  assert.match(prereg.candidate_ranking_policy.B, /qwen_raw_score descending/u);
});

test('Qwen3 ranking lab retrieval is production-only and requires a complete 1000-row pool', async () => {
  const source = await readFile(serverPath, 'utf8');

  assert.match(source, /Qwen is NOT used in this retrieval step/u);
  assert.match(source, /Human labels are NOT used in this retrieval step/u);
  assert.match(source, /rows\.length !== poolDepth/u);
  assert.match(source, /Expected 1000 rows/u);
  assert.match(source, /qwen_used_during_retrieval: false/u);
  assert.match(source, /human_labels_used_during_retrieval: false/u);
  assert.match(source, /production_ranking_changed: false/u);
});

test('Qwen3 ranking lab browser calls only production search before freezing the pool', async () => {
  const source = await readFile(browserPath, 'utf8');

  assert.match(source, /searchPhilosophy/u);
  assert.match(source, /\/__qwen3_ranking\/start/u);
  assert.match(source, /\/__qwen3_ranking\/query/u);
  assert.match(source, /\/__qwen3_ranking\/finalize/u);
  assert.doesNotMatch(source, /raw_score/u);
  assert.doesNotMatch(source, /predicted_relevant/u);
  assert.doesNotMatch(source, /human_relevance/u);
});

test('Qwen3 ranking lab retrieval command is isolated from production ranking', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:ranking:run'],
    'npm run build:duckdb && node scripts/benchmark/qwen3/run_ranking_lab_server.mjs',
  );
});
