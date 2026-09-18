import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const queriesPath = new URL('../benchmark/qwen3/ranking/validation/qwen3-ranking-holdout-v1.queries.json', import.meta.url);
const preregPath = new URL('../benchmark/qwen3/ranking/validation/qwen3-ranking-holdout-v1.preregistered.json', import.meta.url);
const devQueriesPath = new URL('../benchmark/queries.json', import.meta.url);
const priorHoldoutPath = new URL('../benchmark/qwen3/validation/qwen3-reranker-v1-holdout.preregistered.json', import.meta.url);
const serverPath = new URL('../scripts/benchmark/qwen3/run_ranking_holdout_server.mjs', import.meta.url);
const browserPath = new URL('../scripts/benchmark/qwen3/runner-browser-ranking-holdout.js', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 ranking holdout has 25 fresh multilingual queries balanced by family and language', async () => {
  const querySet = JSON.parse(await readFile(queriesPath, 'utf8'));
  assert.equal(querySet.queries.length, 25);

  const byLanguage = new Map();
  const byFamily = new Map();
  for (const query of querySet.queries) {
    byLanguage.set(query.language, (byLanguage.get(query.language) || 0) + 1);
    byFamily.set(query.family, (byFamily.get(query.family) || 0) + 1);
  }

  assert.deepEqual(Object.fromEntries([...byLanguage].sort()), {
    de: 5,
    en: 5,
    es: 5,
    fr: 5,
    pt: 5,
  });
  assert.equal(byFamily.size, 5);
  for (const count of byFamily.values()) assert.equal(count, 5);
});

test('Qwen3 ranking holdout exact queries are absent from development and previous Qwen holdout', async () => {
  const querySet = JSON.parse(await readFile(queriesPath, 'utf8'));
  const dev = JSON.parse(await readFile(devQueriesPath, 'utf8'));
  const prior = JSON.parse(await readFile(priorHoldoutPath, 'utf8'));

  const normalize = (value) => String(value).normalize('NFKC').trim().toLowerCase();
  const forbidden = new Set([
    ...dev.queries.map((query) => normalize(query.query)),
    ...prior.queries.map((query) => normalize(query.query)),
  ]);

  for (const query of querySet.queries) {
    assert.ok(!forbidden.has(normalize(query.query)), query.query);
  }
});

test('Qwen3 ranking holdout preregisters pure same-pool reranking and exact paired delta P@10', async () => {
  const prereg = JSON.parse(await readFile(preregPath, 'utf8'));

  assert.equal(prereg.query_set.query_count, 25);
  assert.equal(prereg.retrieval.pool_depth, 20);
  assert.equal(prereg.retrieval.minimum_results_per_query, 20);
  assert.equal(prereg.retrieval.qwen_used_during_retrieval, false);
  assert.equal(prereg.retrieval.human_labels_used_during_retrieval, false);
  assert.equal(prereg.candidate_ranking_policy.binary_threshold_used_for_ranking, false);
  assert.equal(prereg.candidate_ranking_policy.score_blending, false);
  assert.equal(prereg.candidate_ranking_policy.pool_membership_changes, false);
  assert.match(prereg.human_audit.primary_metric, /delta P@10/u);
  assert.equal(prereg.human_audit.relevant_threshold, 2);
});

test('Qwen3 ranking holdout retrieval uses only production search before freezing the pool', async () => {
  const [server, browser] = await Promise.all([
    readFile(serverPath, 'utf8'),
    readFile(browserPath, 'utf8'),
  ]);

  assert.match(browser, /searchPhilosophy/u);
  assert.doesNotMatch(browser, /qwen_raw_score/u);
  assert.doesNotMatch(browser, /human_relevance/u);
  assert.match(server, /qwen_used_during_retrieval: false/u);
  assert.match(server, /human_labels_used_during_retrieval: false/u);
  assert.match(server, /expectedRows/u);
});

test('Qwen3 ranking holdout retrieval command is isolated from inference and analysis', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.equal(
    pkg.scripts['benchmark:qwen3:ranking:holdout:run'],
    'npm run build:duckdb && node scripts/benchmark/qwen3/run_ranking_holdout_server.mjs',
  );
});
