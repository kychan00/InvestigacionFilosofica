import {
  AutoModelForCausalLM,
  AutoTokenizer,
  Tensor,
  env,
} from '@huggingface/transformers';

const SYSTEM_PREFIX =
  '<|im_start|>system\n' +
  'Judge whether the Document meets the requirements based on the Query and the Instruct provided. ' +
  'Note that the answer can only be "yes" or "no".' +
  '<|im_end|>\n<|im_start|>user\n';

const SYSTEM_SUFFIX =
  '<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n';

function assertBrowserOnly() {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    globalThis !== window
  ) {
    throw new Error(
      'q8 feasibility inference must run in a real Window context',
    );
  }

  if (
    typeof process !== 'undefined' &&
    process?.release?.name === 'node'
  ) {
    throw new Error(
      'Node.js runtime is forbidden for q8 browser feasibility inference',
    );
  }

  if (!navigator.gpu) {
    throw new Error(
      'WebGPU is unavailable; refusing WASM/CPU fallback',
    );
  }
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `${path} failed: ${response.status} ${await response.text()}`,
    );
  }

  return response.json();
}

function adapterInfo(adapter) {
  const info = adapter.info ?? {};

  return {
    vendor: info.vendor ?? null,
    architecture: info.architecture ?? null,
    device: info.device ?? null,
    description: info.description ?? null,
    is_fallback_adapter:
      info.isFallbackAdapter ??
      adapter.isFallbackAdapter ??
      null,
    features: [...adapter.features].sort(),
  };
}

function assertSessionContract(model) {
  const entries = Object.entries(model.sessions ?? {});

  if (entries.length === 0) {
    throw new Error(
      'loaded q8 model exposes no ONNX sessions',
    );
  }

  const configs = {};

  for (const [name, session] of entries) {
    configs[name] = session.config ?? null;

    if (session.config?.device !== 'webgpu') {
      throw new Error(
        `session ${name} did not select WebGPU`,
      );
    }

    if (session.config?.dtype !== 'q8') {
      throw new Error(
        `session ${name} did not select q8`,
      );
    }
  }

  return configs;
}

function restrictModelSessionOutputsToLogits(model) {
  const entries = Object.entries(model.sessions ?? {});

  const logitsSessions = entries.filter(
    ([, session]) =>
      session.outputNames?.includes('logits'),
  );

  if (logitsSessions.length !== 1) {
    throw new Error(
      `expected exactly one ONNX session with logits output, found ${logitsSessions.length}`,
    );
  }

  const [[sessionName, session]] = logitsSessions;
  const originalRun = session.run.bind(session);

  session.run = function runLogitsOnly(
    feeds,
    fetches,
    options,
  ) {
    if (
      fetches !== undefined ||
      options !== undefined
    ) {
      throw new Error(
        `unexpected explicit fetches/options for session ${sessionName}`,
      );
    }

    return originalRun(feeds, ['logits']);
  };

  return {
    session: sessionName,
    fetches: ['logits'],
  };
}

function disposeTensors(value) {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (
    typeof value.dispose === 'function' &&
    Array.isArray(value.dims)
  ) {
    value.dispose();
    return;
  }

  for (const nested of Object.values(value)) {
    disposeTensors(nested);
  }
}

