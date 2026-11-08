import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

import {
  buildResearchAtlasLayout
} from "../src/core/research-atlas-layout.js";

import {
  RESEARCH_ATLAS_VIEW_SCHEMA_VERSION,
  buildResearchAtlasViewModel,
  filterResearchAtlasViewModel,
  selectedResearchAtlasContext
} from "../src/core/research-atlas-view.js";


const fixture = JSON.parse(
  await readFile(
    new URL(
      "../benchmark/research-atlas/v5/layout-fixture.json",
      import.meta.url
    ),
    "utf8"
  )
);


function buildView(
  snapshot = fixture.initialSnapshot,
  edgeTypes
) {
  const layout =
    buildResearchAtlasLayout(
      snapshot
    );

  return buildResearchAtlasViewModel(
    snapshot,
    layout,
    edgeTypes
      ? {edgeTypes}
      : undefined
  );
}


test("RA6 view model conserva todos los nodos y coordenadas del layout", () => {
  const snapshot =
    fixture.initialSnapshot;

  const layout =
    buildResearchAtlasLayout(
      snapshot
    );

  const view =
    buildResearchAtlasViewModel(
      snapshot,
      layout
    );

  assert.equal(
    view.schemaVersion,
    RESEARCH_ATLAS_VIEW_SCHEMA_VERSION
  );

  assert.equal(
    view.nodes.length,
    snapshot.nodes.length
  );

  for (const node of view.nodes) {
    const source =
      layout.nodes.find(
        item =>
          item.id ===
          node.id
      );

    assert.equal(
      node.x,
      source.x
    );

    assert.equal(
      node.y,
      source.y
    );
  }
});


test("hits directos y expansiones L1 permanecen visualmente distintos", () => {
  const view =
    buildView();

  const direct =
    view.nodes.find(
      node =>
        node.id ===
        "work:a"
    );

  const expanded =
    view.nodes.find(
      node =>
        node.id ===
        "work:c"
    );

  assert.equal(
    direct.kind,
    "work-direct"
  );

  assert.equal(
    direct.directHit,
    true
  );

  assert.equal(
    expanded.kind,
    "work-expanded"
  );

  assert.equal(
    expanded.directHit,
    false
  );
});


test("AuthorityPerson y AuthorMention conservan estados visuales diferentes", () => {
  const view =
    buildView();

  const person =
    view.nodes.find(
      node =>
        node.id ===
        "person:p1"
    );

  const mention =
    view.nodes.find(
      node =>
        node.id ===
        "mention:m1"
    );

  assert.equal(
    person.kind,
    "authority-person"
  );

  assert.equal(
    mention.kind,
    "author-mention"
  );

  assert.match(
    person.why.join(" "),
    /Author Authority Graph/
  );

  assert.match(
    mention.why.join(" "),
    /no resuelta/i
  );
});


test("aristas visuales distinguen semántica, Related Work, factual y provisional", () => {
  const view =
    buildView();

  const semantic =
    view.edges.find(
      edge =>
        edge.type ===
        "semantic-neighbor"
    );

  const related =
    view.edges.find(
      edge =>
        edge.type ===
        "related-work"
    );

  const contribution =
    view.edges.find(
      edge =>
        edge.type ===
        "contribution"
    );

  const provisional =
    view.edges.find(
      edge =>
        edge.type ===
        "author-mention"
    );

  assert.equal(
    semantic.visualType,
    "semantic"
  );

  assert.equal(
    semantic.semanticScore,
    0.91
  );

  assert.equal(
    related.visualType,
    "related"
  );

  assert.deepEqual(
    contribution.evidenceClasses,
    ["factual"]
  );

  assert.deepEqual(
    provisional.evidenceClasses,
    ["provisional"]
  );
});


test("query-result no se dibuja por defecto", () => {
  const view =
    buildView();

  assert.equal(
    view.edges.some(
      edge =>
        edge.type ===
        "query-result"
    ),
    false
  );
});


test("el caller puede activar explícitamente query-result sin cambiar el layout", () => {
  const snapshot =
    fixture.initialSnapshot;

  const layout =
    buildResearchAtlasLayout(
      snapshot
    );

  const defaultView =
    buildResearchAtlasViewModel(
      snapshot,
      layout
    );

  const explicit =
    buildResearchAtlasViewModel(
      snapshot,
      layout,
      {
        edgeTypes: [
          "query-result",
          "semantic-neighbor"
        ]
      }
    );

  assert.ok(
    explicit.edges.some(
      edge =>
        edge.type ===
        "query-result"
    )
  );

  assert.deepEqual(
    defaultView.nodes.map(
      node => [
        node.id,
        node.x,
        node.y
      ]
    ),
    explicit.nodes.map(
      node => [
        node.id,
        node.x,
        node.y
      ]
    )
  );
});


test("filtrar por texto no altera coordenadas ni el view model original", () => {
  const view =
    buildView();

  const before =
    structuredClone(
      view.nodes
    );

  const filtered =
    filterResearchAtlasViewModel(
      view,
      "autonomy"
    );

  assert.ok(
    filtered.visibleNodeIds.has(
      "work:a"
    )
  );

  assert.equal(
    filtered.visibleNodeIds.has(
      "person:p1"
    ),
    false
  );

  assert.deepEqual(
    view.nodes,
    before
  );
});


test("contexto seleccionado devuelve sólo conexiones visibles", () => {
  const view =
    buildView();

  const selected =
    selectedResearchAtlasContext(
      view,
      "work:a"
    );

  assert.equal(
    selected.node.id,
    "work:a"
  );

  assert.ok(
    selected.edges.length >=
    3
  );

  assert.ok(
    selected.connectedNodes.some(
      node =>
        node.id ===
        "person:p1"
    )
  );
});


test("snapshot expandido agrega una obra L1 sin cambiar el vocabulario visual", () => {
  const view =
    buildView(
      fixture.expandedSnapshot
    );

  const work =
    view.nodes.find(
      node =>
        node.id ===
        "work:d"
    );

  assert.ok(work);

  assert.equal(
    work.kind,
    "work-expanded"
  );

  assert.equal(
    view.diagnostics.expandedWorks,
    2
  );
});


test("lexical-neighbor conserva un vocabulario visual distinto de semantic-neighbor", () => {
  const snapshot =
    structuredClone(
      fixture.initialSnapshot
    );

  snapshot.evidence.push({
    id:
      "ev:lexical:b:c",
    class:
      "derived",
    source:
      "research-atlas-live-v1",
    payload: {
      method:
        "title-token-jaccard-v1",
      score:
        0.42,
      sharedTokens: [
        "freedom"
      ]
    }
  });

  snapshot.edges.push({
    id:
      "edge:lexical:b:c",
    type:
      "lexical-neighbor",
    fromRef:
      "work:b",
    toRef:
      "work:c",
    status:
      "derived",
    evidenceRefs: [
      "ev:lexical:b:c"
    ]
  });

  const layout =
    buildResearchAtlasLayout(
      snapshot
    );

  const view =
    buildResearchAtlasViewModel(
      snapshot,
      layout
    );

  const lexical =
    view.edges.find(
      edge =>
        edge.type ===
        "lexical-neighbor"
    );

  assert.ok(lexical);

  assert.equal(
    lexical.visualType,
    "lexical"
  );

  assert.equal(
    lexical.label,
    "Similitud título + abstract"
  );
});
