import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

import {
  validateResearchAtlasSnapshot
} from "../src/core/research-atlas-contract.js";

import {
  RESEARCH_ATLAS_LAYOUT_SCHEMA_VERSION,
  ResearchAtlasLayoutEngine,
  buildResearchAtlasLayout,
  measureResearchAtlasLayout,
  researchAtlasLayoutSignature,
  validateResearchAtlasLayout
} from "../src/core/research-atlas-layout.js";

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../benchmark/research-atlas/v5/layout-fixture.json",
      import.meta.url
    ),
    "utf8"
  )
);

function workCoordinates(layout) {
  return Object.fromEntries(
    layout.nodes
      .filter(node => node.nodeType === "work")
      .map(node => [
        node.id,
        {x: node.x, y: node.y}
      ])
  );
}

test("fixtures RA5 cumplen el contrato del grafo", () => {
  for (const snapshot of [
    fixture.initialSnapshot,
    fixture.expandedSnapshot
  ]) {
    const result = validateResearchAtlasSnapshot(snapshot);
    assert.equal(result.ok, true, result.errors.join("\n"));
  }
});

test("RA5 produce coordenadas válidas para todos los nodos", () => {
  const layout = buildResearchAtlasLayout(fixture.initialSnapshot);

  assert.equal(
    layout.schemaVersion,
    RESEARCH_ATLAS_LAYOUT_SCHEMA_VERSION
  );

  const result = validateResearchAtlasLayout(
    layout,
    fixture.initialSnapshot
  );

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(
    layout.nodes.length,
    fixture.initialSnapshot.nodes.length
  );

  assert.ok(
    layout.nodes.every(
      node =>
        Number.isFinite(node.x) &&
        Number.isFinite(node.y)
    )
  );
});

test("QueryNode queda anclado al origen y no participa como fuerza semántica", () => {
  const layout = buildResearchAtlasLayout(fixture.initialSnapshot);
  const query = layout.nodes.find(node => node.id === "query:ra5");

  assert.deepEqual(
    {
      x: query.x,
      y: query.y,
      pinned: query.pinned
    },
    {
      x: 0,
      y: 0,
      pinned: true
    }
  );
});

test("el layout es determinista aunque cambie el orden de nodes, edges y evidence", () => {
  const left = buildResearchAtlasLayout(fixture.initialSnapshot);
  const shuffled = structuredClone(fixture.initialSnapshot);

  shuffled.nodes.reverse();
  shuffled.edges.reverse();
  shuffled.evidence.reverse();

  const right = buildResearchAtlasLayout(shuffled);

  assert.equal(
    researchAtlasLayoutSignature(left),
    researchAtlasLayoutSignature(right)
  );
});

test("personas y menciones no alteran la geometría obra↔obra", () => {
  const full = buildResearchAtlasLayout(fixture.initialSnapshot);
  const worksOnly = structuredClone(fixture.initialSnapshot);

  worksOnly.nodes = worksOnly.nodes.filter(
    node => ["query", "work"].includes(node.nodeType)
  );

  const allowedEvidence = new Set([
    "ev:q:a",
    "ev:q:b",
    "ev:sem:a:b",
    "ev:sem:a:c",
    "ev:related:a:c",
    "ev:authority-only:b:c"
  ]);

  worksOnly.evidence = worksOnly.evidence.filter(
    item => allowedEvidence.has(item.id)
  );

  worksOnly.edges = worksOnly.edges.filter(
    edge => !["contribution", "author-mention"].includes(edge.type)
  );

  worksOnly.diagnostics.authorityPersons = 0;
  worksOnly.diagnostics.unresolvedMentions = 0;

  const validation = validateResearchAtlasSnapshot(worksOnly);
  assert.equal(validation.ok, true, validation.errors.join("\n"));

  const sparse = buildResearchAtlasLayout(worksOnly);

  assert.deepEqual(
    workCoordinates(full),
    workCoordinates(sparse)
  );
});

