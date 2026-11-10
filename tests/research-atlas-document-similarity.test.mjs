import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResearchAtlasSnapshot
} from "../src/core/research-atlas-assembler.js";

import {
  validateResearchAtlasSnapshot
} from "../src/core/research-atlas-contract.js";

import {
  RESEARCH_ATLAS_DOCUMENT_SIMILARITY_METHOD,
  RESEARCH_ATLAS_DOCUMENT_SIMILARITY_REVISION,
  addResearchAtlasDocumentSimilarity
} from "../src/core/research-atlas-document-similarity.js";


function result({
  id,
  title,
  abstract = null,
  externalDescription = null,
  year = 2020
}) {
  return {
    id,
    title,
    abstract,
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
          externalDescription
            ? "Internet Archive"
            : "OpenAlex Philosophy",
        sourceId:
          id,
        query:
          "freedom and autonomy",
        externalDescription
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


function snapshot(
  results
) {
  return buildResearchAtlasSnapshot(
    {
      query:
        "freedom and autonomy",
      results,
      errors: [],
      stats: {
        appearances:
          results.length,
        unique:
          results.length,
        merged: 0,
        providers: {
          "OpenAlex Philosophy":
            results.length
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


test("RA11 preserves abstract on WorkNode", () => {
  const graph =
    snapshot([
      result({
        id:
          "openalex-W100",
        title:
          "Self legislation",
        abstract:
          "Autonomy is treated as rational self legislation under moral law."
      })
    ]);

  const work =
    graph.nodes.find(
      node =>
        node.nodeType ===
        "work"
    );

  assert.equal(
    work.abstract,
    "Autonomy is treated as rational self legislation under moral law."
  );
});


test("RA11 connects works through abstract even when titles are not lexically close", () => {
  const graph =
    addResearchAtlasDocumentSimilarity(
      snapshot([
        result({
          id:
            "openalex-W100",
          title:
            "Self legislation",
          abstract:
            "Autonomy rational agency moral law freedom practical reason."
        }),
        result({
          id:
            "openalex-W200",
          title:
            "The kingdom of ends",
          abstract:
            "Freedom autonomy moral law rational agency practical reason."
        }),
        result({
          id:
            "openalex-W300",
          title:
            "Modal logic and quantification",
          abstract:
            "Quantifiers possible worlds modal operators necessity and reference."
        })
      ])
    );

  const validation =
    validateResearchAtlasSnapshot(
      graph
    );

  assert.equal(
    validation.ok,
    true,
    validation.errors.join("\n")
  );

  const edge =
    graph.edges.find(
      item =>
        item.type ===
        "lexical-neighbor"
    );

  assert.ok(edge);

  const evidence =
    graph.evidence.find(
      item =>
        item.id ===
        edge.evidenceRefs[0]
    );

  assert.equal(
    evidence.payload.method,
    RESEARCH_ATLAS_DOCUMENT_SIMILARITY_METHOD
  );

  assert.equal(
    evidence.payload.revision,
    RESEARCH_ATLAS_DOCUMENT_SIMILARITY_REVISION
  );

  assert.equal(
    evidence.payload.metric,
    "tfidf-cosine"
  );

  assert.deepEqual(
    evidence.payload.fieldsUsed.from,
    [
      "title",
      "abstract"
    ]
  );

  assert.deepEqual(
    evidence.payload.fieldsUsed.to,
    [
      "title",
      "abstract"
    ]
  );

  assert.ok(
    evidence.payload.sharedTerms.includes(
      "autonomy"
    )
  );
});


test("RA11 falls back to title when abstract is unavailable", () => {
  const graph =
    addResearchAtlasDocumentSimilarity(
      snapshot([
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
      ])
    );

  assert.equal(
    graph.diagnostics
      .documentSimilarity
      .worksWithAbstract,
    0
  );

  assert.equal(
    graph.diagnostics
      .documentSimilarity
      .titleOnlyWorks,
    3
  );

  assert.ok(
    graph.edges.some(
      edge =>
        edge.type ===
        "lexical-neighbor"
    )
  );
});


test("RA11 uses derived Internet Archive context without promoting it to abstract", () => {
  const base =
    snapshot([
      result({
        id:
          "ia-W100",
        title:
          "A short philosophical text",
        externalDescription:
          "Freedom autonomy rational agency moral law practical reason."
      }),
      result({
        id:
          "ia-W200",
        title:
          "Another philosophical volume",
        externalDescription:
          "Autonomy freedom moral law rational agency and practical reason."
      }),
      result({
        id:
          "openalex-W300",
        title:
          "Modal logic and reference",
        abstract:
          "Quantifiers possible worlds necessity reference semantics."
      })
    ]);


  const archiveWork =
    base.nodes.find(
      node =>
        node.identity?.key?.includes(
          "ia-W100"
        ) ||
        node.title ===
          "A short philosophical text"
    );


  assert.ok(archiveWork);

  assert.equal(
    archiveWork.abstract,
    null
  );

  assert.ok(
    archiveWork.externalContextTerms
      .includes(
        "autonomy"
      )
  );

  assert.equal(
    Object.values(archiveWork)
      .some(
        value =>
          value ===
            "Freedom autonomy rational agency moral law practical reason."
      ),
    false
  );


  const graph =
    addResearchAtlasDocumentSimilarity(
      base
    );


  assert.ok(
    graph.edges.some(
      edge =>
        edge.type ===
        "lexical-neighbor"
    )
  );


  assert.equal(
    graph.diagnostics
      .documentSimilarity
      .worksWithExternalContext,
    2
  );


  const evidence =
    graph.evidence.find(
      item =>
        item.payload?.fieldsUsed?.from
          ?.includes(
            "external-context"
          ) ||
        item.payload?.fieldsUsed?.to
          ?.includes(
            "external-context"
          )
    );


  assert.ok(evidence);

  assert.equal(
    evidence.payload
      .externalContextWeight,
    0.35
  );
});


test("RA11 prefers an explicit Qwen semantic edge over document similarity for the same pair", () => {
  const base =
    snapshot([
      result({
        id:
          "openalex-W100",
        title:
          "Self legislation",
        abstract:
          "Autonomy rational agency moral law freedom practical reason."
      }),
      result({
        id:
          "openalex-W200",
        title:
          "The kingdom of ends",
        abstract:
          "Freedom autonomy moral law rational agency practical reason."
      })
    ]);

  const works =
    base.nodes.filter(
      node =>
        node.nodeType ===
        "work"
    );

  base.evidence.push({
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
        0.93
    }
  });

  base.edges.push({
    id:
      "edge:semantic",
    type:
      "semantic-neighbor",
    fromRef:
      works[0].id,
    toRef:
      works[1].id,
    status:
      "derived",
    evidenceRefs: [
      "ev:semantic"
    ]
  });

  const graph =
    addResearchAtlasDocumentSimilarity(
      base
    );

  assert.equal(
    graph.edges.filter(
      edge =>
        edge.type ===
        "lexical-neighbor"
    ).length,
    0
  );

  assert.equal(
    graph.diagnostics
      .documentSimilarity
      .skippedBecauseSemantic,
    1
  );
});


test("RA11 document topology is invariant to WorkNode ordering", () => {
  const base =
    snapshot([
      result({
        id:
          "openalex-W100",
        title:
          "Self legislation",
        abstract:
          "Autonomy rational agency moral law freedom practical reason."
      }),
      result({
        id:
          "openalex-W200",
        title:
          "The kingdom of ends",
        abstract:
          "Freedom autonomy moral law rational agency practical reason."
      }),
      result({
        id:
          "openalex-W300",
        title:
          "Logic and ontology",
        abstract:
          "Reference quantification ontology logic and language."
      })
    ]);

  const left =
    addResearchAtlasDocumentSimilarity(
      base
    );

  const shuffled =
    structuredClone(
      base
    );

  shuffled.nodes.reverse();
  shuffled.edges.reverse();
  shuffled.evidence.reverse();

  const right =
    addResearchAtlasDocumentSimilarity(
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
