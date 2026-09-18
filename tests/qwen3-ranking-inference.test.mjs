import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifestPath = new URL('../benchmark/qwen3/configs/qwen3-ranking-v1.inference.json', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

async function readManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

test('Qwen3 ranking inference pins the frozen 1000-pair model-input dataset', async () => {
  const manifest = await readManifest();

  assert.equal(manifest.ranking_experiment_id, 'qwen3-ranking-v1');
  assert.equal(manifest.production_pool_freeze_commit, '36314cc');
  assert.equal(manifest.dataset_freeze_commit, '0efb8e1');
  assert.equal(
    manifest.dataset.sha256,
    'd0f6b29834053615b44f823c7cb61f14478965eb72409ba1ab98742da224c548',
  );
  assert.equal(
    manifest.dataset.source_pool_sha256,
    '596dcb74f786a4e4ff40a705ec9f440accdfebca1ffcdadcdad2548ef7003b4c',
  );
  assert.equal(manifest.dataset.rows, 1000);
  assert.equal(manifest.dataset.unique_queries, 50);
  assert.equal(manifest.dataset.contains_human_labels, false);
  assert.equal(manifest.dataset.contains_ranking_provenance, false);
  assert.equal(manifest.dataset.contains_provider_provenance, false);
});

test('Qwen3 ranking inference uses continuous raw scores without threshold or blending', async () => {
  const manifest = await readManifest();

  assert.equal(manifest.ranking_policy.uses_raw_score_only, true);
  assert.equal(manifest.ranking_policy.binary_threshold_used, false);
  assert.equal(manifest.ranking_policy.score_blending, false);
  assert.equal(manifest.ranking_policy.pool_membership_changes, false);
  assert.equal(manifest.ranking_policy.sort, 'qwen_raw_score descending');
  assert.equal(manifest.ranking_policy.tie_breaker, 'original production rank ascending');
  assert.equal(manifest.production.ranking_changed, false);
});

test('Qwen3 ranking inference writes to isolated ranking score and cache paths', async () => {
  const manifest = await readManifest();

  assert.equal(
    manifest.inference.raw_output,
    'benchmark/qwen3/ranking/scores/qwen3-ranking-v1.raw.jsonl',
  );
  assert.equal(
    manifest.inference.raw_metadata,
    'benchmark/qwen3/ranking/scores/qwen3-ranking-v1.raw.meta.json',
  );
  assert.equal(
    manifest.inference.local_cache,
    'benchmark/qwen3/cache/qwen3-ranking-v1.cache.jsonl',
  );

  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  const command = pkg.scripts['benchmark:qwen3:ranking:infer'];
  assert.match(command, /qwen3-ranking-v1\.inference\.json/u);
  assert.match(command, /qwen3-ranking-v1\.raw\.jsonl/u);
  assert.doesNotMatch(command, /predictions/u);
  assert.doesNotMatch(command, /0\.679178715/u);
});

test('Qwen3 ranking inference reuses the frozen candidate model and instruction', async () => {
  const manifest = await readManifest();

  assert.equal(manifest.model.name, 'Qwen/Qwen3-Reranker-0.6B');
  assert.equal(
    manifest.model.revision,
    'e61197ed45024b0ed8a2d74b80b4d909f1255473',
  );
  assert.equal(
    manifest.instruction.sha256,
    '5693a9a1377e10eb952d327aeec5c05cbbf040989feb786910b42e17cbf271a7',
  );
  assert.equal(manifest.adapter.scoring_version, 'qwen3-yes-no-softmax-v1-mps-singleton');
});
