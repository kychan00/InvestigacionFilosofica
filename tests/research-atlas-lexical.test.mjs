import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResearchAtlasSnapshot
} from "../src/core/research-atlas-assembler.js";

import {
  validateResearchAtlasSnapshot
} from "../src/core/research-atlas-contract.js";

import {
  RESEARCH_ATLAS_LEXICAL_METHOD,
  RESEARCH_ATLAS_LEXICAL_REVISION,
  addResearchAtlasLexicalNeighbors
} from "../src/core/research-atlas-lexical.js";


function result({
  id,
  title,
  year = 2020
}) {
  return {
    id,
    title,
    authors: [],
    year,
    type: "article",
    language: "en",
    doi: null,
    isbn: [],
    topics: [],
    providers: [
      "OpenAlex Philosophy"
    ],
    sourceRecords: [
      {
        provider:
          "OpenAlex Philosophy",
        sourceId:
          id,
        query:
          "freedom and autonomy"
      }
    ],
    matchedQueries: [
      {
        query:
          "freedom and autonomy",
        weight: 1,
        type: "original"
      }
    ],
    urls: {},
    institutionalLinks: []
  };
}


function baseSnapshot() {
  return buildResearchAtlasSnapshot(
    {
      query:
        "freedom and autonomy",
      results: [
        result({
          id:
            "openalex-W100",
          title:
            "Freedom and autonomy in Kant"
        }),
        result({
          id:
            "openalex-W200",
          title:
            "Moral freedom and autonomy after Kant"
        }),
        result({
          id:
            "openalex-W300",
          title:
            "Logic and ontology in Quine"
        })
      ],
      errors: [],
      stats: {
        appearances: 3,
        unique: 3,
        merged: 0,
        providers: {
          "OpenAlex Philosophy": 3
        }
      }
    },
    {
      sourceRevisions: {
        openAlexPhilosophy:
          "fixture"
      }
    }
  );
}


test("RA7 crea lexical-neighbor sólo cuando títulos comparten señal suficiente", () => {
  const snapshot =
    addResearchAtlasLexicalNeighbors(
      baseSnapshot()
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

  const lexical =
    snapshot.edges.filter(
      edge =>
        edge.type ===
        "lexical-neighbor"
    );

  assert.equal(
    lexical.length,
    1
  );

  const evidence =
    snapshot.evidence.find(
      item =>
        item.id ===
        lexical[0]
          .evidenceRefs[0]
    );

  assert.equal(
    evidence.payload.method,
    RESEARCH_ATLAS_LEXICAL_METHOD
  );

  assert.equal(
    evidence.payload.revision,
    RESEARCH_ATLAS_LEXICAL_REVISION
  );

  assert.deepEqual(
    evidence.payload.sharedTokens,
    [
      "autonomy",
      "freedom",
      "kant"
    ]
  );
});


test("lexical-neighbor nunca se presenta como semantic-neighbor", () => {
  const snapshot =
    addResearchAtlasLexicalNeighbors(
      baseSnapshot()
    );

  assert.equal(
    snapshot.edges.some(
      edge =>
        edge.type ===
        "semantic-neighbor"
    ),
    false
  );

  assert.equal(
    snapshot.edges.some(
      edge =>
        edge.type ===
        "lexical-neighbor"
    ),
    true
  );
});


test("una pareja con semantic-neighbor explícito no recibe fallback lexical duplicado", () => {
  const snapshot =
    baseSnapshot();

  const works =
    snapshot.nodes.filter(
      node =>
        node.nodeType ===
        "work"
    );

  const left =
    works.find(
      node =>
        /w100$/i.test(
          node.identity.key
        )
    );

  const right =
    works.find(
      node =>
        /w200$/i.test(
          node.identity.key
        )
    );

  snapshot.evidence.push({
    id:
      "ev:semantic",
    class:
      "derived",
    source:
      "fixture",
    payload: {
      modelId:
        "Qwen3-Embedding",
      modelRevision:
        "fixture-v1",
      metric:
        "cosine",
      score:
        0.91
    }
  });

  snapshot.edges.push({
    id:
      "edge:semantic",
    type:
      "semantic-neighbor",
    fromRef:
      left.id,
    toRef:
      right.id,
    status:
      "derived",
    evidenceRefs: [
      "ev:semantic"
    ]
  });

  const enriched =
    addResearchAtlasLexicalNeighbors(
      snapshot
    );

  assert.equal(
    enriched.edges.filter(
      edge =>
        edge.type ===
        "lexical-neighbor"
    ).length,
    0
  );

  assert.equal(
    enriched.diagnostics
      .lexical
      .skippedBecauseSemantic,
    1
  );
});


test("orden de WorkNodes no altera las relaciones lexicales", () => {
  const left =
    addResearchAtlasLexicalNeighbors(
      baseSnapshot()
    );

  const shuffled =
    baseSnapshot();

  shuffled.nodes.reverse();
  shuffled.edges.reverse();
  shuffled.evidence.reverse();

  const right =
    addResearchAtlasLexicalNeighbors(
      shuffled
    );

  assert.deepEqual(
    left.edges.filter(
      edge =>
        edge.type ===
        "lexical-neighbor"
    ),
    right.edges.filter(
      edge =>
        edge.type ===
        "lexical-neighbor"
    )
  );
});
