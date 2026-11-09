import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4173/", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  const report = await page.evaluate(async () => {
    const [{ ResearchAtlasQwenVectorClient }, { cosineInt8 }] = await Promise.all([
      import("/src/core/research-atlas-qwen-vector-client.js"),
      import("/src/core/research-atlas-qwen-vector-range.js")
    ]);

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
    if (
      directFirst.resolution.state !== "base-direct" ||
      directFirst.vector.state !== "verified" ||
      directFirst.vector.cluster !== 27 ||
      directFirst.vector.ordinal !== 1660 ||
      directFirst.vector.bytes.length !== 1024
    ) {
      throw new Error("direct-v4-verification-failed");
    }

    const beforeDirectRepeat = requests.length;
    const directSecond = await client.resolveAndFetch(directResult);
    const directRepeatDelta = requests.length - beforeDirectRepeat;
    if (directSecond.vector.state !== "verified" || directRepeatDelta !== 0) {
      throw new Error("direct-cache-miss");
    }

    const beforeAdjacentV4 = requests.length;
    const adjacentV4 = await client.fetchV4Vector(27, 1661);
    const adjacentV4Delta = requests.length - beforeAdjacentV4;
    if (adjacentV4.state !== "verified" || adjacentV4Delta !== 1) {
      throw new Error("v4-tile-cache-miss");
    }

    const overlayFirst = await client.resolveAndFetch(overlayResult);
    if (
      overlayFirst.resolution.state !== "overlay" ||
      overlayFirst.vector.state !== "verified" ||
      overlayFirst.vector.identity !== "doi:10.12795/ambitos.2019.i43.10" ||
      overlayFirst.vector.ordinal !== 0 ||
      overlayFirst.vector.bytes.length !== 1024
    ) {
      throw new Error("overlay-verification-failed");
    }

    const beforeOverlayRepeat = requests.length;
    const overlaySecond = await client.resolveAndFetch(overlayResult);
    const overlayRepeatDelta = requests.length - beforeOverlayRepeat;
    if (overlaySecond.vector.state !== "verified" || overlayRepeatDelta !== 0) {
      throw new Error("overlay-cache-miss");
    }

    const beforeAdjacentOverlay = requests.length;
    const adjacentOverlay = await client.fetchOverlayVector(1);
    const adjacentOverlayDelta = requests.length - beforeAdjacentOverlay;
    if (adjacentOverlay.state !== "verified" || adjacentOverlayDelta !== 1) {
      throw new Error("overlay-context-cache-miss");
    }

    const crossCosine = cosineInt8(
      directFirst.vector.bytes,
      overlayFirst.vector.bytes
    );
    if (!Number.isFinite(crossCosine) || crossCosine < -1 || crossCosine > 1) {
      throw new Error("invalid-cross-cosine");
    }

    const rangeRequests = requests.filter(item => item.range);
    if (!rangeRequests.length) throw new Error("missing-range-requests");

    return {
      status: "pass",
      origin: location.origin,
      direct: {
        state: directFirst.resolution.state,
        cluster: directFirst.vector.cluster,
        ordinal: directFirst.vector.ordinal,
        vectorSha256: directFirst.vector.vectorSha256,
        proof: directFirst.vector.proof
      },
      overlay: {
        state: overlayFirst.resolution.state,
        ordinal: overlayFirst.vector.ordinal,
        identity: overlayFirst.vector.identity,
        vectorSha256: overlayFirst.vector.vectorSha256,
        proof: overlayFirst.vector.proof
      },
      cache: {
        directRepeatDelta,
        adjacentV4Delta,
        overlayRepeatDelta,
        adjacentOverlayDelta,
        stats: client.cacheStats()
      },
      crossCosine,
      totalRequests: requests.length,
      rangeRequests: rangeRequests.length,
      modelDownloaded: false,
      liveOpenAlexQueried: false,
      searchResponseChanged: false,
      rankingChanged: false,
      semanticNeighborEnabled: false,
      atlasRuntimeEnabled: false
    };
  });

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} finally {
  await browser.close();
}
