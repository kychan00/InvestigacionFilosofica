// RA12-D1 — immutable semantic-location resolver for Research Atlas.
// Resolves federated results to either Qwen V4 or the published overlay.
// This module does not fetch vectors, add graph edges, alter ranking, or query OpenAlex live.
import { sha256Hex } from "./research-atlas-qwen-vector-range.js";
import {
  semanticAliases,
  overlayStableIdentity,
  normalizeSemanticDoi
} from "./research-atlas-semantic-coverage.js";

export const RA12D1_REVISION = "2026-11-09.ra12-d1-v1";

export const RA12D1_DEFAULT_PINS = Object.freeze({
  dataset: "CristianPelayo/openalex-philosophy",
  lookup: Object.freeze({
    oid: "525900c5e663311b25cc0a42083f241acce2176f",
    prefix: "research-atlas/qwen3-document-lookup/v1/ra12b2-run42439871082",
    manifestSha256: "c2e350fc02819b55a8fa90a11f798f22bb6ed7be87448a6a2591a835b63b6834",
    manifestBytes: 56568,
    sourceRevision: "5a4a195085de54bf607a6c4397092ffb32716dcc",
    sourceManifestSha256: "0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa",
    documents: 451823,
    partitions: 256
  }),
  overlay: Object.freeze({
    oid: "c74f0067ba665c23b09a0a79fa83651b00c0e53e",
    prefix: "research-atlas/qwen3-semantic-overlay/v1/ra12c5b-run42560032286",
    lookupSha256: "8cc87603b049538a1af36aba0b73d3f868f98c136b6832b1a5279896895383c8",
    lookupBytes: 36503,
    sourceManifestSha256: "e76848f2876370b9682d8b906b8704371a331cd0ff2cae4a9fe0bb11a4216166",
    documents: 207,
    dimension: 1024
  })
});

// RA12-C5-A authority: these four DOI identities were resolved by exact DOI echo
// to V4-resident OpenAlex works. The expected V4 locations are pinned as a
// second independent check against B3; semantic similarity is never identity authority.
export const RA12D1_DOI_V4_AUTHORITY = Object.freeze({
  "10.1515/9783110782509-009": Object.freeze({
    workId: "W4388864320", vectorId: 436957, cluster: 27, ordinal: 1660
  }),
  "10.32870/qr.v1i1.63": Object.freeze({
    workId: "W2908224364", vectorId: 33868, cluster: 164, ordinal: 97
  }),
  "10.35494/as.vi6.78": Object.freeze({
    workId: "W7140975779", vectorId: 17083, cluster: 95, ordinal: 57
  }),
  "10.4324/9781315252629-8": Object.freeze({
    workId: "W2301126092", vectorId: 48846, cluster: 118, ordinal: 260
  })
});

const HF_DATASET = "https://huggingface.co/datasets/";
const VALID_SHA = /^[a-f0-9]{64}$/;
const VALID_OID = /^[a-f0-9]{40}$/;
const WORK_ID = /^W[1-9][0-9]*$/;

function fail(reason, extra = {}) {
  return { state: "unresolved", reason, ...extra };
}

function requirePin(condition, detail) {
  if (!condition) throw new TypeError("Invalid RA12-D1 pins: " + detail);
}

function immutableBase(dataset, oid, prefix) {
  requirePin(typeof dataset === "string" && dataset.length > 0, "dataset");
  requirePin(VALID_OID.test(oid || ""), "oid");
  requirePin(typeof prefix === "string" && prefix.startsWith("research-atlas/") && !prefix.includes(".."), "prefix");
  return HF_DATASET + dataset + "/resolve/" + oid + "/" + prefix;
}

