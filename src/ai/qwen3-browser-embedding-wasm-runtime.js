import {
  env,
  pipeline
} from "@huggingface/transformers";


export const BROWSER_EMBEDDING_CONTRACT = Object.freeze({
  model: "onnx-community/Qwen3-Embedding-0.6B-ONNX",
  revision: "c25a394dd583836952667c12f008335071b3f43d",
  dtype: "q8",
  device: "wasm",
  dimension: 1024,
  instruction:
    "Retrieve academic works that are philosophically relevant to the query. " +
    "Prioritize documents that directly discuss the concepts, philosophers, " +
    "arguments, problems or traditions expressed in the query."
});


function assertBrowserRuntime() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    globalThis !== window
  ) {
    throw new Error("Embedding inference requires a real browser window");
  }

  if (
    typeof process !== "undefined" &&
    process?.release?.name === "node"
  ) {
    throw new Error("Node.js inference is forbidden");
  }

}


function sessionAudit(model) {
  const entries = Object.entries(model.sessions || {});
  if (!entries.length) {
    throw new Error("The ONNX model exposed no auditable sessions");
  }

  return Object.fromEntries(entries.map(([name, session]) => {
    if (session.config?.device !== BROWSER_EMBEDDING_CONTRACT.device) {
      throw new Error(`Session ${name} did not select browser WASM`);
    }
    if (session.config?.dtype !== BROWSER_EMBEDDING_CONTRACT.dtype) {
      throw new Error(`Session ${name} did not select q8`);
    }
    return [name, session.config];
  }));
}


function queryText(query) {
  return (
    `Instruct: ${BROWSER_EMBEDDING_CONTRACT.instruction}\n` +
    `Query:${query}`
  );
}


export async function embedQueriesWasm(queries, { onProgress = () => {} } = {}) {
  assertBrowserRuntime();
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  onProgress({ stage: "model" });
  const extractor = await pipeline(
    "feature-extraction",
    BROWSER_EMBEDDING_CONTRACT.model,
    {
      revision: BROWSER_EMBEDDING_CONTRACT.revision,
      dtype: BROWSER_EMBEDDING_CONTRACT.dtype,
      device: BROWSER_EMBEDDING_CONTRACT.device,
      progress_callback: progress => onProgress({ stage: "download", progress })
    }
  );
  const sessions = sessionAudit(extractor.model);

  const results = [];
  for (let index = 0; index < queries.length; index += 1) {
    const item = queries[index];
    onProgress({ stage: "query", index, count: queries.length });
    const output = await extractor(queryText(item.query), {
      pooling: "last_token",
      normalize: true
    });
    const values = output.tolist()[0];
    if (
      values.length !== BROWSER_EMBEDDING_CONTRACT.dimension ||
      values.some(value => !Number.isFinite(value))
    ) {
      throw new Error(`Invalid embedding for ${item.query_id}`);
    }
    results.push({
      query_id: item.query_id,
      query: item.query,
      embedding: values
    });
    output.dispose?.();
  }

  extractor.dispose?.();
  return {
    schema_version: "qwen3-browser-semantic-wasm-embeddings-v2",
    contract: BROWSER_EMBEDDING_CONTRACT,
    execution: {
      environment: "browser",
      device: "wasm",
      node_inference: false
    },
    sessions,
    user_agent: navigator.userAgent,
    queries: results
  };
}
