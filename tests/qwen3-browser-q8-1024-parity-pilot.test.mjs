import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  BROWSER_PARITY_EXPERIMENT_ID,
  BROWSER_SCORE_OUTPUT,
  BROWSER_SCORE_METADATA_OUTPUT,
  BROWSER_PARITY_REPORT_OUTPUT,
  assertFrozenBrowserParityPreregistration,
  buildBrowserParityReport,
} from "../scripts/benchmark/qwen3/browser_q8_1024_parity_pilot_core.mjs";

const preregPath = "benchmark/qwen3/browser/q8-1024-parity-pilot/qwen3-browser-q8-1024-parity-pilot-v1.preregistered.json";
const datasetPath = "benchmark/qwen3/browser/q8-1024-parity-pilot/datasets/qwen3-browser-q8-1024-parity-pilot-v1.jsonl";
const referencePath = "benchmark/qwen3/browser/q8-1024-parity-pilot/reference/qwen3-browser-q8-1024-parity-pilot-v1.python-1024.jsonl";
const runnerPath = "scripts/benchmark/qwen3/run_browser_q8_1024_parity_pilot.mjs";
const browserPath = "scripts/benchmark/qwen3/browser_q8_1024_parity_pilot.js";

const jsonl = (text) => text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));

test("q8 1024 pilot preregistration freezes corrected 100-pair contract", async () => {
  const prereg = assertFrozenBrowserParityPreregistration(JSON.parse(await readFile(preregPath, "utf8")));
  assert.equal(prereg.experiment_id, "qwen3-browser-q8-1024-parity-pilot-v1");
  assert.equal(prereg.selection.rows, 100);
  assert.equal(prereg.selection.queries, 5);
  assert.equal(prereg.selection.documents_per_query, 20);
  assert.deepEqual(prereg.selection.selected_query_ids, ["es-10", "de-01", "en-03", "es-08", "en-08"]);
  assert.deepEqual(prereg.selection.dataset_group_order, prereg.selection.selected_query_ids);
  assert.equal(prereg.primary_parity_gate.required_queries_equal, 5);
  assert.equal(prereg.primary_parity_gate.total_queries, 5);
  assert.equal(prereg.pre_inference_correction.browser_scores_observed_before_correction, false);
  assert.equal(prereg.pre_inference_prompt_contract_completion.browser_scores_observed_before_completion, false);
});

test("q8 1024 pilot dataset and Python reference contain identical ordered pair keys", async () => {
  const rows = jsonl(await readFile(datasetPath, "utf8"));
  const reference = jsonl(await readFile(referencePath, "utf8"));
  assert.equal(rows.length, 100);
  assert.equal(reference.length, 100);
  assert.deepEqual(
    rows.map((r) => [r.query_id, r.record_id]),
    reference.map((r) => [r.query_id, r.record_id]),
  );
});

test("q8 1024 pilot uses isolated q8 browser outputs", async () => {
  const browser = await readFile(browserPath, "utf8");
  assert.equal(BROWSER_PARITY_EXPERIMENT_ID, "qwen3-browser-q8-1024-parity-pilot-v1");
  assert.match(BROWSER_SCORE_OUTPUT, /q8-1024-parity-pilot/);
  assert.match(BROWSER_SCORE_METADATA_OUTPUT, /q8-1024-parity-pilot/);
  assert.match(BROWSER_PARITY_REPORT_OUTPUT, /q8-1024-parity-pilot/);
  assert.match(browser, /device:\s*\x27webgpu\x27/);
  assert.match(browser, /dtype:\s*\x27q8\x27/);
  assert.match(browser, /executionProviders:\s*\[\x27webgpu\x27\]/);
  assert.match(browser, /num_logits_to_keep/);
  assert.doesNotMatch(browser, /dtype:\s*\x27q4\x27/);
});

test("q8 1024 pilot runner forbids diagnostic inference and pins the final preregistration", async () => {
  const runner = await readFile(runnerPath, "utf8");
  assert.match(runner, /diagnostic mode is forbidden for the preregistered pilot/);
  assert.match(runner, /only the preregistered official --run mode may execute browser scoring/);
  assert.match(runner, /5c4fd21aa9414048fe6c045350a773d661e316c902c13a225cc28ba5a976a79b/);
  assert.doesNotMatch(runner, /qwen3-ranking-holdout-v1/);
  assert.doesNotMatch(runner, /\/500/);
});

test("q8 1024 pilot report passes when browser ranking exactly matches frozen Python-1024", async () => {
  const prereg = JSON.parse(await readFile(preregPath, "utf8"));
  const rows = jsonl(await readFile(datasetPath, "utf8"));
  const referenceScores = jsonl(await readFile(referencePath, "utf8"));
  const browserScores = referenceScores.map((score) => ({
    ...score,
    experiment_id: BROWSER_PARITY_EXPERIMENT_ID,
    model: prereg.browser_model.model_id,
    revision: prereg.browser_model.revision,
    device: "webgpu",
    dtype: "q8",
    max_length: 1024,
    cache_hit: false,
  }));
  const report = buildBrowserParityReport({ rows, browserScores, referenceScores, prereg });
  assert.equal(report.primary_gate.queries_equal, 5);
  assert.equal(report.primary_gate.total_queries, 5);
  assert.equal(report.primary_gate.passed, true);
  assert.equal(report.secondary_metrics.exact_top5_membership_queries, 5);
  assert.equal(report.secondary_metrics.exact_top10_order_queries, 5);
});
