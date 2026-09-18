import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const analyzerPath = new URL('../scripts/benchmark/qwen3/analyze_holdout_validation.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 holdout analyzer pins frozen score, prediction, and judgment hashes', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  for (const hash of [
    'e8ccace4407ce9d235aefdf0a2cdc8ec36ec0d1df9843d9ae53611001f0f8942',
    'd9c260018e68c376e487486c38f57894e93abdf962de105ebc3a4fda72542c9c',
    'dc8cb4c9a377e7b4191e5299e274fe9a63af55cdea407026304a6c08a33b6f23',
    '27898e33a40b4b438946a69f616418697c6bd2862fb4e151dfbce09985657408',
  ]) {
    assert.ok(source.includes(hash));
  }

  assert.ok(source.includes("scoreFreezeCommit: 'b8c4a7a'"));
  assert.ok(source.includes("judgmentFreezeCommit: 'ad19e80'"));
});

test('Qwen3 holdout analyzer evaluates only the frozen development threshold', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  assert.ok(source.includes('fixedThreshold: 0.679178715'));
  assert.ok(source.includes('threshold_retuned_on_holdout: false'));
  assert.ok(!source.includes('selectBestF1Threshold'));
  assert.ok(!source.includes('thresholdSweep'));
});

test('Qwen3 holdout analyzer reports continuous, binary, breakdown, and error metrics', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  for (const token of [
    'rocAuc',
    'averagePrecision',
    'spearman',
    'cohenKappaBinary',
    "breakdown(rows, 'query_language')",
    "breakdown(rows, 'family')",
    "breakdown(rows, 'intent')",
    'false_positives',
    'false_negatives',
  ]) {
    assert.ok(source.includes(token), token);
  }
});

test('Qwen3 holdout validation command is wired separately from development calibration', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:holdout:analyze'],
    'node scripts/benchmark/qwen3/analyze_holdout_validation.mjs',
  );
  assert.equal(
    pkg.scripts['benchmark:qwen3:calibrate'],
    'node scripts/benchmark/qwen3/calibrate.mjs',
  );
});
