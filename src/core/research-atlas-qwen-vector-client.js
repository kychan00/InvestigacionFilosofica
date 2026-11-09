// RA12-D2 — cached authenticated Qwen vector transport for Research Atlas.
// Experimental only: resolves/fetches verified vectors but does not add semantic edges,
// mutate SearchResponse/ranking, or wire itself into the production Atlas.
import { sha256Hex } from "./research-atlas-qwen-vector-range.js";
import {
  ResearchAtlasQwenLocator,
  RA12D1_DEFAULT_PINS
} from "./research-atlas-qwen-resolution.js";

export const RA12D2_REVISION = "2026-11-09.ra12-d2-v1";

export const RA12D2_DEFAULT_PINS = Object.freeze({
  dataset: "CristianPelayo/openalex-philosophy",
  v4: Object.freeze({
    digestOid: "1a4e16c65a3285182d2cea875aea015e9435b105",
    digestPrefix: "research-atlas/qwen3-document-digests/v1/ra12c2-run42495212950",
    rootSha256: "38067b5876de5f53abe5c7431b8618464d3fe711058a70fdde700fce7c50d961",
    sourceRevision: "5a4a195085de54bf607a6c4397092ffb32716dcc",
    sourceVectorPrefix: "semantic-retrieval/v3.3/browser-static-v4/20261010-v4/clusters",
    documents: 451823,
    clusters: 256,
    dimension: 1024,
    digestBytes: 32,
    tileVectors: 64
  }),
  overlay: Object.freeze({
    oid: "c74f0067ba665c23b09a0a79fa83651b00c0e53e",
    prefix: "research-atlas/qwen3-semantic-overlay/v1/ra12c5b-run42560032286",
    manifestSha256: "e76848f2876370b9682d8b906b8704371a331cd0ff2cae4a9fe0bb11a4216166",
    manifestBytes: 1803,
    indexSha256: "8e2d1dc520c3c8f4d8bc85ec402ae6ec900e6cd3220a90f710debd3987c3bc90",
    indexBytes: 19314,
    digestsSha256: "1c9a1bb51ef6162d96468f9b990a62a9fae31370140d5d705c1aeefda4f5d491",
    digestsBytes: 6624,
    lookupSha256: "8cc87603b049538a1af36aba0b73d3f868f98c136b6832b1a5279896895383c8",
    lookupBytes: 36503,
    vectorsSha256: "88596081fb50f6dd4a47cbca24b711982a4beca3ed991555588b71ddc4abe89f",
    vectorBytes: 211968,
    documents: 207,
    dimension: 1024
  })
});

const HF_DATASET = "https://huggingface.co/datasets/";
const VALID_SHA = /^[a-f0-9]{64}$/;
const VALID_OID = /^[a-f0-9]{40}$/;

function requirePin(condition, detail) {
  if (!condition) throw new TypeError("Invalid RA12-D2 pins: " + detail);
}

function immutableBase(dataset, oid, prefix) {
  requirePin(typeof dataset === "string" && dataset.length > 0, "dataset");
  requirePin(VALID_OID.test(oid || ""), "oid");
  requirePin(typeof prefix === "string" && prefix.startsWith("research-atlas/") && !prefix.includes(".."), "prefix");
  return HF_DATASET + dataset + "/resolve/" + oid + "/" + prefix;
}

