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

const index =
  await readFile(
    new URL(
      "../index.html",
      import.meta.url
    ),
    "utf8"
  );


test("RA6 publica una ruta experimental con Canvas y alternativa en lista", () => {
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


test("la página declara explícitamente que todavía no está conectada al buscador público", () => {
  assert.match(
    page,
    /Todavía no está conectado\s+al buscador público/i
  );
});


test("RA6 no se añade todavía a la navegación principal de index.html", () => {
  assert.equal(
    index.includes(
      "./research-atlas.html"
    ),
    false
  );
});


test("renderer experimental sólo carga el fixture local y no consulta OpenAlex live", () => {
  assert.match(
    renderer,
    /benchmark\/research-atlas\/v5\/layout-fixture\.json/
  );

  assert.equal(
    renderer.includes(
      "api.openalex.org"
    ),
    false
  );

  assert.equal(
    renderer.includes(
      "huggingface.co/api"
    ),
    false
  );
});


test("renderer ofrece simulación incremental, filtros, pan y zoom", () => {
  for (const token of [
    "ra-simulate",
    "pointerdown",
    "pointermove",
    "pointerup",
    "wheel",
    "zoomAt",
    "fitView",
    "filterResearchAtlasViewModel"
  ]) {
    assert.ok(
      renderer.includes(token),
      token
    );
  }
});
