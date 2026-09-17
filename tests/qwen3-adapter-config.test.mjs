import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifestPath = new URL('../benchmark/qwen3/configs/qwen3-reranker-v1.experiment.json', import.meta.url);
const requirementsPath = new URL('../requirements-qwen3.txt', import.meta.url);
const adapterPath = new URL('../scripts/benchmark/qwen3/adapter.py', import.meta.url);

async function readManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

test('Qwen3 adapter config pins the frozen dataset and model revision', async () => {
  const manifest = await readManifest();
  assert.equal(manifest.status, 'adapter-scaffolded');
  assert.equal(manifest.model.name, 'Qwen/Qwen3-Reranker-0.6B');
  assert.equal(manifest.model.revision, 'e61197ed45024b0ed8a2d74b80b4d909f1255473');
  assert.equal(manifest.dataset.sha256, 'a939e882f95ab13f448da8c614deaa3a2a38cc8e5d266c8686bdf8cd6ab48655');
  assert.equal(manifest.dataset.rows, 100);
});

test('Qwen3 adapter uses probability scoring without changing production ranking', async () => {
  const manifest = await readManifest();
  assert.equal(manifest.adapter.scoring, 'yes-no-softmax-probability');
  assert.equal(manifest.adapter.max_length, 4096);
  assert.deepEqual(manifest.adapter.raw_score_range, [0, 1]);
  assert.equal(manifest.production.changes_rank_js, false);
  assert.equal(manifest.production.changes_parser_js, false);
  assert.equal(manifest.production.changes_expander_js, false);
  assert.equal(manifest.production.changes_conjunction_v1, false);
});

test('Qwen3 runtime requires a Transformers version with Qwen3 support', async () => {
  const requirements = await readFile(requirementsPath, 'utf8');
  assert.match(requirements, /^transformers>=4\.51\.0$/mu);
  const adapter = await readFile(adapterPath, 'utf8');
  assert.match(adapter, /AutoModelForCausalLM/u);
  assert.match(adapter, /token_true_id/u);
  assert.match(adapter, /token_false_id/u);
});
