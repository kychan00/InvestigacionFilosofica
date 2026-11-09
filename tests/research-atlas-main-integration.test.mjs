import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

const app = await readFile(
  new URL("../js/app.js", import.meta.url),
  "utf8"
);

const embed = await readFile(
  new URL("../js/research-atlas-embed.js", import.meta.url),
  "utf8"
);

const page = await readFile(
  new URL("../index.html", import.meta.url),
  "utf8"
);

test("RA9 integra Resultados y Atlas como tabs accesibles", () => {
  assert.match(page, /id="research-view-switch"/);
  assert.match(page, /data-research-view="results"/);
  assert.match(page, /data-research-view="atlas"/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /id="research-atlas-panel"/);
  assert.match(page, /id="research-atlas-canvas"/);
  assert.match(page, /id="research-atlas-list"/);
});

test("Resultados sigue siendo la vista seleccionada por defecto", () => {
  assert.match(
    page,
    /id="research-view-results"[\s\S]*aria-selected="true"/
  );
  assert.match(
    page,
    /id="research-view-atlas"[\s\S]*aria-selected="false"/
  );
  assert.match(
    page,
    /id="research-atlas-panel"[\s\S]*class="research-atlas-embed hidden"/
  );
});

test("app publica el mismo SearchResponse y no inicia un pipeline Atlas separado", () => {
  assert.match(app, /research-atlas:search-response/);
  assert.match(app, /publishResearchAtlasResponse\(\s*response,\s*"partial"\s*\)/);
  assert.match(app, /publishResearchAtlasResponse\(\s*response,\s*"complete"\s*\)/);
  assert.match(app, /resetResearchAtlas\(\s*query\s*\)/);
});

test("renderer embebido no importa ni llama motores de búsqueda", () => {
  for (const forbidden of [
    "searchPhilosophy",
    "searchPublicSemantic",
    "combineSemanticWithFederated",
    "searchMorePhilosophy",
    "ResearchAtlasLiveSession",
    "fetch("
  ]) {
    assert.equal(
      embed.includes(forbidden),
      false,
      "forbidden network/search token in embed: " + forbidden
    );
  }
});

test("renderer embebido reutiliza assembler, similitud documental, layout y view model oficiales", () => {
  for (const required of [
    "ResearchAtlasAssembler",
    "ResearchAtlasLayoutEngine",
    "addResearchAtlasDocumentSimilarity",
    "buildResearchAtlasViewModel",
    "filterResearchAtlasViewModel",
    "selectedResearchAtlasContext",
    "OPENALEX_PHILOSOPHY_HF_REVISION"
  ]) {
    assert.ok(embed.includes(required), required);
  }
});

test("RA9 conserva OpenAlex Philosophy como revisión Hugging Face", () => {
  assert.match(embed, /OPENALEX_PHILOSOPHY_HF_REVISION/);
  assert.equal(embed.includes("api.openalex.org"), false);
});

test("modo autor fuerza regreso a Resultados", () => {
  assert.match(
    embed,
    /document\.body\.classList\.contains\("author-view"\)[\s\S]*setView\(\s*"results"\s*\)/
  );
});

test("filtros principales publican identidades canónicas sin reconstruir topología", () => {
  assert.match(app, /resultIdentityKey/);
  assert.match(app, /research-atlas:filter-results/);
  assert.match(app, /publishResearchAtlasFilter\(\)/);
  assert.match(embed, /mainVisibleIdentityKeys/);
  assert.match(embed, /topología preservada/);

  const filterListener = embed.slice(
    embed.indexOf("window.addEventListener(RESEARCH_ATLAS_FILTER_EVENT"),
    embed.indexOf("new MutationObserver", embed.indexOf("window.addEventListener(RESEARCH_ATLAS_FILTER_EVENT"))
  );

  assert.equal(
    filterListener.includes("layoutEngine.layout"),
    false,
    "changing main filters must not recalculate Atlas geometry"
  );
});

test("app actualiza Atlas al cargar más resultados", () => {
  const loadMoreIndex = app.indexOf("async function loadMoreResults");
  assert.ok(loadMoreIndex >= 0);
  const segment = app.slice(loadMoreIndex, loadMoreIndex + 5000);
  assert.match(segment, /publishResearchAtlasResponse\(\s*response,\s*"complete"\s*\)/);
});


test("RA12-D4 embebe Qwen D3 en El territorio de esta búsqueda sin una segunda búsqueda", () => {
  assert.match(
    embed,
    /addResearchAtlasQwenSemanticTopology/
  );
  assert.match(
    embed,
    /ResearchAtlasQwenVectorClient/
  );
  assert.match(
    embed,
    /RA12D3_REVISION/
  );
  assert.match(
    embed,
    /meta\.phase\s*!==\s*"partial"/
  );
  assert.match(
    embed,
    /snapshot\s*=\s*await\s+addResearchAtlasQwenSemanticTopology/
  );
  assert.match(
    embed,
    /snapshot\s*=\s*addResearchAtlasDocumentSimilarity\(base\)/
  );

  for (const forbidden of [
    "searchPhilosophy(",
    "searchPublicSemantic(",
    "combineSemanticWithFederated(",
    "searchMorePhilosophy(",
    "api.openalex.org"
  ]) {
    assert.equal(
      embed.includes(forbidden),
      false,
      "main embed must not create another search: " + forbidden
    );
  }
});

test("RA12-D4 marca obras del autor buscado sin convertir el color en autoridad bibliográfica", () => {
  assert.match(
    embed,
    /resolvedFocusAuthors/
  );
  assert.match(
    embed,
    /resultMatchesFocusAuthor/
  );
  assert.match(
    embed,
    /focusAuthorWork/
  );
  assert.match(
    embed,
    /colors\.focusAuthor/
  );
  assert.match(
    page,
    /id="research-atlas-author-key"/
  );
  assert.match(
    page,
    /data-author-key-label/
  );
});

test("RA12-D4 ofrece autor, ficha y acceso a la obra desde el Atlas principal", () => {
  assert.match(
    embed,
    /research-atlas-author-link/
  );
  assert.match(
    embed,
    /research-atlas-node-action primary", "Ver ficha"/
  );
  assert.match(
    embed,
    /"Abrir obra"/
  );
  assert.match(
    embed,
    /"DOI"/
  );
  assert.match(
    embed,
    /research-atlas:open-record/
  );
  assert.match(
    app,
    /RESEARCH_ATLAS_OPEN_RECORD_EVENT/
  );
  assert.match(
    app,
    /resultIdentityKey\(result\)\s*===\s*identity/
  );
  assert.match(
    app,
    /openRecord\(item\)/
  );
});

test("RA12-D4 actualiza copy y cache bust del Atlas embebido", () => {
  assert.match(
    page,
    /Qwen3 conecta las obras por proximidad semántica/
  );
  assert.match(
    page,
    /research-atlas-embed\.js\?v=20261109-ra12d3-main-v1/
  );
  assert.match(
    page,
    /research-atlas-embed\.css\?v=20261109-ra12d3-main-v1/
  );
});
