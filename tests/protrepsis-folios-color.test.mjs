import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("revistas/udg/protrepsis.html", "utf8");
const css = await readFile("css/protrepsis-folios-color.css", "utf8");
const script = await readFile("js/protrepsis-catalog.js", "utf8");

test("Protrepsis loads its five coloured folios without changing other journals",async()=>{
  assert.match(page,/protrepsis-folios-color\.css\?v=20261113-folios-v2/);
  assert.match(page,/protrepsis-catalog\.js\?v=20261113-folios-v2/);
  for(const name of ["sincronia","quadripartita-ratio"]){
    const other=await readFile("revistas/udg/"+name+".html","utf8");
    assert.doesNotMatch(other,/protrepsis-folios-color\.css/);
    assert.doesNotMatch(other,/20261113-folios-v2/);
  }
});

test("five stable decorative palettes with original screenprint artwork",()=>{
  for(let i=0;i<5;i++)
    assert.ok(css.includes('data-pro-palette="'+i+'"'),"Missing folio "+i);
  assert.match(script,/card\.dataset\.proPalette=String\(variant\)/);
  assert.match(script,/const paints = \[/);
  assert.match(script,/svg\.append\(paint, g\)/);
  assert.match(script,/pro-catalog-plate-index/);
  assert.match(css,/background:var\(--folio-field\)/);
  assert.match(css,/\.pro-catalog-card \.pro-catalog-art/);
  assert.match(css,/\.pro-catalog-plate-index/);
  assert.match(css,/\.pro-catalog-signature/);
  assert.doesNotMatch(css,/quadripartita|sincronia/i);
  assert.doesNotMatch(script,/jardín de las preguntas/i);
});

test("all original card data and DOM interactions remain untouched",()=>{
  assert.match(script,/body\.prepend\(overline,art\)/);
  assert.match(script,/if\(card\.dataset\.proCatalogReady === "true"\) return;/);
  assert.match(script,/MutationObserver\(decorateAll\)/);
  assert.match(script,/card\.classList\.add\("pro-catalog-card"\)/);
  assert.doesNotMatch(script,/replaceChildren|removeChild|innerHTML|fetch\(/);
  for(const id of ["journal-card-grid","journal-qwen-toggle","journal-atlas-canvas","journal-query","journal-load-more"])
    assert.ok(page.includes('id="'+id+'"'),"Missing "+id);
  assert.match(page,/journal-atlas-sheet\.css/);
});

test("illustrated folios keep text contrast, accessibility and mobile behavior",()=>{
  assert.match(css,/\.pro-catalog-card h3/);
  assert.match(css,/\.journal-card-byline/);
  assert.match(css,/\.journal-card-actions a/);
  assert.match(css,/\.journal-card-actions button/);
  assert.match(css,/\.journal-card-details/);
  assert.match(css,/html\[data-theme="dark"\]/);
  assert.match(css,/@media \(max-width: 700px\)/);
  assert.match(css,/@media \(max-width: 420px\)/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
});
