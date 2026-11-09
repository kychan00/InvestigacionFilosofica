import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResearchAtlasSnapshot
} from "../src/core/research-atlas-assembler.js";

import {
  validateResearchAtlasSnapshot
} from "../src/core/research-atlas-contract.js";

import {
  addResearchAtlasQwenSemanticTopology,
  RA12D3_MODEL_ID,
  RA12D3_MODEL_REVISION
} from "../src/core/research-atlas-qwen-topology.js";

function result(id, title) {
  return {
    id,
    title,
    abstract:
      "Freedom autonomy moral law rational agency practical reason.",
    authors: [],
    year: 2020,
    type: "article",
    language: "en",
    doi: null,
    isbn: [],
    topics: [],
    providers: ["OpenAlex Philosophy"],
    sourceRecords: [{
      provider: "OpenAlex Philosophy",
      sourceId: id,
      query: "freedom and autonomy"
    }],
    matchedQueries: [{
      query: "freedom and autonomy",
      weight: 1,
      type: "original"
    }],
    urls: {},
    institutionalLinks: []
  };
}

function response(results) {
  return {
    query: "freedom and autonomy",
    parsed: {},
    expansions: [],
    results,
    errors: [],
    stats: {
      appearances: results.length,
      unique: results.length,
      merged: 0,
      providers: {
        "OpenAlex Philosophy": results.length
      }
    }
  };
}

function snapshot(results) {
  return buildResearchAtlasSnapshot(
    response(results),
    {
      sourceRevisions: {
        openAlexPhilosophy: "fixture"
      }
    }
  );
}

function verifiedVector(value, source = "v4") {
  const bytes = new Int8Array(1024);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = ((index * value) % 101) - 50;
  }
  return {
    state: "verified",
    source,
    bytes,
    vectorSha256: String(value).repeat(64).slice(0, 64),
    proof: "fixture-proof",
    ...(source === "v4"
      ? { cluster: value, ordinal: value }
      : { identity: "doi:fixture-" + value, ordinal: value })
  };
}

test("RA12-D3 adds Qwen semantic-neighbor and suppresses RA11 for evaluated pairs", async () => {
  const results = [
    result("openalex-W100", "Freedom autonomy moral law"),
    result("openalex-W200", "Moral freedom autonomy"),
    result("openalex-W300", "Autonomy and practical freedom")
  ];

  const client = {
    async resolveAndFetch(item) {
      if (item.id.includes("W100")) {
        return {
          resolution: { state: "base-direct" },
          vector: verifiedVector(3)
        };
      }
      if (item.id.includes("W200")) {
        return {
          resolution: { state: "base-direct" },
          vector: verifiedVector(5)
        };
      }
      return {
        resolution: {
          state: "unresolved",
          reason: "no-published-semantic-location"
        },
        vector: {
          state: "unavailable",
          reason: "no-published-semantic-location"
        }
      };
    }
  };

  const graph = await addResearchAtlasQwenSemanticTopology(
    snapshot(results),
    response(results),
    {
      vectorClient: client,
      topK: 3,
      maximumEdges: 36,
      minimumScore: 0
    }
  );

  const validation = validateResearchAtlasSnapshot(graph);
  assert.equal(validation.ok, true, validation.errors.join("\n"));

  const semantic = graph.edges.filter(
    edge => edge.type === "semantic-neighbor"
  );
  const lexical = graph.edges.filter(
    edge => edge.type === "lexical-neighbor"
  );

  assert.equal(semantic.length, 1);
  assert.ok(lexical.length >= 1);

  const work100 = graph.nodes.find(
    node => node.identity?.key === "openalex:w100"
  );
  const work200 = graph.nodes.find(
    node => node.identity?.key === "openalex:w200"
  );
  const evaluatedPair = [work100.id, work200.id].sort().join("|");

  assert.equal(
    lexical.some(edge =>
      [edge.fromRef, edge.toRef].sort().join("|") === evaluatedPair
    ),
    false
  );

  const evidence = graph.evidence.find(
    item => item.id === semantic[0].evidenceRefs[0]
  );
  assert.equal(evidence.payload.modelId, RA12D3_MODEL_ID);
  assert.equal(evidence.payload.modelRevision, RA12D3_MODEL_REVISION);
  assert.equal(evidence.payload.metric, "cosine");
  assert.equal(
    evidence.payload.interpretation,
    "representational-proximity-only"
  );

  assert.equal(graph.diagnostics.qwenSemantic.vectorsVerified, 2);
  assert.equal(graph.diagnostics.qwenSemantic.unavailableWorks, 1);
  assert.equal(graph.diagnostics.qwenSemantic.evaluatedPairs, 1);
  assert.equal(graph.diagnostics.qwenSemantic.lexicalFallbackPairs, 2);
  assert.equal(
    graph.diagnostics.documentSimilarity.pairFilterApplied,
    true
  );
});

