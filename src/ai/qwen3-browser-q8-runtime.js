import {
  AutoModelForCausalLM,
  AutoTokenizer,
  Tensor,
  env
} from "@huggingface/transformers";

import {
  QWEN3_BROWSER_Q8_CONTRACT
} from "./qwen3-browser-q8-contract.js";


const SYSTEM_PREFIX =
  "<|im_start|>system\n" +
  "Judge whether the Document meets the requirements based on the Query and the Instruct provided. " +
  "Note that the answer can only be \"yes\" or \"no\"." +
  "<|im_end|>\n<|im_start|>user\n";

const SYSTEM_SUFFIX =
  "<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n";


function assertBrowserWebGpu() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    globalThis !== window
  ) {
    throw new Error(
      "Qwen3 sólo puede ejecutarse en una ventana real del navegador"
    );
  }


  if (
    typeof process !== "undefined" &&
    process?.release?.name === "node"
  ) {
    throw new Error(
      "La inferencia con Node.js está prohibida"
    );
  }


  if (!navigator.gpu) {
    throw new Error(
      "WebGPU no está disponible; no se usará fallback CPU/WASM"
    );
  }
}


function adapterInfo(
  adapter
) {
  const info =
    adapter.info || {};


  return {
    vendor:
      info.vendor || null,

    architecture:
      info.architecture || null,

    device:
      info.device || null,

    description:
      info.description || null,

    isFallbackAdapter:
      info.isFallbackAdapter ??
      adapter.isFallbackAdapter ??
      null
  };
}


function assertSessionContract(
  model
) {
  const entries =
    Object.entries(
      model.sessions || {}
    );


  if (!entries.length) {
    throw new Error(
      "El modelo no expuso sesiones ONNX"
    );
  }


  for (
    const [
      name,
      session
    ] of entries
  ) {
    if (
      session.config?.device !==
      "webgpu"
    ) {
      throw new Error(
        `La sesión ${name} no seleccionó WebGPU`
      );
    }


    if (
      session.config?.dtype !==
      "q8"
    ) {
      throw new Error(
        `La sesión ${name} no seleccionó q8`
      );
    }
  }


  return Object.fromEntries(
    entries.map(
      ([name, session]) => [
        name,
        session.config || null
      ]
    )
  );
}


function restrictOutputsToLogits(
  model
) {
  const logitsSessions =
    Object.entries(
      model.sessions || {}
    ).filter(
      ([, session]) =>
        session.outputNames
          ?.includes("logits")
    );


  if (
    logitsSessions.length !== 1
  ) {
    throw new Error(
      "Se esperaba una única sesión ONNX con salida logits"
    );
  }


  const [[
    sessionName,
    session
  ]] = logitsSessions;

  const originalRun =
    session.run.bind(
      session
    );


  session.run =
    function runLogitsOnly(
      feeds,
      fetches,
      options
    ) {
      if (
        fetches !== undefined ||
        options !== undefined
      ) {
        throw new Error(
          `La sesión ${sessionName} recibió fetches/options inesperados`
        );
      }


      return originalRun(
        feeds,
        ["logits"]
      );
    };
}


function disposeTensors(
  value
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return;
  }


  if (
    typeof value.dispose ===
      "function" &&
    Array.isArray(
      value.dims
    )
  ) {
    value.dispose();
    return;
  }


  for (
    const nested of
    Object.values(value)
  ) {
    disposeTensors(
      nested
    );
  }
}


function documentText(
  record
) {
  const lines = [
    `Title: ${record.title}`
  ];


  if (record.authors.length) {
    lines.push(
      `Authors: ${record.authors.join("; ")}`
    );
  }


  if (record.year !== null) {
    lines.push(
      `Year: ${record.year}`
    );
  }


  if (
    record.document_language
  ) {
    lines.push(
      `Document language: ${record.document_language}`
    );
  }


  lines.push(
    `Abstract: ${record.abstract || "[unavailable]"}`
  );


  return lines.join("\n");
}


function abortError() {
  return new DOMException(
    "Qwen3 cancelado",
    "AbortError"
  );
}