test("related-work puramente autoral no ejerce fuerza sobre las obras", () => {
  const withAuthorityOnly =
    buildResearchAtlasLayout(fixture.initialSnapshot);

  const without = structuredClone(fixture.initialSnapshot);

  without.edges = without.edges.filter(
    edge => edge.id !== "edge:authority-only:b:c"
  );

  without.evidence = without.evidence.filter(
    item => item.id !== "ev:authority-only:b:c"
  );

  const layoutWithout = buildResearchAtlasLayout(without);

  assert.deepEqual(
    workCoordinates(withAuthorityOnly),
    workCoordinates(layoutWithout)
  );
});

test("un nuevo WorkNode conectado nace cerca de su vecindad y limita el desplazamiento anterior", () => {
  const initial = buildResearchAtlasLayout(fixture.initialSnapshot);

  const next = buildResearchAtlasLayout(
    fixture.expandedSnapshot,
    {
      previousLayout: initial,
      maxExistingDisplacement: 0.18
    }
  );

  const metrics = measureResearchAtlasLayout(
    fixture.expandedSnapshot,
    next,
    {previousLayout: initial}
  );

  assert.ok(
    metrics.maxExistingDisplacement <= 0.180000001
  );

  const workD = next.nodes.find(node => node.id === "work:d");

  assert.equal(workD.spawn.method, "neighbor");
  assert.equal(workD.spawn.anchorRef, "work:b");
});

test("pinning conserva exactamente la coordenada solicitada", () => {
  const layout = buildResearchAtlasLayout(
    fixture.initialSnapshot,
    {
      pinned: {
        "work:a": {
          x: 1.75,
          y: -0.55
        }
      }
    }
  );

  const pinned = layout.nodes.find(node => node.id === "work:a");

  assert.equal(pinned.x, 1.75);
  assert.equal(pinned.y, -0.55);
  assert.equal(pinned.pinned, true);
});

test("searchPosition cambia evidencia de búsqueda pero no la geometría", () => {
  const left = buildResearchAtlasLayout(fixture.initialSnapshot);
  const changed = structuredClone(fixture.initialSnapshot);

  changed.evidence.find(
    item => item.id === "ev:q:a"
  ).payload.searchPosition = 99;

  changed.evidence.find(
    item => item.id === "ev:q:b"
  ).payload.searchPosition = 1;

  const right = buildResearchAtlasLayout(changed);

  assert.deepEqual(
    workCoordinates(left),
    workCoordinates(right)
  );
});

test("RA5 no muta ResearchAtlasSnapshot", () => {
  const input = structuredClone(fixture.initialSnapshot);
  const before = structuredClone(input);

  buildResearchAtlasLayout(input);

  assert.deepEqual(input, before);
});

test("ResearchAtlasLayoutEngine usa el layout previo de forma incremental", () => {
  const engine = new ResearchAtlasLayoutEngine({
    maxExistingDisplacement: 0.15
  });

  const first = engine.layout(fixture.initialSnapshot);
  const second = engine.layout(fixture.expandedSnapshot);

  const metrics = measureResearchAtlasLayout(
    fixture.expandedSnapshot,
    second,
    {previousLayout: first}
  );

  assert.ok(
    metrics.maxExistingDisplacement <= 0.150000001
  );

  assert.equal(
    engine.snapshot().sessionRef,
    fixture.expandedSnapshot.session.id
  );

  engine.reset();
  assert.equal(engine.snapshot(), null);
});

test("métricas separan longitud semántica de otros tipos de geometría", () => {
  const layout = buildResearchAtlasLayout(fixture.initialSnapshot);

  const metrics = measureResearchAtlasLayout(
    fixture.initialSnapshot,
    layout
  );

  assert.equal(
    metrics.edgeLengths["semantic-neighbor"].count,
    2
  );

  assert.equal(
    metrics.edgeLengths["related-work"],
    undefined
  );

  assert.ok(
    Number.isFinite(
      metrics.edgeLengths["semantic-neighbor"].mean
    )
  );
});
