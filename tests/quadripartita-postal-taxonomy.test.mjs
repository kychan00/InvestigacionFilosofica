import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("revistas/udg/quadripartita-ratio.html", "utf8");
const runtime = await readFile("js/journal-page.js", "utf8");
const style = await readFile("css/quadripartita-postal-taxonomy.css", "utf8");

test("Quadripartita tiene un clasificador de temas y números con reinicios independientes", async () => {
  assert.match(page,/id="journal-category-all"/);
  assert.match(page,/id="journal-issue-all"/);
  assert.match(page,/Todos los temas/);
  assert.match(page,/Todos los números/);
  assert.match(page,/aria-pressed="true"/);
  assert.match(page,/qr-postal-taxonomy/);
  assert.match(page,/quadripartita-postal-taxonomy\.css\?v=20261113-postal-v1/);
  assert.match(page,/journal-page\.js\?v=20261113-postal-v1/);
  for (const path of ["protrepsis.html","sincronia.html"]) {
    const other = await readFile("revistas/udg/"+path,"utf8");
    assert.doesNotMatch(other,/quadripartita-postal-taxonomy\.css/);
    assert.doesNotMatch(other,/qr-postal-taxonomy/);
  }
});

test("filtros compartidos funcionan en Protrepsis y Quadripartita sin afectar Sincronía", () => {
  assert.match(runtime,/const supportsCuratorialFacets = journalId === "protrepsis" \|\| journalId === "quadripartita"/);
  assert.match(runtime,/function syncCuratorialChips\(\)/);
  assert.match(runtime,/if \(!supportsCuratorialFacets\) return;/);
  assert.match(runtime,/supportsCuratorialFacets && value !== "all" && state\[facet\] === value \? "all" : value/);
  assert.match(runtime,/button\.dataset\.taxonomyValue = group\.key/);
  assert.match(runtime,/button\.classList\.toggle\("is-active", selected\)/);
  assert.match(runtime,/el\.categoryAll\?\.addEventListener\("click"/);
  assert.match(runtime,/el\.issueAll\?\.addEventListener\("click"/);
  assert.match(runtime,/if \(state\.view === "atlas"\) buildAtlas\(\)/);
});

test("estampillas-filtro muestran todos los números y animan solo cuando se permite", () => {
  assert.match(style,/body\[data-journal="quadripartita"\] \.qr-postal-taxonomy/);
  assert.match(style,/\.qr-postal-issues \.journal-taxonomy-list/);
  assert.match(style,/max-height: none !important/);
  assert.match(style,/overflow: visible !important/);
  assert.match(style,/\.taxonomy-chip\[aria-pressed="true"\]/);
  assert.match(style,/@keyframes qr-postal-stamp/);
  assert.match(style,/@keyframes qr-postal-cards-appear/);
  assert.match(style,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(style,/:focus-visible/);
  assert.match(style,/html\[data-theme="dark"\]/);
  assert.doesNotMatch(style,/body\[data-journal="protrepsis"\]/);
});

test("se conservan el catálogo, Atlas, DOI, carga incremental y diseño de estampillas", () => {
  for (const id of ["journal-issue","journal-category","journal-category-chips","journal-issue-chips","journal-reset","journal-card-grid","journal-atlas-canvas","journal-qwen-toggle","journal-load-more","journal-results-status"]) {
    assert.ok(page.includes('id="'+id+'"'),"Falta #"+id);
  }
  assert.match(page,/quadripartita-stamps\.js\?v=20261113-stamps-v1/);
  assert.match(page,/journal-atlas-sheet\.css\?v=/);
  assert.match(page,/quadripartita-cobalt\.css\?v=/);
});
