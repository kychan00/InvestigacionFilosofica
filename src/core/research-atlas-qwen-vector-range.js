// RA12-C1: experimental document-vector transport. Not imported by production Atlas.
// Every slice requires a hash from a separately SHA-verified complete source shard.
// A full-shard manifest SHA alone cannot authenticate an isolated Range response.

export const QWEN3_V4_DIMENSION = 1024;
export const QWEN3_V4_REVISION = "5a4a195085de54bf607a6c4397092ffb32716dcc";

export function vectorByteRange(ordinal, record, dimension = QWEN3_V4_DIMENSION) {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 ||
      !Number.isSafeInteger(dimension) || dimension !== QWEN3_V4_DIMENSION ||
      !record || !Number.isSafeInteger(record.count) || ordinal >= record.count ||
      !Number.isSafeInteger(record.vectors?.bytes) ||
      record.vectors.bytes !== record.count * dimension) {
    throw new RangeError("Invalid V4 cluster, ordinal or vector dimensions");
  }
  const start = ordinal * dimension;
  const end = start + dimension - 1;
  if (!Number.isSafeInteger(end) || end >= record.vectors.bytes) {
    throw new RangeError("Vector byte range exceeds V4 shard");
  }
  return { start, end, total: record.vectors.bytes, bytes: dimension };
}

export function parseExactContentRange(value, expected) {
  if (typeof value !== "string") return false;
  const match = /^bytes ([0-9]+)-([0-9]+)\/([0-9]+)$/.exec(value);
  if (!match) return false;
  const [start, end, total] = match.slice(1).map(Number);
  return [start, end, total].every(Number.isSafeInteger) &&
    start === expected.start && end === expected.end && total === expected.total &&
    start <= end && end < total;
}

function hex(bytes) {
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(bytes, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle?.digest) throw new Error("Crypto SHA-256 unavailable");
  return hex(new Uint8Array(await cryptoImpl.subtle.digest("SHA-256", bytes)));
}

export function cosineInt8(left, right, dimension = QWEN3_V4_DIMENSION) {
  if (!(left instanceof Int8Array) || !(right instanceof Int8Array) ||
      dimension !== QWEN3_V4_DIMENSION ||
      left.length !== dimension || right.length !== dimension) {
    throw new RangeError("Quantized document cosine requires two 1024-byte int8 vectors");
  }
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < dimension; i += 1) {
    const a = left[i], b = right[i];
    dot += a * b;
    aa += a * a;
    bb += b * b;
  }
  if (aa === 0 || bb === 0) throw new RangeError("Zero-norm int8 vector");
  const score = dot / Math.sqrt(aa * bb);
  if (!Number.isFinite(score)) throw new RangeError("Invalid document cosine");
  return Math.max(-1, Math.min(1, score));
}

export async function fetchVerifiedVectorRange({
  url,
  range,
  expectedSliceSha256,
  fetchImpl = globalThis.fetch,
  cryptoImpl = globalThis.crypto,
  signal
} = {}) {
  // Fail closed: no access without independent 1KB slice hash.
  const pinnedClusterBase = "https://huggingface.co/datasets/CristianPelayo/openalex-philosophy/resolve/" +
    QWEN3_V4_REVISION + "/semantic-retrieval/v3.3/browser-static-v4/20261010-v4/clusters/";
  const clusterName = typeof url === "string" && url.startsWith(pinnedClusterBase)
    ? url.slice(pinnedClusterBase.length) : "";
  const exactClusterFile = /^cluster-(\\d{3})\\.vectors\\.i8$/.exec(clusterName);
  if (!exactClusterFile || Number(exactClusterFile[1]) > 255 ||
      !range || range.bytes !== QWEN3_V4_DIMENSION ||
      range.end !== range.start + QWEN3_V4_DIMENSION - 1 ||
      !Number.isSafeInteger(range.total) || range.total < QWEN3_V4_DIMENSION ||
      !/^[a-f0-9]{64}$/.test(expectedSliceSha256 || "") ||
      typeof fetchImpl !== "function" || !cryptoImpl?.subtle?.digest) {
    return { state: "blocked", reason: "invalid-contract" };
  }
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Range: "bytes=" + range.start + "-" + range.end },
      cache: "no-store",
      signal
    });
  } catch {
    return { state: "blocked", reason: signal?.aborted ? "aborted" : "network-or-cors" };
  }
  // Reject 200 BEFORE consuming a multi-megabyte shard.
  if (response.status !== 206) {
    await response.body?.cancel().catch(() => {});
    return { state: "blocked", reason: response.status === 200 ? "range-ignored-200" : "http-" + response.status };
  }
  const contentRange = response.headers.get("content-range");
  const encoding = response.headers.get("content-encoding");
  const contentType = response.headers.get("content-type");
  if (!parseExactContentRange(contentRange, range) ||
      (encoding && encoding.toLowerCase() !== "identity") ||
      (contentType && contentType.toLowerCase().includes("multipart/"))) {
    await response.body?.cancel().catch(() => {});
    return { state: "blocked", reason: !contentRange ? "content-range-not-exposed" : "invalid-content-range-or-encoding" };
  }
  const reader = response.body?.getReader();
  if (!reader) return { state: "blocked", reason: "no-readable-body" };
  const bytes = new Uint8Array(QWEN3_V4_DIMENSION);
  let cursor = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || cursor + value.byteLength > QWEN3_V4_DIMENSION) {
        await reader.cancel().catch(() => {});
        return { state: "blocked", reason: "response-over-budget" };
      }
      bytes.set(value, cursor);
      cursor += value.byteLength;
    }
  } catch {
    await reader.cancel().catch(() => {});
    return { state: "blocked", reason: signal?.aborted ? "aborted" : "read-failed" };
  }
  if (cursor !== QWEN3_V4_DIMENSION) return { state: "blocked", reason: "short-read" };
  const hash = await sha256Hex(bytes, cryptoImpl);
  if (hash !== expectedSliceSha256) return { state: "blocked", reason: "slice-sha-mismatch" };
  return {
    state: "verified",
    bytes: new Int8Array(bytes.buffer),
    byteCount: bytes.length,
    sliceSha256: hash,
    integrity: "sha256-against-full-shard-verified-reference"
  };
}
