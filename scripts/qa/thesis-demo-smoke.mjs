/** Browser smoke for new thesis demo (mock 566-record index, no PDF). */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const records = Array.from({ length: 566 }, (_, index) => ({
  id: `thesis:work:demo-${String(index).padStart(5, "0")}`,
  title: index % 2
    ? "Historia cultural y humanidades en la Universidad de Guadalajara"
    : "Fenomenología y lenguaje en la investigación filosófica",
  authors: [index % 2 ? "Juan López" : "María Hernández"],
  directors: ["Ángel Torres"],
  year: 2026 - (index % 15),
  dateQuality: "valid",
  program: index % 2 ? "Maestría en Historia" : "Licenciatura en Filosofía",
  programRef: index % 2 ? "program:udg:historia" : "program:udg:filosofia",
  degree: index % 2 ? "maestria" : "licenciatura",
  unit: "CUCSH",
  abstractExcerpt: "Resumen institucional breve; la tesis se consulta en RIUdeG.",
  keywords: [index % 2 ? "historia" : "fenomenología"],
  sourceUrl: `https://hdl.handle.net/20.500.12104/${84204 + index}`,
  handle: `20.500.12104/${84204 + index}`,
}));

const payload = {
  schemaVersion: "thesis-demo-index-v1",
  sourceRelease: "thesis-effective-corpus-v2",
  totalIncluded: records.length,
  totalCanonical: 27580,
  referenceOnly: true,
  records,
};

await mkdir("artifacts/thesis-demo-ui", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});

try {
  for (const [name, width, height] of [
    ["phone", 390, 844],
    ["tablet", 820, 1180],
    ["desktop", 1440, 900],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.route("**/data/theses/demo-v1/index.json", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    }));
    await page.goto(new URL("tesis.html", BASE).href, { waitUntil: "networkidle" });
    await page.waitForFunction(() =>
      document.querySelector("#thesis-total")?.textContent === "566"
    );
    assert.equal(await page.locator(".td-result").count(), 12);
    assert.match(await page.locator("#thesis-summary").innerText(), /566/);
    assert.equal(await page.locator("#thesis-canonical-total").innerText(), "27,580");
    const initialWidth = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(initialWidth.scroll <= initialWidth.viewport + 2,
      `${name} horizontal overflow: ${JSON.stringify(initialWidth)}`);

    await page.locator("#thesis-query").fill("fenomenologia");
    assert.equal(await page.locator("#thesis-count").innerText(), "283");
    await page.locator("#thesis-query").fill("");
    await page.locator("#thesis-program").selectOption("Maestría en Historia");
    assert.equal(await page.locator("#thesis-count").innerText(), "283");
    await page.locator("#thesis-clear").click();
    assert.equal(await page.locator("#thesis-count").innerText(), "566");
    await page.locator(".td-result details summary").first().click();
    assert.equal(await page.locator(".td-result details[open]").count(), 1);
    const href = await page.locator(".td-primary-action[href]").first().getAttribute("href");
    assert.match(href, /^https:\/\/hdl\.handle\.net\//);
    assert.doesNotMatch(href, /\.pdf(?:\?|$)/i);

    await page.locator('[data-theme-choice="light"]').click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    await page.screenshot({ path: `artifacts/thesis-demo-ui/${name}-light.png`, fullPage: true });
    await page.locator('[data-theme-choice="dark"]').click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    const measured = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(measured.scroll <= measured.viewport + 2,
      `${name} dark overflow: ${JSON.stringify(measured)}`);
    await page.screenshot({ path: `artifacts/thesis-demo-ui/${name}-dark.png`, fullPage: true });
    await context.close();
    console.log(`Thesis demo UI PASS: ${name}, ${width} x ${height}`);
  }
} finally {
  await browser.close();
}
