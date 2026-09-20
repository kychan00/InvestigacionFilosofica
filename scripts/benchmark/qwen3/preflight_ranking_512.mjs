#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";

const preregPath =
  "benchmark/qwen3/ranking/512-development/qwen3-ranking-512-development-v1.preregistered.json";

const manifestPath =
  "benchmark/qwen3/configs/qwen3-ranking-512-development-v1.inference.json";

const expectedPreregSha =
  "dc68ff205aceecd2972b0fdcce4d906c9e190e0d3b51bb77dbb4a93d97054eb8";

const expectedDatasetSha =
  "d0f6b29834053615b44f823c7cb61f14478965eb72409ba1ab98742da224c548";

const expectedInstructionSha =
  "5693a9a1377e10eb952d327aeec5c05cbbf040989feb786910b42e17cbf271a7";

const outputPath =
  "benchmark/qwen3/ranking/512-development/scores/qwen3-ranking-512-development-v1.raw.jsonl";

const metaPath =
  "benchmark/qwen3/ranking/512-development/scores/qwen3-ranking-512-development-v1.raw.meta.json";

const cachePath =
  "benchmark/qwen3/cache/qwen3-ranking-512-development-v1.cache.jsonl";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const preregBytes = await readFile(preregPath);
const preregSha = sha256(preregBytes);

assert.equal(preregSha, expectedPreregSha);

const prereg = JSON.parse(preregBytes.toString("utf8"));
const manifest = JSON.parse(
  await readFile(manifestPath, "utf8"),
);

assert.equal(
  prereg.experiment_id,
  "qwen3-ranking-512-development-v1",
);

assert.equal(
  prereg.status,
  "preregistered-before-inference",
);

assert.equal(
  manifest.experiment_id,
  "qwen3-reranker-v1",
);

assert.equal(
  manifest.ranking_experiment_id,
  "qwen3-ranking-512-development-v1",
);

assert.equal(
  manifest.adapter.max_length,
  512,
);

assert.equal(
  manifest.adapter.scoring_version,
  "qwen3-yes-no-softmax-v1-mps-singleton",
);

assert.equal(
  manifest.adapter.mps_model_batch_strategy,
  "singleton",
);

assert.equal(
  manifest.model.name,
  "Qwen/Qwen3-Reranker-0.6B",
);

assert.equal(
  manifest.model.revision,
  "e61197ed45024b0ed8a2d74b80b4d909f1255473",
);

assert.equal(
  manifest.dataset.sha256,
  expectedDatasetSha,
);

assert.equal(
  manifest.dataset.rows,
  1000,
);

assert.equal(
  manifest.dataset.unique_queries,
  50,
);

assert.equal(
  manifest.instruction.sha256,
  expectedInstructionSha,
);

assert.equal(
  manifest.inference.raw_output,
  outputPath,
);

assert.equal(
  manifest.inference.raw_metadata,
  metaPath,
);

assert.equal(
  manifest.inference.local_cache,
  cachePath,
);

assert.equal(
  manifest.ranking_policy.binary_threshold_used,
  false,
);

assert.equal(
  manifest.ranking_policy.score_blending,
  false,
);

assert.equal(
  manifest.human_labels.used_for_model_input,
  false,
);

assert.equal(
  manifest.human_labels.used_during_scoring,
  false,
);

assert.equal(
  manifest.production.ranking_changed,
  false,
);

assert.equal(
  manifest.preregistration.sha256,
  expectedPreregSha,
);

for (const path of [
  manifest.inference.raw_output,
  manifest.inference.raw_metadata,
  manifest.inference.local_cache,
]) {
  assert.equal(
    path.includes("\\"),
    false,
    `path contains backslash: ${path}`,
  );
}

const datasetBytes = await readFile(
  manifest.dataset.path,
);

assert.equal(
  sha256(datasetBytes),
  expectedDatasetSha,
);

const instructionBytes = await readFile(
  manifest.instruction.path,
);

assert.equal(
  sha256(instructionBytes),
  expectedInstructionSha,
);

assert.equal(
  await exists(outputPath),
  false,
  "candidate raw output already exists",
);

assert.equal(
  await exists(metaPath),
  false,
  "candidate metadata already exists",
);

assert.equal(
  await exists(cachePath),
  false,
  "candidate cache already exists before official run",
);

console.log(
  JSON.stringify(
    {
      experiment_id:
        "qwen3-ranking-512-development-v1",
      status:
        "preflight-passed-no-model-execution",
      preregistration_sha256: preregSha,
      candidate: {
        model: manifest.model.name,
        revision: manifest.model.revision,
        max_length: manifest.adapter.max_length,
        scoring_version:
          manifest.adapter.scoring_version,
        device: "mps",
        dtype: "float16",
        mps_model_batch_strategy:
          manifest.adapter.mps_model_batch_strategy,
      },
      dataset: {
        rows: manifest.dataset.rows,
        queries: manifest.dataset.unique_queries,
        sha256: manifest.dataset.sha256,
      },
      outputs_absent: true,
      cache_absent: true,
      reference_scores_read: false,
      ranking_holdout_accessed: false,
      human_labels_accessed: false,
      inference_executed: false,
      model_loaded: false,
      production_changed: false,
    },
    null,
    2,
  ),
);
