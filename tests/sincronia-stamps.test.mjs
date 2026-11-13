import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile("revistas/udg/sincronia.html", "utf8");
const css = await readFile("css/sincronia-stamps.css", "utf8");
const js = await readFile("js/sincronia-stamps.js", "utf8");

test("Sincronía adopta identidad filatélica sin perder el contrato académico", () => {
  assert.match(html, /sincronia-stamps\.css/);
  assert.match(html, /sincronia-stamps\.js/);
  assert.match(html, /journal-atlas-canvas/);
  assert.match(html, /journal-qwen-toggle/);
  assert.match(html, /journal-category-chips/);
  assert.match(html, /journal-issue-chips/);
  assert.match(html, /journal-topic-chips/);
  assert.match(html, /journal-author-chips/);
  assert.match(html, /Fuente editorial/);
  assert.match(html, /revistasincronia\.cucsh\.udg\.mx/);
  assert.match(html, /La estética cambia; la bibliografía no/);
});

test("diseño está estrictamente limitado a Sincronía y soporta tema oscuro", () => {
  assert.match(css, /body\[data-journal="sincronia"\]/);
  assert.match(css, /html\[data-theme="dark"\] body\[data-journal="sincronia"\]/);
  assert.doesNotMatch(css, /body\[data-journal="protrepsis"\]/);
  assert.doesNotMatch(css, /body\[data-journal="quadripartita"\]/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(max-width: 700px\)/);
});

test("estampas de artículos conservan el DOM bibliográfico existente", () => {
  assert.match(js, /const body = card\.querySelector\("\.journal-card-body"\)/);
  assert.match(js, /paper\.append\(plate, body\)/);
  assert.match(js, /card\.replaceChildren\(frame\)/);
  assert.match(js, /MutationObserver\(decorateAll\)/);
  assert.match(js, /pin-year/);
  assert.match(js, /pin-issue/);
  assert.match(js, /journal-card-rail strong/);
  assert.match(js, /dataset\.snStampReady/);
  assert.doesNotMatch(js, /fetch\s*\(/);
  assert.doesNotMatch(js, /XMLHttpRequest/);
});

test("ilustración es procedural, local y tiene seis composiciones", () => {
  assert.match(js, /makeArchiveDrawing/);
  assert.match(js, /variant === 0/);
  assert.match(js, /variant === 1/);
  assert.match(js, /variant === 2/);
  assert.match(js, /variant === 3/);
  assert.match(js, /variant === 4/);
  assert.match(js, /const variant = .* % 6/);
  assert.match(css, /sn-stamp-paper/);
  assert.match(css, /radial-gradient\(circle 6px/);
  assert.match(css, /mask-composite: intersect/);
});

test("otras revistas no cargan el tema de Sincronía", async () => {
  for (const path of [
    "revistas/udg/protrepsis.html",
    "revistas/udg/quadripartita-ratio.html"
  ]) {
    const other = await readFile(path, "utf8");
    assert.doesNotMatch(other, /sincronia-stamps\.(?:css|js)/);
  }
});


test("Sincronía evita el panel lateral interminable con tres vistas accesibles", async () => {
  const explorer = await readFile("js/sincronia-explorer.js", "utf8");
  assert.match(html, /class="journal-sidebar sn-explorer"/);
  assert.match(html, /data-sn-explorer-tab="topics"/);
  assert.match(html, /data-sn-explorer-tab="issues"/);
  assert.match(html, /data-sn-explorer-tab="filters"/);
  assert.match(html, /data-sn-explorer-panel="topics"/);
  assert.match(html, /data-sn-explorer-panel="issues"/);
  assert.match(html, /data-sn-explorer-panel="filters"/);
  assert.match(css, /max-height:calc\(100dvh - 98px\)/);
  assert.match(css, /sn-explorer-panels[\s\S]*overflow-y:auto/);
  assert.match(explorer, /ArrowRight/);
  assert.match(explorer, /ArrowLeft/);
  assert.match(explorer, /filterToggle\.click/);
});

test("Atlas de Sincronía usa lector lateral y relaciones de ancho completo", () => {
  assert.match(html, /class="journal-atlas-aside sn-atlas-reader"/);
  assert.match(html, /id="journal-atlas-relations"/);
  assert.match(html, /class="sn-atlas-map-footer"/);
  assert.match(html, /II \/ LECTURA/);
  assert.match(css, /sn-atlas-shell[\s\S]*grid-template-columns:minmax\(0,1\.06fr\) minmax\(400px,\.94fr\)/);
  assert.match(css, /sn-atlas-reader[\s\S]*overflow-y:auto/);
  assert.match(css, /sn-atlas-relations[\s\S]*grid-column:1 \/ -1/);
  assert.match(css, /atlas-related-list[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:950px\)[\s\S]*sn-atlas-reader[\s\S]*grid-row:3/);
});
