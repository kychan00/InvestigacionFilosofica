import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const BASE =
  process.env.RESEARCH_ATLAS_BASE_URL ||
  "http://127.0.0.1:4173/";

const LOAD_MORE_CLICKS = 3;

await mkdir("artifacts/research-atlas-ra9", {recursive: true});

function parseAtlasStatus(value) {
  const text = String(value || "");
  const match = text.match(
    /(\d+) obras · (\d+) conexiones semánticas · (\d+) con vector/
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
  const consoleWarnings = [];

  page.on("pageerror", error => {
    pageErrors.push(error.message);
  });

  page.on("console", message => {
    if (message.type() === "warning") {
      consoleWarnings.push(message.text());
    }
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
            "",
          stageLabel:
            document
              .querySelector("#research-atlas-stage-label")
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

    return /conexiones semánticas/.test(text);
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
    "initial Hegel search should expose semantic topology"
  );

  const loads = [];
  let previousVectors = initial.vectors;
  let previousEdges = initial.semanticEdges;

  for (let clickIndex = 0; clickIndex < LOAD_MORE_CLICKS; clickIndex += 1) {
    const loadMore =
      page.locator(".fetch-more").first();

    await loadMore.waitFor({
      state: "visible",
      timeout: 15000
    });

    const beforeCount =
      await page.evaluate(() =>
        (window.__atlasTopologyReady || []).length
      );

    await loadMore.click();

    await page.waitForFunction(
      ({beforeCount}) =>
        (window.__atlasTopologyReady || []).length > beforeCount,
      {beforeCount},
      {
        timeout: 240000,
        polling: 500
      }
    );

    const ready =
      await page.evaluate(() =>
        (window.__atlasTopologyReady || []).at(-1)
      );

    assert.equal(
      ready?.detail?.reason,
      "load-more",
      "every expanded batch must report load-more topology completion"
    );

    assert.ok(
      ready?.detail?.qwen,
      "every repeated load-more must finish with Qwen diagnostics"
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
      ready.detail.qwen.maximumEdges <= 200,
      "expanded topology must respect the D3 engine ceiling"
    );

    assert.ok(
      ready.detail.qwen.vectorsVerified >= previousVectors,
      "verified-vector coverage must not regress after repeated load-more"
    );

    assert.ok(
      ready.detail.qwen.semanticEdgesAdded >= previousEdges,
      "semantic-edge coverage must not regress after repeated load-more"
    );

    assert.match(
      ready.stageLabel || "",
      /Semántica · \d+ conexiones · \d+ obras con vector · lote \d+/,
      "the visible Atlas stage must keep showing semantic counts"
    );

    assert.doesNotMatch(
      ready.stageLabel || "",
      /Respaldo RA11/,
      "repeated load-more must not silently fall back after crossing the edge ceiling"
    );

    previousVectors =
      ready.detail.qwen.vectorsVerified;

    previousEdges =
      ready.detail.qwen.semanticEdgesAdded;

    loads.push({
      click: clickIndex + 1,
      ...ready.detail,
      buttonAtReady: ready.buttonAtReady,
      stageLabel: ready.stageLabel
    });

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
  }

  const finalStatus =
    await page.locator("#status").innerText();

  const finalStageLabel =
    await page.locator("#research-atlas-stage-label").innerText();

  assert.match(
    finalStatus,
    /conexiones semánticas/,
    "main status must finish on semantic topology after repeated load-more"
  );

  assert.match(
    finalStageLabel,
    /Semántica · \d+ conexiones · \d+ obras con vector · lote \d+/,
    "Atlas must expose persistent connection counts after repeated load-more"
  );

  assert.equal(
    consoleWarnings.some(value =>
      value.includes("Atlas Qwen no disponible")
    ),
    false,
    "repeated load-more must not trigger the Qwen fallback warning"
  );

  assert.deepEqual(
    pageErrors,
    [],
    "repeated load-more semantic topology should not throw page errors"
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
    loads,
    finalStatus,
    finalStageLabel,
    consoleWarnings
  }, null, 2) + "\n");

  await context.close();
} finally {
  await browser.close();
}
