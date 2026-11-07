import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  RESEARCH_ATLAS_SCHEMA_VERSION,
  RESEARCH_ATLAS_NODE_TYPES,
  RESEARCH_ATLAS_EDGE_TYPES,
  RESEARCH_ATLAS_EVIDENCE_CLASSES,
  validateResearchAtlasSnapshot,
  assertResearchAtlasSnapshot
} from "../src/core/research-atlas-contract.js";

const fixtures = JSON.parse(
  await readFile(
    new URL(
      "../benchmark/research-atlas/v1/fixtures.json",
      import.meta.url
    ),
    "utf8"
  )
);

function pathParts(path) {
  return String(path)
    .split(".")
    .map(part => /^\\d+$/.test(part) ? Number(part) : part);
}

function getParent(root, path) {
  const parts = pathParts(path);
  const key = parts.pop();
  let target = root;

  for (const part of parts) {
    target = target[part];
  }

  return { target, key };
}

function applyMutation(snapshot, mutation) {
  if (mutation.op === "set") {
    const { target, key } = getParent(snapshot, mutation.path);
    target[key] = structuredClone(mutation.value);
    return;
  }

  if (mutation.op === "delete") {
    const { target, key } = getParent(snapshot, mutation.path);
    delete target[key];
    return;
  }

  if (mutation.op === "remove-array-index") {
    const { target, key } = getParent(snapshot, mutation.path);
    const array = key === undefined ? target : target[key];
    array.splice(mutation.index, 1);
    return;
  }

  throw new Error("Unknown fixture mutation: " + mutation.op);
}

function buildCase(fixture) {
  const snapshot = structuredClone(fixtures.baseSnapshot);

  for (const mutation of fixture.mutations || []) {
    applyMutation(snapshot, mutation);
  }

  return snapshot;
}

test("RA1 congela vocabulario mínimo y no incluye influence", () => {
  assert.equal(
    RESEARCH_ATLAS_SCHEMA_VERSION,
    "research-atlas-snapshot-v1"
  );

  assert.deepEqual(
    new Set(Object.values(RESEARCH_ATLAS_NODE_TYPES)),
    new Set([
      "query",
      "work",
      "authority-person",
      "author-mention"
    ])
  );

  assert.ok(
    Object.values(RESEARCH_ATLAS_EDGE_TYPES)
      .includes("semantic-neighbor")
  );

  assert.ok(
    Object.values(RESEARCH_ATLAS_EDGE_TYPES)
      .includes("citation")
  );

  assert.equal(
    Object.values(RESEARCH_ATLAS_EDGE_TYPES)
      .includes("influence"),
    false
  );

  assert.deepEqual(
    new Set(Object.values(RESEARCH_ATLAS_EVIDENCE_CLASSES)),
    new Set(["factual", "derived", "provisional"])
  );
});

test("el snapshot base RA1 es válido", () => {
  const result =
    validateResearchAtlasSnapshot(
      fixtures.baseSnapshot
    );

  assert.equal(
    result.ok,
    true,
    result.errors.join("\n")
  );

  assert.equal(
    assertResearchAtlasSnapshot(
      fixtures.baseSnapshot
    ),
    fixtures.baseSnapshot
  );
});

test("todos los fixtures cumplen su expectativa", () => {
  assert.equal(
    fixtures.schemaVersion,
    "research-atlas-fixtures-v1"
  );

  assert.ok(
    fixtures.cases.length >= 19
  );

  for (const fixture of fixtures.cases) {
    const snapshot = buildCase(fixture);
    const result =
      validateResearchAtlasSnapshot(snapshot);

    assert.equal(
      result.ok,
      fixture.expected.valid,
      fixture.id +
        " " +
        fixture.label +
        "\n" +
        result.errors.join("\n")
    );

    for (const expectedError of fixture.expected.errorIncludes || []) {
      assert.ok(
        result.errors.includes(expectedError),
        fixture.id +
          " expected " +
          expectedError +
          "\nReceived:\n" +
          result.errors.join("\n")
      );
    }

    if (fixture.expected.valid) {
      assert.doesNotThrow(
        () =>
          assertResearchAtlasSnapshot(snapshot)
      );
    } else {
      assert.throws(
        () =>
          assertResearchAtlasSnapshot(snapshot),
        /Invalid ResearchAtlasSnapshot/
      );
    }
  }
});

test("todo hit directo conserva evidencia query-result", () => {
  const snapshot =
    structuredClone(
      fixtures.baseSnapshot
    );

  const directWorks =
    snapshot.nodes.filter(
      node =>
        node.nodeType === "work" &&
        node.discovery.directHit
    );

  const targets =
    new Set(
      snapshot.edges
        .filter(edge => edge.type === "query-result")
        .map(edge => edge.toRef)
    );

  for (const work of directWorks) {
    assert.ok(
      targets.has(work.id),
      work.id
    );
  }
});

test("una mención no resuelta nunca aparece como AuthorityPerson", () => {
  const snapshot =
    fixtures.baseSnapshot;

  const mention =
    snapshot.nodes.find(
      node => node.id === "mention:m1"
    );

  assert.equal(
    mention.nodeType,
    "author-mention"
  );

  assert.equal(
    mention.resolutionState,
    "unresolved"
  );

  const edge =
    snapshot.edges.find(
      item => item.fromRef === mention.id
    );

  assert.equal(
    edge.type,
    "author-mention"
  );

  assert.equal(
    edge.status,
    "provisional"
  );
});

test("citation y semantic-neighbor conservan evidencia de clases distintas", () => {
  const snapshot =
    fixtures.baseSnapshot;

  const evidence =
    new Map(
      snapshot.evidence.map(
        item => [item.id, item]
      )
    );

  const semantic =
    snapshot.edges.find(
      edge => edge.type === "semantic-neighbor"
    );

  const citation =
    snapshot.edges.find(
      edge => edge.type === "citation"
    );

  assert.equal(
    evidence.get(semantic.evidenceRefs[0]).class,
    "derived"
  );

  assert.equal(
    evidence.get(citation.evidenceRefs[0]).class,
    "factual"
  );

  assert.equal(
    evidence.get(
      citation.evidenceRefs[0]
    ).payload.explicitBibliographicEdge,
    true
  );
});
