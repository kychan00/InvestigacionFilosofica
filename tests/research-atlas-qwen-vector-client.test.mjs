import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";

import {
  ResearchAtlasQwenVectorClient
} from "../src/core/research-atlas-qwen-vector-client.js";

const cryptoImpl = globalThis.crypto || webcrypto;
const encoder = new TextEncoder();

async function sha(bytes) {
  const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest).toString("hex");
}

function whole(bytes, status = 200) {
  return new Response(bytes, {
    status,
    headers: {
      "content-length": String(bytes.byteLength)
    }
  });
}

function ranged(bytes, start, total, status = 206) {
  const end = start + bytes.byteLength - 1;
  return new Response(bytes, {
    status,
    headers: status === 206
      ? {
          "content-length": String(bytes.byteLength),
          "content-range": `bytes ${start}-${end}/${total}`
        }
      : {
          "content-length": String(bytes.byteLength)
        }
  });
}

async function fixture({ corruptV4Vector = false, ignoreRange = false } = {}) {
  const dataset = "CristianPelayo/openalex-philosophy";
  const sourceRevision = "5a4a195085de54bf607a6c4397092ffb32716dcc";
  const digestOid = "1".repeat(40);
  const overlayOid = "2".repeat(40);
  const digestPrefix = "research-atlas/test-digest";
  const overlayPrefix = "research-atlas/test-overlay";
  const dimension = 1024;

  const v4Vector0 = new Int8Array(dimension);
  const v4Vector1 = new Int8Array(dimension);
  const overlayVector0 = new Int8Array(dimension);
  for (let index = 0; index < dimension; index += 1) {
    v4Vector0[index] = (index % 127) - 63;
    v4Vector1[index] = ((index * 3) % 127) - 63;
    overlayVector0[index] = ((index * 5) % 127) - 63;
  }

  const v4Digest0 = await sha(new Uint8Array(v4Vector0.buffer));
  const v4Digest1 = await sha(new Uint8Array(v4Vector1.buffer));
  const v4DigestBytes = new Uint8Array(64);
  v4DigestBytes.set(Buffer.from(v4Digest0, "hex"), 0);
  v4DigestBytes.set(Buffer.from(v4Digest1, "hex"), 32);
  const tileSha = await sha(v4DigestBytes);
  const fullDigestSha = await sha(v4DigestBytes);

  const targetCluster = 27;
  const clusters = Array.from({ length: 256 }, (_, cluster) => ({
    cluster,
    count: cluster === targetCluster ? 2 : 1,
    index: {
      path: `indexes/cluster-${String(cluster).padStart(3, "0")}.json`,
      sha256: "a".repeat(64)
    },
    digests: {
      path: `digests/cluster-${String(cluster).padStart(3, "0")}.sha256.bin`,
      sha256: cluster === targetCluster ? fullDigestSha : "b".repeat(64),
      bytes: (cluster === targetCluster ? 2 : 1) * 32
    }
  }));

  const indexObject = {
    schemaVersion: "research-atlas-ra12c2-cluster-index-v1",
    cluster: targetCluster,
    count: 2,
    vectorDimension: 1024,
    digestBytes: 32,
    tileVectors: 64,
    digests: { sha256: fullDigestSha },
    sourceVectorSha256: "c".repeat(64),
    tiles: [{
      firstOrdinal: 0,
      count: 2,
      startByte: 0,
      endByte: 63,
      bytes: 64,
      sha256: tileSha
    }]
  };
  const indexBytes = encoder.encode(JSON.stringify(indexObject));
  clusters[targetCluster].index.sha256 = await sha(indexBytes);

  const rootObject = {
    schemaVersion: "research-atlas-ra12c2-vector-digest-tree-v1",
    documentCount: 451823,
    clusterCount: 256,
    dimension: 1024,
    digestBytes: 32,
    tileVectors: 64,
    source: {
      revision: sourceRevision,
      vectorShardsSourceSha256Verified: true
    },
    productionEnabled: false,
    clusters
  };
  const rootBytes = encoder.encode(JSON.stringify(rootObject));

  const overlayDigestBytes = new Uint8Array(207 * 32);
  const overlayDigest0 = await sha(new Uint8Array(overlayVector0.buffer));
  overlayDigestBytes.set(Buffer.from(overlayDigest0, "hex"), 0);
  for (let ordinal = 1; ordinal < 207; ordinal += 1) {
    const digest = await sha(encoder.encode("overlay-" + ordinal));
    overlayDigestBytes.set(Buffer.from(digest, "hex"), ordinal * 32);
  }

  const overlayLookup = {
    schemaVersion: "research-atlas-ra12c5c-overlay-identity-lookup-v1",
    sourceManifestSha256: null,
    documentCount: 207,
    dimension: 1024,
    vectorsSha256: "d".repeat(64),
    digestsSha256: await sha(overlayDigestBytes),
    productionEnabled: false,
    records: Array.from({ length: 207 }, (_, ordinal) => ({
      ordinal,
      identity: ordinal === 0
        ? "doi:10.12795/ambitos.2019.i43.10"
        : `openalex:W${8000000000 + ordinal}`,
      vectorSha256: Buffer.from(
        overlayDigestBytes.subarray(ordinal * 32, (ordinal + 1) * 32)
      ).toString("hex")
    }))
  };

  const overlayIndexBytes = encoder.encode("fixture-index-gzip-bytes");
  const overlayIndexSha = await sha(overlayIndexBytes);
  const overlayDigestsSha = await sha(overlayDigestBytes);
  const overlayManifest = {
    schemaVersion: "research-atlas-ra12c5b-semantic-overlay-v1",
    status: "built-unpublished",
    documentCount: 207,
    dimension: 1024,
    productionEnabled: false,
    artifacts: {
      vectors: { sha256: "d".repeat(64), bytes: 207 * 1024 },
      index: { sha256: overlayIndexSha },
      digests: { sha256: overlayDigestsSha, bytes: overlayDigestBytes.byteLength }
    }
  };
  const overlayManifestBytes = encoder.encode(JSON.stringify(overlayManifest));
  const overlayManifestSha = await sha(overlayManifestBytes);
  overlayLookup.sourceManifestSha256 = overlayManifestSha;
  const overlayLookupBytes = encoder.encode(JSON.stringify(overlayLookup));
  const overlayLookupSha = await sha(overlayLookupBytes);

  const pins = {
    dataset,
    v4: {
      digestOid,
      digestPrefix,
      rootSha256: await sha(rootBytes),
      sourceRevision,
      sourceVectorPrefix: "semantic-retrieval/v3.3/browser-static-v4/20261010-v4/clusters",
      documents: 451823,
      clusters: 256,
      dimension: 1024,
      digestBytes: 32,
      tileVectors: 64
    },
    overlay: {
      oid: overlayOid,
      prefix: overlayPrefix,
      manifestSha256: overlayManifestSha,
      manifestBytes: overlayManifestBytes.byteLength,
      indexSha256: overlayIndexSha,
      indexBytes: overlayIndexBytes.byteLength,
      digestsSha256: overlayDigestsSha,
      digestsBytes: overlayDigestBytes.byteLength,
      lookupSha256: overlayLookupSha,
      lookupBytes: overlayLookupBytes.byteLength,
      vectorsSha256: "d".repeat(64),
      vectorBytes: 207 * 1024,
      documents: 207,
      dimension: 1024
    }
  };

  const locator = {
    pins: {
      dataset,
      lookup: { sourceRevision },
      overlay: { oid: overlayOid }
    },
    async resolve(result) {
      if (result?.kind === "v4") {
        return {
          state: "base-direct",
          location: {
            source: "v4",
            cluster: targetCluster,
            ordinal: 0
          }
        };
      }
      if (result?.kind === "overlay") {
        return {
          state: "overlay",
          location: {
            source: "overlay",
            identity: "doi:10.12795/ambitos.2019.i43.10",
            ordinal: 0
          }
        };
      }
      return { state: "unresolved", reason: "fixture-unresolved" };
    }
  };

  const digestBase =
    `https://huggingface.co/datasets/${dataset}/resolve/${digestOid}/${digestPrefix}`;
  const vectorBase =
    `https://huggingface.co/datasets/${dataset}/resolve/${sourceRevision}/semantic-retrieval/v3.3/browser-static-v4/20261010-v4/clusters`;
  const overlayBase =
    `https://huggingface.co/datasets/${dataset}/resolve/${overlayOid}/${overlayPrefix}`;

  const calls = new Map();
  const count = url => calls.set(url, (calls.get(url) || 0) + 1);

  const fetchImpl = async (url, options = {}) => {
    const text = String(url);
    count(text);
    if (text === digestBase + "/hash-manifest.json") return whole(rootBytes);
    if (text === digestBase + "/indexes/cluster-027.json") return whole(indexBytes);
    if (text === digestBase + "/digests/cluster-027.sha256.bin") {
      return ignoreRange
        ? ranged(v4DigestBytes, 0, v4DigestBytes.byteLength, 200)
        : ranged(v4DigestBytes, 0, v4DigestBytes.byteLength);
    }
    if (text === vectorBase + "/cluster-027.vectors.i8") {
      const body = corruptV4Vector
        ? new Uint8Array(dimension).fill(7)
        : new Uint8Array(v4Vector0.buffer);
      return ignoreRange
        ? ranged(body, 0, dimension * 2, 200)
        : ranged(body, 0, dimension * 2);
    }
    if (text === overlayBase + "/manifest.json") return whole(overlayManifestBytes);
    if (text === overlayBase + "/vector-index.jsonl.gz") return whole(overlayIndexBytes);
    if (text === overlayBase + "/vector-digests.sha256.bin") return whole(overlayDigestBytes);
    if (text === overlayBase + "/identity-lookup.json") return whole(overlayLookupBytes);
    if (text === overlayBase + "/vectors.i8") {
      return ranged(new Uint8Array(overlayVector0.buffer), 0, 207 * 1024);
    }
    return new Response("missing", { status: 404 });
  };

  return {
    pins,
    locator,
    fetchImpl,
    calls,
    targetCluster,
    v4Digest0,
    overlayDigest0
  };
}