async function createScorer(payload, gpuAdapter) {
  const { prereg } = payload;

  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useFS = false;
  env.useFSCache = false;
  env.useBrowserCache = true;

  /*
   * Host/control layer only.
   * The inference EP remains exclusively WebGPU.
   */
  env.backends.onnx.wasm.numThreads = 1;

  env.backends.onnx.webgpu.adapter = gpuAdapter;
  env.backends.onnx.webgpu.powerPreference =
    'high-performance';

  const common = {
    revision: prereg.candidate.revision,

    progress_callback: (event) => {
      if (
        event?.status === 'progress' &&
        Number.isFinite(event.progress)
      ) {
        console.log(
          `model-download ${event.file ?? ''} ${event.progress.toFixed(1)}%`,
        );
      }
    },
  };

  const tokenizer =
    await AutoTokenizer.from_pretrained(
      prereg.candidate.model_id,
      common,
    );

  tokenizer.padding_side = 'left';

  /*
   * Freeze the synthetic token construction BEFORE
   * model execution.
   */
  const prefixIds = tokenizer.encode(
    SYSTEM_PREFIX,
    {
      add_special_tokens: false,
    },
  );

  const fixedSyntheticContent =
    `<Query>: ${prereg.synthetic_input_contract.base_query}\n` +
    `<Document>: ${prereg.synthetic_input_contract.base_document}`;

  const contentIds = tokenizer.encode(
    fixedSyntheticContent,
    {
      add_special_tokens: false,
    },
  );

  const suffixIds = tokenizer.encode(
    SYSTEM_SUFFIX,
    {
      add_special_tokens: false,
    },
  );

  const fillerIds = tokenizer.encode(
    prereg.synthetic_input_contract.filler_text,
    {
      add_special_tokens: false,
    },
  );

  if (fillerIds.length !== 1) {
    throw new Error(
      `preregistered filler_text must encode to exactly one token; got ${fillerIds.length}`,
    );
  }

  const fillerTokenId = fillerIds[0];

  const fixedTokenCount =
    prefixIds.length +
    contentIds.length +
    suffixIds.length;

  const smallestTarget =
    Math.min(
      ...prereg.cases.map(
        (item) => item.target_total_tokens,
      ),
    );

  if (fixedTokenCount > smallestTarget) {
    throw new Error(
      `fixed synthetic prompt requires ${fixedTokenCount} tokens, exceeding smallest target ${smallestTarget}`,
    );
  }

  const model =
    await AutoModelForCausalLM.from_pretrained(
      prereg.candidate.model_id,
      {
        ...common,
        device: 'webgpu',
        dtype: 'q8',
        subfolder: 'onnx',
        model_file_name: 'model',
        session_options: {
          executionProviders: ['webgpu'],
        },
      },
    );

  const sessionConfigs =
    assertSessionContract(model);

  const outputSelection =
    restrictModelSessionOutputsToLogits(model);

  const noTokenId =
    tokenizer.convert_tokens_to_ids('no');

  const yesTokenId =
    tokenizer.convert_tokens_to_ids('yes');

  if (
    !Number.isInteger(noTokenId) ||
    !Number.isInteger(yesTokenId) ||
    noTokenId === yesTokenId
  ) {
    throw new Error(
      'tokenizer does not expose distinct integer yes/no token IDs',
    );
  }

  return {
    sessionConfigs,
    outputSelection,
    noTokenId,
    yesTokenId,
    fillerTokenId,
    fixedTokenCount,

    token_layout: {
      prefix_tokens: prefixIds.length,
      fixed_content_tokens: contentIds.length,
      suffix_tokens: suffixIds.length,
      filler_token_id: fillerTokenId,
    },

    async scoreCase(testCase) {
      const target =
        testCase.target_total_tokens;

      const fillerCount =
        target - fixedTokenCount;

      if (fillerCount < 0) {
        throw new Error(
          `cannot construct ${target}-token case`,
        );
      }

      const ids = [
        ...prefixIds,
        ...contentIds,
        ...Array(fillerCount).fill(
          fillerTokenId,
        ),
        ...suffixIds,
      ];

      if (ids.length !== target) {
        throw new Error(
          `constructed token count ${ids.length} != target ${target}`,
        );
      }

      const inputIds =
        new Tensor(
          'int64',
          BigInt64Array.from(ids, BigInt),
          [1, ids.length],
        );

      const attentionMask =
        new Tensor(
          'int64',
          BigInt64Array.from(
            {
              length: ids.length,
            },
            () => 1n,
          ),
          [1, ids.length],
        );

      const numLogitsToKeep =
        new Tensor(
          'int64',
          [1n],
          [],
        );

      let output;

      try {
        output = await model({
          input_ids: inputIds,
          attention_mask: attentionMask,
          num_logits_to_keep:
            numLogitsToKeep,
        });

        const logits = output.logits;

        if (
          !logits ||
          logits.dims.length !== 3 ||
          logits.dims[0] !== 1
        ) {
          throw new Error(
            `unexpected logits shape: ${JSON.stringify(logits?.dims)}`,
          );
        }

        const vocabularySize =
          logits.dims[2];

        const lastTokenOffset =
          (logits.dims[1] - 1) *
          vocabularySize;

        const noLogit =
          Number(
            logits.data[
              lastTokenOffset +
              noTokenId
            ],
          );

        const yesLogit =
          Number(
            logits.data[
              lastTokenOffset +
              yesTokenId
            ],
          );

        const maximum =
          Math.max(
            noLogit,
            yesLogit,
          );

        const noExp =
          Math.exp(
            noLogit - maximum,
          );

        const yesExp =
          Math.exp(
            yesLogit - maximum,
          );

        const score =
          yesExp /
          (noExp + yesExp);

        if (
          !Number.isFinite(score) ||
          score < 0 ||
          score > 1
        ) {
          throw new Error(
            `non-finite/out-of-range q8 score: ${score}`,
          );
        }

        return {
          raw_score: score,
          constructed_total_tokens:
            ids.length,
          filler_tokens:
            fillerCount,
        };
      } finally {
        inputIds.dispose();
        attentionMask.dispose();
        numLogitsToKeep.dispose();
        disposeTensors(output);
      }
    },
  };
}

