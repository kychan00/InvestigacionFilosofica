import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const cases = [
  ["protrepsis-institucional.html", "Protrepsis"],
  ["sincronia-institucional.html", "Sincronía"],
  ["quadripartita-ratio-institucional.html", "Quadripartita Ratio"]
];
const widths = [390, 768, 1280];
const folder = "artifacts/journal-institutional";
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  for (const [filename, name] of cases) {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: 850 },
        colorScheme: "light",
        reducedMotion: "reduce"
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const response = await page.goto(
        new URL("revistas/udg/" + filename, BASE).href,
        { waitUntil: "domcontentloaded" }
      );
      assert.equal(response?.status(), 200, filename + " must be served");
      await page.locator(".ji .book-cover").waitFor({ state: "visible" });
      await page.locator("#equipo").scrollIntoViewIfNeeded();
      assert.ok(await page.locator(".profile").count() >= 1);
      assert.ok(await page.locator('a[href^="mailto:"]').count() >= 1);
      assert.ok(await page.locator(".source-list a").count() >= 4);
      assert.ok(await page.locator('a[href$=".html"]').count() >= 1);
      const geom = await page.evaluate(() => {
        const hero = document.querySelector(".ji .hero");
        const root = document.documentElement;
        const copy = document.querySelector(".hero-copy");
        const art = document.querySelector(".hero-art");
        const c = copy?.getBoundingClientRect();
        const a = art?.getBoundingClientRect();
        return {
          viewport: window.innerWidth,
          width: root.scrollWidth,
          heroWidth: hero?.getBoundingClientRect().width,
          copyRight: c?.right,
          artLeft: a?.left,
          artTop: a?.top,
          copyBottom: c?.bottom
        };
      });
      assert.ok(
        geom.width <= geom.viewport + 3,
        name + " at " + width + "px must not overflow horizontally: " + JSON.stringify(geom)
      );
      assert.ok(geom.heroWidth <= geom.viewport + 3);
      if (width >= 821) {
        assert.ok(geom.copyRight <= geom.artLeft + 2, "hero columns may not overlap");
      } else {
        assert.ok(geom.copyBottom <= geom.artTop + 2, "mobile hero should stack");
      }
      const details = page.locator(".disclosure");
      if (await details.count()) {
        await details.first().locator("summary").click();
        assert.equal(await details.first().getAttribute("open"), "");
      }
      assert.deepEqual(errors, [], name + " JS errors");
      await page.screenshot({
        path: folder + "/" + filename.replace(".html", "") + "-" + width + ".png",
        fullPage: true, animations: "disabled"
      });
      if (width === 390) {
        await page.locator(".site-menu-toggle").click();
        assert.equal(await page.locator("#site-mobile-menu").getAttribute("aria-hidden"), "false");
        await page.locator('[data-site-theme="dark"]').click();
        assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
        await page.locator(".site-menu-close").click();
      }
      await context.close();
    }
  }
  process.stdout.write("Journal institutional responsive smoke OK\n");
} finally {
  await browser.close();
}
