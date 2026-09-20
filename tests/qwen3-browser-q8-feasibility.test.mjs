import assert from 'node:assert/strict';
import {
  readFile,
} from 'node:fs/promises';
import {
  test,
} from 'node:test';

const preregPath =
  'benchmark/qwen3/browser/q8/qwen3-browser-runtime-q8-feasibility-v1.preregistered.json';

const browserPath =
  'scripts/benchmark/qwen3/q8_feasibility_browser.js';

const runnerPath =
  'scripts/benchmark/qwen3/run_q8_feasibility.mjs';

test(
  'q8 feasibility preregistration freezes synthetic 512/2048/4096 cases',
  async () => {
    const prereg =
      JSON.parse(
        await readFile(
          preregPath,
          'utf8',
        ),
      );

    assert.equal(
      prereg.experiment_id,
      'qwen3-browser-runtime-q8-feasibility-v1',
    );

    assert.equal(
      prereg.candidate.dtype,
      'q8',
    );

    assert.equal(
      prereg.candidate.artifact,
      'onnx/model_quantized.onnx',
    );

    assert.deepEqual(
      prereg.cases.map(
        (item) =>
          item.target_total_tokens,
      ),
      [
        512,
        2048,
        4096,
      ],
    );

    assert.equal(
      prereg.synthetic_input_contract
        .uses_ranking_holdout,
      false,
    );
  },
);

test(
  'q8 browser runner pins WebGPU q8 and forbids Node inference fallback',
  async () => {
    const source =
      await readFile(
        browserPath,
        'utf8',
      );

    assert.match(
      source,
      /dtype:\s*'q8'/,
    );

    assert.match(
      source,
      /executionProviders:\s*\[\s*'webgpu'\s*\]/,
    );

    assert.match(
      source,
      /env\.backends\.onnx\.wasm\.numThreads\s*=\s*1/,
    );

    assert.match(
      source,
      /Node\.js runtime is forbidden/,
    );

    assert.doesNotMatch(
      source,
      /dtype:\s*'q4'/,
    );
  },
);

test(
  'q8 feasibility runner audits browser bundle and never reads ranking holdout',
  async () => {
    const source =
      await readFile(
        runnerPath,
        'utf8',
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

    assert.match(
      source,
      /ranking_holdout_accessed:\s*false/,
    );

    assert.doesNotMatch(
      source,
      /qwen3-ranking-holdout-v1\.model-input\.jsonl/,
    );
  },
);
