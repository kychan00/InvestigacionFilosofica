import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const BASE =
  process.env.RESEARCH_ATLAS_BASE_URL ||
  "http://127.0.0.1:4173/";

await mkdir("artifacts/research-atlas-ra9", {recursive: true});

function parseAtlasStatus(value) {
  const text = String(value || "");
  const match = text.match(
    /(\d+) obras · (\d+) conexiones Qwen · (\d+) con vector/
  );
  return match
    ? {
        works: Number(match[1]),
        semanticEdges: Number(match[2]),
        vectors: Number(match[3])
      }
    : null;
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"]
});

try {
  const context = await browser.newContext({
    viewport: {width: 1440, height: 1000},
    deviceScaleFactor: 1
  });

  const page = await context.newPage();
  const pageErrors = [];

  page.on("pageerror", error => {
    pageErrors.push(error.message);
  });

  await page.addInitScript(() => {
    window.__atlasTopologyReady = [];

    window.addEventListener(
      "research-atlas:topology-ready",
      event => {
        const button =
          document.querySelector(".fetch-more");

        window.__atlasTopologyReady.push({
          detail:
            JSON.parse(
              JSON.stringify(event.detail)
            ),
          buttonAtReady: button
            ? {
                disabled:
                  Boolean(button.disabled),
                text:
                  button.textContent?.trim() || ""
              }
            : null,
          syncStatus:
            document
              .querySelector("#research-atlas-sync-status")
              ?.textContent
              ?.trim() ||
            ""
        });
      }
    );
  });

  await page.goto(BASE, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await page.locator("#search-input").fill("Hegel");
  await page.locator("#search-form button[type=submit]").click();

  await page.waitForFunction(() => {
    const text =
      document
        .querySelector("#research-atlas-sync-status")
        ?.textContent
        ?.trim() ||
      "";

    return /conexiones Qwen/.test(text);
  }, null, {
    timeout: 180000,
    polling: 500
  });

  const initialText =
    await page
      .locator("#research-atlas-sync-status")
      .innerText();

  const initial =
    parseAtlasStatus(initialText);

  assert.ok(
    initial,
    "initial Hegel search should expose Qwen topology"
  );

  const loadMore =
    page.locator(".fetch-more").first();

  await loadMore.waitFor({
    state: "visible",
    timeout: 15000
  });

  await loadMore.click();

  await page.waitForFunction(() => {
    return (
      window.__atlasTopologyReady || []
    ).some(item =>
      item?.detail?.reason === "load-more"
    );
  }, null, {
    timeout: 240000,
    polling: 500
  });

  const ready =
    await page.evaluate(() =>
      (window.__atlasTopologyReady || [])
        .find(item =>
          item?.detail?.reason === "load-more"
        )
    );

  assert.ok(
    ready?.detail?.qwen,
    "load-more must finish with Qwen diagnostics"
  );

  assert.equal(
    ready.buttonAtReady?.disabled,
    true,
    "Cargar más must remain disabled until topology-ready"
  );

  assert.match(
    ready.buttonAtReady?.text || "",
    /Conectando semánticamente/,
    "button must show semantic connection phase when D3 finishes"
  );

  assert.ok(
    ready.detail.qwen.maximumEdges > 36,
    "expanded load-more topology should raise the original 36-edge budget"
  );

  assert.ok(
    ready.detail.qwen.vectorsVerified >=
      initial.vectors,
    "expanded topology must preserve or increase verified-vector coverage"
  );

  await page.waitForFunction(() => {
    const button =
      document.querySelector(".fetch-more");

    return (
      !button ||
      (
        !button.disabled &&
        /Cargar más resultados/.test(
          button.textContent || ""
        )
      )
    );
  }, null, {
    timeout: 15000,
    polling: 200
  });

  const finalStatus =
    await page.locator("#status").innerText();

  assert.match(
    finalStatus,
    /conexiones Qwen|Atlas actualizado con respaldo textual/,
    "main status must not report load-more complete before Atlas completion"
  );

  assert.deepEqual(
    pageErrors,
    [],
    "load-more semantic topology should not throw page errors"
  );

  await page.screenshot({
    path: "artifacts/research-atlas-ra9/hegel-load-more-semantic.png",
    fullPage: true,
    animations: "disabled"
  });

  process.stdout.write(JSON.stringify({
    status: "pass",
    query: "Hegel",
    initial,
    topologyReady: ready.detail,
    buttonAtReady: ready.buttonAtReady,
    finalStatus
  }, null, 2) + "\n");

  await context.close();
} finally {
  await browser.close();
}
