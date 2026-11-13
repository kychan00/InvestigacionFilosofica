import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("revistas/udg/protrepsis.html", "utf8");
const style = await readFile("css/protrepsis-reading-layout.css", "utf8");
const explorer = await readFile("js/protrepsis-explorer.js", "utf8");
const journal = await readFile("js/journal-page.js", "utf8");
const atlas = await readFile("js/journal-atlas.js", "utf8");

test("la portada mantiene el grabado limpio sin tres etiquetas encima", () => {
  assert.match(page,/class="pro-museum-art"/);
  assert.match(page,/class="pro-museum-caption"/);
  assert.doesNotMatch(page,/class="pro-museum-corner/);
  assert.doesNotMatch(page,/class="pro-museum-seal/);
  assert.doesNotMatch(page,/class="pro-book-cover pro-museum-plaque"/);
  assert.match(style,/\.pro-museum-frame/);
  assert.match(style,/aspect-ratio:1600\/850/);
});

test("el explorador ofrece pestañas accesibles de temas números y filtros", () => {
  for (const name of ["topics","issues","filters"]) {
    assert.match(page,new RegExp('id="pro-explorer-tab-'+name+'"'));
    assert.match(page,new RegExp('data-pro-explorer-panel="'+name+'"'));
    assert.match(page,new RegExp('role="tabpanel" aria-labelledby="pro-explorer-tab-'+name+'"'));
  }
  assert.match(page,/aria-label="Elegir panel del catálogo"/);
  assert.match(explorer,/aria-selected/);
  assert.match(explorer,/event\.key === "ArrowRight"/);
  assert.match(explorer,/event\.key === "ArrowLeft"/);
  assert.match(explorer,/event\.key === "Home"/);
  assert.match(explorer,/event\.key === "End"/);
  assert.match(explorer,/filterToggle\.click\(\)/);
  assert.match(style,/\.pro-explorer-panels/);
  assert.match(style,/overflow-y:auto/);
  assert.match(style,/\.pro-explorer \[data-pro-explorer-panel\]\[hidden\]/);
});

test("Protrepsis presenta artículo junto al mapa y relaciones debajo", () => {
  assert.match(page,/class="journal-atlas-aside pro-atlas-reader"/);
  assert.match(page,/id="journal-atlas-relations"/);
  assert.match(page,/id="journal-atlas-detail" class="journal-atlas-detail pro-atlas-reader-detail"/);
  assert.match(page,/id="journal-atlas-legend"/);
  assert.match(journal,/atlasRelations: document\.querySelector\("#journal-atlas-relations"\)/);
  assert.match(journal,/relations: el\.atlasRelations/);
  assert.match(atlas,/relations = null/);
  assert.match(atlas,/this\.relations = relations/);
  assert.match(atlas,/this\.relations \? '' : relatedMarkup/);
  assert.match(atlas,/if \(this\.relations\) this\.relations\.innerHTML = relatedMarkup/);
  assert.match(atlas,/const relationRoot = this\.relations \|\| this\.detail/);
  assert.match(style,/\.pro-atlas-relations \.atlas-related-list/);
  assert.match(style,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(style,/\.pro-atlas-reader-detail \.atlas-abstract-body/);
});

test("no se introduce el cambio en Sincronía ni Quadripartita ni se modifica el corpus", async () => {
  for (const journalName of ["quadripartita-ratio","sincronia"]) {
    const html = await readFile("revistas/udg/"+journalName+".html","utf8");
    assert.doesNotMatch(html,/protrepsis-reading-layout|protrepsis-explorer/);
    assert.doesNotMatch(html,/journal-atlas-relations/);
  }
  const data = JSON.parse(await readFile("src/data/cucsh-filosofia.json","utf8"));
  assert.equal(data.records.filter(record => record.journal === "Protrepsis").length,248);
  assert.match(style,/@media\(max-width:950px\)/);
  assert.match(style,/@media\(max-width:700px\)/);
  assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
});
