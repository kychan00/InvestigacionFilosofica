import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const builderPath = new URL(
  '../scripts/benchmark/qwen3/build_browser_q8_confirmatory_holdout_v2_ab.mjs',
  import.meta.url,
);
const packagePath = new URL('../package.json', import.meta.url);

test('q8 confirmatory holdout v2 A/B pins frozen pool, dataset, scores and score-freeze commit', async () => {
  const source = await readFile(builderPath, 'utf8');
  for (const token of [
    '122a9414377c10e4805639e5022cce926130efd17e82111abd4756d5be33f9f8',
    '87270e16257135c133db8b395c8a65eb6197d681ded54bd68426f1c4a8666fdd',
    'ea8f06baf5144ff109b05ae9b9b690d9b25cf7cb7a12ae2dbbdeb38943aed6f1',
    '0d85099abf5c4d5e78b4de61019b324d3242b525',
  ]) assert.ok(source.includes(token), token);
  assert.match(source, /EXPECTED_ROWS = 600/u);
  assert.match(source, /EXPECTED_QUERIES = 30/u);
  assert.match(source, /POOL_DEPTH = 20/u);
});

test('q8 confirmatory holdout v2 A preserves production and B uses pure q8 raw-score ordering', async () => {
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

test('q8 confirmatory holdout v2 A/B requires identical 600-pair membership in both conditions', async () => {
  const source = await readFile(builderPath, 'utf8');
  assert.match(source, /A\/B condition pair counts are not exactly 600\/600/u);
  assert.match(source, /A and B do not contain the exact same candidate pool/u);
  assert.match(source, /same_pool_per_condition: true/u);
  assert.match(source, /condition_rows: \{ A: EXPECTED_ROWS, B: EXPECTED_ROWS \}/u);
});

test('q8 confirmatory holdout v2 A/B builder uses no human labels or model inference', async () => {
  const source = await readFile(builderPath, 'utf8');
  assert.match(source, /qwen_model_called_during_ab_build: false/u);
  assert.match(source, /human_labels_used: false/u);
  assert.doesNotMatch(source, /AutoModel|AutoTokenizer|from_pretrained/u);
});

test('q8 confirmatory holdout v2 A/B preflight is output-free and run refuses overwrite', async () => {
  const source = await readFile(builderPath, 'utf8');
  assert.match(source, /preflight-passed-no-output/u);
  assert.match(source, /writeOutput: mode === 'run'/u);
  assert.match(source, /refusing to overwrite frozen A\/B output/u);
});

test('q8 confirmatory holdout v2 A/B package commands separate preflight and run', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-confirmatory-holdout-v2:ab:preflight'],
    'node scripts/benchmark/qwen3/build_browser_q8_confirmatory_holdout_v2_ab.mjs --preflight',
  );
  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-confirmatory-holdout-v2:ab:run'],
    'node scripts/benchmark/qwen3/build_browser_q8_confirmatory_holdout_v2_ab.mjs --run',
  );
});
