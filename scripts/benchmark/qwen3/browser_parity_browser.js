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
const SYSTEM_SUFFIX = '<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n';

function assertBrowserOnly() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || globalThis !== window) {
    throw new Error('browser parity inference must run in a real Window context');
  }
  if (typeof process !== 'undefined' && process?.release?.name === 'node') {
    throw new Error('Node.js runtime is forbidden for browser parity inference');
  }
  if (!navigator.gpu) throw new Error('WebGPU is unavailable; refusing WASM/CPU fallback');
}

function buildDocumentText(record) {
  const lines = [`Title: ${record.title}`];
  if (record.authors.length > 0) lines.push(`Authors: ${record.authors.join('; ')}`);
  if (record.year !== null) lines.push(`Year: ${record.year}`);
  if (record.document_language) lines.push(`Document language: ${record.document_language}`);
  lines.push(`Abstract: ${record.abstract?.trim() || '[unavailable]'}`);
  return lines.join('\n');
}

function formatInstruction(instruction, query, documentText) {
  const separator = instruction.endsWith('\n') ? '' : '\n';
  return `<Instruct>: ${instruction}${separator}<Query>: ${query}\n<Document>: ${documentText}`;
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function adapterInfo(adapter) {
  const info = adapter.info ?? {};
  return {
    vendor: info.vendor ?? null,
    architecture: info.architecture ?? null,
    device: info.device ?? null,
    description: info.description ?? null,
    is_fallback_adapter: info.isFallbackAdapter ?? adapter.isFallbackAdapter ?? null,
    features: [...adapter.features].sort(),
  };
}

function assertSessionContract(model) {
  const entries = Object.entries(model.sessions ?? {});
  if (entries.length === 0) throw new Error('loaded model exposes no ONNX sessions');
  const configs = {};
  for (const [name, session] of entries) {
    configs[name] = session.config ?? null;
    if (session.config?.device !== 'webgpu') {
      throw new Error(`session ${name} did not select WebGPU`);
    }
    if (session.config?.dtype !== 'q4') {
      throw new Error(`session ${name} did not select q4`);
    }
  }
  return configs;
}

function restrictModelSessionOutputsToLogits(model) {
  const entries = Object.entries(model.sessions ?? {});
  const logitsSessions = entries.filter(([, session]) => session.outputNames?.includes('logits'));
  if (logitsSessions.length !== 1) {
    throw new Error(`expected exactly one ONNX session with logits output, found ${logitsSessions.length}`);
  }
  const [[sessionName, session]] = logitsSessions;
  const originalRun = session.run.bind(session);
  session.run = function runLogitsOnly(feeds, fetches, options) {
    if (fetches !== undefined || options !== undefined) {
      throw new Error(`unexpected explicit fetches/options for session ${sessionName}`);
    }
    // Transformers.js normally asks ONNX Runtime for every graph output. This
    // decoder also exposes large present.* KV-cache tensors, but parity scoring
    // consumes only logits. Restricting fetches changes no computed score and
    // prevents those unused outputs from being allocated at 4096 tokens.
    return originalRun(feeds, ['logits']);
  };
  return { session: sessionName, fetches: ['logits'] };
}

function disposeTensors(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.dispose === 'function' && Array.isArray(value.dims)) {
    value.dispose();
    return;
  }
  for (const nested of Object.values(value)) disposeTensors(nested);
}