export async function createQwen3BrowserQ8Scorer({
  onProgress = () => {}
} = {}) {
  assertBrowserWebGpu();


  const adapter =
    await navigator.gpu.requestAdapter({
      powerPreference:
        "high-performance",

      forceFallbackAdapter:
        false
    });


  if (!adapter) {
    throw new Error(
      "No hay un adaptador WebGPU de alto rendimiento"
    );
  }


  const gpuInfo =
    adapterInfo(
      adapter
    );


  if (
    gpuInfo.isFallbackAdapter ===
    true
  ) {
    throw new Error(
      "El adaptador WebGPU de software/fallback está prohibido"
    );
  }


  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useFS = false;
  env.useFSCache = false;
  env.useBrowserCache = true;
  env.backends.onnx.wasm.numThreads =
    1;
  env.backends.onnx.webgpu.adapter =
    adapter;
  env.backends.onnx.webgpu.powerPreference =
    "high-performance";


  const common = {
    revision:
      QWEN3_BROWSER_Q8_CONTRACT
        .revision,

    progress_callback(
      event
    ) {
      if (
        event?.status ===
          "progress" &&
        Number.isFinite(
          event.progress
        )
      ) {
        onProgress({
          phase:
            "download",

          file:
            event.file || "modelo",

          percent:
            event.progress
        });
      }
    }
  };


  const tokenizer =
    await AutoTokenizer
      .from_pretrained(
        QWEN3_BROWSER_Q8_CONTRACT
          .modelId,
        common
      );

  tokenizer.padding_side =
    "left";


  const model =
    await AutoModelForCausalLM
      .from_pretrained(
        QWEN3_BROWSER_Q8_CONTRACT
          .modelId,
        {
          ...common,
          device:
            "webgpu",
          dtype:
            "q8",
          subfolder:
            "onnx",
          model_file_name:
            "model",
          session_options: {
            executionProviders: [
              "webgpu"
            ]
          }
        }
      );


  const sessionConfigs =
    assertSessionContract(
      model
    );

  restrictOutputsToLogits(
    model
  );


  const noTokenId =
    tokenizer
      .convert_tokens_to_ids(
        "no"
      );

  const yesTokenId =
    tokenizer
      .convert_tokens_to_ids(
        "yes"
      );


  if (
    !Number.isInteger(
      noTokenId
    ) ||
    !Number.isInteger(
      yesTokenId
    ) ||
    noTokenId === yesTokenId
  ) {
    throw new Error(
      "El tokenizer no expuso tokens yes/no válidos"
    );
  }


  const prefixIds =
    tokenizer.encode(
      SYSTEM_PREFIX,
      {
        add_special_tokens:
          false
      }
    );

  const suffixIds =
    tokenizer.encode(
      SYSTEM_SUFFIX,
      {
        add_special_tokens:
          false
      }
    );

  const contentMaxLength =
    QWEN3_BROWSER_Q8_CONTRACT
      .maxLength -
    prefixIds.length -
    suffixIds.length;


  async function score(
    record,
    {
      signal
    } = {}
  ) {
    if (signal?.aborted) {
      throw abortError();
    }


    const instruction =
      QWEN3_BROWSER_Q8_CONTRACT
        .instruction;

    const separator =
      instruction.endsWith("\n")
        ? ""
        : "\n";

    const content =
      `<Instruct>: ${instruction}${separator}` +
      `<Query>: ${record.query}\n` +
      `<Document>: ${documentText(record)}`;

    const encoded =
      tokenizer(
        content,
        {
          add_special_tokens:
            true,
          padding:
            false,
          truncation:
            true,
          max_length:
            contentMaxLength,
          return_tensor:
            false
        }
      );

    const ids = [
      ...prefixIds,
      ...encoded.input_ids,
      ...suffixIds
    ];


    if (
      ids.length >
      QWEN3_BROWSER_Q8_CONTRACT
        .maxLength
    ) {
      throw new Error(
        "La entrada tokenizada excedió 1024 tokens"
      );
    }


    const inputIds =
      new Tensor(
        "int64",
        BigInt64Array.from(
          ids,
          BigInt
        ),
        [1, ids.length]
      );

    const attentionMask =
      new Tensor(
        "int64",
        BigInt64Array.from(
          {
            length:
              ids.length
          },
          () => 1n
        ),
        [1, ids.length]
      );

    const numLogitsToKeep =
      new Tensor(
        "int64",
        [1n],
        []
      );

    let output;


    try {
      output =
        await model({
          input_ids:
            inputIds,
          attention_mask:
            attentionMask,
          num_logits_to_keep:
            numLogitsToKeep
        });


      if (signal?.aborted) {
        throw abortError();
      }


      const logits =
        output.logits;


      if (
        !logits ||
        logits.dims.length !== 3 ||
        logits.dims[0] !== 1
      ) {
        throw new Error(
          "El modelo devolvió logits con forma inesperada"
        );
      }


      const vocabularySize =
        logits.dims[2];

      const offset =
        (logits.dims[1] - 1) *
        vocabularySize;

      const noLogit =
        Number(
          logits.data[
            offset +
            noTokenId
          ]
        );

      const yesLogit =
        Number(
          logits.data[
            offset +
            yesTokenId
          ]
        );

      const maximum =
        Math.max(
          noLogit,
          yesLogit
        );

      const noExp =
        Math.exp(
          noLogit - maximum
        );

      const yesExp =
        Math.exp(
          yesLogit - maximum
        );

      const rawScore =
        yesExp /
        (noExp + yesExp);


      if (
        !Number.isFinite(
          rawScore
        ) ||
        rawScore < 0 ||
        rawScore > 1
      ) {
        throw new Error(
          "Qwen3 devolvió un score inválido"
        );
      }


      return rawScore;
    } finally {
      inputIds.dispose();
      attentionMask.dispose();
      numLogitsToKeep.dispose();
      disposeTensors(output);
    }
  }


  return {
    runtime: {
      backend:
        "onnxruntime-web",
      executionProvider:
        "webgpu",
      device:
        "webgpu",
      dtype:
        "q8",
      adapter:
        gpuInfo,
      sessionConfigs
    },

    score,

    async dispose() {
      await model.dispose?.();
    }
  };
}
