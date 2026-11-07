import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

import {
  normalizeRelatedWorkIndexIdentity,
  relationShardNumber
} from "../src/core/related-work-index-format.js";

import {
  buildResearchAtlasSnapshot,
  researchAtlasWorkNodeId
} from "../src/core/research-atlas-assembler.js";

import {
  validateResearchAtlasSnapshot
} from "../src/core/research-atlas-contract.js";

import {
  RESEARCH_ATLAS_RELATED_REVISION,
  expandResearchAtlasWithRelatedWorks,
  normalizeResearchAtlasWorkIdentity,
  relatedWorkSeedIdentityForAtlasIdentity
} from "../src/core/research-atlas-related.js";

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../benchmark/research-atlas/v4/related-work-fixture.json",
      import.meta.url
    ),
    "utf8"
  )
);

const context = {
  filters: {},
  sourceRevisions: {
    openAlexPhilosophy: "fixture-ra4"
  }
};


function baseSnapshot() {
  return buildResearchAtlasSnapshot(
    fixture.searchResponse,
    context
  );
}


function expanded(options = {}) {
  return expandResearchAtlasWithRelatedWorks(
    baseSnapshot(),
    fixture.relatedResponses,
    options
  );
}


test("normaliza la frontera OpenAlex entre Atlas y Related Work Index", async () => {
  assert.equal(
    normalizeResearchAtlasWorkIdentity(
      "openalex:W123"
    ),
    "openalex:w123"
  );

  assert.equal(
    relatedWorkSeedIdentityForAtlasIdentity(
      "openalex:w123"
    ),
    "openalex:W123"
  );

  assert.equal(
    normalizeRelatedWorkIndexIdentity(
      "openalex:w123"
    ),
    "openalex:W123"
  );

  assert.equal(
    await relationShardNumber(
      "openalex:w123",
      {
        shardCount: 8
      }
    ),
    await relationShardNumber(
      "openalex:W123",
      {
        shardCount: 8
      }
    )
  );
});


test("RA4 produce un snapshot válido con hits directos y expansiones separadas", () => {
  const snapshot = expanded();
  const result =
    validateResearchAtlasSnapshot(
      snapshot
    );

  assert.equal(
    result.ok,
    true,
    result.errors.join("\n")
  );

  assert.equal(
    snapshot.diagnostics.directHits,
    2
  );

  assert.equal(
    snapshot.diagnostics.expandedWorks,
    2
  );

  assert.equal(
    snapshot.diagnostics.related.revision,
    RESEARCH_ATLAS_RELATED_REVISION
  );
});


test("una obra expandida conserva ID compatible con RA2 si luego se vuelve hit directo", () => {
  const snapshot = expanded();

  const target =
    snapshot.nodes.find(
      node =>
        node.identity?.key ===
        "openalex:w300"
    );

  assert.ok(target);

  assert.equal(
    target.discovery.directHit,
    false
  );

  assert.equal(
    target.id,
    researchAtlasWorkNodeId(
      "openalex:w300"
    )
  );
});


test("un target que ya era hit directo no se duplica ni se degrada a expansión", () => {
  const snapshot = expanded();

  const direct =
    snapshot.nodes.filter(
      node =>
        node.identity?.key ===
        "openalex:w200"
    );

  assert.equal(
    direct.length,
    1
  );

  assert.equal(
    direct[0].discovery.directHit,
    true
  );

  assert.deepEqual(
    direct[0].discovery.origins,
    ["direct-search"]
  );

  assert.equal(
    snapshot.diagnostics.related.reusedDirectTargets,
    1
  );
});


test("el mismo target descubierto desde dos seeds produce un solo WorkNode", () => {
  const snapshot = expanded();

  const targets =
    snapshot.nodes.filter(
      node =>
        node.identity?.key ===
        "openalex:w300"
    );

  assert.equal(
    targets.length,
    1
  );

  assert.equal(
    targets[0].relatedDiscovery.seedWorkRefs.length,
    2
  );

  assert.equal(
    targets[0].relatedDiscovery.relationEdgeRefs.length,
    2
  );
});


