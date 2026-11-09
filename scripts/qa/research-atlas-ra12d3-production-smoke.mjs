import { chromium } from "playwright";

const PROD =
  "https://kychan00.github.io/InvestigacionFilosofica/research-atlas.html";

function numberFromEs(value) {
  return Number(
    String(value || "")
      .replace(/\./g, "")
      .replace(/,/g, ".")
  );
}

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", error => {
    errors.push("pageerror:" + error.message);
  });
  page.on("console", message => {
    if (message.type() === "error") {
      errors.push("console:" + message.text());
    }
  });

  await page.goto(
    PROD + "?qa=ra12d3-prod-probe",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000
    }
  );

  const assets = await page.evaluate(async () => {
    const js = await fetch(
      "./js/research-atlas.js?qa=ra12d3-production-smoke",
      { cache: "no-store" }
    ).then(response => {
      if (!response.ok) {
        throw new Error("production-js-http-" + response.status);
      }
      return response.text();
    });

    return {
      qwenEnabled:
        /enableQwenTopology\s*:\s*true/.test(js),
      qwenStatus:
        js.includes("Atlas Qwen")
    };
  });

  if (!assets.qwenEnabled || !assets.qwenStatus) {
    throw new Error(
      "production-assets-do-not-contain-ra12d3"
    );
  }

  const vectorProbe = await page.evaluate(async () => {
    const [
      { ResearchAtlasQwenVectorClient },
      { cosineInt8 }
    ] = await Promise.all([
      import("./src/core/research-atlas-qwen-vector-client.js?qa=prod"),
      import("./src/core/research-atlas-qwen-vector-range.js?qa=prod")
    ]);

    const client =
      new ResearchAtlasQwenVectorClient();

    const v4 =
      await client.resolveAndFetch({
        id: "openalex-W4388864320",
        providers: [
          "OpenAlex Philosophy"
        ]
      });

    const overlay =
      await client.resolveAndFetch({
        doi: "10.12795/ambitos.2019.i43.10",
        providers: [
          "Crossref"
        ]
      });

    if (
      v4.resolution.state !==
        "base-direct" ||
      v4.vector.state !==
        "verified" ||
      overlay.resolution.state !==
        "overlay" ||
      overlay.vector.state !==
        "verified"
    ) {
      throw new Error(
        "production-vector-resolution-failed"
      );
    }

    const cosine =
      cosineInt8(
        v4.vector.bytes,
        overlay.vector.bytes
      );

    return {
      cosine,
      v4: {
        cluster:
          v4.vector.cluster,
        ordinal:
          v4.vector.ordinal,
        vectorSha256:
          v4.vector.vectorSha256
      },
      overlay: {
        ordinal:
          overlay.vector.ordinal,
        identity:
          overlay.vector.identity,
        vectorSha256:
          overlay.vector.vectorSha256
      },
      cache:
        client.cacheStats()
    };
  });

  const expectedCosine =
    0.20802329168861472;

  if (
    Math.abs(
      vectorProbe.cosine -
      expectedCosine
    ) >
    1e-12
  ) {
    throw new Error(
      "production-vector-cosine-mismatch:" +
      vectorProbe.cosine
    );
  }

  await page.goto(
    PROD +
      "?q=" +
      encodeURIComponent("Kant") +
      "&mode=federated" +
      "&qa=ra12d3-production-search",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000
    }
  );

  await page.waitForFunction(
    () => {
      const text =
        document
          .querySelector("#ra-status")
          ?.textContent
          ?.trim() ||
        "";

      return (
        text.includes("Atlas Qwen") ||
        text.includes(
          "No fue posible completar esta búsqueda."
        ) ||
        text.includes(
          "No fue posible inicializar el Atlas de Investigación."
        )
      );
    },
    null,
    {
      timeout: 180000,
      polling: 500
    }
  );

  const live = await page.evaluate(() => {
    const status =
      document
        .querySelector("#ra-status")
        ?.textContent
        ?.trim() ||
      "";

    const edgeCount =
      document
        .querySelector("#ra-edge-count")
        ?.textContent
        ?.trim() ||
      "";

    const nodeCount =
      document
        .querySelector("#ra-node-count")
        ?.textContent
        ?.trim() ||
      "";

    const directCount =
      document
        .querySelector("#ra-direct-count")
        ?.textContent
        ?.trim() ||
      "";

    const qwenMatch =
      status.match(
        /([\d.,]+) resultados · Atlas Qwen · ([\d.,]+) conexiones semánticas · ([\d.,]+) obras con vector/
      );

    return {
      status,
      edgeCount,
      nodeCount,
      directCount,
      qwenMatch:
        qwenMatch
          ? {
              results: qwenMatch[1],
              semanticEdges:
                qwenMatch[2],
              vectorWorks:
                qwenMatch[3]
            }
          : null
    };
  });

  if (!live.qwenMatch) {
    throw new Error(
      "production-live-search-did-not-finish-as-qwen:" +
      live.status
    );
  }

  const semanticEdges =
    numberFromEs(
      live.qwenMatch.semanticEdges
    );

  const vectorWorks =
    numberFromEs(
      live.qwenMatch.vectorWorks
    );

  const results =
    numberFromEs(
      live.qwenMatch.results
    );

  if (
    !Number.isFinite(results) ||
    results < 2 ||
    !Number.isFinite(vectorWorks) ||
    vectorWorks < 2 ||
    !Number.isFinite(semanticEdges) ||
    semanticEdges < 1
  ) {
    throw new Error(
      "production-qwen-coverage-insufficient:" +
      JSON.stringify({
        results,
        vectorWorks,
        semanticEdges
      })
    );
  }

  console.log(JSON.stringify({
    status: "pass",
    productionUrl: PROD,
    assets,
    vectorProbe,
    liveSearch: {
      query: "Kant",
      mode: "federated",
      status: live.status,
      results,
      semanticEdges,
      vectorWorks,
      edgeCount: live.edgeCount,
      nodeCount: live.nodeCount,
      directCount: live.directCount
    },
    capturedErrors: errors
  }, null, 2));
} finally {
  await browser.close();
}
