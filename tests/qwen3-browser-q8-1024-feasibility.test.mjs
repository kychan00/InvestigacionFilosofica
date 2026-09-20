import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const preregPath =
  "benchmark/qwen3/browser/q8-1024-feasibility/qwen3-browser-q8-1024-feasibility-v1.preregistered.json";

const runnerPath =
  "scripts/benchmark/qwen3/run_q8_1024_feasibility.mjs";

test("q8 1024 feasibility preregistration freezes one first plus five warm forwards", async () => {
  const prereg = JSON.parse(
    await readFile(preregPath, "utf8"),
  );

  assert.equal(
    prereg.experiment_id,
    "qwen3-browser-q8-1024-feasibility-v1",
  );

  assert.equal(
    prereg.candidate.exact_total_tokens,
    1024,
  );

  assert.equal(
    prereg.run_plan.first_forward_runs,
    1,
  );

  assert.equal(
    prereg.run_plan.measured_warm_runs,
    5,
  );

  assert.equal(
    prereg.run_plan.total_forward_runs,
    6,
  );

  assert.equal(
    prereg.primary_gate.required_successful_runs,
    6,
  );

  assert.equal(
    prereg.primary_gate.latency_threshold,
    null,
  );
});

test("q8 1024 feasibility runner reuses frozen q8 WebGPU browser scorer", async () => {
  const source = await readFile(
    runnerPath,
    "utf8",
  );

  assert.match(
    source,
    /q8_feasibility_browser\.js/,
  );

  assert.match(
    source,
    /first-1/,
  );

  assert.match(
    source,
    /warm-5/,
  );

  assert.match(
    source,
    /target_total_tokens:\s*target/,
  );

  assert.match(
    source,
    /transformers\.web\.js/,
  );

  assert.match(
    source,
    /onnxruntime-web/,
  );

  assert.match(
    source,
    /onnxruntime-node/,
  );
});

test("q8 1024 feasibility runner excludes ranking holdout and production changes", async () => {
  const source = await readFile(
    runnerPath,
    "utf8",
  );

  assert.match(
    source,
    /uses_ranking_development_pool/,
  );

  assert.match(
    source,
    /uses_reference_qwen_scores/,
  );

  assert.match(
    source,
    /ranking_holdout_accessed:\s*false/,
  );

  assert.match(
    source,
    /human_labels_accessed:\s*false/,
  );

  assert.match(
    source,
    /production_changed:\s*false/,
  );

  assert.doesNotMatch(
    source,
    /qwen3-ranking-holdout-v1\.model-input\.jsonl/,
  );
});
