import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const PAGE_URL = new URL("filosofia-latinoamericana.html", BASE).href;
const WIDTHS = [390, 768, 1280];
const ARTIFACTS = "artifacts/latin-american-philosophy";

await mkdir(ARTIFACTS, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"]
});

try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: "light",
      reducedMotion: "reduce"
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));

    const response = await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, "Latin American philosophy page must be served");

    await page.waitForFunction(() => {
      const seeded = document.querySelector("#stat-seeded")?.textContent?.trim();
      return seeded && seeded !== "—";
    });

    const geometry = await page.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
          height: box.height
        };
      };

      return {
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hero: rect(".latam-hero"),
        periodGrid: rect(".period-grid"),
        periodCards: [...document.querySelectorAll(".period-card")].map(card => {
          const box = card.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            width: box.width,
            height: box.height
          };
        }),
        periodCtas: [...document.querySelectorAll(".period-card button")].map(button => {
          const box = button.getBoundingClientRect();
          return { width: box.width, height: box.height };
        }),
        directory: rect("#author-directory"),
        skipLink: Boolean(document.querySelector(".skip-link")),
        dialogLabel: document.querySelector("#author-dialog")?.getAttribute("aria-labelledby")
      };
    });

    assert.ok(
      geometry.scrollWidth <= geometry.viewport + 3,
      "Page must not overflow horizontally at " + width + "px: " + JSON.stringify(geometry)
    );
    assert.equal(geometry.periodCards.length, 4, "Exactly four major period cards are required");
    assert.equal(geometry.skipLink, true, "Skip link must exist");
    assert.equal(geometry.dialogLabel, "author-dialog-title", "Author dialog must be labelled");
    for (const card of geometry.periodCards) {
      assert.ok(card.left >= -2 && card.right <= geometry.viewport + 2,
        "Period card clipped at " + width + "px: " + JSON.stringify(card));
    }
    for (const cta of geometry.periodCtas) {
      assert.ok(cta.height >= 40, "Period CTA should remain a usable target");
    }

    assert.equal(await page.locator("#author-directory .author-card").count(), 80,
      "Initial directory should render one bounded page of authors");

    await page.locator("#author-search").fill("Firmin");
    await page.waitForFunction(() =>
      document.querySelector("#author-directory")?.textContent?.includes("Anténor Firmin")
    );
    assert.equal(await page.locator("#author-directory .author-card").count(), 1,
      "Search should narrow directory to Firmin");

    const firminCard = page.locator("#author-directory .author-card").first();
    assert.equal(await firminCard.getAttribute("type"), "button",
      "Documented author cards should be interactive buttons");
    await firminCard.click();

    await page.locator("#author-dialog[open]").waitFor({ state: "visible" });
    await page.waitForFunction(() =>
      document.querySelector("#author-dialog-title")?.textContent?.includes("Anténor Firmin")
    );

    assert.equal(new URL(page.url()).hash, "#autor-0380",
      "Opening a philosopher dossier must expose a shareable author hash");
    assert.ok(await page.locator("#author-dialog .author-dossier-identity").count() === 1,
      "Dossier must render an identity panel");
    assert.ok(await page.locator("#author-dialog #author-dossier-overview").count() === 1,
      "Dossier must render an archival overview");
    assert.ok(await page.locator("#author-dialog .author-work-card").count() >= 1,
      "Dossier must render complete work cards");
    assert.ok(await page.locator("#author-dialog .author-source-card").count() >= 1,
      "Dossier must render source cards");
    assert.ok(await page.locator("#author-dialog .author-dossier-nav button").count() === 4,
      "Dossier must expose its four reading sections");
    assert.ok((await page.locator("#author-dossier-index").textContent()).includes("#0380"),
      "Dossier must retain the canonical author identifier");

    await page.screenshot({
      path: ARTIFACTS + "/dossier-" + width + "-light.png",
      animations: "disabled"
    });

    await page.locator("#author-dialog-next").click();
    await page.waitForFunction(() =>
      document.querySelector("#author-dossier-index")?.textContent?.includes("#0381")
    );
    assert.equal(new URL(page.url()).hash, "#autor-0381",
      "Next-author navigation must update the shareable hash");

    await page.locator("#author-dialog-prev").click();
    await page.waitForFunction(() =>
      document.querySelector("#author-dossier-index")?.textContent?.includes("#0380")
    );

    await page.locator("#author-dialog-close").click();
    assert.ok(!new URL(page.url()).hash.startsWith("#autor-"),
      "Closing the dossier must restore the previous page hash");

    const seededTotal = Number(
      (await page.locator("#stat-seeded").textContent()).replace(/[^0-9]/g, "")
    );
    assert.ok(seededTotal >= 380, "Seeded corpus should include Anténor Firmin");

    const pendingAuthor = await page.evaluate(async seeded => {
      const response = await fetch("./src/data/latin-american-philosophers-metadata.json");
      const payload = await response.json();
      const inventory = Array.isArray(payload)
        ? payload
        : payload.philosophers || payload.authors || payload.items || [];
      return inventory.find(author => Number(author.id) === seeded + 1) || null;
    }, seededTotal);

    assert.ok(pendingAuthor?.name, "There must be a next canonical author after the seeded corpus");
    await page.locator("#author-search").fill(pendingAuthor.name);
    await page.waitForFunction(name =>
      document.querySelector("#author-directory")?.textContent?.includes(name)
    , pendingAuthor.name);

    const pendingCard = page.locator("#author-directory .author-card").first();
    assert.equal(
      await pendingCard.evaluate(element => element.tagName),
      "ARTICLE",
      "Authors without a bibliographic seed must remain visible but non-interactive"
    );
    assert.ok(
      (await pendingCard.locator(".author-state").textContent()).includes("pendiente"),
      "Authors without works must be explicitly marked as pending"
    );

    await page.locator("#author-search").fill("");
    await page.locator('[data-status-filter="seeded"]').click();
    await page.waitForFunction(expected => {
      const status = document.querySelector("#directory-status")?.textContent || "";
      return status.replace(/[^0-9]/g, "").startsWith(String(expected));
    }, seededTotal);

    await page.locator('[data-period-jump="originarios"]').click();
    await page.locator("#coleccion-originarios").waitFor({ state: "visible" });
    const firstLoaded = await page.locator(".mini-author").count();
    assert.ok(firstLoaded > 0 && firstLoaded <= 40,
      "First period hydration must be bounded to one 40-author batch");

    const periodLoadMore = page.locator("#load-more-period-authors");
    if (await periodLoadMore.isVisible()) {
      await periodLoadMore.click();
      await page.waitForFunction(() => {
        const text = document.querySelector("#periodization-status")?.textContent || "";
        return /80 de \d+ fichas cargadas/.test(text);
      });
      assert.ok(await page.locator(".mini-author").count() > firstLoaded,
        "Loading the next period batch should add authors");
    }

    await page.screenshot({
      path: ARTIFACTS + "/archive-" + width + "-light.png",
      fullPage: true,
      animations: "disabled"
    });

    if (width >= 821) {
      await page.locator('[data-theme-choice="dark"]').click();
      assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    } else {
      await page.locator(".site-menu-toggle").click();
      await page.locator('[data-site-theme="dark"]').click();
      assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
      await page.locator(".site-menu-close").click();
    }

    await page.locator("#author-search").fill("Firmin");
    await page.waitForFunction(() =>
      document.querySelector("#author-directory")?.textContent?.includes("Anténor Firmin")
    );
    await page.locator("#author-directory .author-card").first().click();
    await page.locator("#author-dialog[open]").waitFor({ state: "visible" });
    await page.waitForFunction(() =>
      document.querySelector("#author-dossier-index")?.textContent?.includes("#0380")
    );

    assert.deepEqual(pageErrors, [], "Page must not emit uncaught JS errors");

    await page.screenshot({
      path: ARTIFACTS + "/dossier-" + width + "-dark.png",
      animations: "disabled"
    });

    await page.locator("#author-dialog-close").click();
    await page.locator("#author-search").fill("");

    await page.screenshot({
      path: ARTIFACTS + "/archive-" + width + "-dark.png",
      fullPage: true,
      animations: "disabled"
    });

    await context.close();
  }

  process.stdout.write("Latin American philosophy responsive smoke OK\n");
} finally {
  await browser.close();
}
