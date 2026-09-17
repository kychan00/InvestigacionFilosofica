import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifestPath = new URL('../benchmark/qwen3/configs/qwen3-reranker-v1-holdout-v1.inference.json', import.meta.url);
const inferencePath = new URL('../scripts/benchmark/qwen3/inference.py', import.meta.url);
const predictionsPath = new URL('../scripts/benchmark/qwen3/build_holdout_predictions.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

async function readManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

test('Qwen3 holdout inference pins the frozen sample dataset and candidate threshold', async () => {
  const manifest = await readManifest();
  assert.equal(manifest.validation_id, 'qwen3-reranker-v1-holdout-v1');
  assert.equal(manifest.sample_dataset_freeze_commit, '859216e');
  assert.equal(
    manifest.dataset.sha256,
    'bc0de328ea953840909435cdcf4c4e346103d56d6c97db25738c094ef3321e64',
  );
  assert.equal(manifest.dataset.rows, 100);
  assert.equal(manifest.dataset.contains_human_labels, false);
  assert.equal(manifest.dataset.contains_ranking_provenance, false);
  assert.equal(manifest.prediction.fixed_binary_threshold, 0.679178715);
  assert.equal(manifest.prediction.threshold_retuning, false);
});

test('Qwen3 holdout inference writes to isolated validation score and cache paths', async () => {
  const manifest = await readManifest();
  assert.equal(
    manifest.inference.raw_output,
    'benchmark/qwen3/validation/scores/qwen3-reranker-v1-holdout-v1.raw.jsonl',
  );
  assert.equal(
    manifest.inference.raw_metadata,
    'benchmark/qwen3/validation/scores/qwen3-reranker-v1-holdout-v1.raw.meta.json',
  );
  assert.equal(
    manifest.inference.local_cache,
    'benchmark/qwen3/cache/qwen3-reranker-v1-holdout-v1.cache.jsonl',
  );

  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  const command = pkg.scripts['benchmark:qwen3:holdout:infer'];
  assert.match(command, /qwen3-reranker-v1-holdout-v1\.inference\.json/u);
  assert.match(command, /qwen3-reranker-v1-holdout-v1\.raw\.jsonl/u);
  assert.doesNotMatch(command, /qwen3-reranker-v1\.raw\.jsonl(?:\s|$)/u);
});

test('Qwen3 inference metadata takes its purpose from the active manifest', async () => {
  const source = await readFile(inferencePath, 'utf8');
  assert.match(
    source,
    /manifest\.get\("inference", \{\}\)\.get\("purpose", "development-raw-scores"\)/u,
  );
});

test('Qwen3 holdout prediction builder freezes the pre-adjudication threshold without human labels', async () => {
  const source = await readFile(predictionsPath, 'utf8');
  assert.match(source, /fixed_binary_threshold/u);
  assert.match(source, /threshold_retuning !== false/u);
  assert.match(source, /human_labels_used: false/u);
  assert.match(source, /raw_scores_sha256/u);
  assert.match(source, /dataset_sha256/u);
  assert.doesNotMatch(source, /human_relevance/u);
  assert.doesNotMatch(source, /human_note/u);
  assert.doesNotMatch(source, /predicted_relevant_count/u);
  assert.doesNotMatch(source, /predicted_non_relevant_count/u);

  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.equal(
    pkg.scripts['benchmark:qwen3:holdout:predictions'],
    'node scripts/benchmark/qwen3/build_holdout_predictions.mjs',
  );
});
