import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

import {
  validateResearchAtlasSnapshot
} from "../src/core/research-atlas-contract.js";

import {
  buildResearchAtlasSnapshot,
  ResearchAtlasAssembler,
  researchAtlasGraphSignature
} from "../src/core/research-atlas-assembler.js";

import {
  RESEARCH_ATLAS_AUTHORITY_REVISION,
  enrichResearchAtlasWithAuthority
} from "../src/core/research-atlas-authority.js";

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../benchmark/research-atlas/v3/authority-fixture.json",
      import.meta.url
    ),
    "utf8"
  )
);

const context = {
  filters: {},
  sourceRevisions: {
    openAlexPhilosophy: "fixture-openalex-ra3",
    crossref: "fixture-crossref-ra3"
  }
};


function buildBase() {
  return buildResearchAtlasSnapshot(
    fixture.searchResponse,
    context
  );
}


function enrich() {
  return enrichResearchAtlasWithAuthority(
    buildBase(),
    fixture.searchResponse,
    {
      authorityGraph:
        fixture.authorityGraph,
      authorityWorkMap:
        fixture.authorityWorkMap
    }
  );
}


test("RA3 enriquece el snapshot y conserva el contrato RA1", () => {
  const snapshot = enrich();
  const validation =
    validateResearchAtlasSnapshot(
      snapshot
    );

  assert.equal(
    validation.ok,
    true,
    validation.errors.join("\n")
  );

  assert.equal(
    snapshot.diagnostics.authority.revision,
    RESEARCH_ATLAS_AUTHORITY_REVISION
  );

  assert.equal(
    snapshot.diagnostics.authorityPersons,
    4
  );

  assert.equal(
    snapshot.diagnostics.unresolvedMentions,
    1
  );
});


test("authority-work-map materializa autores aun cuando el resultado no trae authors", () => {
  const snapshot = enrich();

  const work =
    snapshot.nodes.find(
      node =>
        node.identity?.key ===
        "openalex:w200"
    );

  assert.ok(work);

  const contributions =
    snapshot.edges.filter(
      edge =>
        edge.type ===
          "contribution" &&
        edge.toRef ===
          work.id
    );

  assert.equal(
    contributions.length,
    2
  );

  const personRefs =
    contributions.map(
      edge =>
        snapshot.nodes.find(
          node =>
            node.id ===
            edge.fromRef
        )?.authorityRef
    ).sort();

  assert.deepEqual(
    personRefs,
    [
      "authority:ana",
      "authority:carlos"
    ]
  );

  assert.equal(
    snapshot.diagnostics
      .authority
      .unresolvedAuthorityObservations,
    1
  );
});


test("identificador estructurado resuelve AuthorityPerson y nombre solo permanece como mención", () => {
  const snapshot = enrich();

  const diana =
    snapshot.nodes.find(
      node =>
        node.authorityRef ===
        "authority:diana"
    );

  assert.ok(diana);

  const unresolved =
    snapshot.nodes.filter(
      node =>
        node.nodeType ===
        "author-mention"
    );

  assert.equal(
    unresolved.length,
    1
  );

  assert.equal(
    unresolved[0].rawName,
    "José Martínez"
  );

  assert.equal(
    unresolved[0].resolutionState,
    "unresolved"
  );

  assert.equal(
    snapshot.edges.some(
      edge =>
        edge.type ===
          "contribution" &&
        edge.fromRef ===
          unresolved[0].id
    ),
    false
  );
});


test("mismo autor se deriva sólo de AuthorityPerson compartida", () => {
  const snapshot = enrich();

  const sameAuthor =
    snapshot.edges.filter(
      edge =>
        edge.type ===
        "same-author"
    );

  assert.equal(
    sameAuthor.length,
    1
  );

  const evidence =
    snapshot.evidence.find(
      item =>
        item.id ===
        sameAuthor[0]
          .evidenceRefs[0]
    );

  assert.deepEqual(
    evidence.payload.authorityRefs,
    ["authority:ana"]
  );
});


