#!/usr/bin/env node
// RA12-C1: run the exact experimental reader from the actual GitHub Pages
// origin in Chromium. This never changes production HTML or its search engine.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const v4Base = "https://huggingface.co/datasets/CristianPelayo/openalex-philosophy/resolve/" +
  "5a4a195085de54bf607a6c4397092ffb32716dcc/semantic-retrieval/v3.3/browser-static-v4/20261010-v4";
const siteUrl = "https://kychan00.github.io/InvestigacionFilosofica/";

const args = process.argv.slice(2);
const get = key => {
  const i = args.indexOf(key);
  if (i < 0 || i === args.length - 1) throw new Error("Missing " + key);
  return args[i + 1];
};
const referenceFile = get("--reference");
const outputFile = get("--output");
const reference = JSON.parse(await fs.readFile(referenceFile, "utf8"));
if (reference.schemaVersion !== "research-atlas-ra12c1-full-shard-reference-v1" ||
    reference.status !== "sha256-verified-reference" ||
    reference.dimension !== 1024 ||
    reference.sliceCount !== 6 ||
    reference.probes.length !== 6 ||
    reference.wholeShardsSha256Verified !== true ||
    reference.productionEnabled !== false) {
  throw new Error("Invalid SHA-verified RA12-C1 reference manifest");
}

const report = {
  schemaVersion: "research-atlas-ra12c1-browser-range-audit-v1",
  sourceRevision: reference.sourceRevision,
  sourceManifestSha256: reference.sourceManifestSha256,
  urlOrigin: "https://kychan00.github.io",
  attemptedInRealChromium: false,
  integrityAgainstVerifiedSource: true,
  browserGate: "blocked",
  fallback: "RA11-title-abstract-tfidf-cosine",
  modelDownloaded: false,
  atlasRuntimeChanged: false,
  slices: [],
  cosine: [],
  bytesAccepted: 0
};

const browser = await chromium.launch({headless: true});
try {
  const page = await browser.newPage();
  await page.goto(siteUrl, {waitUntil: "domcontentloaded", timeout: 45_000});
  const actualOrigin = await page.evaluate(() => location.origin);
  if (actualOrigin !== report.urlOrigin) throw new Error("Did not reach canonical Pages origin");
  const localReaderSource = await fs.readFile(
    path.join(repoRoot, "src/core/research-atlas-qwen-vector-range.js"), "utf8"
  );
  // The module source is trusted repository content. Expose exactly its own
  // functions in a classic injected script without fetching/deploying new code.
  const browserSource = localReaderSource.replace(/^export /gm, "") +
    "\nwindow.__RA12_C1 = {fetchVerifiedVectorRange, cosineInt8};\n";
  await page.addScriptTag({content: browserSource});
  const installed = await page.evaluate(() => Boolean(window.__RA12_C1?.fetchVerifiedVectorRange));
  if (!installed) throw new Error("Experimental range reader unavailable in live-origin browser");

  report.attemptedInRealChromium = true;
  const browserResult = await page.evaluate(async ({base, probes, pairs}) => {
    const data = [];
    const slices = [];
    for (const source of probes) {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 15_000);
      const start = performance.now();
      const result = await window.__RA12_C1.fetchVerifiedVectorRange({
        url: base + "/" + source.shard,
        range: {start:source.start, end:source.end, total:source.total, bytes:1024},
        expectedSliceSha256: source.sliceSha256,
        signal: abort.signal
      });
      clearTimeout(timer);
      slices.push({
        cluster: source.cluster,
        ordinal: source.ordinal,
        state: result.state,
        reason: result.reason || null,
        acceptedBytes: result.state === "verified" ? result.byteCount : 0,
        durationMs: Math.round(performance.now() - start),
        sliceSha256: result.state === "verified" ? result.sliceSha256 : null
      });
      data.push(result.state === "verified" ? result.bytes : null);
    }
    const cosine = [];
    for (const pair of pairs) {
      const [a, b] = pair.indices;
      if (data[a] && data[b]) {
        cosine.push({indices: pair.indices, score:window.__RA12_C1.cosineInt8(data[a],data[b])});
      }
    }
    return {slices, cosine};
  }, {base:v4Base, probes:reference.probes, pairs:reference.quantizedCosineReference});
  report.slices = browserResult.slices;
  report.cosine = browserResult.cosine;
  report.bytesAccepted = report.slices.reduce((sum,x) => sum + x.acceptedBytes,0);
  const verified = report.slices.filter(x => x.state === "verified").length;
  if (verified === 6) {
    if (report.cosine.length !== reference.quantizedCosineReference.length) {
      throw new Error("Missing cosine parity comparisons");
    }
    for (let i=0;i<report.cosine.length;i++) {
      const actual = report.cosine[i].score;
      const expected = reference.quantizedCosineReference[i].referenceCosine;
      if (!Number.isFinite(actual) || Math.abs(actual-expected) > 1e-12) {
        throw new Error("Quantized cosine parity failed");
      }
    }
    report.browserGate = "pass";
  } else {
    // A missing or inconsistent browser transport is a BLOCKED capability,
    // never evidence that semantic retrieval should be enabled.
    report.browserGate = "blocked";
    if (report.slices.some(x => x.reason === "slice-sha-mismatch")) {
      report.browserGate = "integrity-failed";
    }
  }
} catch (error) {
  report.browserGate = "blocked";
  report.originProbeError = error instanceof Error ? error.message.slice(0,240) : "browser-probe-failed";
} finally {
  await browser.close();
}

await fs.mkdir(path.dirname(outputFile), {recursive: true});
await fs.writeFile(outputFile, JSON.stringify(report,null,2) + "\n", "utf8");
console.log(JSON.stringify({
  gate:report.browserGate,
  browser:report.attemptedInRealChromium,
  slices:report.slices.map(x => ({state:x.state,reason:x.reason,bytes:x.acceptedBytes})),
  acceptedBytes:report.bytesAccepted,
  cosinePairs:report.cosine.length
}));
if (report.browserGate === "integrity-failed") process.exitCode = 1;
