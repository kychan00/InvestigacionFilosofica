import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";
import { webcrypto } from "node:crypto";

import {
  ResearchAtlasQwenLocator,
  RA12D1_DOI_V4_AUTHORITY
} from "../src/core/research-atlas-qwen-resolution.js";

const encoder = new TextEncoder();
const cryptoImpl = globalThis.crypto || webcrypto;

async function sha(bytes) {
  const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest).toString("hex");
}

function response(bytes, status = 200) {
  return new Response(bytes, { status, headers: { "content-length": String(bytes.byteLength) } });
}

async function fixture() {
  const directWork = "W4388864320";
  const otherWork = "W2908224364";
  const directPrefix = parseInt((await sha(encoder.encode(directWork))).slice(0, 2), 16);
  const otherPrefix = parseInt((await sha(encoder.encode(otherWork))).slice(0, 2), 16);
  const locations = {
    [directWork]: [directWork, 436957, 27, 1660],
    [otherWork]: [otherWork, 33868, 164, 97]
  };
  const partitionBodies = new Map();
  for (const [work, row] of Object.entries(locations)) {
    const prefix = work === directWork ? directPrefix : otherPrefix;
    const previous = partitionBodies.get(prefix) || [];
    previous.push(row);
    partitionBodies.set(prefix, previous);
  }

  const partitions = Array.from({ length: 256 }, (_, prefix) => ({
    prefix,
    path: `lookup/part-${String(prefix).padStart(3, "0")}.jsonl.gz`,
    bytes: 1,
    sha256: "0".repeat(64),
    count: 1
  }));
  const compressedByPath = new Map();

  for (let prefix = 0; prefix < 256; prefix += 1) {
    const rows = partitionBodies.get(prefix) || [
      [`W${9000000000 + prefix}`, prefix, prefix, 0]
    ];
    rows.sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)));
    const raw = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n");
    const compressed = new Uint8Array(gzipSync(raw));
    const path = partitions[prefix].path;
    partitions[prefix] = {
      prefix,
      path,
      bytes: compressed.byteLength,
      sha256: await sha(compressed),
      count: rows.length
    };
    compressedByPath.set(path, compressed);
  }

  const manifestObject = {
    schemaVersion: "research-atlas-qwen-document-lookup-v1",
    status: "generated-unpublished",
    productionEnabled: false,
    source: {
      revision: "fixture-revision",
      manifestSha256: "a".repeat(64)
    },
    coverage: {
      documents: 451823
    },
    lookup: {
      entryCount: 451823,
      ambiguousWorkIdsExcluded: 0,
      partitionCount: 256,
      partitions
    }
  };
  const manifest = encoder.encode(JSON.stringify(manifestObject));

  const overlayObject = {
    schemaVersion: "research-atlas-ra12c5c-overlay-identity-lookup-v1",
    sourceManifestSha256: "b".repeat(64),
    documentCount: 207,
    dimension: 1024,
    productionEnabled: false,
    records: Array.from({ length: 207 }, (_, ordinal) => ({
      ordinal,
      identity: ordinal === 0
        ? "doi:10.12795/ambitos.2019.i43.10"
        : `openalex:W${8000000000 + ordinal}`,
      vectorSha256: (ordinal.toString(16).padStart(2, "0")).repeat(32).slice(0, 64)
    }))
  };
  const overlay = encoder.encode(JSON.stringify(overlayObject));

  const pins = {
    dataset: "fixture/dataset",
    lookup: {
      oid: "1".repeat(40),
      prefix: "research-atlas/lookup",
      manifestSha256: await sha(manifest),
      manifestBytes: manifest.byteLength,
      sourceRevision: "fixture-revision",
      sourceManifestSha256: "a".repeat(64),
      documents: 451823,
      partitions: 256
    },
    overlay: {
      oid: "2".repeat(40),
      prefix: "research-atlas/overlay",
      lookupSha256: await sha(overlay),
      lookupBytes: overlay.byteLength,
      sourceManifestSha256: "b".repeat(64),
      documents: 207,
      dimension: 1024
    }
  };

  const lookupBase =
    `https://huggingface.co/datasets/${pins.dataset}/resolve/${pins.lookup.oid}/${pins.lookup.prefix}`;
  const overlayBase =
    `https://huggingface.co/datasets/${pins.dataset}/resolve/${pins.overlay.oid}/${pins.overlay.prefix}`;

  const fetchImpl = async url => {
    if (url === lookupBase + "/lookup-manifest.json") return response(manifest);
    if (url === overlayBase + "/identity-lookup.json") return response(overlay);
    for (const [path, bytes] of compressedByPath) {
      if (url === lookupBase + "/" + path) return response(bytes);
    }
    return new Response("missing", { status: 404 });
  };

  return { pins, fetchImpl, manifest };
}

