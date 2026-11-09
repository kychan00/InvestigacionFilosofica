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
  const segment = app.slice(loadMoreIndex, loadMoreIndex + 9000);

  assert.match(
    segment,
    /publishResearchAtlasResponse\([\s\S]*?response,[\s\S]*?"complete",[\s\S]*?requestId:[\s\S]*?topologyRequestId,[\s\S]*?reason:[\s\S]*?"load-more"[\s\S]*?\)/
  );
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
    /research-atlas-embed\.js\?v=20261109-work-identity-alias-v1/
  );
  assert.match(
    page,
    /research-atlas-embed\.css\?v=20261109-ra12d3-main-v1/
  );
});


test("Atlas principal infiere autor buscado desde authors[] cuando authorResolution no existe", () => {
  assert.match(embed, /resultAuthorFallback/);
  assert.match(embed, /looksLikeGenericAuthorQuery/);
  assert.match(embed, /containsAuthorQuery/);
  assert.match(embed, /matchMode:\s*"result-author-query"/);
  assert.match(embed, /matchedResults/);
  assert.match(embed, /exactMatches/);
});

test("fallback visual de autor no sustituye la identidad resuelta", () => {
  const resolvedIndex = embed.indexOf("if (descriptors.length)");
  const fallbackIndex = embed.indexOf("return resultAuthorFallback(response)");

  assert.ok(resolvedIndex >= 0);
  assert.ok(fallbackIndex > resolvedIndex);
  assert.match(
    embed,
    /id\s*&&\s*focus\.ids\.has\(id\)/
  );
});


test("Cargar más espera a que D3 termine la topología semántica ampliada", () => {
  assert.match(
    app,
    /RESEARCH_ATLAS_TOPOLOGY_READY_EVENT/
  );
  assert.match(
    app,
    /waitForResearchAtlasTopology/
  );
  assert.match(
    app,
    /reason:\s*"load-more"/
  );
  assert.match(
    app,
    /"Conectando semánticamente…"/
  );
  assert.match(
    app,
    /await\s+topologyReady/
  );

  assert.match(
    embed,
    /RESEARCH_ATLAS_TOPOLOGY_READY_EVENT/
  );
  assert.match(
    embed,
    /meta\?\.reason\s*===\s*"load-more"/
  );
  assert.match(
    embed,
    /maximumEdges\s*=/
  );
  assert.match(
    embed,
    /Math\.min\(\s*RA12D3_MAXIMUM_EDGES/
  );
  assert.match(
    embed,
    /semanticEdgesAdded/
  );
  assert.match(
    embed,
    /vectorsVerified/
  );
});

test("load-more topology reuses the existing cached Qwen vector client", () => {
  assert.match(
    embed,
    /const qwenVectorClient = new ResearchAtlasQwenVectorClient\(\)/
  );

  const clients =
    embed.match(
      /new ResearchAtlasQwenVectorClient\(\)/g
    ) || [];

  assert.equal(
    clients.length,
    1,
    "the embedded Atlas must keep a single cached vector client across load-more updates"
  );
});

test("load-more topology cache-busts both app and embedded Atlas assets", () => {
  assert.match(
    page,
    /research-atlas-embed\.js\?v=20261109-work-identity-alias-v1/
  );
  assert.match(
    page,
    /app\.js\?v=20261109-work-aggregate-v1/
  );
});


test("expanded load-more topology uses the D3 engine edge ceiling", () => {
  assert.match(
    embed,
    /RA12D3_MAXIMUM_EDGES/
  );
  assert.match(
    embed,
    /Math\.min\(\s*RA12D3_MAXIMUM_EDGES/
  );
  assert.equal(
    embed.includes("Math.min(\n            240"),
    false
  );
});

test("Atlas stage reports persistent Qwen connection counts after each final snapshot", () => {
  assert.match(
    embed,
    /Qwen3 ·/
  );
  assert.match(
    embed,
    /semanticEdgesAdded/
  );
  assert.match(
    embed,
    /obras con vector · lote/
  );
  assert.match(
    embed,
    /Respaldo RA11 ·/
  );
});
