import assert from "node:assert/strict";

import {
  buildResearchAtlasSnapshot
} from "../../src/core/research-atlas-assembler.js";

import {
  addResearchAtlasQwenSemanticTopology
} from "../../src/core/research-atlas-qwen-topology.js";

function result({
  id,
  title,
  doi = null,
  provider
}) {
  return {
    id,
    title,
    abstract:
      "Freedom autonomy moral law rational agency practical reason.",
    authors: [],
    year: 2020,
    type: "article",
    language: "en",
    doi,
    isbn: [],
    topics: [],
    providers: [provider],
    sourceRecords: [{
      provider,
      sourceId: id,
      query: "freedom autonomy"
    }],
    matchedQueries: [{
      query: "freedom autonomy",
      weight: 1,
      type: "original"
    }],
    urls: {},
    institutionalLinks: []
  };
}

const results = [
  result({
    id: "openalex-W4388864320",
    title: "Freedom autonomy moral law",
    provider: "OpenAlex Philosophy"
  }),
  result({
    id: "crossref-10.12795/ambitos.2019.i43.10",
    title: "Freedom autonomy and practical reason",
    doi: "10.12795/ambitos.2019.i43.10",
    provider: "Crossref"
  }),
  result({
    id: "ia-fixture-no-vector",
    title: "Moral freedom and autonomy",
    provider: "Internet Archive"
  })
];

const searchResponse = {
  query: "freedom autonomy",
  parsed: {},
  expansions: [],
  results,
  errors: [],
  stats: {
    appearances: results.length,
    unique: results.length,
    merged: 0,
    providers: {
      "OpenAlex Philosophy": 1,
      Crossref: 1,
      "Internet Archive": 1
    }
  }
};

const base = buildResearchAtlasSnapshot(
  searchResponse,
  {
    sourceRevisions: {
      openAlexPhilosophy: "real-v4",
      crossref: "live",
      internetArchive: "live"
    }
  }
);

const graph = await addResearchAtlasQwenSemanticTopology(
  base,
  searchResponse
);

const semantic = graph.edges.filter(
  edge => edge.type === "semantic-neighbor"
);
const lexical = graph.edges.filter(
  edge => edge.type === "lexical-neighbor"
);

assert.equal(semantic.length, 1);
assert.ok(lexical.length >= 1);

const semanticEvidence = graph.evidence.find(
  item => item.id === semantic[0].evidenceRefs[0]
);

assert.equal(
  semanticEvidence.payload.modelId,
  "Qwen/Qwen3-Embedding-0.6B"
);
assert.equal(
  semanticEvidence.payload.modelRevision,
  "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3"
);
assert.equal(
  semanticEvidence.payload.interpretation,
  "representational-proximity-only"
);

const score = semanticEvidence.payload.score;
assert.ok(Math.abs(score - 0.20802329168861472) < 1e-12);

const qwen = graph.diagnostics.qwenSemantic;
assert.equal(qwen.vectorsVerified, 2);
assert.equal(qwen.v4Vectors, 1);
assert.equal(qwen.overlayVectors, 1);
assert.equal(qwen.unavailableWorks, 1);
assert.equal(qwen.evaluatedPairs, 1);
assert.equal(qwen.semanticEdgesAdded, 1);
assert.equal(qwen.lexicalFallbackPairs, 2);

const semanticPair = [
  semantic[0].fromRef,
  semantic[0].toRef
].sort().join("|");

assert.equal(
  lexical.some(edge =>
    [edge.fromRef, edge.toRef]
      .sort()
      .join("|") === semanticPair
  ),
  false
);

console.log(JSON.stringify({
  status: "pass",
  semanticScore: score,
  semanticEdges: semantic.length,
  lexicalFallbackEdges: lexical.length,
  diagnostics: qwen,
  documentSimilarity: graph.diagnostics.documentSimilarity,
  liveOpenAlexQueried: false,
  rankingChanged: false,
  searchResponseChanged: false
}, null, 2));
