import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const dest = "artifacts/protrepsis-paper";
await mkdir(dest, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const viewports = [
  ["phone", 390, 844],
  ["tablet", 820, 1180],
  ["desktop", 1440, 900]
];

try {
  for (const [name, width, height] of viewports) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
        reducedMotion: "reduce"
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => {
        const u = new URL(route.request().url());
        if (u.origin === new URL(BASE).origin) return route.continue();
        return route.abort();
      });
      const response = await page.goto(
        new URL("revistas/udg/protrepsis.html", BASE).href,
        { waitUntil: "domcontentloaded" }
      );
      assert.equal(response?.status(), 200);
      await page.locator(".pro-book-cover").waitFor({ state: "visible" });
      await page.waitForFunction(() => Number(document.querySelector("#journal-total")?.textContent) === 248, null, { timeout: 15000 });
      assert.equal((await page.locator(".journal-card").count()) > 0, true);
      assert.equal(await page.locator(".pro-editorial-feature-link").count(), 1);
      assert.equal(await page.locator('.pro-button-primary[href="#journal-views"]').count(), 1);
      assert.equal(await page.locator('.pro-button-plain[href="protrepsis-institucional.html"]').count(), 1);
      assert.equal(await page.locator(".pro-book-title").innerText(), "PROTREPSIS");
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      const geom = await page.evaluate(() => {
        const root = document.documentElement;
        const hero = document.querySelector(".journal-hero");
        const title = document.querySelector(".journal-hero h1");
        const art = document.querySelector(".journal-hero-aside");
        const feature = document.querySelector(".pro-editorial-feature");
        const rect = node => node.getBoundingClientRect();
        const h = rect(hero), t = rect(title), a = rect(art), f = rect(feature);
        return {
          viewport: innerWidth,
          scrollWidth: root.scrollWidth,
          titleScroll: title.scrollWidth,
          titleClient: title.clientWidth,
          h,
          t,
          a,
          f,
          paper: getComputedStyle(document.body).getPropertyValue("--jp-bg").trim(),
          serif: getComputedStyle(title).fontFamily
        };
      });
      assert.ok(geom.scrollWidth <= width + 2, name + " " + theme + " horizontal overflow " + JSON.stringify(geom));
      assert.ok(geom.titleScroll <= geom.titleClient + 2, name + " " + theme + " clipped heading " + JSON.stringify(geom));
      assert.ok(geom.t.right <= width + 3, "title outside viewport");
      assert.ok(geom.a.right <= width + 3, "cover outside viewport");
      assert.ok(geom.f.right <= width + 3, "editorial feature outside viewport");
      assert.ok(geom.serif.includes("Cormorant Garamond"), "missing editorial display font");
      assert.equal(geom.paper, theme === "light" ? "#f4eee1" : "#1b201e");
      if (width <= 900) {
        assert.ok(geom.a.top >= geom.t.bottom - 1, "cover must stack below title on phone/tablet");
      } else {
        assert.ok(geom.a.left >= geom.t.right - 2, "desktop cover should stand beside text");
      }
      const menu = page.locator(".site-menu-link");
      for (const filename of [
        "protrepsis-institucional.html",
        "sincronia-institucional.html",
        "quadripartita-ratio-institucional.html"
      ]) {
        assert.equal(await menu.filter({ has: page.locator('a[href*="' + filename + '"]') }).count(), 0);
        assert.equal(await page.locator('.site-menu-link[href*="' + filename + '"]').count(), 0);
      }
      if (width <= 820) {
        await page.locator(".site-menu-toggle").click();
        assert.equal(await page.locator("#site-mobile-menu").getAttribute("aria-hidden"), "false");
        await page.locator(".site-menu-close").click();
      }
      await page.screenshot({
        path: dest + "/revista-" + name + "-" + theme + ".png",
        fullPage: true, animations: "disabled"
      });
      const tabs = page.locator('[data-journal-view="atlas"]');
      await tabs.click();
      assert.equal(await page.locator("#journal-atlas-panel").isVisible(), true);
      await page.locator('[data-journal-view="archive"]').click();
      assert.equal(await page.locator("#journal-archive-panel").isVisible(), true);
      assert.deepEqual(errors, [], name + " " + theme + " page errors");
      await context.close();
    }
  }

  for (const [name, width, height] of viewports) {
    const context = await browser.newContext({
      viewport: { width, height }, colorScheme: "light", reducedMotion: "reduce"
    });
    const page = await context.newPage();
    await page.route("**/*", route => {
      if (new URL(route.request().url()).origin === new URL(BASE).origin) return route.continue();
      return route.abort();
    });
    const response = await page.goto(
      new URL("revistas/udg/protrepsis-institucional.html", BASE).href,
      { waitUntil: "domcontentloaded" }
    );
    assert.equal(response?.status(), 200);
    assert.equal(await page.locator(".person").count(), 69);
    assert.equal(await page.locator(".pro-profile-companion").count(), 1);
    const data = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      source: !!document.querySelector('a[href*="ConsejoEditorial"]'),
      back: document.querySelector(".pro-profile-companion a")?.getAttribute("href"),
      heading: document.querySelector(".ji h1")?.scrollWidth,
      available: document.querySelector(".ji h1")?.clientWidth
    }));
    assert.ok(data.width <= width + 2, "team page horizontal overflow: " + JSON.stringify(data));
    assert.ok(data.heading <= data.available + 3, "team page heading clipped: " + JSON.stringify(data));
    assert.ok(data.source);
    assert.equal(data.back, "protrepsis.html#journal-views");
    await page.screenshot({
      path: dest + "/equipo-" + name + ".png",
      fullPage: true, animations: "disabled"
    });
    await context.close();
  }
  process.stdout.write("Protrepsis editorial-paper responsive smoke OK\n");
} finally {
  await browser.close();
}