test("coauthor se deriva de una obra compartida y conserva supportWorkRefs", () => {
  const snapshot = enrich();

  const coauthors =
    snapshot.edges.filter(
      edge =>
        edge.type ===
        "coauthor"
    );

  assert.equal(
    coauthors.length,
    2
  );

  for (const edge of coauthors) {
    const evidence =
      snapshot.evidence.find(
        item =>
          item.id ===
          edge.evidenceRefs[0]
      );

    assert.ok(
      evidence.payload
        .supportWorkRefs.length >=
        1
    );
  }
});


test("la misma Contribution no se duplica si resultado y work-map confirman a la misma persona", () => {
  const snapshot = enrich();

  const work100 =
    snapshot.nodes.find(
      node =>
        node.identity?.key ===
        "openalex:w100"
    );

  const ana =
    snapshot.nodes.find(
      node =>
        node.authorityRef ===
        "authority:ana"
    );

  const edges =
    snapshot.edges.filter(
      edge =>
        edge.type ===
          "contribution" &&
        edge.fromRef ===
          ana.id &&
        edge.toRef ===
          work100.id
    );

  assert.equal(
    edges.length,
    1
  );

  assert.equal(
    edges[0].evidenceRefs.length,
    2
  );
});


test("orden de Authority Work Map y authorities no altera el grafo", () => {
  const left = enrich();

  const graph =
    structuredClone(
      fixture.authorityGraph
    );

  graph.authorities.reverse();

  const workMap =
    structuredClone(
      fixture.authorityWorkMap
    );

  workMap.rows.reverse();

  for (const row of workMap.rows) {
    row.a.reverse();
  }

  const right =
    enrichResearchAtlasWithAuthority(
      buildBase(),
      fixture.searchResponse,
      {
        authorityGraph: graph,
        authorityWorkMap: workMap
      }
    );

  assert.deepEqual(
    left,
    right
  );
});


test("authority-work-map que apunta a persona inexistente falla cerrado", () => {
  const broken =
    structuredClone(
      fixture.authorityWorkMap
    );

  broken.rows[0].a[0].r =
    "authority:missing";

  assert.throws(
    () =>
      enrichResearchAtlasWithAuthority(
        buildBase(),
        fixture.searchResponse,
        {
          authorityGraph:
            fixture.authorityGraph,
          authorityWorkMap:
            broken
        }
      ),
    /unknown AuthorityPerson/
  );
});


test("dos identificadores registrados en autoridades distintas producen mención ambigua, no falsa persona", () => {
  const response =
    structuredClone(
      fixture.searchResponse
    );

  response.results[2].authors = [
    {
      name: "Conflicted Person",
      id: "https://openalex.org/A123",
      orcid: "https://orcid.org/0000-0002-2222-2222"
    }
  ];

  const base =
    buildResearchAtlasSnapshot(
      response,
      context
    );

  const snapshot =
    enrichResearchAtlasWithAuthority(
      base,
      response,
      {
        authorityGraph:
          fixture.authorityGraph,
        authorityWorkMap:
          fixture.authorityWorkMap
      }
    );

  const mention =
    snapshot.nodes.find(
      node =>
        node.nodeType ===
        "author-mention"
    );

  assert.ok(mention);

  assert.equal(
    mention.resolutionState,
    "ambiguous"
  );

  assert.deepEqual(
    mention.candidateAuthorityRefs,
    [
      "authority:ana",
      "authority:diana"
    ]
  );
});


test("ResearchAtlasAssembler aplica RA3 sólo cuando recibe authorityGraph", () => {
  const plain =
    new ResearchAtlasAssembler(
      context
    ).ingest(
      fixture.searchResponse
    );

  assert.equal(
    plain.diagnostics.authorityPersons,
    0
  );

  const enriched =
    new ResearchAtlasAssembler({
      ...context,
      authorityGraph:
        fixture.authorityGraph,
      authorityWorkMap:
        fixture.authorityWorkMap
    }).ingest(
      fixture.searchResponse
    );

  assert.equal(
    enriched.diagnostics.authorityPersons,
    4
  );

  assert.notEqual(
    researchAtlasGraphSignature(plain),
    researchAtlasGraphSignature(enriched)
  );
});
