import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifestPath = new URL('../benchmark/qwen3/configs/qwen3-reranker-v1.experiment.json', import.meta.url);
const inferencePath = new URL('../scripts/benchmark/qwen3/inference.py', import.meta.url);
const adapterPath = new URL('../scripts/benchmark/qwen3/adapter.py', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);
const gitignorePath = new URL('../.gitignore', import.meta.url);

async function readManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

test('Qwen3 inference manifest freezes batch, output and cache boundaries', async () => {
  const manifest = await readManifest();
  assert.equal(manifest.status, 'inference-engine-scaffolded');
  assert.equal(manifest.inference.default_batch_size, 2);
  assert.equal(manifest.inference.checkpoint_after_each_batch, true);
  assert.equal(manifest.inference.atomic_cache_writes, true);
  assert.equal(manifest.inference.atomic_final_writes, true);
  assert.equal(manifest.inference.full_output_requires_complete_dataset, true);
  assert.equal(manifest.inference.cache_is_versioned, false);
});

test('Qwen3 inference verifies frozen dataset and instruction before model loading', async () => {
  const source = await readFile(inferencePath, 'utf8');
  assert.match(source, /dataset SHA mismatch/u);
  assert.match(source, /instruction SHA mismatch/u);
  assert.match(source, /validate_frozen_inputs\(manifest\)/u);
  assert.match(source, /Qwen3RerankerAdapter\(/u);
  assert.ok(source.indexOf('validate_frozen_inputs(manifest)') < source.indexOf('Qwen3RerankerAdapter('));
});

test('Qwen3 cache key includes every inference setting that can invalidate a score', async () => {
  const manifest = await readManifest();
  assert.deepEqual(manifest.inference.cache_key_fields, [
    'scoring version',
    'model',
    'model revision',
    'instruction sha256',
    'input sha256',
    'max length',
    'device',
    'dtype',
  ]);
  const source = await readFile(inferencePath, 'utf8');
  for (const field of ['scoring_version', 'model', 'revision', 'instruction_sha256', 'input_sha256', 'max_length', 'device', 'dtype']) {
    assert.match(source, new RegExp(`"${field}"`, 'u'));
  }
});

test('Qwen3 inference is resumable but only finalizes complete raw score output', async () => {
  const source = await readFile(inferencePath, 'utf8');
  assert.match(source, /save_cache\(cache_path, cache\)/u);
  assert.match(source, /if not full_run:/u);
  assert.match(source, /raw_output_finalized=false/u);
  assert.match(source, /completed output already exists/u);
  assert.match(source, /cache_hits_this_run/u);
});

test('Qwen3 adapter exposes batch scoring and local cache stays unversioned', async () => {
  const adapter = await readFile(adapterPath, 'utf8');
  assert.match(adapter, /def score_many\(/u);
  assert.match(adapter, /return self\.score_many\(\[\(query, document\)\]\)\[0\]/u);

  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.equal(packageJson.scripts['benchmark:qwen3:infer'], 'python scripts/benchmark/qwen3/inference.py');

  const gitignore = await readFile(gitignorePath, 'utf8');
  assert.match(gitignore, /^benchmark\/qwen3\/cache\/$/mu);
});
