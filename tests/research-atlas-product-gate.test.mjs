import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";


const config =
  JSON.parse(
    await readFile(
      new URL(
        "../benchmark/research-atlas/v8/product-gate-config.json",
        import.meta.url
      ),
      "utf8"
    )
  );

const renderer =
  await readFile(
    new URL(
      "../js/research-atlas.js",
      import.meta.url
    ),
    "utf8"
  );

const page =
  await readFile(
    new URL(
      "../research-atlas.html",
      import.meta.url
    ),
    "utf8"
  );

const script =
  await readFile(
    new URL(
      "../scripts/research-atlas/run-product-gate.mjs",
      import.meta.url
    ),
    "utf8"
  );


test("RA8 gate cubre 5, 20 y 50 resultados", () => {
  assert.deepEqual(
    config.cases.map(
      item =>
        item.resultCount
    ),
    [
      5,
      20,
      50
    ]
  );

  assert.ok(
    config.samplesPerCase >=
      20
  );
});


test("RA8 define umbrales de CPU, tamaño, densidad y navegador", () => {
  assert.ok(
    config.thresholds
      .coreP95Ms
      .large >
      0
  );

  assert.ok(
    config.thresholds
      .serializedSnapshotBytes
      .large >
      0
  );

  assert.equal(
    config.thresholds
      .lexicalEdges
      .largeMax,
    36
  );

  assert.ok(
    config.thresholds
      .browser
      .timeToRenderedAtlasMs >
      0
  );
});


test("benchmark del renderer está aislado detrás de benchmark=1", () => {
  assert.match(
    renderer,
    /params\.get\(\s*"benchmark"\s*\)\s*===\s*"1"/
  );

  assert.match(
    renderer,
    /artifacts\/research-atlas-ra8\/product-gate-fixture\.json/
  );

  assert.match(
    renderer,
    /dataset\s*\.raBenchmark\s*=\s*"ready"/
  );
});


test("modo normal sigue inicializando ResearchAtlasLiveSession", () => {
  assert.match(
    renderer,
    /new ResearchAtlasLiveSession/
  );

  assert.match(
    renderer,
    /philosophy-map\.json/
  );
});


test("core gate usa ResearchAtlasLiveSession y no una implementación paralela", () => {
  assert.match(
    script,
    /ResearchAtlasLiveSession/
  );

  assert.match(
    script,
    /session\.runFederated/
  );

  assert.match(
    script,
    /lexical-neighbor/
  );
});


test("RA8 elimina metadata y cache-busting obsoletos de RA6", () => {
  assert.equal(
    /Experimento RA6|EXPERIMENTO RA6|ra6-v1/.test(
      page
    ),
    false
  );

  assert.match(
    page,
    /research-atlas\.css\?v=20261107-ra11-v1/
  );

  assert.match(
    page,
    /research-atlas\.js\?v=20261113-ra13a-v1/
  );
});
