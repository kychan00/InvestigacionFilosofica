import {
  mkdir,
  copyFile,
  stat
} from "node:fs/promises";

import {
  build
} from "esbuild";


const SOURCE =
  "node_modules/@duckdb/duckdb-wasm/dist";

const OUTPUT =
  "vendor/duckdb";


await mkdir(
  OUTPUT,
  {
    recursive: true
  }
);


console.log(
  "Bundling DuckDB-Wasm browser module..."
);


await build({
  entryPoints: [
    `${SOURCE}/duckdb-browser.mjs`
  ],

  bundle: true,
  format: "esm",
  platform: "browser",

  target: [
    "es2020"
  ],

  minify: true,

  outfile:
    `${OUTPUT}/duckdb-browser.bundle.mjs`
});


await copyFile(
  `${SOURCE}/duckdb-mvp.wasm`,
  `${OUTPUT}/duckdb-mvp.wasm`
);


await copyFile(
  `${SOURCE}/duckdb-browser-mvp.worker.js`,
  `${OUTPUT}/duckdb-browser-mvp.worker.js`
);


console.log();
console.log("DuckDB browser assets:");

for (const name of [
  "duckdb-browser.bundle.mjs",
  "duckdb-mvp.wasm",
  "duckdb-browser-mvp.worker.js"
]) {
  const path =
    `${OUTPUT}/${name}`;

  const info =
    await stat(path);

  console.log(
    `${name}: ` +
    `${(info.size / 1024 / 1024).toFixed(2)} MiB`
  );
}