function validatePins(pins) {
  requirePin(pins && typeof pins === "object", "root");
  const v4 = pins.v4;
  const overlay = pins.overlay;
  immutableBase(pins.dataset, v4?.digestOid, v4?.digestPrefix);
  immutableBase(pins.dataset, overlay?.oid, overlay?.prefix);
  requirePin(VALID_SHA.test(v4?.rootSha256 || ""), "v4 root sha");
  requirePin(typeof v4?.sourceRevision === "string" && VALID_OID.test(v4.sourceRevision), "v4 source revision");
  requirePin(v4?.documents === 451823 && v4?.clusters === 256 && v4?.dimension === 1024, "v4 shape");
  requirePin(v4?.digestBytes === 32 && v4?.tileVectors === 64, "v4 digest shape");
  requirePin(typeof v4?.sourceVectorPrefix === "string" && !v4.sourceVectorPrefix.includes(".."), "v4 source vector prefix");

  for (const key of ["manifestSha256", "indexSha256", "digestsSha256", "lookupSha256", "vectorsSha256"]) {
    requirePin(VALID_SHA.test(overlay?.[key] || ""), "overlay " + key);
  }
  requirePin(
    overlay?.documents === 207 &&
    overlay?.dimension === 1024 &&
    overlay?.vectorBytes === overlay.documents * overlay.dimension &&
    overlay?.digestsBytes === overlay.documents * 32,
    "overlay shape"
  );
  for (const key of ["manifestBytes", "indexBytes", "digestsBytes", "lookupBytes", "vectorBytes"]) {
    requirePin(Number.isSafeInteger(overlay?.[key]) && overlay[key] > 0, "overlay " + key);
  }
}

async function readCapped(response, maximum) {
  if (!response.body?.getReader) throw new Error("no-readable-body");
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) > maximum) {
    await response.body.cancel().catch(() => {});
    throw new Error("response-over-budget");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || total + value.byteLength > maximum) {
        await reader.cancel().catch(() => {});
        throw new Error("response-over-budget");
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function fetchVerifiedWhole({
  url,
  expectedSha,
  expectedBytes = null,
  maximum,
  fetchImpl,
  cryptoImpl
}) {
  if (!VALID_SHA.test(expectedSha || "") || !Number.isSafeInteger(maximum) || maximum < 1) {
    throw new Error("invalid-whole-file-contract");
  }
  const response = await fetchImpl(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store"
  });
  if (response.status !== 200) {
    await response.body?.cancel().catch(() => {});
    throw new Error("file-http-" + response.status);
  }
  const bytes = await readCapped(response, maximum);
  if (expectedBytes !== null && bytes.byteLength !== expectedBytes) {
    throw new Error("file-byte-count-mismatch");
  }
  if (await sha256Hex(bytes, cryptoImpl) !== expectedSha) {
    throw new Error("file-sha-mismatch");
  }
  return bytes;
}

function parseExactContentRange(value, start, end, total) {
  const match = /^bytes ([0-9]+)-([0-9]+)\/([0-9]+)$/.exec(String(value || ""));
  if (!match) return false;
  return Number(match[1]) === start && Number(match[2]) === end && Number(match[3]) === total;
}

async function fetchVerifiedRange({
  url,
  start,
  bytes,
  total,
  expectedSha,
  maximum,
  fetchImpl,
  cryptoImpl
}) {
  if (
    !Number.isSafeInteger(start) || start < 0 ||
    !Number.isSafeInteger(bytes) || bytes < 1 ||
    !Number.isSafeInteger(total) || total < bytes ||
    start + bytes > total ||
    bytes > maximum ||
    !VALID_SHA.test(expectedSha || "")
  ) {
    throw new Error("invalid-range-contract");
  }
  const end = start + bytes - 1;
  const response = await fetchImpl(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: { Range: "bytes=" + start + "-" + end }
  });
  if (response.status !== 206) {
    await response.body?.cancel().catch(() => {});
    throw new Error(response.status === 200 ? "range-ignored-200" : "range-http-" + response.status);
  }
  const contentRange = response.headers.get("content-range");
  const encoding = response.headers.get("content-encoding");
  const contentType = response.headers.get("content-type");
  if (
    !parseExactContentRange(contentRange, start, end, total) ||
    (encoding && encoding.toLowerCase() !== "identity") ||
    (contentType && contentType.toLowerCase().includes("multipart/"))
  ) {
    await response.body?.cancel().catch(() => {});
    throw new Error(contentRange ? "invalid-content-range-or-encoding" : "content-range-not-exposed");
  }
  const body = await readCapped(response, maximum);
  if (body.byteLength !== bytes) throw new Error("range-short-read");
  if (await sha256Hex(body, cryptoImpl) !== expectedSha) throw new Error("range-sha-mismatch");
  return body;
}