test("semantic-affinity produce semantic-neighbor con score y revisión", () => {
  const snapshot = expanded();

  const semantic =
    snapshot.edges.filter(
      edge =>
        edge.type ===
        "semantic-neighbor"
    );

  assert.equal(
    semantic.length,
    3
  );

  for (const edge of semantic) {
    const evidence =
      snapshot.evidence.find(
        item =>
          item.id ===
          edge.evidenceRefs[0]
      );

    assert.equal(
      evidence.payload.modelId,
      "Qwen3-Embedding"
    );

    assert.equal(
      evidence.payload.modelRevision,
      "qwen3-browser-static-v4-fixture"
    );

    assert.equal(
      evidence.payload.metric,
      "cosine"
    );

    assert.ok(
      evidence.payload.score > 0
    );
  }
});


test("authority-only Related Work no inventa semantic-neighbor", () => {
  const snapshot = expanded();

  const related =
    snapshot.edges.find(
      edge =>
        edge.type ===
          "related-work" &&
        snapshot.nodes.find(
          node =>
            node.id ===
            edge.toRef
        )?.identity?.key ===
          "openalex:w400"
    );

  assert.ok(related);

  const semantic =
    snapshot.edges.find(
      edge =>
        edge.type ===
          "semantic-neighbor" &&
        edge.toRef ===
          related.toRef
    );

  assert.equal(
    semantic,
    undefined
  );
});


test("target sin metadata hidratada no se inventa como WorkNode", () => {
  const snapshot = expanded();

  assert.equal(
    snapshot.nodes.some(
      node =>
        node.identity?.key ===
        "openalex:w500"
    ),
    false
  );

  assert.equal(
    snapshot.diagnostics.related.skippedUnhydratedTargets,
    1
  );
});


test("related-work conserva relación compuesta sin colapsarla a semántica", () => {
  const snapshot = expanded();

  const target =
    snapshot.nodes.find(
      node =>
        node.identity?.key ===
        "openalex:w300"
    );

  const seed =
    snapshot.nodes.find(
      node =>
        node.identity?.key ===
        "openalex:w100"
    );

  const related =
    snapshot.edges.find(
      edge =>
        edge.type ===
          "related-work" &&
        edge.fromRef ===
          seed.id &&
        edge.toRef ===
          target.id
    );

  const evidence =
    snapshot.evidence.find(
      item =>
        item.id ===
          related.evidenceRefs[0]
    );

  assert.ok(
    evidence.payload.relationTypes.includes(
      "semantic-affinity"
    )
  );

  assert.ok(
    evidence.payload.relationTypes.includes(
      "shared-topic"
    )
  );
});


test("sin revisión semántica se conserva related-work pero no se publica semantic-neighbor", () => {
  const responses =
    structuredClone(
      fixture.relatedResponses
    );

  for (const response of responses) {
    delete response.provenance.source.semantic_revision;
  }

  const snapshot =
    expandResearchAtlasWithRelatedWorks(
      baseSnapshot(),
      responses
    );

  assert.equal(
    snapshot.edges.filter(
      edge =>
        edge.type ===
        "semantic-neighbor"
    ).length,
    0
  );

  assert.ok(
    snapshot.edges.some(
      edge =>
        edge.type ===
        "related-work"
    )
  );

  assert.equal(
    snapshot.diagnostics.related
      .skippedSemanticWithoutRevision,
    3
  );
});


test("budget global limita sólo nuevas expansiones, no relaciones hacia hits existentes", () => {
  const snapshot =
    expandResearchAtlasWithRelatedWorks(
      baseSnapshot(),
      fixture.relatedResponses,
      {
        maxExpandedWorks: 1
      }
    );

  assert.equal(
    snapshot.diagnostics.expandedWorks,
    1
  );

  assert.ok(
    snapshot.edges.some(
      edge =>
        edge.type ===
          "related-work" &&
        snapshot.nodes.find(
          node =>
            node.id ===
            edge.toRef
        )?.identity?.key ===
          "openalex:w200"
    )
  );

  assert.ok(
    snapshot.diagnostics.related
      .skippedByGlobalBudget >=
      1
  );
});


test("orden de responses no altera el snapshot", () => {
  const left = expanded();

  const right =
    expandResearchAtlasWithRelatedWorks(
      baseSnapshot(),
      [
        ...fixture.relatedResponses
      ].reverse()
    );

  assert.deepEqual(
    left,
    right
  );
});
