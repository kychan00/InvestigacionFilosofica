import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";


const page =
  await readFile(
    new URL(
      "../research-atlas.html",
      import.meta.url
    ),
    "utf8"
  );

const renderer =
  await readFile(
    new URL(
      "../js/research-atlas.js",
      import.meta.url
    ),
    "utf8"
  );

const live =
  await readFile(
    new URL(
      "../src/core/research-atlas-live.js",
      import.meta.url
    ),
    "utf8"
  );

const searchEngine =
  await readFile(
    new URL(
      "../src/core/search-engine.js",
      import.meta.url
    ),
    "utf8"
  );

const openAlexPhilosophy =
  await readFile(
    new URL(
      "../src/sources/openalex-philosophy.js",
      import.meta.url
    ),
    "utf8"
  );

const index =
  await readFile(
    new URL(
      "../index.html",
      import.meta.url
    ),
    "utf8"
  );


test("RA7 conserva Canvas y alternativa accesible en lista", () => {
  assert.match(
    page,
    /id="ra-canvas"/
  );

  assert.match(
    page,
    /id="ra-node-list"/
  );

  assert.match(
    page,
    /ALTERNATIVA EN LISTA/
  );
});


test("RA7 añade búsqueda real federada y semántica en la ruta experimental", () => {
  assert.match(
    page,
    /id="ra-live-search-form"/
  );

  assert.match(
    page,
    /value="federated"/
  );

  assert.match(
    page,
    /value="semantic"/
  );

  assert.match(
    renderer,
    /ResearchAtlasLiveSession/
  );

  assert.match(
    renderer,
    /philosophy-map\.json/
  );
});


test("RA7 sigue aislado de la navegación principal", () => {
  assert.equal(
    index.includes(
      "./research-atlas.html"
    ),
    false
  );

  assert.match(
    page,
    /todavía no forma parte del flujo principal de producción/i
  );
});


test("renderer RA7 ya no carga el fixture RA5", () => {
  assert.equal(
    renderer.includes(
      "benchmark/research-atlas/v5/layout-fixture.json"
    ),
    false
  );

  assert.equal(
    renderer.includes(
      "ra-simulate"
    ),
    false
  );
});


test("OpenAlex Philosophy permanece fijado al corpus Hugging Face y la API live sigue bloqueada", () => {
  assert.match(
    openAlexPhilosophy,
    /CristianPelayo\/openalex-philosophy/
  );

  assert.match(
    openAlexPhilosophy,
    /09c329326ed24ccf986c4b4c47c9794f055516dc/
  );

  assert.match(
    searchEngine,
    /client-side OpenAlex API calls are disabled/
  );

  assert.match(
    searchEngine,
    /enabled:\s*false/
  );

  assert.equal(
    renderer.includes(
      "api.openalex.org"
    ),
    false
  );

  assert.equal(
    live.includes(
      "api.openalex.org"
    ),
    false
  );
});


test("RA11 expone la capa título + abstract sin llamarla semántica Qwen3", () => {
  assert.match(
    page,
    /data-ra-edge-toggle="lexical-neighbor"/
  );

  assert.match(
    live,
    /addResearchAtlasDocumentSimilarity/
  );
});


test("renderer mantiene filtros, pan, zoom, cancelación y URL compartible", () => {
  for (const token of [
    "ra-live-cancel",
    "pointerdown",
    "pointermove",
    "pointerup",
    "wheel",
    "zoomAt",
    "fitView",
    "filterResearchAtlasViewModel",
    "history.replaceState",
    "URLSearchParams"
  ]) {
    assert.ok(
      renderer.includes(token),
      token
    );
  }
});
