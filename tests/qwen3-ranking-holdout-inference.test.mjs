import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifestPath = new URL('../benchmark/qwen3/configs/qwen3-ranking-holdout-v1.inference.json', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

async function readManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

test('Qwen3 ranking holdout inference pins frozen dataset, model and instruction', async () => {
  const manifest = await readManifest();

  assert.equal(manifest.validation_id, 'qwen3-ranking-holdout-v1');
  assert.equal(manifest.dataset_freeze_commit, '212a197');
  assert.equal(
    manifest.dataset.sha256,
    '99745f88c232d50d8b6715d6062beae556a71c364623916b9c41239076d56f17',
  );
  assert.equal(
    manifest.dataset.metadata_sha256,
    'e30a84ba6350f1192682031d8483793abf20bd5de9d5801593d40957586a668b',
  );
  assert.equal(
    manifest.dataset.source_pool_sha256,
    '26e39978dac68d37975732e2877830d58affc93a4e8c206edd4abd98f6b5d949',
  );
  assert.equal(manifest.dataset.rows, 500);
  assert.equal(manifest.dataset.unique_queries, 25);
  assert.equal(manifest.dataset.unique_records, 421);
  assert.equal(manifest.model.name, 'Qwen/Qwen3-Reranker-0.6B');
  assert.equal(
    manifest.model.revision,
    'e61197ed45024b0ed8a2d74b80b4d909f1255473',
  );
  assert.equal(
    manifest.instruction.sha256,
    '5693a9a1377e10eb952d327aeec5c05cbbf040989feb786910b42e17cbf271a7',
  );
});

test('Qwen3 ranking holdout inference has no threshold, blending or human labels', async () => {
  const manifest = await readManifest();

  assert.equal(manifest.ranking_policy.uses_raw_score_only, true);
  assert.equal(manifest.ranking_policy.binary_threshold_used, false);
  assert.equal(manifest.ranking_policy.score_blending, false);
  assert.equal(manifest.ranking_policy.pool_membership_changes, false);
  assert.equal(manifest.human_labels.used_for_model_input, false);
  assert.equal(manifest.human_labels.used_during_scoring, false);
  assert.equal(manifest.production.ranking_changed, false);
});

test('Qwen3 ranking holdout inference writes only to isolated validation score and cache paths', async () => {
  const manifest = await readManifest();

  assert.equal(
    manifest.inference.raw_output,
    'benchmark/qwen3/ranking/validation/scores/qwen3-ranking-holdout-v1.raw.jsonl',
  );
  assert.equal(
    manifest.inference.raw_metadata,
    'benchmark/qwen3/ranking/validation/scores/qwen3-ranking-holdout-v1.raw.meta.json',
  );
  assert.equal(
    manifest.inference.local_cache,
    'benchmark/qwen3/cache/qwen3-ranking-holdout-v1.cache.jsonl',
  );
});

test('Qwen3 ranking holdout inference command is wired to the frozen manifest', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:ranking:holdout:infer'],
    'python scripts/benchmark/qwen3/inference.py --manifest benchmark/qwen3/configs/qwen3-ranking-holdout-v1.inference.json --output benchmark/qwen3/ranking/validation/scores/qwen3-ranking-holdout-v1.raw.jsonl --meta benchmark/qwen3/ranking/validation/scores/qwen3-ranking-holdout-v1.raw.meta.json --cache benchmark/qwen3/cache/qwen3-ranking-holdout-v1.cache.jsonl --batch-size 2 --dtype float16',
  );
});
