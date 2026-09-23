import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const builderPath = new URL('../scripts/benchmark/qwen3/build_browser_q8_human_holdout_dataset.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('q8 human holdout dataset builder pins the frozen 500-row pool', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /qwen3-browser-q8-human-holdout-v1-production-pool\.jsonl/u);
  assert.match(source, /938322b67d543780a0489e0b5b0d63658c18b0fb32562f27f57fb7277c9711dd/u);
  assert.match(source, /0c81a62d20661d813ecf772c09f7c4adb7fef6f63f7d29c0082c6295ccfd3053/u);
  assert.match(source, /SOURCE_FREEZE_COMMIT = 'dc326c9'/u);
  assert.match(source, /EXPECTED_ROWS = 500/u);
  assert.match(source, /EXPECTED_QUERIES = 25/u);
  assert.match(source, /EXPECTED_PER_QUERY = 20/u);
});

test('q8 human holdout dataset strips ranking and provider provenance', async () => {
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

test('q8 human holdout dataset keeps one clean model-input row per frozen pair', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /buildQwen3Dataset/u);
  assert.match(source, /duplicate_rows_removed !== 0/u);
  assert.match(source, /records\.length !== EXPECTED_ROWS/u);
  assert.match(source, /source ranks are not exactly 1\.\.20/u);
  assert.match(source, /duplicate record_id in frozen holdout pool/u);
});

test('q8 human holdout dataset command is isolated from inference and production', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-human-holdout:dataset:run'],
    'node scripts/benchmark/qwen3/build_browser_q8_human_holdout_dataset.mjs --run',
  );
});