test("RA12-D3 uses RA11 for all pairs when no Qwen vector is available", async () => {
  const results = [
    result("openalex-W100", "Freedom autonomy moral law"),
    result("openalex-W200", "Moral freedom autonomy"),
    result("openalex-W300", "Autonomy and practical freedom")
  ];

  const client = {
    async resolveAndFetch() {
      return {
        resolution: {
          state: "unresolved",
          reason: "fixture-unresolved"
        },
        vector: {
          state: "unavailable",
          reason: "fixture-unresolved"
        }
      };
    }
  };

  const graph = await addResearchAtlasQwenSemanticTopology(
    snapshot(results),
    response(results),
    { vectorClient: client }
  );

  assert.equal(
    graph.edges.some(edge => edge.type === "semantic-neighbor"),
    false
  );
  assert.equal(
    graph.edges.some(edge => edge.type === "lexical-neighbor"),
    true
  );
  assert.equal(graph.diagnostics.qwenSemantic.vectorsVerified, 0);
  assert.equal(graph.diagnostics.qwenSemantic.lexicalFallbackPairs, 3);
});

test("RA12-D3 transport failure degrades to RA11 instead of failing the Atlas", async () => {
  const results = [
    result("openalex-W100", "Freedom autonomy moral law"),
    result("openalex-W200", "Moral freedom autonomy")
  ];

  const client = {
    async resolveAndFetch() {
      throw new Error("network-down");
    }
  };

  const graph = await addResearchAtlasQwenSemanticTopology(
    snapshot(results),
    response(results),
    { vectorClient: client }
  );

  assert.equal(graph.diagnostics.qwenSemantic.blockedWorks, 2);
  assert.equal(graph.diagnostics.qwenSemantic.lexicalFallbackPairs, 1);
  assert.equal(
    graph.edges.some(edge => edge.type === "lexical-neighbor"),
    true
  );
});

test("RA12-D3 does not backfill lexical edges for vector-evaluated pairs excluded by topK", async () => {
  const results = [
    result("openalex-W100", "Freedom autonomy moral law"),
    result("openalex-W200", "Freedom autonomy moral agency"),
    result("openalex-W300", "Freedom autonomy practical reason")
  ];

  const vectors = new Map([
    ["openalex-W100", verifiedVector(3)],
    ["openalex-W200", verifiedVector(5)],
    ["openalex-W300", verifiedVector(7)]
  ]);

  const client = {
    async resolveAndFetch(item) {
      return {
        resolution: { state: "base-direct" },
        vector: vectors.get(item.id)
      };
    }
  };

  const graph = await addResearchAtlasQwenSemanticTopology(
    snapshot(results),
    response(results),
    {
      vectorClient: client,
      topK: 1,
      maximumEdges: 1,
      minimumScore: -1
    }
  );

  assert.equal(
    graph.edges.filter(edge => edge.type === "semantic-neighbor").length,
    1
  );
  assert.equal(
    graph.edges.filter(edge => edge.type === "lexical-neighbor").length,
    0
  );
  assert.equal(graph.diagnostics.qwenSemantic.evaluatedPairs, 3);
  assert.equal(graph.diagnostics.qwenSemantic.lexicalFallbackPairs, 0);
});