test("RA12-D2 caches V4 root, cluster index, digest tile and vector range", async () => {
  const fx = await fixture();
  const client = new ResearchAtlasQwenVectorClient({
    pins: fx.pins,
    locator: fx.locator,
    fetchImpl: fx.fetchImpl,
    cryptoImpl
  });

  const first = await client.fetchV4Vector(fx.targetCluster, 0);
  const callsAfterFirst = [...fx.calls.values()].reduce((a, b) => a + b, 0);
  const second = await client.fetchV4Vector(fx.targetCluster, 0);
  const callsAfterSecond = [...fx.calls.values()].reduce((a, b) => a + b, 0);

  assert.equal(first.state, "verified");
  assert.equal(first.vectorSha256, fx.v4Digest0);
  assert.equal(second.vectorSha256, fx.v4Digest0);
  assert.equal(callsAfterSecond, callsAfterFirst);
  assert.deepEqual(client.cacheStats(), {
    v4Root: true,
    v4Clusters: 1,
    v4DigestTiles: 1,
    v4Vectors: 1,
    overlayContext: false,
    overlayVectors: 0
  });

  first.bytes[0] = 127;
  assert.notEqual(second.bytes[0], 127);
});

test("RA12-D2 caches the authenticated overlay context and vector range", async () => {
  const fx = await fixture();
  const client = new ResearchAtlasQwenVectorClient({
    pins: fx.pins,
    locator: fx.locator,
    fetchImpl: fx.fetchImpl,
    cryptoImpl
  });

  const first = await client.fetchOverlayVector(0);
  const callsAfterFirst = [...fx.calls.values()].reduce((a, b) => a + b, 0);
  const second = await client.fetchOverlayVector(0);
  const callsAfterSecond = [...fx.calls.values()].reduce((a, b) => a + b, 0);

  assert.equal(first.state, "verified");
  assert.equal(first.identity, "doi:10.12795/ambitos.2019.i43.10");
  assert.equal(first.vectorSha256, fx.overlayDigest0);
  assert.equal(callsAfterSecond, callsAfterFirst);
  assert.equal(client.cacheStats().overlayContext, true);
  assert.equal(client.cacheStats().overlayVectors, 1);
});

