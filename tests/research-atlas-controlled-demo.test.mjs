import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

import {
  ResearchAtlasAssembler
} from "../src/core/research-atlas-assembler.js";

import {
  expandResearchAtlasWithRelatedWorks
} from "../src/core/research-atlas-related.js";

import {
  addResearchAtlasDocumentSimilarity
} from "../src/core/research-atlas-document-similarity.js";

import {
  buildResearchAtlasLayout
} from "../src/core/research-atlas-layout.js";

import {
  buildResearchAtlasViewModel
} from "../src/core/research-atlas-view.js";

const authorityFixture = JSON.parse(
  await readFile(
    new URL(
      "../benchmark/research-atlas/v3/authority-fixture.json",
      import.meta.url
    ),
    "utf8"
  )
);

const relatedFixture = JSON.parse(
  await readFile(
    new URL(
      "../benchmark/research-atlas/v4/related-work-fixture.json",
      import.meta.url
    ),
    "utf8"
  )
);

function buildDemo() {
  const assembler = new ResearchAtlasAssembler({
    filters: {},
    sourceRevisions: {
      openAlexPhilosophy: "fixture-openalex-ra3",
      crossref: "fixture-crossref-ra3",
      authorAuthority:
        authorityFixture.authorityGraph.buildRevision,
      authorityWorkMap:
        authorityFixture.authorityWorkMap.buildRevision,
      relatedWork:
        "fixture-related-ra4"
    },
    authorityGraph:
      authorityFixture.authorityGraph,
    authorityWorkMap:
      authorityFixture.authorityWorkMap
  });

  let snapshot =
    assembler.ingest(
      authorityFixture.searchResponse
    );

  snapshot =
    expandResearchAtlasWithRelatedWorks(
      snapshot,
      relatedFixture.relatedResponses,
      {
        maxExpandedWorks: 8,
        semanticModelId: "Qwen3-Embedding"
      }
    );

  snapshot =
    addResearchAtlasDocumentSimilarity(
      snapshot
    );

  const layout =
    buildResearchAtlasLayout(
      snapshot
    );

  const viewModel =
    buildResearchAtlasViewModel(
      snapshot,
      layout
    );

  return {
    snapshot,
    layout,
    viewModel
  };
}

test("controlled demo combines RA3 Authority and RA4 Related Work using real Atlas contracts", () => {
  const {
    snapshot,
    layout,
    viewModel
  } = buildDemo();

  assert.equal(
    snapshot.diagnostics.directHits,
    3
  );

  assert.equal(
    snapshot.diagnostics.expandedWorks,
    2
  );

  assert.equal(
    snapshot.diagnostics.authorityPersons,
    4
  );

  assert.equal(
    snapshot.diagnostics.unresolvedMentions,
    1
  );

  assert.equal(
    layout.nodes.length,
    snapshot.nodes.length
  );

  assert.ok(
    viewModel.nodes.length >= 10
  );
});

test("controlled demo shows confirmed authority, provisional mention, coauthor and same-author relations", () => {
  const {snapshot} =
    buildDemo();

  const types =
    new Set(
      snapshot.edges.map(
        edge => edge.type
      )
    );

  for (const required of [
    "contribution",
    "author-mention",
    "same-author",
    "coauthor",
    "related-work",
    "semantic-neighbor"
  ]) {
    assert.ok(
      types.has(required),
      "missing edge type: " + required
    );
  }
});

test("controlled demo keeps José Martínez unresolved", () => {
  const {snapshot} =
    buildDemo();

  const mention =
    snapshot.nodes.find(
      node =>
        node.nodeType ===
          "author-mention" &&
        node.rawName ===
          "José Martínez"
    );

  assert.ok(mention);

  assert.equal(
    mention.resolutionState,
    "unresolved"
  );

  assert.equal(
    snapshot.edges.some(
      edge =>
        edge.type ===
          "contribution" &&
        edge.fromRef ===
          mention.id
    ),
    false
  );
});

test("controlled demo expands W300 and W400 without converting them into direct hits", () => {
  const {snapshot} =
    buildDemo();

  for (const identity of [
    "openalex:w300",
    "openalex:w400"
  ]) {
    const work =
      snapshot.nodes.find(
        node =>
          node.identity?.key ===
          identity
      );

    assert.ok(work);
    assert.equal(
      work.discovery.directHit,
      false
    );
  }
});

test("demo page exposes explicit controlled-demo link and warning", async () => {
  const page =
    await readFile(
      new URL(
        "../research-atlas.html",
        import.meta.url
      ),
      "utf8"
    );

  const script =
    await readFile(
      new URL(
        "../js/research-atlas.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    page,
    /demo=authority-related/
  );

  assert.match(
    script,
    /Demo controlado · no producción/
  );

  assert.match(
    script,
    /Fixtures RA3 \+ RA4/
  );
});
