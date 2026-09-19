import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const preregPath = new URL('../benchmark/qwen3/browser/qwen3-browser-parity-v1.preregistered.json', import.meta.url);

test('Qwen3 browser parity preregistration pins validated reference and browser runtime', async () => {
  const prereg = JSON.parse(await readFile(preregPath, 'utf8'));

  assert.equal(prereg.experiment_id, 'qwen3-browser-parity-v1');
  assert.equal(prereg.status, 'preregistered-before-browser-model-execution');

  assert.equal(
    prereg.validated_reference.report_freeze_commit,
    'ad180f6ebb4f78196f71355a48d1673cb60ebda4',
  );
  assert.equal(
    prereg.validated_reference.report_sha256,
    'c503b06280ebc7e1ea98fbb2c2d680469c2639de72a9649834e310a272abb92c',
  );
  assert.equal(prereg.validated_reference.exact_delta_p10, 0.156);

  assert.equal(prereg.browser_model.model_id, 'onnx-community/Qwen3-Reranker-0.6B-ONNX');
  assert.equal(
    prereg.browser_model.revision,
    '9995c50e2310679108a55f5ccd16ba8be9f17c20',
  );
  assert.equal(prereg.browser_model.artifact, 'onnx/model_q4.onnx');
  assert.equal(prereg.browser_model.dtype, 'q4');
  assert.equal(prereg.browser_model.primary_device, 'webgpu');
  assert.equal(prereg.browser_model.transformers_js_version, '4.3.0');
});

test('Qwen3 browser parity preregistration reuses the exact frozen 500-pair holdout input', async () => {
  const prereg = JSON.parse(await readFile(preregPath, 'utf8'));

  assert.equal(prereg.model_input.rows, 500);
  assert.equal(prereg.model_input.queries, 25);
  assert.equal(
    prereg.model_input.dataset_sha256,
    '99745f88c232d50d8b6715d6062beae556a71c364623916b9c41239076d56f17',
  );
  assert.equal(prereg.model_input.contains_human_labels, false);
  assert.equal(prereg.model_input.contains_ranking_provenance, false);
  assert.equal(prereg.model_input.contains_provider_provenance, false);
});

test('Qwen3 browser parity preregistration preserves exact validated prompt and scoring semantics', async () => {
  const prereg = JSON.parse(await readFile(preregPath, 'utf8'));

  assert.equal(
    prereg.prompt_contract.instruction_sha256,
    '5693a9a1377e10eb952d327aeec5c05cbbf040989feb786910b42e17cbf271a7',
  );
  assert.equal(prereg.prompt_contract.max_length, 4096);
  assert.equal(prereg.prompt_contract.padding_side, 'left');
  assert.deepEqual(prereg.prompt_contract.score_tokens, ['no', 'yes']);
  assert.equal(prereg.prompt_contract.score_formula, 'softmax([no_logit, yes_logit])[1]');
});

test('Qwen3 browser parity primary gate requires exact Top-10 membership on all 25 queries', async () => {
  const prereg = JSON.parse(await readFile(preregPath, 'utf8'));

  assert.equal(prereg.primary_parity_gate.required_queries_equal, 25);
  assert.equal(prereg.primary_parity_gate.total_queries, 25);
  assert.match(prereg.primary_parity_gate.pass_condition, /25\/25/u);
  assert.equal(prereg.ranking_contract.threshold_used, false);
  assert.equal(prereg.ranking_contract.score_blending, false);
  assert.equal(prereg.ranking_contract.retrieval_changes, false);
  assert.equal(prereg.ranking_contract.candidate_pool_changes, false);
});

test('Qwen3 browser parity failure policy forbids tuning and automatic production changes', async () => {
  const prereg = JSON.parse(await readFile(preregPath, 'utf8'));

  assert.equal(prereg.failure_policy.retuning_on_parity_dataset, false);
  assert.equal(prereg.failure_policy.threshold_tuning, false);
  assert.equal(prereg.failure_policy.score_blending_tuning, false);
  assert.equal(prereg.production_policy.modifies_production, false);
  assert.equal(prereg.production_policy.production_authorized_by_preregistration, false);
  assert.equal(prereg.browser_model.model_weights_must_not_be_committed_to_repository, true);
});
