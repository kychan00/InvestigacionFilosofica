import assert from "node:assert/strict";
import {
  readFile
} from "node:fs/promises";
import test from "node:test";


test(
  "la búsqueda muestra carga inmediata y consume resultados parciales",
  async () => {
    const [
      app,
      css
    ] = await Promise.all([
      readFile(
        new URL(
          "../js/app.js",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "../css/redesign.css",
          import.meta.url
        ),
        "utf8"
      )
    ]);


    assert.match(
      app,
      /resultsEl\.innerHTML\s*=\s*\n\s*renderSearchLoading\(\)/u
    );

    assert.match(
      app,
      /onPartialResults\(response\)/u
    );

    assert.match(
      app,
      /renderProgressiveSearch\(/u
    );

    assert.match(
      app,
      /"aria-busy",\s*\n\s*"true"/u
    );

    assert.match(
      css,
      /\.search-live-progress/u
    );

    assert.match(
      css,
      /prefers-reduced-motion/u
    );
  }
);
