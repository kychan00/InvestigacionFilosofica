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

  await page.locator("#search-input").fill("Hegel");
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
    "normal Hegel search must finish with the embedded semantic topology"
  );

  await page.locator("#research-view-atlas").click();

  await page.waitForFunction(() =>
    document
      .querySelector("#research-atlas-stage")
      ?.classList
      .contains("is-react-flow") &&
    document.querySelectorAll(
      "#research-atlas-flow .research-atlas-rf-node"
    ).length > 0
  , null, {
    timeout: 30000,
    polling: 100
  });

  const authorKey = page.locator("#research-atlas-author-key");
  await assert.doesNotReject(async () => {
    await authorKey.waitFor({state: "visible", timeout: 15000});
  });

  const authorLabel =
    await authorKey.locator("[data-author-key-label]").innerText();

  assert.match(
    authorLabel,
    /Hegel/i,
    "searched-author legend should name Hegel"
  );

  const focusButtons =
    page.locator(
      "#research-atlas-list button",
      {hasText: "obra del autor buscado"}
    );

  const focusCount = await focusButtons.count();
  assert.ok(
    focusCount >= 1,
    "Hegel search should mark at least one work as authored by Hegel"
  );

  const visualFocusNodes =
    page.locator(
      "#research-atlas-flow .research-atlas-rf-node.is-focus-author"
    );

  const visualFocusCount =
    await visualFocusNodes.count();

  assert.ok(
    visualFocusCount >= 1,
    "React Flow should render Hegel works with the magenta focus-author glow"
  );

  assert.ok(
    await page.locator(
      "#research-atlas-flow .research-atlas-rf-panel"
    ).count() >= 1,
    "React Flow should expose the temporal-plane legend"
  );

  await visualFocusNodes.first().click();

  const detail = page.locator("#research-atlas-detail");
  await detail.locator(".research-atlas-author-link").first()
    .waitFor({state: "visible", timeout: 10000});

  const authorHref =
    await detail.locator(".research-atlas-author-link").first()
      .getAttribute("href");

  assert.ok(authorHref);
  assert.match(authorHref, /view=author/);
  assert.match(authorHref, /author=/);

  const recordButton =
    detail.locator("[data-research-atlas-open-record]");

  await recordButton.waitFor({state: "visible", timeout: 10000});

  const externalLinks =
    detail.locator(
      ".research-atlas-node-action[href]"
    );

  assert.ok(
    await externalLinks.count() >= 1,
    "selected work should expose at least one author/work/DOI hyperlink"
  );

  await recordButton.click();

  const modal = page.locator("#record-modal");
  await modal.waitFor({state: "visible", timeout: 10000});

  assert.equal(
    await modal.evaluate(el => el.classList.contains("hidden")),
    false,
    "Ver ficha from Atlas should open the existing record modal"
  );

  await page.screenshot({
    path: "artifacts/research-atlas-ra9/hegel-qwen-author-links.png",
    fullPage: true,
    animations: "disabled"
  });

  assert.deepEqual(
    pageErrors,
    [],
    "Hegel main-search Atlas should not throw page errors"
  );

  process.stdout.write(JSON.stringify({
    status: "pass",
    query: "Hegel",
    syncText,
    authorLabel,
    focusCount,
    visualFocusCount,
    temporalPlane: true,
    authorHref,
    recordModalOpened: true
  }, null, 2) + "\n");

  await context.close();
} finally {
  await browser.close();
}
