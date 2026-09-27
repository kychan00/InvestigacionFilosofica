import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const builderPath = new URL('../scripts/benchmark/qwen3/build_browser_q8_confirmatory_holdout_v2_dataset.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('q8 confirmatory holdout v2 dataset builder pins the frozen 600-row pool', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /qwen3-browser-q8-confirmatory-holdout-v2-production-pool\.jsonl/u);
  assert.match(source, /122a9414377c10e4805639e5022cce926130efd17e82111abd4756d5be33f9f8/u);
  assert.match(source, /782575648eaa1b9bc29a429cb9eb7f0f6896c4bb7532704d5f4f8e43ed8c3f75/u);
  assert.match(source, /SOURCE_FREEZE_COMMIT = '85f866ecc56bcfca5c53e00c2fdceb014ea77fbe'/u);
  assert.match(source, /EXPECTED_ROWS = 600/u);
  assert.match(source, /EXPECTED_QUERIES = 30/u);
  assert.match(source, /EXPECTED_PER_QUERY = 20/u);
});

test('q8 confirmatory holdout v2 dataset strips ranking and provider provenance', async () => {
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

test('q8 confirmatory holdout v2 dataset keeps one clean model-input row per frozen pair', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /buildQwen3Dataset/u);
  assert.match(source, /duplicate_rows_removed !== 0/u);
  assert.match(source, /records\.length !== EXPECTED_ROWS/u);
  assert.match(source, /source ranks are not exactly 1\.\.20/u);
  assert.match(source, /duplicate record_id in frozen holdout pool/u);
});

test('q8 confirmatory holdout v2 dataset command is isolated from inference and production', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-confirmatory-holdout-v2:dataset:run'],
    'node scripts/benchmark/qwen3/build_browser_q8_confirmatory_holdout_v2_dataset.mjs --run',
  );
});
