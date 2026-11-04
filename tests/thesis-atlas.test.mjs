import test from "node:test";
import assert from "node:assert/strict";
import {
  ATLAS_NODES,
  atlasClusterMap,
  atlasNodeMap,
  atlasSearch,
  atlasYearExtent,
  neighborEntries,
  overlayColor,
  proposedClusterLabel,
  stableHue,
  validateAtlas,
} from "../src/core/thesis-atlas.js";

function payload() {
  const clusters = [{
    id: "cluster:thesis-atlas-v1:001",
    proposedLabels: [{
      status: "proposed",
      label: "fenomenología · cuerpo",
      evidenceTerms: ["fenomenología", "cuerpo"],
    }],
  }];
  const nodes = Array.from({ length: ATLAS_NODES }, (_, index) => ({
    id: `thesis:work:${String(index).padStart(8, "0")}`,
    title: index % 2 ? "Historia cultural y memoria" : "Fenomenología del cuerpo",
    authors: [index % 2 ? "Juan López" : "María Hernández"],
    year: 1990 + (index % 35),
    program: index % 2 ? "Maestría en Historia" : "Licenciatura en Filosofía",
    programRef: index % 2 ? "program:historia" : "program:filosofia",
    degree: index % 2 ? "maestria" : "licenciatura",
    unit: "CUCSH",
    keywords: index % 2 ? ["historia", "memoria"] : ["fenomenología", "cuerpo"],
    sourceUrl: `https://hdl.handle.net/20.500.12104/${80000 + index}`,
    topology: {
      inputContractVersion: "normalized-title-v1",
    },
    neighborhood: {
      k: 8,
      neighborRefs: Array.from({ length: 8 }, (_, offset) =>
        `thesis:work:${String((index + offset + 1) % ATLAS_NODES).padStart(8, "0")}`
      ),
      similarityValues: Array.from({ length: 8 }, (_, offset) => 0.9 - offset * 0.03),
    },
    atlas: {
      x: ((index % 29) / 14) - 1,
      y: ((index % 23) / 11) - 1,
      clusterRefs: ["cluster:thesis-atlas-v1:001"],
    },
  }));
  return {
    schemaVersion: "thesis-atlas-index-v1",
    sourceRelease: "thesis-effective-corpus-v1",
    referenceOnly: true,
    methodStatus: "experimental-not-benchmark-approved",
    topologyInputContract: {
      version: "normalized-title-v1",
      fields: ["title"],
    },
    nodes,
    clusters,
  };
}

test("validates exact reference-only atlas contract", () => {
  assert.equal(validateAtlas(payload()).nodes.length, ATLAS_NODES);
  const bad = payload();
  bad.topologyInputContract.fields = ["title", "program"];
  assert.throws(() => validateAtlas(bad), /contrato experimental/);
});

test("rejects direct PDF or unknown institutional links", () => {
  const bad = payload();
  bad.nodes[0].sourceUrl = "https://riudg.udg.mx/bitstreams/123/file.pdf";
  assert.throws(() => validateAtlas(bad), /no institucional/);
});

test("accent-insensitive atlas search can use metadata without changing topology", () => {
  const data = payload();
  assert.equal(atlasSearch(data.nodes, "fenomenologia").length, 281);
  assert.equal(atlasSearch(data.nodes, "María filosofía").length, 281);
  assert.equal(atlasSearch(data.nodes, "historia memoria").length, 280);
});

test("neighbor and cluster helpers preserve explicit semantics", () => {
  const data = payload();
  const nodeMap = atlasNodeMap(data.nodes);
  const clusterMap = atlasClusterMap(data.clusters);
  const entries = neighborEntries(data.nodes[0], nodeMap);
  assert.equal(entries.length, 8);
  assert.equal(entries[0].node.id, data.nodes[1].id);
  assert.equal(entries[0].similarity, 0.9);
  assert.equal(
    proposedClusterLabel(clusterMap.get("cluster:thesis-atlas-v1:001")),
    "fenomenología · cuerpo",
  );
});

test("overlay colors are deterministic and overlays do not alter coordinates", () => {
  const data = payload();
  const node = data.nodes[0];
  const before = { ...node.atlas };
  const clusterById = atlasClusterMap(data.clusters);
  const [minYear, maxYear] = atlasYearExtent(data.nodes);
  for (const mode of ["region", "program", "degree", "period"]) {
    assert.match(overlayColor(node, mode, { clusterById, minYear, maxYear }), /^hsl\(/);
  }
  assert.deepEqual(node.atlas, before);
  assert.equal(stableHue("abc"), stableHue("abc"));
  assert.notEqual(stableHue("abc"), stableHue("xyz"));
});
