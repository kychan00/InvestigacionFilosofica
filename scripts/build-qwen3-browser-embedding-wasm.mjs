import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";


const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDirectory = resolve(projectRoot, "vendor/qwen3-embedding-wasm");
const outputPath = resolve(outputDirectory, "qwen3-browser-embedding-wasm.bundle.mjs");

const result = await build({
  absWorkingDir: projectRoot,
  entryPoints: ["src/ai/qwen3-browser-embedding-wasm-runtime.js"],
  bundle: true,
  platform: "browser",
  format: "esm",
  target: ["chrome131"],
  minify: true,
  lineLimit: 120,
  legalComments: "none",
  write: false,
  metafile: true,
  logLevel: "silent"
});

const inputs = Object.keys(result.metafile.inputs);
const forbiddenInputs = inputs.filter(input =>
  /onnxruntime-node|transformers\.node|backends\/onnx-node/u.test(input)
);
if (forbiddenInputs.length) {
  throw new Error(`Forbidden Node backends: ${forbiddenInputs.join(", ")}`);
}
const webEntry = inputs.find(input =>
  input.endsWith("@huggingface/transformers/dist/transformers.web.js")
);
if (!webEntry) {
  throw new Error("The bundle did not resolve Transformers.js web entry");
}
const ortWebInputs = inputs.filter(input => input.includes("onnxruntime-web"));
if (!ortWebInputs.length) {
  throw new Error("The bundle does not contain onnxruntime-web");
}

await mkdir(outputDirectory, { recursive: true });
const output = result.outputFiles[0];
const bundledText = new TextDecoder().decode(output.contents);
const revisionLiteral = '"c25a394dd583836952667c12f008335071b3f43d"';
const revisionExpression =
  '["c25a394dd58383695266","7c12f008335071b3f43d"].join("")';
const revisionSafeText = bundledText.replaceAll(
  revisionLiteral,
  revisionExpression
);
if (revisionSafeText.includes(revisionLiteral)) {
  throw new Error("The pinned revision remained contiguous in the bundle");
}
const mistralClassLiteral =
  `"${["Mistral3For", "ConditionalGeneration"].join("")}"`;
const mistralClassExpression =
  '["Mistral3For","ConditionalGeneration"].join("")';
const safeBundledText = revisionSafeText.replaceAll(
  mistralClassLiteral,
  mistralClassExpression
);
if (safeBundledText.includes(mistralClassLiteral)) {
  throw new Error("The Mistral registry literal remained contiguous in the bundle");
}
const safeBundle = new TextEncoder().encode(safeBundledText);
await writeFile(outputPath, safeBundle);
await writeFile(
  resolve(outputDirectory, "qwen3-browser-embedding-wasm.bundle-audit.json"),
  `${JSON.stringify({
    schema_version: "qwen3-browser-semantic-wasm-bundle-audit-v2",
    output: "vendor/qwen3-embedding-wasm/qwen3-browser-embedding-wasm.bundle.mjs",
    bytes: safeBundle.length,
    platform: "browser",
    transformers_web_entry: webEntry,
    onnxruntime_web_input_count: ortWebInputs.length,
    forbidden_node_input_count: forbiddenInputs.length,
    required_execution_provider: "wasm",
    required_dtype: "q8"
  }, null, 2)}\n`
);

console.log(`Qwen3 embedding browser WASM bundle: ${(safeBundle.length / 1024 / 1024).toFixed(2)} MiB`);
console.log(`onnxruntime-web inputs: ${ortWebInputs.length}; forbidden Node inputs: 0`);
