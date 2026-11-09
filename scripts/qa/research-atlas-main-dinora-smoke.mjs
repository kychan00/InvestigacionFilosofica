import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const BASE =
  process.env.RESEARCH_ATLAS_BASE_URL ||
  "http://127.0.0.1:4173/";

await mkdir("artifacts/research-atlas-ra9", {recursive: true});

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
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto(BASE, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await page.locator("#search-input").fill("Dinora Hernández");
  await page.locator("#search-form button[type=submit]").click();

  await page.waitForFunction(() => {
    const text =
      document.querySelector("#research-atlas-sync-status")
        ?.textContent?.trim() || "";

    return (
      /conexiones semánticas/.test(text) ||
      /respaldo textual/.test(text)
    );
  }, null, {
    timeout: 180000,
    polling: 500
  });

  const syncText =
    await page.locator("#research-atlas-sync-status").innerText();

  assert.match(
    syncText,
    /conexiones semánticas/,
    "Dinora search must finish with the embedded semantic topology"
  );

  await page.locator("#research-view-atlas").click();

  const authorKey = page.locator("#research-atlas-author-key");
  await authorKey.waitFor({state: "visible", timeout: 15000});

  const authorLabel =
    await authorKey.locator("[data-author-key-label]").innerText();

  assert.match(
    authorLabel,
    /Dinora Hernández/i,
    "generic author fallback should name Dinora Hernández"
  );

  const focusButtons =
    page.locator(
      "#research-atlas-list button",
      {hasText: "obra del autor buscado"}
    );

  const focusCount = await focusButtons.count();

  assert.ok(
    focusCount >= 1,
    "Dinora search should mark at least one authored work"
  );

  await focusButtons.first().click();

  const detail = page.locator("#research-atlas-detail");

  const authorTexts =
    await detail.locator(".research-atlas-author-link")
      .allInnerTexts();

  assert.ok(
    authorTexts.some(value =>
      /Dinora Hernández/i.test(value)
    ),
    "selected highlighted work should actually list Dinora Hernández in its authors"
  );

  const recordButton =
    detail.locator("[data-research-atlas-open-record]");

  await recordButton.waitFor({state: "visible", timeout: 10000});
  await recordButton.click();

  const modal = page.locator("#record-modal");
  await modal.waitFor({state: "visible", timeout: 10000});

  assert.equal(
    await modal.evaluate(el => el.classList.contains("hidden")),
    false
  );

  await page.screenshot({
    path: "artifacts/research-atlas-ra9/dinora-qwen-author-focus.png",
    fullPage: true,
    animations: "disabled"
  });

  assert.deepEqual(pageErrors, []);

  process.stdout.write(JSON.stringify({
    status: "pass",
    query: "Dinora Hernández",
    syncText,
    authorLabel,
    focusCount,
    authorTexts,
    recordModalOpened: true
  }, null, 2) + "\n");

  await context.close();
} finally {
  await browser.close();
}
