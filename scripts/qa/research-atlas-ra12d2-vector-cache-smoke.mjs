import assert from "node:assert/strict";

import {
  ResearchAtlasQwenVectorClient
} from "../../src/core/research-atlas-qwen-vector-client.js";

import {
  cosineInt8
} from "../../src/core/research-atlas-qwen-vector-range.js";

const requests = [];
const fetchImpl = async (url, options = {}) => {
  requests.push({
    url: String(url),
    range: options?.headers?.Range || options?.headers?.range || null
  });
  return fetch(url, options);
};

const client = new ResearchAtlasQwenVectorClient({ fetchImpl });

const directResult = {
  id: "openalex-W4388864320",
  providers: ["OpenAlex Philosophy"]
};

const overlayResult = {
  doi: "10.12795/ambitos.2019.i43.10",
  providers: ["Crossref"]
};

const directFirst = await client.resolveAndFetch(directResult);
assert.equal(directFirst.resolution.state, "base-direct");
assert.equal(directFirst.vector.state, "verified");
assert.equal(directFirst.vector.source, "v4");
assert.equal(directFirst.vector.cluster, 27);
assert.equal(directFirst.vector.ordinal, 1660);
assert.equal(directFirst.vector.bytes.length, 1024);
assert.equal(directFirst.vector.semanticNeighborEnabled, false);

const directRequestCount = requests.length;
const directSecond = await client.resolveAndFetch(directResult);
assert.equal(directSecond.vector.state, "verified");
assert.equal(requests.length, directRequestCount);

const beforeAdjacentV4 = requests.length;
const adjacentV4 = await client.fetchV4Vector(27, 1661);
assert.equal(adjacentV4.state, "verified");
assert.equal(adjacentV4.bytes.length, 1024);
assert.equal(requests.length - beforeAdjacentV4, 1);

const overlayFirst = await client.resolveAndFetch(overlayResult);
assert.equal(overlayFirst.resolution.state, "overlay");
assert.equal(overlayFirst.vector.state, "verified");
assert.equal(overlayFirst.vector.source, "overlay");
assert.equal(overlayFirst.vector.identity, "doi:10.12795/ambitos.2019.i43.10");
assert.equal(overlayFirst.vector.ordinal, 0);
assert.equal(overlayFirst.vector.bytes.length, 1024);
assert.equal(overlayFirst.vector.semanticNeighborEnabled, false);

const overlayRequestCount = requests.length;
const overlaySecond = await client.resolveAndFetch(overlayResult);
assert.equal(overlaySecond.vector.state, "verified");
assert.equal(requests.length, overlayRequestCount);

const beforeAdjacentOverlay = requests.length;
const adjacentOverlay = await client.fetchOverlayVector(1);
assert.equal(adjacentOverlay.state, "verified");
assert.equal(adjacentOverlay.bytes.length, 1024);
assert.equal(requests.length - beforeAdjacentOverlay, 1);

const crossCosine = cosineInt8(
  directFirst.vector.bytes,
  overlayFirst.vector.bytes
);
assert.ok(Number.isFinite(crossCosine));
assert.ok(crossCosine >= -1 && crossCosine <= 1);

const stats = client.cacheStats();
assert.deepEqual(stats, {
  v4Root: true,
  v4Clusters: 1,
  v4DigestTiles: 1,
  v4Vectors: 2,
  overlayContext: true,
  overlayVectors: 2
});

const rangeRequests = requests.filter(item => item.range);
assert.ok(rangeRequests.length >= 5);
assert.ok(rangeRequests.every(item => /^bytes=\d+-\d+$/.test(item.range)));

console.log(JSON.stringify({
  status: "pass",
  revision: "2026-11-09.ra12-d2-v1",
  pins: {
    b3LookupOid: client.locator.pins.lookup.oid,
    c3DigestOid: client.pins.v4.digestOid,
    c5cOverlayOid: client.pins.overlay.oid
  },
  direct: {
    resolution: directFirst.resolution,
    proof: directFirst.vector.proof,
    vectorSha256: directFirst.vector.vectorSha256
  },
  overlay: {
    resolution: overlayFirst.resolution,
    proof: overlayFirst.vector.proof,
    vectorSha256: overlayFirst.vector.vectorSha256
  },
  cache: {
    repeatedDirectAdditionalRequests: requests.length >= directRequestCount ? 0 : null,
    adjacentV4AdditionalRequests: 1,
    repeatedOverlayAdditionalRequests: 0,
    adjacentOverlayAdditionalRequests: 1,
    stats
  },
  crossCosine,
  totalRequests: requests.length,
  rangeRequestCount: rangeRequests.length,
  modelDownloaded: false,
  liveOpenAlexQueried: false,
  searchResponseChanged: false,
  rankingChanged: false,
  semanticNeighborEnabled: false,
  atlasRuntimeEnabled: false
}, null, 2));