async function main() {
  assertBrowserOnly();

  const adapter =
    await navigator.gpu.requestAdapter({
      powerPreference:
        'high-performance',
      forceFallbackAdapter: false,
    });

  if (!adapter) {
    throw new Error(
      'no high-performance WebGPU adapter is available',
    );
  }

  const info =
    adapterInfo(adapter);

  if (
    info.is_fallback_adapter === true
  ) {
    throw new Error(
      'fallback/software WebGPU adapter is forbidden',
    );
  }

  const payloadResponse =
    await fetch('/payload');

  if (!payloadResponse.ok) {
    throw new Error(
      `payload failed: ${payloadResponse.status}`,
    );
  }

  const payload =
    await payloadResponse.json();

  const scorer =
    await createScorer(
      payload,
      adapter,
    );

  const runtimeMetadata = {
    runtime: 'browser',
    user_agent:
      navigator.userAgent,

    transformers_js_version:
      env.version,

    onnx_backend:
      'onnxruntime-web',

    wasm_host_threads: 1,

    execution_provider:
      'webgpu',

    device:
      'webgpu',

    dtype:
      'q8',

    model_artifact:
      payload.prereg.candidate.artifact,

    adapter_info:
      info,

    session_configs:
      scorer.sessionConfigs,

    yes_token_id:
      scorer.yesTokenId,

    no_token_id:
      scorer.noTokenId,

    num_logits_to_keep:
      1,

    onnx_output_selection:
      scorer.outputSelection,

    token_layout:
      scorer.token_layout,
  };

  await postJson(
    '/runtime',
    runtimeMetadata,
  );

  for (
    let index = 0;
    index < payload.prereg.cases.length;
    index += 1
  ) {
    const testCase =
      payload.prereg.cases[index];

    console.log(
      `starting ${testCase.case_id} target=${testCase.target_total_tokens}`,
    );

    const startedAt =
      performance.now();

    const result =
      await scorer.scoreCase(
        testCase,
      );

    const latencyMs =
      performance.now() -
      startedAt;

    await postJson(
      '/case',
      {
        index,
        case_id:
          testCase.case_id,

        target_total_tokens:
          testCase.target_total_tokens,

        constructed_total_tokens:
          result.constructed_total_tokens,

        filler_tokens:
          result.filler_tokens,

        raw_score:
          result.raw_score,

        latency_ms:
          latencyMs,
      },
    );

    console.log(
      `passed ${testCase.case_id} score=${result.raw_score} latency_ms=${latencyMs.toFixed(1)}`,
    );
  }

  await postJson(
    '/complete',
    {},
  );

  document.title =
    'qwen3-browser-runtime-q8-feasibility-v1 complete';
}

main().catch(
  async (error) => {
    console.error(error);

    try {
      await postJson(
        '/error',
        {
          message:
            error.message,
          stack:
            error.stack ?? null,
        },
      );
    } catch {}

    document.title =
      'qwen3-browser-runtime-q8-feasibility-v1 failed';
  },
);
