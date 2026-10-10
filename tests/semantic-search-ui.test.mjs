import assert from "node:assert/strict";
import {
  readFile
} from "node:fs/promises";
import test from "node:test";


test(
  "la UI ofrece semántica como alfa explícita y conserva tradicional por defecto",
  async () => {
    const [
      html,
      app,
      css
    ] = await Promise.all([
      readFile(
        new URL(
          "../index.html",
          import.meta.url
        ),
        "utf8"
      ),
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
      html,
      /data-search-mode="federated"[\s\S]*aria-pressed="true"/u
    );

    assert.match(
      html,
      /data-search-mode="semantic"[\s\S]*aria-pressed="false"/u
    );

    assert.match(
      app,
      /searchPublicSemantic\(/u
    );

    assert.match(
      html,
      /id="search-engine-indicator"[\s\S]*data-semantic-status="checking"/u
    );

    assert.match(
      app,
      /checkPublicSemanticHealth\(/u
    );

    assert.match(
      app,
      /Motor usado/u
    );

    assert.match(
      app,
      /await runFederatedSearch\([\s\S]*fallbackReason:/u
    );

    assert.match(
      app,
      /Búsqueda semántica activa · \$\{elapsedSeconds\} s transcurridos/u
    );

    assert.match(
      app,
      /registros equivalentes/u
    );

    assert.match(
      app,
      /identidad exacta/u
    );

    assert.match(
      css,
      /\.search-mode-option\.is-active/u
    );

    assert.match(
      css,
      /\.search-live-progress\.semantic-progress/u
    );

    assert.match(
      css,
      /data-semantic-status="available"/u
    );
  }
);
