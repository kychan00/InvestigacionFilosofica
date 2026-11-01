import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"]
});
await mkdir("artifacts/author-timeline", { recursive: true });

try {
  for (const width of [320, 375, 390, 768, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: 820 },
      hasTouch: width <= 768,
      isMobile: width <= 768,
      deviceScaleFactor: 1
    });

    await page.route("**/*", route =>
      route.request().url().startsWith(BASE)
        ? route.continue()
        : route.abort()
    );
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
      [...document.styleSheets].some(sheet =>
        sheet.href?.includes("author-timeline.css") && sheet.cssRules.length > 0
      )
    );

    await page.evaluate(async () => {
      const { mountAuthorTimeline } = await import(
        "./src/core/author-timeline-ui.js"
      );
      const container = document.querySelector("#results");
      container.className = "results";
      container.innerHTML =
        '<article class="author-page"><section id="author-timeline-root"></section></article>';
      document.body.classList.add("author-view");
      document.querySelector("#research-workspace").classList.remove("hidden");

      const works = Array.from({ length: 75 }, (_, index) => ({
        id: "W" + index,
        title: "Obra filosófica " + (index + 1),
        year: 1781,
        type: "book"
      }));
      works.push(
        {id: "W76", title: "Estudio con fecha completa", year: 1781,
          publicationDate: "1781-05-15", type: "article"},
        {id: "W77", title: "Ética de 1782", year: 1782, type: "book"},
        {id: "W78", title: "Texto sin fecha", type: "other"}
      );

      const state = {unit:"year",selectedKey:null,visibleLimit:60};
      window.__timelineOpened = null;
      mountAuthorTimeline(
        document.querySelector("#author-timeline-root"),
        works,
        state,
        {onOpenWork:index => {window.__timelineOpened = index;}}
      );
    });

    assert.equal(
      await page.locator(".author-timeline-work").count(),
      60,
      "Initially render only 60 work nodes"
    );
    assert.equal(
      await page.locator(".author-timeline-period").count(),
      3,
      "Year groups should include 1781, 1782, undated"
    );
    const metrics = await page.evaluate(() => {
      const root = document.querySelector("#author-timeline-root");
      const rail = document.querySelector(".author-timeline-periods");
      const r = root.getBoundingClientRect();
      return {
        viewport:innerWidth,
        documentWidth:document.documentElement.scrollWidth,
        rootLeft:r.left,
        rootRight:r.right,
        railScrollWidth:rail.scrollWidth,
        railClientWidth:rail.clientWidth
      };
    });
    assert.ok(metrics.documentWidth <= width + 2, "Document horizontal overflow");
    assert.ok(metrics.rootLeft >= -2 && metrics.rootRight <= width + 2,
      "Timeline extends beyond viewport");

    await page.screenshot({
      path:"artifacts/author-timeline/year-" + width + ".png",
      animations:"disabled"
    });

    await page.getByRole("button", {name:/Mostrar más nodos/}).click();
    assert.equal(await page.locator(".author-timeline-work").count(), 76,
      "Expand all nodes in the selected year");
    await page.locator(".author-timeline-work").first().click();
    assert.equal(await page.evaluate(() => window.__timelineOpened),0,
      "Work node should open the corresponding original work");

    await page.getByRole("button",{name:"Por mes"}).click();
    assert.equal(
      await page.locator(".author-timeline-period").count(),
      4,
      "Month view splits actual month from unknown months"
    );
    assert.equal(
      await page.locator(".author-timeline-period.is-active .author-timeline-date").textContent(),
      "mayo de 1781"
    );
    await page.getByRole("button",{name:/1781 · Mes no registrado/}).click();
    assert.equal(await page.locator(".author-timeline-work").count(),60,
      "Unknown-month group remains navigable without invented months");

    if (width === 375 || width === 1280) {
      await page.screenshot({
        path:"artifacts/author-timeline/month-" + width + ".png",
        animations:"disabled"
      });
    }
    await page.close();
    process.stdout.write("author timeline OK: " + width + "px\n");
  }
} finally {
  await browser.close();
}
