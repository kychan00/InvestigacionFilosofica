import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const preregPath = new URL('../benchmark/qwen3/validation/qwen3-reranker-v1-holdout.preregistered.json', import.meta.url);
const devDatasetPath = new URL('../benchmark/qwen3/datasets/human-audit-v1.jsonl', import.meta.url);
const benchmarkQueriesPath = new URL('../benchmark/queries.json', import.meta.url);
const multilingualValidationPath = new URL('../benchmark/validation-multilingual-ab-v1.queries.json', import.meta.url);
const serverPath = new URL('../scripts/benchmark/qwen3/run_holdout_server.mjs', import.meta.url);
const browserPath = new URL('../scripts/benchmark/qwen3/runner-browser-holdout.js', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

async function readPrereg() {
  return JSON.parse(await readFile(preregPath, 'utf8'));
}

function jsonlQueries(text) {
  return new Set(text.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line).query));
}

test('Qwen3 holdout freezes the candidate and forbids threshold retuning', async () => {
  const prereg = await readPrereg();
  assert.equal(prereg.status, 'preregistered-before-retrieval');
  assert.equal(prereg.development_freeze_commit, 'b3a795b');
  assert.equal(prereg.candidate.fixed_binary_threshold, 0.679178715);
  assert.equal(prereg.candidate.revision, 'e61197ed45024b0ed8a2d74b80b4d909f1255473');
  assert.equal(prereg.candidate.instruction_sha256, '5693a9a1377e10eb952d327aeec5c05cbbf040989feb786910b42e17cbf271a7');
  assert.equal(prereg.evaluation.threshold_retuning, false);
  assert.equal(prereg.evaluation.report_development_threshold_optimization_on_holdout, false);
});

test('Qwen3 holdout has 20 fresh multilingual queries and a fixed 100-pair human sample', async () => {
  const prereg = await readPrereg();
  assert.equal(prereg.queries.length, 20);
  assert.deepEqual(prereg.query_design.languages, ['es', 'en', 'de', 'fr', 'pt']);
  assert.deepEqual(prereg.query_design.human_audit_ranks, [1, 3, 5, 7, 10]);
  assert.equal(prereg.query_design.planned_human_pairs, 100);
  assert.equal(prereg.query_design.minimum_results_per_query, 10);

  const ids = new Set(prereg.queries.map((row) => row.id));
  assert.equal(ids.size, 20);

  const byFamily = new Map();
  const byLanguage = new Map();
  const byIntent = new Map();
  for (const row of prereg.queries) {
    byFamily.set(row.family, (byFamily.get(row.family) || 0) + 1);
    byLanguage.set(row.language, (byLanguage.get(row.language) || 0) + 1);
    byIntent.set(row.intent, (byIntent.get(row.intent) || 0) + 1);
  }
  assert.deepEqual([...byFamily.values()].sort((a, b) => a - b), [5, 5, 5, 5]);
  assert.deepEqual([...byLanguage.values()].sort((a, b) => a - b), [4, 4, 4, 4, 4]);
  assert.equal(byIntent.get('philosopher-concept'), 10);
  assert.equal(byIntent.get('work'), 5);
  assert.equal(byIntent.get('interdisciplinary-challenge'), 5);
});

test('Qwen3 holdout exact queries are absent from development and prior benchmark query sets', async () => {
  const [prereg, devText, benchmarkText, multilingualText] = await Promise.all([
    readPrereg(),
    readFile(devDatasetPath, 'utf8'),
    readFile(benchmarkQueriesPath, 'utf8'),
    readFile(multilingualValidationPath, 'utf8'),
  ]);

  const prior = new Set([
    ...jsonlQueries(devText),
    ...JSON.parse(benchmarkText).queries.map((row) => row.query),
    ...JSON.parse(multilingualText).queries.map((row) => row.query),
  ]);

  const collisions = prereg.queries.filter((row) => prior.has(row.query));
  assert.deepEqual(collisions, []);
});

test('Qwen3 holdout retrieval is production-only and cannot score with Qwen', async () => {
  const [server, browser, packageText] = await Promise.all([
    readFile(serverPath, 'utf8'),
    readFile(browserPath, 'utf8'),
    readFile(packagePath, 'utf8'),
  ]);
  assert.match(browser, /searchPhilosophy/u);
  assert.match(browser, /maxQueries: 5/u);
  assert.doesNotMatch(browser, /Qwen3RerankerAdapter/u);
  assert.doesNotMatch(browser, /raw_score/u);
  assert.doesNotMatch(server, /Qwen3RerankerAdapter/u);
  assert.match(server, /qwen_used_during_retrieval: false/u);
  assert.match(server, /human_labels_used_during_retrieval: false/u);
  assert.match(server, /production_base_commit: experiment\.base_commit/u);
  assert.match(server, /retrieval_runtime_commit: runtimeCommit/u);
  assert.doesNotMatch(server, /releaseManifest\.release\.runtimeCommit/u);

  const packageJson = JSON.parse(packageText);
  assert.equal(
    packageJson.scripts['benchmark:qwen3:holdout:run'],
    'npm run build:duckdb && node scripts/benchmark/qwen3/run_holdout_server.mjs',
  );
});
