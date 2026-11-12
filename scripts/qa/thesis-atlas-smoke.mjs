import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";

function mockAtlas() {
  const clusters = Array.from({ length: 8 }, (_, index) => ({
    id: `cluster:thesis-atlas-v1:${String(index + 1).padStart(3, "0")}`,
    level: "topic",
    memberCount: index < 6 ? 71 : 70,
    proposedLabels: [{
      label: [
        "fenomenología · cuerpo",
        "historia · memoria",
        "arte · estética",
        "lenguaje · significado",
        "ética · libertad",
        "territorio · patrimonio",
        "cultura · identidad",
        "política · comunidad",
      ][index],
      status: "proposed",
      method: "mean-tfidf-title-terms-v1",
      evidenceTerms: ["tema", String(index + 1)],
    }],
    publishedLabelRef: null,
    keywordEvidence: ["tema", String(index + 1)],
    centroid: {
      x: Math.cos(index / 8 * Math.PI * 2) * .45,
      y: Math.sin(index / 8 * Math.PI * 2) * .45,
    },
    buildRevision: "2026-11-03.t5aa-v1",
  }));

  const nodes = Array.from({ length: 566 }, (_, index) => {
    const angle = index / 566 * Math.PI * 16;
    const radius = .16 + (index % 41) / 41 * .78;
    const cluster = clusters[index % clusters.length];
    const id = `thesis:work:${String(index).padStart(8, "0")}`;
    return {
      id,
      title: index % 2
        ? `Historia, memoria y cultura en Guadalajara ${index}`
        : `Fenomenología, cuerpo y experiencia ${index}`,
      authors: [index % 2 ? "Juan López" : "María Hernández"],
      year: 1990 + index % 35,
      program: index % 2 ? "Maestría en Historia" : "Licenciatura en Filosofía",
      programRef: index % 2 ? "program:historia" : "program:filosofia",
      degree: index % 2 ? "maestria" : "licenciatura",
      unit: "CUCSH",
      keywords: index % 2 ? ["historia", "memoria"] : ["fenomenología", "cuerpo"],
      abstractExcerpt: "Resumen institucional breve.",
      sourceUrl: `https://hdl.handle.net/20.500.12104/${84000 + index}`,
      handle: `20.500.12104/${84000 + index}`,
      topology: {
        purpose: "topology",
        inputContractVersion: "normalized-title-v1",
        inputHash: String(index).padStart(64, "0"),
        dimensions: 64,
        normalization: "l2",
        buildRevision: "2026-11-03.t5aa-v1",
      },
      neighborhood: {
        neighborRefs: Array.from({ length: 8 }, (_, offset) =>
          `thesis:work:${String((index + offset + 1) % 566).padStart(8, "0")}`
        ),
        similarityValues: Array.from({ length: 8 }, (_, offset) => .92 - offset * .035),
        metric: "cosine",
        k: 8,
        indexVersion: "fixture",
        embeddingVersion: "fixture",
        buildRevision: "2026-11-03.t5aa-v1",
      },
      atlas: {
        clusterRefs: [cluster.id],
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        projectionAlgorithm: "tsne",
        projectionVersion: "fixture",
        clusteringAlgorithm: "hdbscan",
        clusteringVersion: "fixture",
        buildRevision: "2026-11-03.t5aa-v1",
      },
    };
  });

  return {
    schemaVersion: "thesis-atlas-index-v1",
    revision: "2026-11-03.t5aa-v1",
    methodStatus: "experimental-not-benchmark-approved",
    referenceOnly: true,
    sourceRelease: "thesis-effective-corpus-v2",
    topologyInputContract: {
      version: "normalized-title-v1",
      fields: ["title"],
      forbiddenFields: ["program", "authors", "abstract"],
    },
    representation: { actualSvdDimensions: 64 },
    neighborhood: { metric: "cosine", k: 8 },
    projection: { algorithm: "tsne" },
    clustering: { algorithm: "hdbscan" },
    evaluation: {
      trustworthinessK8: .941,
      neighborPreservationK8: .487,
      sameProgramNeighborRate: .312,
      clusters: clusters.length,
      outliers: 0,
      benchmarkStatus: "not-yet-human-benchmarked",
    },
    nodes,
    clusters,
  };
}

await mkdir("artifacts/thesis-atlas-ui", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const data = mockAtlas();

try {
  for (const [name, width, height] of [
    ["phone", 390, 844],
    ["tablet", 820, 1180],
    ["desktop", 1440, 920],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.route("**/data/theses/atlas-v1/index.json", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    }));

    const selected = data.nodes[0].id;
    await page.goto(
      new URL(`atlas.html?thesis=${encodeURIComponent(selected)}`, BASE).href,
      { waitUntil: "networkidle" },
    );
    await page.waitForFunction(() =>
      document.querySelector("#atlas-node-count")?.textContent === "566"
    );

    assert.equal(await page.locator("#atlas-cluster-count").innerText(), "8");
    assert.match(await page.locator(".ta-detail-title").innerText(), /Fenomenología/);
    assert.equal(await page.locator(".ta-neighbor").count(), 8);

    const geometry = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
      canvasWidth: document.querySelector("#atlas-canvas")?.getBoundingClientRect().width,
      stageWidth: document.querySelector("#atlas-stage")?.getBoundingClientRect().width,
    }));
    assert.ok(geometry.scroll <= geometry.viewport + 2,
      `${name} horizontal overflow: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.canvasWidth > 250 && geometry.stageWidth > 250);

    await page.locator("#atlas-query").fill("historia memoria");
    await page.waitForTimeout(80);
    assert.equal(await page.locator("#atlas-match-count").innerText(), "283");

    await page.locator("#atlas-overlay").selectOption("degree");
    assert.match(await page.locator("#atlas-overlay-label").innerText(), /grado/);

    const beforeZoom = await page.locator("#atlas-zoom-readout").innerText();
    await page.locator("#atlas-zoom-in").click();
    await page.waitForTimeout(30);
    const afterZoom = await page.locator("#atlas-zoom-readout").innerText();
    assert.notEqual(afterZoom, beforeZoom);

    await page.locator("#atlas-reset-view").click();
    assert.equal(await page.locator("#atlas-match-count").innerText(), "566");

    if (width <= 820) {
      await page.locator(".site-menu-toggle").click();
      await page.locator('[data-site-theme="light"]').click();
      await page.locator(".site-menu-close").click();
    } else {
      await page.locator('[data-theme-choice="light"]').click();
    }
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    await page.screenshot({
      path: `artifacts/thesis-atlas-ui/${name}-light.png`,
      fullPage: true,
    });

    if (width <= 820) {
      await page.locator(".site-menu-toggle").click();
      await page.locator('[data-site-theme="dark"]').click();
      await page.locator(".site-menu-close").click();
    } else {
      await page.locator('[data-theme-choice="dark"]').click();
    }
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.screenshot({
      path: `artifacts/thesis-atlas-ui/${name}-dark.png`,
      fullPage: true,
    });

    await context.close();
    console.log(`Thesis Atlas PASS: ${name} ${width}x${height}`);
  }
} finally {
  await browser.close();
}
