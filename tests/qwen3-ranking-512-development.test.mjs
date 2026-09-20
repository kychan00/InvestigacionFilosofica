import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const manifestPath =
  "benchmark/qwen3/configs/qwen3-ranking-512-development-v1.inference.json";

test("Qwen3 512 development manifest changes only the intended inference boundary", async () => {
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
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
    manifest.dataset.sha256,
    "d0f6b29834053615b44f823c7cb61f14478965eb72409ba1ab98742da224c548",
  );

  assert.equal(
    manifest.instruction.sha256,
    "5693a9a1377e10eb952d327aeec5c05cbbf040989feb786910b42e17cbf271a7",
  );
});

test("Qwen3 512 development output and cache paths are isolated and clean", async () => {
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  );

  assert.equal(
    manifest.inference.raw_output,
    "benchmark/qwen3/ranking/512-development/scores/qwen3-ranking-512-development-v1.raw.jsonl",
  );

  assert.equal(
    manifest.inference.raw_metadata,
    "benchmark/qwen3/ranking/512-development/scores/qwen3-ranking-512-development-v1.raw.meta.json",
  );

  assert.equal(
    manifest.inference.local_cache,
    "benchmark/qwen3/cache/qwen3-ranking-512-development-v1.cache.jsonl",
  );

  assert.equal(
    manifest.inference.raw_output.includes("\\"),
    false,
  );

  assert.equal(
    manifest.inference.raw_metadata.includes("\\"),
    false,
  );

  assert.equal(
    manifest.inference.local_cache.includes("\\"),
    false,
  );
});

test("existing inference engine obtains max length from the active manifest", async () => {
  const source = await readFile(
    "scripts/benchmark/qwen3/inference.py",
    "utf8",
  );

  assert.match(
    source,
    /max_length\s*=\s*int\(manifest\["adapter"\]\["max_length"\]\)/,
  );

  assert.match(
    source,
    /max_length=max_length/,
  );

  assert.match(
    source,
    /save_cache\(cache_path,\s*cache\)/,
  );

  assert.doesNotMatch(
    source,
    /qwen3-ranking-v1\.raw\.jsonl/,
  );
});

test("Qwen3 512 development command cannot overwrite or consume 4096 reference scores", async () => {
  const packageJson = JSON.parse(
    await readFile("package.json", "utf8"),
  );

  const command =
    packageJson.scripts[
      "benchmark:qwen3:ranking:512-development:infer"
    ];

  assert.ok(command);

  assert.match(
    command,
    /qwen3-ranking-512-development-v1\.inference\.json/,
  );

  assert.match(
    command,
    /qwen3-ranking-512-development-v1\.raw\.jsonl/,
  );

  assert.match(
    command,
    /qwen3-ranking-512-development-v1\.cache\.jsonl/,
  );

  assert.match(
    command,
    /--device mps/,
  );

  assert.match(
    command,
    /--dtype float16/,
  );

  assert.doesNotMatch(
    command,
    /benchmark\/qwen3\/ranking\/scores\/qwen3-ranking-v1\.raw\.jsonl/,
  );
});
