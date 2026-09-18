import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const builderPath = new URL('../scripts/benchmark/qwen3/build_ranking_dataset.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 ranking dataset builder pins the frozen 1000-row production pool', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /qwen3-ranking-v1-production-pool-c2ca5ed\.jsonl/u);
  assert.match(source, /596dcb74f786a4e4ff40a705ec9f440accdfebca1ffcdadcdad2548ef7003b4c/u);
  assert.match(source, /SOURCE_FREEZE_COMMIT = '36314cc'/u);
  assert.match(source, /EXPECTED_ROWS = 1000/u);
  assert.match(source, /EXPECTED_QUERIES = 50/u);
  assert.match(source, /EXPECTED_PER_QUERY = 20/u);
});

test('Qwen3 ranking dataset builder maps document language but strips ranking provenance', async () => {
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

test('Qwen3 ranking dataset requires one clean model-input row per frozen pair', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /buildQwen3Dataset/u);
  assert.match(source, /duplicate_rows_removed !== 0/u);
  assert.match(source, /records\.length !== EXPECTED_ROWS/u);
  assert.match(source, /source ranks are not exactly 1\.\.20/u);
  assert.match(source, /duplicate record_id in frozen pool/u);
});

test('Qwen3 ranking dataset build command is isolated from inference and production ranking', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:ranking:dataset'],
    'node scripts/benchmark/qwen3/build_ranking_dataset.mjs',
  );
});
