import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const builderPath = new URL('../scripts/benchmark/qwen3/build_ranking_ab.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 ranking A/B builder pins the frozen pool, dataset, and raw scores', async () => {
  const source = await readFile(builderPath, 'utf8');

  for (const token of [
    '596dcb74f786a4e4ff40a705ec9f440accdfebca1ffcdadcdad2548ef7003b4c',
    'd0f6b29834053615b44f823c7cb61f14478965eb72409ba1ab98742da224c548',
    '09483050c0c327c3fb9115c245a0584ac9f38107133e0363fa255d23a0b4b29c',
  ]) {
    assert.ok(source.includes(token), token);
  }

  assert.match(source, /EXPECTED_ROWS = 1000/u);
  assert.match(source, /EXPECTED_QUERIES = 50/u);
  assert.match(source, /POOL_DEPTH = 20/u);
});

test('Qwen3 ranking A/B uses raw score descending with original-rank tie breaker only', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /right\.qwen_raw_score - left\.qwen_raw_score/u);
  assert.match(source, /left\.original_rank - right\.original_rank/u);
  assert.match(source, /binary_threshold_used: false/u);
  assert.match(source, /score_blending: false/u);
  assert.match(source, /pool_membership_changes: false/u);
  assert.doesNotMatch(source, /0\.679178715/u);
});

test('Qwen3 ranking A/B keeps identical pair membership and emits 2000 condition rows', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /condition: 'A'/u);
  assert.match(source, /condition: 'B'/u);
  assert.match(source, /condition_rows: \{ A: EXPECTED_ROWS, B: EXPECTED_ROWS \}/u);
  assert.match(source, /same_pool_per_condition: true/u);
  assert.match(source, /qwen_model_called_during_ab_build: false/u);
  assert.match(source, /human_labels_used: false/u);
});

test('Qwen3 ranking A/B plans blind audit only from Top-10 membership changes', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /Top-10 symmetric difference/u);
  for (const token of [
    "'condition'",
    "'rank'",
    "'original_rank'",
    "'qwen_raw_score'",
    "'providers'",
    "'matchedQueries'",
  ]) {
    assert.ok(source.includes(token), token);
  }
});

test('Qwen3 ranking A/B command is isolated from inference and production', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:ranking:ab'],
    'node scripts/benchmark/qwen3/build_ranking_ab.mjs',
  );
});