function digestHex(bytes) {
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

function cachedTask(map, key, task) {
  if (!map.has(key)) {
    const promise = Promise.resolve()
      .then(task)
      .catch(error => {
        map.delete(key);
        throw error;
      });
    map.set(key, promise);
  }
  return map.get(key);
}

function cloneVerified(result) {
  return {
    ...result,
    bytes: new Int8Array(result.bytes)
  };
}

export class ResearchAtlasQwenVectorClient {
  constructor({
    pins = RA12D2_DEFAULT_PINS,
    locator = null,
    fetchImpl = globalThis.fetch,
    cryptoImpl = globalThis.crypto
  } = {}) {
    validatePins(pins);
    if (typeof fetchImpl !== "function" || !cryptoImpl?.subtle?.digest) {
      throw new TypeError("ResearchAtlasQwenVectorClient requires fetch and crypto SHA-256");
    }

    this.pins = pins;
    this.fetchImpl = fetchImpl;
    this.cryptoImpl = cryptoImpl;
    this.locator = locator || new ResearchAtlasQwenLocator({ fetchImpl, cryptoImpl });

    requirePin(this.locator?.pins?.dataset === pins.dataset, "D1/D2 dataset disagreement");
    requirePin(this.locator?.pins?.lookup?.sourceRevision === pins.v4.sourceRevision, "D1/D2 V4 revision disagreement");
    requirePin(this.locator?.pins?.overlay?.oid === pins.overlay.oid, "D1/D2 overlay OID disagreement");

    this.v4RootPromise = null;
    this.v4ClusterPromises = new Map();
    this.v4TilePromises = new Map();
    this.v4VectorPromises = new Map();
    this.overlayContextPromise = null;
    this.overlayVectorPromises = new Map();
  }

  v4DigestBase() {
    return immutableBase(this.pins.dataset, this.pins.v4.digestOid, this.pins.v4.digestPrefix);
  }

  v4VectorBase() {
    return (
      HF_DATASET + this.pins.dataset + "/resolve/" + this.pins.v4.sourceRevision + "/" +
      this.pins.v4.sourceVectorPrefix
    );
  }

  overlayBase() {
    return immutableBase(this.pins.dataset, this.pins.overlay.oid, this.pins.overlay.prefix);
  }

  async v4Root() {
    if (!this.v4RootPromise) {
      this.v4RootPromise = (async () => {
        const bytes = await fetchVerifiedWhole({
          url: this.v4DigestBase() + "/hash-manifest.json",
          expectedSha: this.pins.v4.rootSha256,
          maximum: 750000,
          fetchImpl: this.fetchImpl,
          cryptoImpl: this.cryptoImpl
        });
        const manifest = JSON.parse(new TextDecoder().decode(bytes));
        if (
          manifest.schemaVersion !== "research-atlas-ra12c2-vector-digest-tree-v1" ||
          manifest.documentCount !== this.pins.v4.documents ||
          manifest.clusterCount !== this.pins.v4.clusters ||
          manifest.dimension !== this.pins.v4.dimension ||
          manifest.digestBytes !== this.pins.v4.digestBytes ||
          manifest.tileVectors !== this.pins.v4.tileVectors ||
          manifest.source?.revision !== this.pins.v4.sourceRevision ||
          manifest.source?.vectorShardsSourceSha256Verified !== true ||
          manifest.productionEnabled !== false ||
          manifest.clusters?.length !== this.pins.v4.clusters
        ) {
          throw new Error("invalid-v4-root-contract");
        }
        return manifest;
      })().catch(error => {
        this.v4RootPromise = null;
        throw error;
      });
    }
    return this.v4RootPromise;
  }

  async v4Cluster(cluster) {
    if (!Number.isSafeInteger(cluster) || cluster < 0 || cluster >= this.pins.v4.clusters) {
      throw new Error("invalid-v4-cluster");
    }
    return cachedTask(this.v4ClusterPromises, cluster, async () => {
      const root = await this.v4Root();
      const entry = root.clusters[cluster];
      const clusterName = String(cluster).padStart(3, "0");
      if (
        entry?.cluster !== cluster ||
        !Number.isSafeInteger(entry.count) || entry.count < 1 ||
        entry.index?.path !== "indexes/cluster-" + clusterName + ".json" ||
        !VALID_SHA.test(entry.index?.sha256 || "") ||
        entry.digests?.path !== "digests/cluster-" + clusterName + ".sha256.bin" ||
        !Number.isSafeInteger(entry.digests?.bytes) ||
        entry.digests.bytes !== entry.count * this.pins.v4.digestBytes
      ) {
        throw new Error("invalid-v4-cluster-descriptor");
      }
      const indexBytes = await fetchVerifiedWhole({
        url: this.v4DigestBase() + "/" + entry.index.path,
        expectedSha: entry.index.sha256,
        maximum: 250000,
        fetchImpl: this.fetchImpl,
        cryptoImpl: this.cryptoImpl
      });
      const index = JSON.parse(new TextDecoder().decode(indexBytes));
      if (
        index.schemaVersion !== "research-atlas-ra12c2-cluster-index-v1" ||
        index.cluster !== cluster ||
        index.count !== entry.count ||
        index.vectorDimension !== this.pins.v4.dimension ||
        index.digestBytes !== this.pins.v4.digestBytes ||
        index.tileVectors !== this.pins.v4.tileVectors ||
        index.digests?.sha256 !== entry.digests.sha256 ||
        !VALID_SHA.test(index.sourceVectorSha256 || "")
      ) {
        throw new Error("invalid-v4-cluster-index");
      }
      return { entry, index };
    });
  }

  async v4VectorSha(cluster, ordinal) {
    const { entry, index } = await this.v4Cluster(cluster);
    if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= entry.count) {
      throw new Error("invalid-v4-ordinal");
    }
    const tileIndex = Math.floor(ordinal / this.pins.v4.tileVectors);
    const tile = index.tiles?.[tileIndex];
    const startOrdinal = tileIndex * this.pins.v4.tileVectors;
    const count = Math.min(this.pins.v4.tileVectors, entry.count - startOrdinal);
    if (
      !tile ||
      tile.firstOrdinal !== startOrdinal ||
      tile.count !== count ||
      tile.startByte !== startOrdinal * this.pins.v4.digestBytes ||
      tile.bytes !== count * this.pins.v4.digestBytes ||
      tile.endByte !== (startOrdinal + count) * this.pins.v4.digestBytes - 1 ||
      !VALID_SHA.test(tile.sha256 || "")
    ) {
      throw new Error("invalid-v4-digest-tile");
    }

    const key = cluster + ":" + tileIndex;
    const tileBytes = await cachedTask(this.v4TilePromises, key, () =>
      fetchVerifiedRange({
        url: this.v4DigestBase() + "/" + entry.digests.path,
        start: tile.startByte,
        bytes: tile.bytes,
        total: entry.digests.bytes,
        expectedSha: tile.sha256,
        maximum: 2048,
        fetchImpl: this.fetchImpl,
        cryptoImpl: this.cryptoImpl
      })
    );

    const local = (ordinal - startOrdinal) * this.pins.v4.digestBytes;
    const vectorSha256 = digestHex(tileBytes.subarray(local, local + this.pins.v4.digestBytes));
    if (!VALID_SHA.test(vectorSha256)) throw new Error("invalid-v4-vector-digest");
    return { entry, index, vectorSha256, tileIndex };
  }

  async fetchV4Vector(cluster, ordinal) {
    const key = cluster + ":" + ordinal;
    const result = await cachedTask(this.v4VectorPromises, key, async () => {
      const { entry, index, vectorSha256, tileIndex } = await this.v4VectorSha(cluster, ordinal);
      const clusterName = String(cluster).padStart(3, "0");
      const bytes = await fetchVerifiedRange({
        url: this.v4VectorBase() + "/cluster-" + clusterName + ".vectors.i8",
        start: ordinal * this.pins.v4.dimension,
        bytes: this.pins.v4.dimension,
        total: entry.count * this.pins.v4.dimension,
        expectedSha: vectorSha256,
        maximum: this.pins.v4.dimension,
        fetchImpl: this.fetchImpl,
        cryptoImpl: this.cryptoImpl
      });
      return {
        state: "verified",
        source: "v4",
        cluster,
        ordinal,
        bytes: new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        vectorSha256,
        sourceVectorShardSha256: index.sourceVectorSha256,
        digestTreeOid: this.pins.v4.digestOid,
        sourceRevision: this.pins.v4.sourceRevision,
        tileIndex,
        proof: "root-sha:index-sha:tile-sha:range206:vector-sha",
        atlasRuntimeEnabled: false,
        semanticNeighborEnabled: false
      };
    });
    return cloneVerified(result);
  }

  async overlayContext() {
    if (!this.overlayContextPromise) {
      this.overlayContextPromise = (async () => {
        const base = this.overlayBase();
        const manifestBytes = await fetchVerifiedWhole({
          url: base + "/manifest.json",
          expectedSha: this.pins.overlay.manifestSha256,
          expectedBytes: this.pins.overlay.manifestBytes,
          maximum: 10000,
          fetchImpl: this.fetchImpl,
          cryptoImpl: this.cryptoImpl
        });
        const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
        if (
          manifest.schemaVersion !== "research-atlas-ra12c5b-semantic-overlay-v1" ||
          manifest.status !== "built-unpublished" ||
          manifest.documentCount !== this.pins.overlay.documents ||
          manifest.dimension !== this.pins.overlay.dimension ||
          manifest.productionEnabled !== false ||
          manifest.artifacts?.vectors?.sha256 !== this.pins.overlay.vectorsSha256 ||
          manifest.artifacts?.vectors?.bytes !== this.pins.overlay.vectorBytes ||
          manifest.artifacts?.index?.sha256 !== this.pins.overlay.indexSha256 ||
          manifest.artifacts?.digests?.sha256 !== this.pins.overlay.digestsSha256 ||
          manifest.artifacts?.digests?.bytes !== this.pins.overlay.digestsBytes
        ) {
          throw new Error("invalid-overlay-manifest-contract");
        }

        const [indexBytes, digestBytes, lookupBytes] = await Promise.all([
          fetchVerifiedWhole({
            url: base + "/vector-index.jsonl.gz",
            expectedSha: this.pins.overlay.indexSha256,
            expectedBytes: this.pins.overlay.indexBytes,
            maximum: 50000,
            fetchImpl: this.fetchImpl,
            cryptoImpl: this.cryptoImpl
          }),
          fetchVerifiedWhole({
            url: base + "/vector-digests.sha256.bin",
            expectedSha: this.pins.overlay.digestsSha256,
            expectedBytes: this.pins.overlay.digestsBytes,
            maximum: 10000,
            fetchImpl: this.fetchImpl,
            cryptoImpl: this.cryptoImpl
          }),
          fetchVerifiedWhole({
            url: base + "/identity-lookup.json",
            expectedSha: this.pins.overlay.lookupSha256,
            expectedBytes: this.pins.overlay.lookupBytes,
            maximum: 150000,
            fetchImpl: this.fetchImpl,
            cryptoImpl: this.cryptoImpl
          })
        ]);
        if (indexBytes.byteLength !== this.pins.overlay.indexBytes) {
          throw new Error("overlay-index-byte-count-mismatch");
        }

        const lookup = JSON.parse(new TextDecoder().decode(lookupBytes));
        if (
          lookup.schemaVersion !== "research-atlas-ra12c5c-overlay-identity-lookup-v1" ||
          lookup.sourceManifestSha256 !== this.pins.overlay.manifestSha256 ||
          lookup.documentCount !== this.pins.overlay.documents ||
          lookup.dimension !== this.pins.overlay.dimension ||
          lookup.vectorsSha256 !== this.pins.overlay.vectorsSha256 ||
          lookup.digestsSha256 !== this.pins.overlay.digestsSha256 ||
          lookup.productionEnabled !== false ||
          lookup.records?.length !== this.pins.overlay.documents
        ) {
          throw new Error("invalid-overlay-lookup-contract");
        }

        for (let ordinal = 0; ordinal < lookup.records.length; ordinal += 1) {
          const row = lookup.records[ordinal];
          if (
            row?.ordinal !== ordinal ||
            typeof row.identity !== "string" ||
            !VALID_SHA.test(row.vectorSha256 || "")
          ) {
            throw new Error("invalid-overlay-lookup-row");
          }
          const digest = digestHex(
            digestBytes.subarray(ordinal * 32, (ordinal + 1) * 32)
          );
          if (digest !== row.vectorSha256) {
            throw new Error("overlay-lookup-digest-disagreement");
          }
        }

        return { manifest, digestBytes, lookup };
      })().catch(error => {
        this.overlayContextPromise = null;
        throw error;
      });
    }
    return this.overlayContextPromise;
  }

  async fetchOverlayVector(ordinal) {
    if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= this.pins.overlay.documents) {
      throw new Error("invalid-overlay-ordinal");
    }
    const result = await cachedTask(this.overlayVectorPromises, ordinal, async () => {
      const context = await this.overlayContext();
      const row = context.lookup.records[ordinal];
      const digest = digestHex(
        context.digestBytes.subarray(ordinal * 32, (ordinal + 1) * 32)
      );
      const bytes = await fetchVerifiedRange({
        url: this.overlayBase() + "/vectors.i8",
        start: ordinal * this.pins.overlay.dimension,
        bytes: this.pins.overlay.dimension,
        total: this.pins.overlay.vectorBytes,
        expectedSha: digest,
        maximum: this.pins.overlay.dimension,
        fetchImpl: this.fetchImpl,
        cryptoImpl: this.cryptoImpl
      });
      return {
        state: "verified",
        source: "overlay",
        ordinal,
        identity: row.identity,
        bytes: new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        vectorSha256: digest,
        overlayOid: this.pins.overlay.oid,
        proof: "manifest-sha:index-sha:digests-sha:lookup-sha:range206:vector-sha",
        atlasRuntimeEnabled: false,
        semanticNeighborEnabled: false
      };
    });
    return cloneVerified(result);
  }

  async fetchResolution(resolution) {
    if (!resolution || typeof resolution !== "object") {
      return { state: "unavailable", reason: "invalid-resolution" };
    }
    if (resolution.state === "unresolved") {
      return {
        state: "unavailable",
        reason: resolution.reason || "no-published-semantic-location",
        resolution
      };
    }
    try {
      if (
        (resolution.state === "base-direct" || resolution.state === "base-alias") &&
        resolution.location?.source === "v4"
      ) {
        return await this.fetchV4Vector(
          resolution.location.cluster,
          resolution.location.ordinal
        );
      }
      if (
        resolution.state === "overlay" &&
        resolution.location?.source === "overlay"
      ) {
        const vector = await this.fetchOverlayVector(resolution.location.ordinal);
        if (
          resolution.location.identity &&
          vector.identity !== resolution.location.identity
        ) {
          return { state: "blocked", reason: "overlay-resolution-identity-mismatch" };
        }
        return vector;
      }
      return { state: "unavailable", reason: "unsupported-resolution-state" };
    } catch (error) {
      return {
        state: "blocked",
        reason: error instanceof Error ? error.message : "vector-fetch-failed"
      };
    }
  }

  async resolveAndFetch(result) {
    const resolution = await this.locator.resolve(result);
    const vector = await this.fetchResolution(resolution);
    return { resolution, vector };
  }

  cacheStats() {
    return {
      v4Root: Boolean(this.v4RootPromise),
      v4Clusters: this.v4ClusterPromises.size,
      v4DigestTiles: this.v4TilePromises.size,
      v4Vectors: this.v4VectorPromises.size,
      overlayContext: Boolean(this.overlayContextPromise),
      overlayVectors: this.overlayVectorPromises.size
    };
  }
}