async function createScorer(payload, gpuAdapter) {
  const { prereg, instruction } = payload;
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useFS = false;
  env.useFSCache = false;
  env.useBrowserCache = true;
  // ONNX Runtime's WASM layer owns session/tensor handles even when every
  // graph node executes on WebGPU. Keep that host layer single-threaded to
  // avoid atomic handle-release faults at the frozen 4096-token boundary.
  // This does not add the WASM execution provider or move model computation
  // off WebGPU; the session below still permits only the WebGPU EP.
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.webgpu.adapter = gpuAdapter;
  env.backends.onnx.webgpu.powerPreference = 'high-performance';

  const common = {
    revision: prereg.browser_model.revision,
    progress_callback: (event) => {
      if (event?.status === 'progress' && Number.isFinite(event.progress)) {
        console.log(`model-download ${event.file ?? ''} ${event.progress.toFixed(1)}%`);
      }
    },
  };
  const tokenizer = await AutoTokenizer.from_pretrained(prereg.browser_model.model_id, common);
  tokenizer.padding_side = 'left';

  const model = await AutoModelForCausalLM.from_pretrained(prereg.browser_model.model_id, {
    ...common,
    device: 'webgpu',
    dtype: 'q4',
    subfolder: 'onnx',
    model_file_name: 'model',
    session_options: { executionProviders: ['webgpu'] },
  });
  const sessionConfigs = assertSessionContract(model);
  const outputSelection = restrictModelSessionOutputsToLogits(model);

  const noTokenId = tokenizer.convert_tokens_to_ids('no');
  const yesTokenId = tokenizer.convert_tokens_to_ids('yes');
  if (!Number.isInteger(noTokenId) || !Number.isInteger(yesTokenId) || noTokenId === yesTokenId) {
    throw new Error('tokenizer does not expose distinct integer yes/no token IDs');
  }
  const prefixIds = tokenizer.encode(SYSTEM_PREFIX, { add_special_tokens: false });
  const suffixIds = tokenizer.encode(SYSTEM_SUFFIX, { add_special_tokens: false });
  const contentMaxLength = prereg.prompt_contract.max_length - prefixIds.length - suffixIds.length;
  if (contentMaxLength <= 0) throw new Error('prefix/suffix exceed frozen max length');

  return {
    sessionConfigs,
    outputSelection,
    noTokenId,
    yesTokenId,
    contentMaxLength,
    async score(row) {
      const content = formatInstruction(instruction, row.query, buildDocumentText(row));
      const encoded = tokenizer(content, {
        add_special_tokens: true,
        padding: false,
        truncation: true,
        max_length: contentMaxLength,
        return_tensor: false,
      });
      const ids = [...prefixIds, ...encoded.input_ids, ...suffixIds];
      if (ids.length > prereg.prompt_contract.max_length) throw new Error('tokenized input exceeds 4096');
      const inputIds = new Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]);
      const attentionMask = new Tensor('int64', BigInt64Array.from({ length: ids.length }, () => 1n), [1, ids.length]);
      // The reference score reads only logits[:, -1, :]. Asking the ONNX export
      // to materialize exactly that final position is semantically equivalent,
      // and avoids a multi-gigabyte [sequence, vocabulary] output at 4096 tokens.
      const numLogitsToKeep = new Tensor('int64', [1n], []);
      let output;
      try {
        output = await model({
          input_ids: inputIds,
          attention_mask: attentionMask,
          num_logits_to_keep: numLogitsToKeep,
        });
        const logits = output.logits;
        if (!logits || logits.dims.length !== 3 || logits.dims[0] !== 1) {
          throw new Error(`unexpected logits shape: ${JSON.stringify(logits?.dims)}`);
        }
        const vocabularySize = logits.dims[2];
        const lastTokenOffset = (logits.dims[1] - 1) * vocabularySize;
        const noLogit = Number(logits.data[lastTokenOffset + noTokenId]);
        const yesLogit = Number(logits.data[lastTokenOffset + yesTokenId]);
        const maximum = Math.max(noLogit, yesLogit);
        const noExp = Math.exp(noLogit - maximum);
        const yesExp = Math.exp(yesLogit - maximum);
        const score = yesExp / (noExp + yesExp);
        if (!Number.isFinite(score) || score < 0 || score > 1) {
          throw new Error(`non-finite/out-of-range browser score: ${score}`);
        }
        return score;
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
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
    forceFallbackAdapter: false,
  });
  if (!adapter) throw new Error('no high-performance WebGPU adapter is available');
  const info = adapterInfo(adapter);
  if (info.is_fallback_adapter === true) throw new Error('fallback/software WebGPU adapter is forbidden');

  const payloadResponse = await fetch('/payload');
  if (!payloadResponse.ok) throw new Error(`payload failed: ${payloadResponse.status}`);
  const payload = await payloadResponse.json();
  const scorer = await createScorer(payload, adapter);
  const runtimeMetadata = {
    runtime: 'browser',
    user_agent: navigator.userAgent,
    transformers_js_version: env.version,
    onnx_backend: 'onnxruntime-web',
    wasm_host_threads: 1,
    execution_provider: 'webgpu',
    device: 'webgpu',
    dtype: 'q4',
    adapter_info: info,
    session_configs: scorer.sessionConfigs,
    yes_token_id: scorer.yesTokenId,
    no_token_id: scorer.noTokenId,
    content_max_length: scorer.contentMaxLength,
    num_logits_to_keep: 1,
    onnx_output_selection: scorer.outputSelection,
  };
  await postJson('/runtime', runtimeMetadata);

  for (let index = payload.completed_rows; index < payload.rows.length; index += 1) {
    const row = payload.rows[index];
    const startedAt = performance.now();
    const rawScore = await scorer.score(row);
    const latencyMs = performance.now() - startedAt;
    const documentText = buildDocumentText(row);
    const inputSha256 = await sha256Text(`${payload.instruction}\0${row.query}\0${documentText}`);
    await postJson('/checkpoint', {
      index,
      raw_score: rawScore,
      latency_ms: latencyMs,
      input_sha256: inputSha256,
    });
    console.log(`scored ${index + 1}/${payload.rows.length} ${row.query_id} ${row.record_id}`);
  }
  await postJson('/complete', {});
  document.title = 'qwen3-browser-parity-v1 complete';
}

main().catch(async (error) => {
  console.error(error);
  try {
    await postJson('/error', { message: error.message, stack: error.stack ?? null });
  } catch {}
  document.title = 'qwen3-browser-parity-v1 failed';
});
