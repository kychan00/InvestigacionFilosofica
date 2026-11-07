import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  resultIdentityKey
} from "../src/core/merge-results.js";

import {
  validateResearchAtlasSnapshot
} from "../src/core/research-atlas-contract.js";

import {
  RESEARCH_ATLAS_ASSEMBLER_REVISION,
  ResearchAtlasAssembler,
  buildResearchAtlasSnapshot,
  researchAtlasGraphSignature
} from "../src/core/research-atlas-assembler.js";

const fixtures = JSON.parse(
  await readFile(
    new URL(
      "../benchmark/research-atlas/v2/search-response-fixtures.json",
      import.meta.url
    ),
    "utf8"
  )
);

const context = {
  filters: {},
  sourceRevisions:
    fixtures.sourceRevisions
};


test("RA2 reutiliza exactamente la identidad canónica de merge-results", () => {
  for (const result of fixtures.final.results) {
    const key =
      resultIdentityKey(result);

    assert.ok(
      key.startsWith("doi:") ||
      key.startsWith("openalex:") ||
      key.startsWith("provider-id:") ||
      key.startsWith("fallback:")
    );
  }
});


test("SearchResponse final produce un snapshot válido sin autores canónicos inventados", () => {
  const snapshot =
    buildResearchAtlasSnapshot(
      fixtures.final,
      context
    );

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
    snapshot.session.assemblerRevision,
    RESEARCH_ATLAS_ASSEMBLER_REVISION
  );

  assert.equal(
    snapshot.diagnostics.directHits,
    fixtures.final.results.length
  );

  assert.equal(
    snapshot.diagnostics.authorityPersons,
    0
  );

  assert.equal(
    snapshot.diagnostics.unresolvedMentions,
    0
  );

  assert.equal(
    snapshot.nodes.filter(
      node => node.nodeType === "work"
    ).length,
    fixtures.final.results.length
  );

  assert.equal(
    snapshot.edges.every(
      edge => edge.type === "query-result"
    ),
    true
  );
});


test("el assembler no muta SearchResponse", () => {
  const input =
    structuredClone(
      fixtures.final
    );

  const before =
    structuredClone(
      input
    );

  buildResearchAtlasSnapshot(
    input,
    context
  );

  assert.deepEqual(
    input,
    before
  );
});


test("providers, source records y matched queries no cambian el grafo por orden de llegada", () => {
  const first =
    structuredClone(
      fixtures.final
    );

  const second =
    structuredClone(
      fixtures.final
    );

  for (const result of second.results) {
    result.providers =
      [...result.providers]
        .reverse();

    result.sourceRecords =
      [...result.sourceRecords]
        .reverse();

    result.matchedQueries =
      [...result.matchedQueries]
        .reverse();
  }

  const left =
    buildResearchAtlasSnapshot(
      first,
      context
    );

  const right =
    buildResearchAtlasSnapshot(
      second,
      context
    );

  assert.deepEqual(
    left,
    right
  );
});


test("el orden de ranking puede cambiar evidencia de posición pero no la estructura del grafo", () => {
  const first =
    buildResearchAtlasSnapshot(
      fixtures.final,
      context
    );

  const reversedResponse =
    structuredClone(
      fixtures.final
    );

  reversedResponse.results =
    [...reversedResponse.results]
      .reverse();

  const second =
    buildResearchAtlasSnapshot(
      reversedResponse,
      context
    );

  assert.equal(
    researchAtlasGraphSignature(first),
    researchAtlasGraphSignature(second)
  );

  assert.notDeepEqual(
    first.evidence,
    second.evidence
  );
});


test("snapshots parciales crecen con IDs de obra estables", () => {
  const assembler =
    new ResearchAtlasAssembler(
      context
    );

  const first =
    assembler.ingest(
      fixtures.partials[0]
    );

  const second =
    assembler.ingest(
      fixtures.partials[1]
    );

  const final =
    assembler.ingest(
      fixtures.final
    );

  assert.equal(
    first.session.state,
    "collecting"
  );

  assert.equal(
    second.session.state,
    "collecting"
  );

  assert.equal(
    final.session.state,
    "complete"
  );

  assert.equal(
    first.session.id,
    final.session.id
  );

  const firstWork =
    first.nodes.find(
      node =>
        node.nodeType === "work"
    );

  const sameWork =
    final.nodes.find(
      node =>
        node.identity?.key ===
        firstWork.identity.key
    );

  assert.ok(sameWork);

  assert.equal(
    firstWork.id,
    sameWork.id
  );

  assert.equal(
    first.session.graphRevision,
    1
  );

  assert.equal(
    second.session.graphRevision,
    2
  );

  assert.equal(
    final.session.graphRevision,
    3
  );
});


test("dos resultados con la misma identidad canónica son rechazados antes de producir un grafo inválido", () => {
  const response =
    structuredClone(
      fixtures.final
    );

  response.results.push(
    {
      ...structuredClone(
        response.results[0]
      ),
      id: "duplicate-provider-row"
    }
  );

  assert.throws(
    () =>
      buildResearchAtlasSnapshot(
        response,
        context
      ),
    /duplicate canonical identity/
  );
});


test("resultado sin proveedor no puede convertirse en hit factual", () => {
  const response =
    structuredClone(
      fixtures.final
    );

  response.results[0].providers =
    [];

  assert.throws(
    () =>
      buildResearchAtlasSnapshot(
        response,
        context
      ),
    /no provider evidence/
  );
});


test("browser semantic exige opt-in también al pasar por RA2", () => {
  const response =
    structuredClone(
      fixtures.final
    );

  response.searchMode =
    "semantic";

  assert.throws(
    () =>
      buildResearchAtlasSnapshot(
        response,
        {
          ...context,
          searchMode:
            "browser-semantic",
          browserOptIn:
            false
        }
      ),
    /browser-semantic-requires-explicit-opt-in/
  );

  const valid =
    buildResearchAtlasSnapshot(
      response,
      {
        ...context,
        searchMode:
          "browser-semantic",
        browserOptIn:
          true
      }
    );

  assert.equal(
    valid.session.semantic
      .browserOptIn,
    true
  );
});


test("reset elimina el estado incremental sin modificar el contexto", () => {
  const assembler =
    new ResearchAtlasAssembler(
      context
    );

  assembler.ingest(
    fixtures.partials[0]
  );

  assert.ok(
    assembler.snapshot()
  );

  assembler.reset();

  assert.equal(
    assembler.snapshot(),
    null
  );

  const rebuilt =
    assembler.ingest(
      fixtures.final
    );

  assert.equal(
    rebuilt.session.graphRevision,
    1
  );
});
