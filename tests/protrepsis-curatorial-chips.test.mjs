import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("revistas/udg/protrepsis.html","utf8");
const runtime = await readFile("js/journal-page.js","utf8");
const styles = await readFile("css/protrepsis-curatorial-chips.css","utf8");

test("chips y resets de Protrepsis forman parte del catálogo, no de otras revistas",async()=>{
  assert.match(page,/journal-category-all/);
  assert.match(page,/journal-issue-all/);
  assert.match(page,/Todos los temas/);
  assert.match(page,/Todos los números/);
  assert.match(page,/protrepsis-curatorial-chips\.css\?v=20261113-museum-chips-v1/);
  assert.match(page,/journal-page\.js\?v=20261113-museum-chips-v1/);
  for(const path of ["sincronia.html","quadripartita-ratio.html"]){
    const other=await readFile("revistas/udg/"+path,"utf8");
    assert.doesNotMatch(other,/journal-category-all|journal-issue-all|protrepsis-curatorial-chips/);
  }
});

test("selección es accesible y restablece solo el filtro correspondiente",()=>{
  assert.match(runtime,/function syncCuratorialChips/);
  assert.match(runtime,/function selectTaxonomyFacet/);
  assert.match(runtime,/value !== "all" && state\[facet\] === value \? "all" : value/);
  assert.match(runtime,/button\.setAttribute\("aria-pressed", String\(selected\)\)/);
  assert.match(runtime,/button\.classList\.toggle\("is-active", selected\)/);
  assert.match(runtime,/button\.dataset\.taxonomyValue = label/);
  assert.match(runtime,/button\.dataset\.taxonomyValue = group\.key/);
  assert.match(runtime,/el\.categoryAll\?\.addEventListener\("click"/);
  assert.match(runtime,/el\.issueAll\?\.addEventListener\("click"/);
  assert.match(runtime,/if \(state\.view === "atlas"\) buildAtlas\(\)/);
});

test("la estética museográfica deja ver todos los números y respeta movimiento reducido",()=>{
  assert.match(styles,/body\[data-journal="protrepsis"\] \.pro-curatorial-block/);
  assert.match(styles,/\.journal-taxonomy-list/);
  assert.match(styles,/max-height:none !important/);
  assert.match(styles,/overflow:visible !important/);
  assert.match(styles,/\[aria-pressed="true"\]/);
  assert.match(styles,/pro-curatorial-results/);
  assert.match(styles,/pro-curatorial-select/);
  assert.match(styles,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles,/:focus-visible/);
  assert.match(styles,/--ticket-accent/);
  assert.doesNotMatch(styles,/jardín de las preguntas/i);
});