const gunzipImpl = async bytes => new Uint8Array(gunzipSync(bytes));

test("RA12-D1 resolves an explicit OpenAlex identity through immutable B3", async () => {
  const fx = await fixture();
  const locator = new ResearchAtlasQwenLocator({
    pins: fx.pins,
    fetchImpl: fx.fetchImpl,
    cryptoImpl,
    gunzipImpl
  });
  const out = await locator.resolve({
    id: "openalex-W4388864320",
    providers: ["OpenAlex Philosophy"]
  });
  assert.equal(out.state, "base-direct");
  assert.deepEqual(out.location, {
    source: "v4",
    workId: "W4388864320",
    vectorId: 436957,
    cluster: 27,
    ordinal: 1660
  });
});

test("RA12-D1 requires the C5-A DOI authority location to agree with B3", async () => {
  const fx = await fixture();
  const locator = new ResearchAtlasQwenLocator({
    pins: fx.pins,
    fetchImpl: fx.fetchImpl,
    cryptoImpl,
    gunzipImpl
  });
  const out = await locator.resolve({
    doi: "10.32870/qr.v1i1.63",
    providers: ["CUCSH Filosofía"]
  });
  assert.equal(out.state, "base-alias");
  assert.equal(
    out.location.workId,
    RA12D1_DOI_V4_AUTHORITY["10.32870/qr.v1i1.63"].workId
  );
});

test("RA12-D1 resolves an exact published overlay identity without title fuzzy matching", async () => {
  const fx = await fixture();
  const locator = new ResearchAtlasQwenLocator({
    pins: fx.pins,
    fetchImpl: fx.fetchImpl,
    cryptoImpl,
    gunzipImpl
  });
  const out = await locator.resolve({
    doi: "10.12795/ambitos.2019.i43.10",
    title: "unrelated title",
    providers: ["Crossref"]
  });
  assert.equal(out.state, "overlay");
  assert.equal(out.location.ordinal, 0);
});

test("RA12-D1 leaves unknown works unresolved; similar title is never identity authority", async () => {
  const fx = await fixture();
  const locator = new ResearchAtlasQwenLocator({
    pins: fx.pins,
    fetchImpl: fx.fetchImpl,
    cryptoImpl,
    gunzipImpl
  });
  const out = await locator.resolve({
    title: "same title as anything",
    providers: ["Internet Archive"],
    id: "unknown"
  });
  assert.equal(out.state, "unresolved");
  assert.equal(out.reason, "no-published-semantic-location");
});

test("RA12-D1 fails closed when the authenticated B3 manifest changes", async () => {
  const fx = await fixture();
  const badFetch = async url => {
    if (url.endsWith("/lookup-manifest.json")) {
      const mutated = new Uint8Array(fx.manifest);
      mutated[mutated.length - 1] ^= 1;
      return response(mutated);
    }
    return fx.fetchImpl(url);
  };
  const locator = new ResearchAtlasQwenLocator({
    pins: fx.pins,
    fetchImpl: badFetch,
    cryptoImpl,
    gunzipImpl
  });
  const out = await locator.resolve({
    id: "openalex-W4388864320",
    providers: ["OpenAlex Philosophy"]
  });
  assert.equal(out.state, "unresolved");
  assert.equal(out.reason, "file-sha-mismatch");
});
