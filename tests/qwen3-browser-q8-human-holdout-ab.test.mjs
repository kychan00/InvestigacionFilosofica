import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const builderPath = new URL(
  '../scripts/benchmark/qwen3/build_browser_q8_human_holdout_ab.mjs',
  import.meta.url,
);
const packagePath = new URL('../package.json', import.meta.url);

test('fresh q8 human holdout A/B pins frozen pool, dataset, scores and score-freeze commit', async () => {
  const source = await readFile(builderPath, 'utf8');
  for (const token of [
    '938322b67d543780a0489e0b5b0d63658c18b0fb32562f27f57fb7277c9711dd',
    '52fa2d0c863c69270de5f77006b42106dcfb6ed7d998d9209934018e96edb4c4',
    'c260c2f3194cda9cef91c9efc1b1cf7a0c0adee4c2b2d5a1e56c0855c35cd518',
    '604214b2e9f76e960b2488d6a8fd3dec3b1946b5',
  ]) assert.ok(source.includes(token), token);
  assert.match(source, /EXPECTED_ROWS = 500/u);
  assert.match(source, /EXPECTED_QUERIES = 25/u);
  assert.match(source, /POOL_DEPTH = 20/u);
});

test('fresh q8 human holdout A preserves production and B uses pure q8 raw-score ordering', async () => {
  const source = await readFile(builderPath, 'utf8');
  assert.match(source, /condition: 'A'/u);
  assert.match(source, /condition: 'B'/u);
  assert.match(
    source,
    /right\.browser_q8_raw_score - left\.browser_q8_raw_score/u,
  );
  assert.match(source, /left\.original_rank - right\.original_rank/u);
  assert.match(source, /binary_threshold_used: false/u);
  assert.match(source, /score_blending: false/u);
  assert.match(source, /pool_membership_changes: false/u);
});

test('fresh q8 human holdout A/B requires identical 500-pair membership in both conditions', async () => {
  const source = await readFile(builderPath, 'utf8');
  assert.match(source, /A\/B condition pair counts are not exactly 500\/500/u);
  assert.match(source, /A and B do not contain the exact same candidate pool/u);
  assert.match(source, /same_pool_per_condition: true/u);
  assert.match(source, /condition_rows: \{ A: EXPECTED_ROWS, B: EXPECTED_ROWS \}/u);
});

test('fresh q8 human holdout A/B builder uses no human labels or model inference', async () => {
  const source = await readFile(builderPath, 'utf8');
  assert.match(source, /qwen_model_called_during_ab_build: false/u);
  assert.match(source, /human_labels_used: false/u);
  assert.doesNotMatch(source, /AutoModel|AutoTokenizer|from_pretrained/u);
});

test('fresh q8 human holdout A/B preflight is output-free and run refuses overwrite', async () => {
  const source = await readFile(builderPath, 'utf8');
  assert.match(source, /preflight-passed-no-output/u);
  assert.match(source, /writeOutput: mode === 'run'/u);
  assert.match(source, /refusing to overwrite frozen A\/B output/u);
});

test('fresh q8 human holdout A/B package commands separate preflight and run', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-human-holdout:ab:preflight'],
    'node scripts/benchmark/qwen3/build_browser_q8_human_holdout_ab.mjs --preflight',
  );
  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-human-holdout:ab:run'],
    'node scripts/benchmark/qwen3/build_browser_q8_human_holdout_ab.mjs --run',
  );
});
