import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const builderPath = new URL('../scripts/benchmark/qwen3/build_ranking_holdout_dataset.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 ranking holdout dataset builder pins the frozen 500-row pool', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /qwen3-ranking-holdout-v1-production-pool-e10bbc4\.jsonl/u);
  assert.match(source, /26e39978dac68d37975732e2877830d58affc93a4e8c206edd4abd98f6b5d949/u);
  assert.match(source, /0de6853b1b4e71fab74876152d0af41d8a5c242cbad7b0a936283a0f26a36918/u);
  assert.match(source, /SOURCE_FREEZE_COMMIT = '9c1bf8b'/u);
  assert.match(source, /EXPECTED_ROWS = 500/u);
  assert.match(source, /EXPECTED_QUERIES = 25/u);
  assert.match(source, /EXPECTED_PER_QUERY = 20/u);
});

test('Qwen3 ranking holdout dataset strips ranking and provider provenance', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /document_language: row\.document_language \?\? row\.language \?\? null/u);
  assert.match(source, /contains_human_labels: false/u);
  assert.match(source, /contains_ranking_provenance: false/u);
  assert.match(source, /contains_provider_provenance: false/u);

  for (const token of [
    "'rank'",
    "'score'",
    "'relevanceLevel'",
    "'providers'",
    "'matchedQueries'",
    "'ranking'",
    "'urls'",
    "'citedBy'",
  ]) {
    assert.ok(source.includes(token), token);
  }
});

test('Qwen3 ranking holdout dataset keeps one clean model-input row per frozen pair', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /buildQwen3Dataset/u);
  assert.match(source, /duplicate_rows_removed !== 0/u);
  assert.match(source, /records\.length !== EXPECTED_ROWS/u);
  assert.match(source, /source ranks are not exactly 1\.\.20/u);
  assert.match(source, /duplicate record_id in frozen holdout pool/u);
});

test('Qwen3 ranking holdout dataset command is isolated from inference and production', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:ranking:holdout:dataset'],
    'node scripts/benchmark/qwen3/build_ranking_holdout_dataset.mjs',
  );
});