function validatePins(pins) {
  requirePin(pins && typeof pins === "object", "root");
  const lookup = pins.lookup;
  const overlay = pins.overlay;
  requirePin(VALID_SHA.test(lookup?.manifestSha256 || ""), "lookup manifest sha");
  requirePin(Number.isSafeInteger(lookup?.manifestBytes) && lookup.manifestBytes > 0 && lookup.manifestBytes < 200000, "lookup manifest bytes");
  requirePin(VALID_SHA.test(lookup?.sourceManifestSha256 || ""), "lookup source manifest sha");
  requirePin(Number.isSafeInteger(lookup?.documents) && lookup.documents === 451823, "lookup documents");
  requirePin(Number.isSafeInteger(lookup?.partitions) && lookup.partitions === 256, "lookup partitions");
  requirePin(VALID_SHA.test(overlay?.lookupSha256 || ""), "overlay lookup sha");
  requirePin(Number.isSafeInteger(overlay?.lookupBytes) && overlay.lookupBytes > 0 && overlay.lookupBytes < 150000, "overlay lookup bytes");
  requirePin(VALID_SHA.test(overlay?.sourceManifestSha256 || ""), "overlay manifest sha");
  requirePin(overlay?.documents === 207 && overlay?.dimension === 1024, "overlay shape");
  immutableBase(pins.dataset, lookup.oid, lookup.prefix);
  immutableBase(pins.dataset, overlay.oid, overlay.prefix);
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
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchVerifiedFile({ url, expectedSha, expectedBytes, maximum, fetchImpl, cryptoImpl, signal }) {
  if (!VALID_SHA.test(expectedSha || "") || !Number.isSafeInteger(expectedBytes) || expectedBytes < 1 || expectedBytes > maximum) {
    throw new Error("invalid-file-contract");
  }
  const response = await fetchImpl(url, {
    method: "GET", mode: "cors", credentials: "omit", cache: "no-store", signal
  });
  if (response.status !== 200) {
    await response.body?.cancel().catch(() => {});
    throw new Error("file-http-" + response.status);
  }
  const bytes = await readCapped(response, maximum);
  if (bytes.byteLength !== expectedBytes) throw new Error("file-byte-count-mismatch");
  if (await sha256Hex(bytes, cryptoImpl) !== expectedSha) throw new Error("file-sha-mismatch");
  return bytes;
}

async function defaultGunzip(bytes, maximum = 250000) {
  if (typeof globalThis.DecompressionStream !== "function" || typeof globalThis.Blob !== "function" || typeof globalThis.Response !== "function") {
    throw new Error("gzip-unavailable");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const body = new Uint8Array(await new Response(stream).arrayBuffer());
  if (body.byteLength > maximum) throw new Error("gzip-output-over-budget");
  return body;
}

function normalizeWorkAlias(alias) {
  const match = /^openalex:(W[1-9][0-9]*)$/i.exec(String(alias || ""));
  return match ? match[1].toUpperCase() : null;
}

function aliasDoi(alias) {
  const text = String(alias || "");
  if (text.startsWith("doi:")) return normalizeSemanticDoi(text.slice(4));
  if (text.startsWith("crossref:")) return normalizeSemanticDoi(text.slice(9));
  return null;
}

function sameLocation(actual, expected) {
  return actual?.workId === expected.workId &&
    actual?.vectorId === expected.vectorId &&
    actual?.cluster === expected.cluster &&
    actual?.ordinal === expected.ordinal;
}

export class ResearchAtlasQwenLocator {
  constructor({
    pins = RA12D1_DEFAULT_PINS,
    fetchImpl = globalThis.fetch,
    cryptoImpl = globalThis.crypto,
    gunzipImpl = defaultGunzip
  } = {}) {
    validatePins(pins);
    if (typeof fetchImpl !== "function" || !cryptoImpl?.subtle?.digest || typeof gunzipImpl !== "function") {
      throw new TypeError("ResearchAtlasQwenLocator requires fetch, crypto SHA-256 and gzip support");
    }
    this.pins = pins;
    this.fetchImpl = fetchImpl;
    this.cryptoImpl = cryptoImpl;
    this.gunzipImpl = gunzipImpl;
    this.lookupManifestPromise = null;
    this.lookupPartitionPromises = new Map();
    this.overlayLookupPromise = null;
  }

  lookupBase() {
    return immutableBase(this.pins.dataset, this.pins.lookup.oid, this.pins.lookup.prefix);
  }

  overlayBase() {
    return immutableBase(this.pins.dataset, this.pins.overlay.oid, this.pins.overlay.prefix);
  }

  async lookupManifest(signal) {
    if (!this.lookupManifestPromise) {
      this.lookupManifestPromise = (async () => {
        const bytes = await fetchVerifiedFile({
          url: this.lookupBase() + "/lookup-manifest.json",
          expectedSha: this.pins.lookup.manifestSha256,
          expectedBytes: this.pins.lookup.manifestBytes,
          maximum: 200000,
          fetchImpl: this.fetchImpl,
          cryptoImpl: this.cryptoImpl,
          signal
        });
        const manifest = JSON.parse(new TextDecoder().decode(bytes));
        if (manifest.schemaVersion !== "research-atlas-qwen-document-lookup-v1" ||
            manifest.status !== "generated-unpublished" || manifest.productionEnabled !== false ||
            manifest.source?.revision !== this.pins.lookup.sourceRevision ||
            manifest.source?.manifestSha256 !== this.pins.lookup.sourceManifestSha256 ||
            manifest.coverage?.documents !== this.pins.lookup.documents ||
            manifest.lookup?.entryCount !== this.pins.lookup.documents ||
            manifest.lookup?.ambiguousWorkIdsExcluded !== 0 ||
            manifest.lookup?.partitionCount !== this.pins.lookup.partitions ||
            manifest.lookup?.partitions?.length !== this.pins.lookup.partitions) {
          throw new Error("lookup-manifest-contract-mismatch");
        }
        return manifest;
      })().catch(error => {
        this.lookupManifestPromise = null;
        throw error;
      });
    }
    return this.lookupManifestPromise;
  }

  async partitionIndex(workId) {
    if (!WORK_ID.test(workId || "")) throw new Error("invalid-openalex-work-id");
    const hash = await sha256Hex(new TextEncoder().encode(workId), this.cryptoImpl);
    return Number.parseInt(hash.slice(0, 2), 16);
  }

  async lookupPartition(prefix, signal) {
    if (!Number.isSafeInteger(prefix) || prefix < 0 || prefix > 255) throw new Error("invalid-partition-prefix");
    if (!this.lookupPartitionPromises.has(prefix)) {
      const promise = (async () => {
        const manifest = await this.lookupManifest(signal);
        const part = manifest.lookup.partitions[prefix];
        const expectedPath = "lookup/part-" + String(prefix).padStart(3, "0") + ".jsonl.gz";
        if (part?.prefix !== prefix || part?.path !== expectedPath ||
            !VALID_SHA.test(part?.sha256 || "") || !Number.isSafeInteger(part?.bytes) ||
            part.bytes < 1 || part.bytes > 100000 || !Number.isSafeInteger(part?.count) || part.count < 1) {
          throw new Error("invalid-partition-descriptor");
        }
        const compressed = await fetchVerifiedFile({
          url: this.lookupBase() + "/" + expectedPath,
          expectedSha: part.sha256,
          expectedBytes: part.bytes,
          maximum: 100000,
          fetchImpl: this.fetchImpl,
          cryptoImpl: this.cryptoImpl,
          signal
        });
        const decoded = await this.gunzipImpl(compressed, 250000);
        const rows = new Map();
        let previous = -1;
        const lines = new TextDecoder().decode(decoded).split("\n").filter(Boolean);
        if (lines.length !== part.count) throw new Error("partition-row-count-mismatch");
        for (const line of lines) {
          const row = JSON.parse(line);
          if (!Array.isArray(row) || row.length !== 4) throw new Error("invalid-lookup-row");
          const [work, vectorId, cluster, ordinal] = row;
          if (!WORK_ID.test(work) || !Number.isSafeInteger(vectorId) || vectorId < 0 || vectorId >= this.pins.lookup.documents ||
              !Number.isSafeInteger(cluster) || cluster < 0 || cluster > 255 || !Number.isSafeInteger(ordinal) || ordinal < 0) {
            throw new Error("invalid-lookup-row-fields");
          }
          const numeric = Number(work.slice(1));
          if (!Number.isSafeInteger(numeric) || numeric <= previous || rows.has(work)) throw new Error("lookup-partition-order-or-duplicate");
          previous = numeric;
          rows.set(work, { workId: work, vectorId, cluster, ordinal });
        }
        return rows;
      })().catch(error => {
        this.lookupPartitionPromises.delete(prefix);
        throw error;
      });
      this.lookupPartitionPromises.set(prefix, promise);
    }
    return this.lookupPartitionPromises.get(prefix);
  }

  async resolveOpenAlex(workId, signal) {
    if (!WORK_ID.test(workId || "")) return null;
    const prefix = await this.partitionIndex(workId);
    const rows = await this.lookupPartition(prefix, signal);
    return rows.get(workId) || null;
  }

  async overlayLookup(signal) {
    if (!this.overlayLookupPromise) {
      this.overlayLookupPromise = (async () => {
        const bytes = await fetchVerifiedFile({
          url: this.overlayBase() + "/identity-lookup.json",
          expectedSha: this.pins.overlay.lookupSha256,
          expectedBytes: this.pins.overlay.lookupBytes,
          maximum: 150000,
          fetchImpl: this.fetchImpl,
          cryptoImpl: this.cryptoImpl,
          signal
        });
        const lookup = JSON.parse(new TextDecoder().decode(bytes));
        if (lookup.schemaVersion !== "research-atlas-ra12c5c-overlay-identity-lookup-v1" ||
            lookup.sourceManifestSha256 !== this.pins.overlay.sourceManifestSha256 ||
            lookup.documentCount !== this.pins.overlay.documents || lookup.dimension !== this.pins.overlay.dimension ||
            lookup.productionEnabled !== false || lookup.records?.length !== this.pins.overlay.documents) {
          throw new Error("overlay-lookup-contract-mismatch");
        }
        const map = new Map();
        for (const row of lookup.records) {
          if (!Number.isSafeInteger(row?.ordinal) || row.ordinal < 0 || row.ordinal >= this.pins.overlay.documents ||
              typeof row.identity !== "string" || row.identity.length < 3 || !VALID_SHA.test(row.vectorSha256 || "") || map.has(row.identity)) {
            throw new Error("invalid-overlay-identity-row");
          }
          map.set(row.identity, {
            source: "overlay",
            identity: row.identity,
            ordinal: row.ordinal,
            vectorSha256: row.vectorSha256
          });
        }
        return map;
      })().catch(error => {
        this.overlayLookupPromise = null;
        throw error;
      });
    }
    return this.overlayLookupPromise;
  }

  async resolve(result, { signal } = {}) {
    if (!result || typeof result !== "object") return fail("invalid-result");
    if (signal?.aborted) return fail("aborted");
    try {
      const aliases = semanticAliases(result);
      for (const alias of aliases) {
        const workId = normalizeWorkAlias(alias);
        if (!workId) continue;
        const location = await this.resolveOpenAlex(workId, signal);
        if (location) {
          return {
            state: "base-direct",
            alias,
            location: { source: "v4", ...location },
            authority: "ra12-b3-openalex-workid",
            proof: "immutable-b3-manifest:partition-sha:exact-work-id"
          };
        }
      }

      for (const alias of aliases) {
        const doi = aliasDoi(alias);
        const authority = doi ? RA12D1_DOI_V4_AUTHORITY[doi] : null;
        if (!authority) continue;
        const location = await this.resolveOpenAlex(authority.workId, signal);
        if (!location || !sameLocation(location, authority)) {
          return fail("doi-authority-v4-location-mismatch", { alias: "doi:" + doi });
        }
        return {
          state: "base-alias",
          alias: "doi:" + doi,
          location: { source: "v4", ...location },
          authority: "ra12-c5a-exact-doi-openalex",
          proof: "c5a-exact-doi-authority:b3-exact-work-id"
        };
      }

      const candidates = new Set();
      for (const alias of aliases) {
        if (alias.startsWith("openalex:") || alias.startsWith("doi:")) candidates.add(alias);
      }
      const stable = overlayStableIdentity(result);
      if (stable) candidates.add(stable);
      if (candidates.size) {
        const overlay = await this.overlayLookup(signal);
        for (const identity of candidates) {
          const location = overlay.get(identity);
          if (location) {
            return {
              state: "overlay",
              alias: identity,
              location,
              authority: "ra12-c5c-exact-overlay-identity",
              proof: "immutable-c5c-lookup-sha:exact-identity"
            };
          }
        }
      }

      return fail("no-published-semantic-location", { aliases: [...aliases] });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "resolver-failed");
    }
  }

  async resolveMany(results, { signal } = {}) {
    const values = Array.isArray(results) ? results : [];
    return Promise.all(values.map(result => this.resolve(result, { signal })));
  }
}
