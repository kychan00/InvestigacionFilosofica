import {
  mkdir,
  writeFile
} from "node:fs/promises";

import {
  resolve
} from "node:path";

import {
  fileURLToPath
} from "node:url";

import {
  build
} from "esbuild";


const projectRoot =
  resolve(
    fileURLToPath(
      new URL(
        "..",
        import.meta.url
      )
    )
  );

const outputDirectory =
  resolve(
    projectRoot,
    "vendor/qwen3"
  );

const outputPath =
  resolve(
    outputDirectory,
    "qwen3-browser-q8.bundle.mjs"
  );


const result =
  await build({
    absWorkingDir:
      projectRoot,

    entryPoints: [
      "src/ai/qwen3-browser-q8-runtime.js"
    ],

    bundle:
      true,

    platform:
      "browser",

    format:
      "esm",

    target: [
      "chrome131"
    ],

    minify:
      true,

    legalComments:
      "none",

    write:
      false,

    metafile:
      true,

    logLevel:
      "silent"
  });


const inputs =
  Object.keys(
    result.metafile.inputs
  );

const forbiddenInputs =
  inputs.filter(
    input =>
      /onnxruntime-node|transformers\.node|backends\/onnx-node/u
        .test(input)
  );


if (forbiddenInputs.length) {
  throw new Error(
    `El bundle contiene backends Node prohibidos: ${forbiddenInputs.join(", ")}`
  );
}


const transformersWebEntry =
  inputs.find(
    input =>
      input.endsWith(
        "@huggingface/transformers/dist/transformers.web.js"
      )
  );


if (!transformersWebEntry) {
  throw new Error(
    "El bundle no resolvió la exportación web de Transformers.js"
  );
}


const onnxruntimeWebInputs =
  inputs.filter(
    input =>
      input.includes(
        "onnxruntime-web"
      )
  );


if (!onnxruntimeWebInputs.length) {
  throw new Error(
    "El bundle no contiene onnxruntime-web"
  );
}


const output =
  result.outputFiles[0];


await mkdir(
  outputDirectory,
  {
    recursive:
      true
  }
);

await writeFile(
  outputPath,
  output.contents
);

await writeFile(
  resolve(
    outputDirectory,
    "qwen3-browser-q8.bundle-audit.json"
  ),
  `${JSON.stringify({
    schema_version:
      "qwen3-browser-q8-product-bundle-audit-v1",
    output:
      "vendor/qwen3/qwen3-browser-q8.bundle.mjs",
    bytes:
      output.contents.length,
    platform:
      "browser",
    transformers_web_entry:
      transformersWebEntry,
    onnxruntime_web_input_count:
      onnxruntimeWebInputs.length,
    forbidden_node_input_count:
      forbiddenInputs.length,
    required_execution_provider:
      "webgpu",
    required_dtype:
      "q8"
  }, null, 2)}\n`
);


console.log(
  `Qwen3 browser q8 bundle: ${(output.contents.length / 1024 / 1024).toFixed(2)} MiB`
);

console.log(
  `onnxruntime-web inputs: ${onnxruntimeWebInputs.length}; forbidden Node inputs: 0`
);
