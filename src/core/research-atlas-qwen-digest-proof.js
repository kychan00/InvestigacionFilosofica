// RA12-C3 — standalone experimental integrity proof. Not imported by Atlas runtime.
// The root SHA and immutable HF commit OID must both be independently established.
// SHA chain: pinned root → index → 64-vector digest tile → 1024-byte V4 vector.
import { fetchVerifiedVectorRange, vectorByteRange, sha256Hex } from "./research-atlas-qwen-vector-range.js";

export const RA12C3_ROOT_SHA = "38067b5876de5f53abe5c7431b8618464d3fe711058a70fdde700fce7c50d961";
const SOURCE_REVISION = "5a4a195085de54bf607a6c4397092ffb32716dcc";
const ROOT_PATH = "research-atlas/qwen3-document-digests/v1/ra12c2-run42495212950";
const DATASET_PREFIX = "https://huggingface.co/datasets/CristianPelayo/openalex-philosophy/resolve/";
const V4_PREFIX = DATASET_PREFIX + SOURCE_REVISION + "/semantic-retrieval/v3.3/browser-static-v4/20261010-v4/clusters/";

function validSha(value) { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
function validInteger(value, low, high) { return Number.isSafeInteger(value) && value >= low && value <= high; }
function toHex(bytes) { return [...bytes].map(x => x.toString(16).padStart(2, "0")).join(""); }
function fail(reason) { return { state: "blocked", reason }; }
function digestBase(oid) {
  if (typeof oid !== "string" || !/^[a-f0-9]{40}$/.test(oid)) {
    throw new Error("Missing immutable 40-hex Hugging Face commit OID");
  }
  return DATASET_PREFIX + oid + "/" + ROOT_PATH;
}

async function readCapped(response, maximum) {
  if (!response.body?.getReader) throw new Error("no-body");
  const header = response.headers.get("content-length");
  if (header !== null && Number(header) > maximum) {
    await response.body.cancel().catch(() => {});
    throw new Error("over-budget");
  }
  const chunks = [];
  let bytes = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value || bytes + value.byteLength > maximum) {
        await reader.cancel().catch(() => {});
        throw new Error("over-budget");
      }
      chunks.push(value);
      bytes += value.byteLength;
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  const result = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

async function verifiedSmallJson({ url, expectedSha, maxBytes, fetchImpl, cryptoImpl, signal }) {
  if (!validSha(expectedSha)) throw new Error("untrusted-json-sha");
  const response = await fetchImpl(url, { method: "GET", mode: "cors",
    credentials: "omit", cache: "no-store", signal });
  if (response.status !== 200) {
    await response.body?.cancel().catch(() => {});
    throw new Error("json-http-" + response.status);
  }
  const body = await readCapped(response, maxBytes);
  if (await sha256Hex(body, cryptoImpl) !== expectedSha) throw new Error("json-sha-mismatch");
  return { data: JSON.parse(new TextDecoder().decode(body)), bytes: body.length };
}

async function verifiedDigestTile({ url, tile, fullLength, fetchImpl, cryptoImpl, signal }) {
  if (!validSha(tile.sha256) || !validInteger(tile.startByte, 0, fullLength - 1) ||
      !validInteger(tile.endByte, tile.startByte, fullLength - 1) ||
      !validInteger(tile.bytes, 32, 2048) || tile.bytes !== tile.endByte - tile.startByte + 1) {
    throw new Error("invalid-tile-descriptor");
  }
  const response = await fetchImpl(url, {
    method: "GET", mode: "cors", credentials: "omit", cache: "no-store",
    headers: { Range: "bytes=" + tile.startByte + "-" + tile.endByte }, signal
  });
  if (response.status !== 206) {
    await response.body?.cancel().catch(() => {});
    throw new Error(response.status === 200 ? "digest-range-ignored-200" : "digest-http-" + response.status);
  }
  const contentRange = response.headers.get("content-range");
  const exact = "bytes " + tile.startByte + "-" + tile.endByte + "/" + fullLength;
  const encoding = response.headers.get("content-encoding");
  if (contentRange !== exact || (encoding && encoding.toLowerCase() !== "identity")) {
    await response.body?.cancel().catch(() => {});
    throw new Error(contentRange ? "invalid-digest-content-range" : "digest-content-range-not-exposed");
  }
  const bytes = await readCapped(response, tile.bytes);
  if (bytes.byteLength !== tile.bytes) throw new Error("digest-tile-short-read");
  if (await sha256Hex(bytes, cryptoImpl) !== tile.sha256) throw new Error("digest-tile-sha-mismatch");
  return bytes;
}

/** Verify the entire chain, including original V4 vector bytes, for one cluster/ordinal. */
export async function fetchAuthenticatedQwenVector({
  oid, cluster, ordinal, expectedRootSha = RA12C3_ROOT_SHA,
  fetchImpl = globalThis.fetch, cryptoImpl = globalThis.crypto, signal
} = {}) {
  if (!validInteger(cluster, 0, 255) || !validInteger(ordinal, 0, 6471) ||
      !validSha(expectedRootSha) || typeof fetchImpl !== "function" ||
      !cryptoImpl?.subtle?.digest || signal?.aborted) return fail("invalid-contract-or-aborted");
  let base;
  try { base = digestBase(oid); } catch { return fail("invalid-hf-oid"); }
  let bytesReceived = 0;
  try {
    const root = await verifiedSmallJson({
      url: base + "/hash-manifest.json", expectedSha: expectedRootSha,
      maxBytes: 750_000, fetchImpl, cryptoImpl, signal
    });
    bytesReceived += root.bytes;
    const manifest = root.data;
    if (manifest.schemaVersion !== "research-atlas-ra12c2-vector-digest-tree-v1" ||
        manifest.documentCount !== 451823 || manifest.clusterCount !== 256 ||
        manifest.dimension !== 1024 || manifest.digestBytes !== 32 ||
        manifest.tileVectors !== 64 ||
        manifest.source?.revision !== SOURCE_REVISION ||
        manifest.source?.vectorShardsSourceSha256Verified !== true ||
        manifest.clusters?.length !== 256 ||
        manifest.productionEnabled !== false) throw new Error("invalid-pinned-root-contract");
    const entry = manifest.clusters[cluster];
    if (entry?.cluster !== cluster || !validInteger(entry.count, 1, 6472) ||
        ordinal >= entry.count || !validSha(entry.index?.sha256) ||
        entry.index?.path !== "indexes/cluster-" + String(cluster).padStart(3, "0") + ".json" ||
        entry.digests?.path !== "digests/cluster-" + String(cluster).padStart(3, "0") + ".sha256.bin" ||
        entry.digests?.bytes !== entry.count * 32) throw new Error("invalid-cluster-descriptor");
    const idx = await verifiedSmallJson({
      url: base + "/" + entry.index.path, expectedSha: entry.index.sha256,
      maxBytes: 250_000, fetchImpl, cryptoImpl, signal
    });
    bytesReceived += idx.bytes;
    const index = idx.data;
    if (index.schemaVersion !== "research-atlas-ra12c2-cluster-index-v1" ||
        index.cluster !== cluster || index.count !== entry.count ||
        index.vectorDimension !== 1024 || index.digestBytes !== 32 ||
        index.tileVectors !== 64 ||
        index.digests?.sha256 !== entry.digests.sha256 ||
        !validSha(index.sourceVectorSha256)) throw new Error("invalid-cluster-index");
    const tile = index.tiles?.[Math.floor(ordinal / 64)];
    const startOrdinal = Math.floor(ordinal / 64) * 64;
    const count = Math.min(64, entry.count - startOrdinal);
    if (!tile || tile.firstOrdinal !== startOrdinal || tile.count !== count ||
        tile.startByte !== startOrdinal * 32 || tile.bytes !== count * 32 ||
        tile.endByte !== (startOrdinal + count) * 32 - 1)
      throw new Error("invalid-digest-tile-offset");
    const tileBytes = await verifiedDigestTile({
      url: base + "/" + entry.digests.path, tile, fullLength:entry.digests.bytes,
      fetchImpl, cryptoImpl, signal
    });
    bytesReceived += tileBytes.length;
    const localOffset = (ordinal - startOrdinal) * 32;
    const vectorSha = toHex(tileBytes.subarray(localOffset, localOffset + 32));
    if (!validSha(vectorSha)) throw new Error("missing-slice-sha");
    const record = { count: entry.count, vectors: { bytes: entry.count * 1024 } };
    const range = vectorByteRange(ordinal, record);
    const url = V4_PREFIX + "cluster-" + String(cluster).padStart(3, "0") + ".vectors.i8";
    const vector = await fetchVerifiedVectorRange({
      url, range, expectedSliceSha256: vectorSha, fetchImpl, cryptoImpl, signal
    });
    if (vector.state !== "verified") return {
      state: "blocked", reason: "vector-" + vector.reason, bytesAccepted: bytesReceived
    };
    bytesReceived += vector.byteCount;
    return {
      state: "verified",
      bytes: vector.bytes,
      bytesAccepted: bytesReceived,
      vectorSha256: vectorSha,
      cluster, ordinal,
      digestTreeRootSha256: expectedRootSha,
      sourceVectorShardSha256: index.sourceVectorSha256,
      sourceRevision: SOURCE_REVISION,
      digestArtifactOid: oid,
      proof: "root-sha:index-sha:tile-sha:vector-sha",
      atlasRuntimeEnabled: false
    };
  } catch (error) {
    return { state: "blocked", reason: error instanceof Error ? error.message : "unknown-error",
      bytesAccepted: bytesReceived };
  }
}
