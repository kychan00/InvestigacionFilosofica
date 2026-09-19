import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const builderPath = new URL('../scripts/benchmark/qwen3/build_ranking_holdout_ab.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 ranking holdout A/B pins frozen pool, dataset, and raw scores', async () => {
  const source = await readFile(builderPath, 'utf8');

  for (const token of [
    '26e39978dac68d37975732e2877830d58affc93a4e8c206edd4abd98f6b5d949',
    '99745f88c232d50d8b6715d6062beae556a71c364623916b9c41239076d56f17',
    'a463a8473cd9a2d465e6368849a341e6fbba1923ddea9d8fe785da92a10cdbd3',
  ]) assert.ok(source.includes(token), token);

  assert.match(source, /EXPECTED_ROWS = 500/u);
  assert.match(source, /EXPECTED_QUERIES = 25/u);
  assert.match(source, /POOL_DEPTH = 20/u);
});

test('Qwen3 ranking holdout A/B uses pure raw-score reranking with original-rank tie break', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /right\.qwen_raw_score - left\.qwen_raw_score/u);
  assert.match(source, /left\.original_rank - right\.original_rank/u);
  assert.match(source, /binary_threshold_used: false/u);
  assert.match(source, /score_blending: false/u);
  assert.match(source, /pool_membership_changes: false/u);
  assert.doesNotMatch(source, /0\.679178715/u);
});

test('Qwen3 ranking holdout A/B keeps identical membership and emits 1000 rows', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /condition: 'A'/u);
  assert.match(source, /condition: 'B'/u);
  assert.match(source, /condition_rows: \{ A: EXPECTED_ROWS, B: EXPECTED_ROWS \}/u);
  assert.match(source, /same_pool_per_condition: true/u);
  assert.match(source, /qwen_model_called_during_ab_build: false/u);
  assert.match(source, /human_labels_used: false/u);
});

test('Qwen3 ranking holdout A/B preregisters blind human audit from Top-10 changes only', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /exact paired human delta P@10/u);
  assert.match(source, /Top-10 symmetric difference/u);

  for (const token of [
    "'condition'",
    "'rank'",
    "'original_rank'",
    "'qwen_raw_score'",
    "'providers'",
    "'matchedQueries'",
  ]) assert.ok(source.includes(token), token);
});

test('Qwen3 ranking holdout A/B command is isolated from inference and production', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:ranking:holdout:ab'],
    'node scripts/benchmark/qwen3/build_ranking_holdout_ab.mjs',
  );
});