test("RA12-D2 resolveAndFetch stays location-only and returns unavailable for unresolved works", async () => {
  const fx = await fixture();
  const client = new ResearchAtlasQwenVectorClient({
    pins: fx.pins,
    locator: fx.locator,
    fetchImpl: fx.fetchImpl,
    cryptoImpl
  });

  const direct = await client.resolveAndFetch({ kind: "v4" });
  assert.equal(direct.resolution.state, "base-direct");
  assert.equal(direct.vector.state, "verified");
  assert.equal(direct.vector.semanticNeighborEnabled, false);

  const overlay = await client.resolveAndFetch({ kind: "overlay" });
  assert.equal(overlay.resolution.state, "overlay");
  assert.equal(overlay.vector.state, "verified");
  assert.equal(overlay.vector.semanticNeighborEnabled, false);

  const before = [...fx.calls.values()].reduce((a, b) => a + b, 0);
  const unresolved = await client.resolveAndFetch({ kind: "none" });
  const after = [...fx.calls.values()].reduce((a, b) => a + b, 0);
  assert.equal(unresolved.vector.state, "unavailable");
  assert.equal(after, before);
});

test("RA12-D2 rejects HTTP 200 when a Range response was required", async () => {
  const fx = await fixture({ ignoreRange: true });
  const client = new ResearchAtlasQwenVectorClient({
    pins: fx.pins,
    locator: fx.locator,
    fetchImpl: fx.fetchImpl,
    cryptoImpl
  });
  const out = await client.fetchResolution({
    state: "base-direct",
    location: { source: "v4", cluster: fx.targetCluster, ordinal: 0 }
  });
  assert.equal(out.state, "blocked");
  assert.equal(out.reason, "range-ignored-200");
});

test("RA12-D2 fails closed when the returned V4 vector does not match its digest", async () => {
  const fx = await fixture({ corruptV4Vector: true });
  const client = new ResearchAtlasQwenVectorClient({
    pins: fx.pins,
    locator: fx.locator,
    fetchImpl: fx.fetchImpl,
    cryptoImpl
  });
  const out = await client.fetchResolution({
    state: "base-direct",
    location: { source: "v4", cluster: fx.targetCluster, ordinal: 0 }
  });
  assert.equal(out.state, "blocked");
  assert.equal(out.reason, "range-sha-mismatch");
});

test("RA12-D2 refuses overlay location/identity disagreement", async () => {
  const fx = await fixture();
  const client = new ResearchAtlasQwenVectorClient({
    pins: fx.pins,
    locator: fx.locator,
    fetchImpl: fx.fetchImpl,
    cryptoImpl
  });
  const out = await client.fetchResolution({
    state: "overlay",
    location: {
      source: "overlay",
      ordinal: 0,
      identity: "doi:10.0000/not-the-published-identity"
    }
  });
  assert.equal(out.state, "blocked");
  assert.equal(out.reason, "overlay-resolution-identity-mismatch");
});
