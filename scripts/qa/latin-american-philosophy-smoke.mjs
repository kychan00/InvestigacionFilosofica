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

async function settlePaint(page) {
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: "light",
      reducedMotion: "reduce"
    });
    const page = await context.newPage();

    await page.route("**/api.crossref.org/v1/works**", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          message: {
            items: [
              {
                title: ["De l'égalité des races humaines: anthropologie positive"],
                author: [{ given: "Anténor", family: "Firmin" }],
                published: { "date-parts": [[1885]] },
                type: "book",
                URL: "https://example.test/firmin-1885"
              },
              {
                title: ["Haïti au point de vue politique, administratif et économique"],
                author: [{ given: "Anténor", family: "Firmin" }],
                published: { "date-parts": [[1891]] },
                type: "book",
                URL: "https://example.test/firmin-1891"
              },
              {
                title: ["M. Roosevelt, président des États-Unis, et la République d'Haïti"],
                author: [{ given: "Anténor", family: "Firmin" }],
                published: { "date-parts": [[1905]] },
                type: "book",
                URL: "https://example.test/firmin-1905"
              },
              {
                title: ["Lettres de Saint-Thomas: études sociologiques, historiques et littéraires"],
                author: [{ given: "Anténor", family: "Firmin" }],
                published: { "date-parts": [[1910]] },
                type: "book",
                URL: "https://example.test/firmin-1910"
              }
            ]
          }
        })
      });
    });

    await page.route("**/archive.org/advancedsearch.php**", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ response: { numFound: 0, docs: [] } })
      });
    });

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
        mobileToolbar: rect(".site-mobile-toolbar"),
        ornament: rect(".ornament-frame"),
        mobileSubnav: rect(".latam-mobile-sections"),
        mobileSubnavDisplay: getComputedStyle(document.querySelector(".latam-mobile-sections")).display,
        mobileSubnavLinks: [...document.querySelectorAll(".latam-mobile-sections a")].map(link => {
          const box = link.getBoundingClientRect();
          return { text: link.textContent.trim(), width: box.width, height: box.height };
        }),
        hero: rect(".latam-hero"),
        heroIllustration: rect(".hero-illustration"),
        heroTitle: rect(".hero-copy h1"),
        heroActions: [...document.querySelectorAll(".hero-actions a")].map(link => {
          const box = link.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
        }),
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

    if (width <= 820) {
      assert.equal(geometry.mobileSubnavDisplay, "flex",
        "Archive section navigation must remain visible in portrait/tablet mobile layouts");
      assert.deepEqual(
        geometry.mobileSubnavLinks.map(link => link.text),
        ["Periodos", "Con obra", "Autores", "Acerca"],
        "Mobile archive navigation must expose the same four destinations as desktop"
      );
      assert.ok(
        geometry.mobileSubnavLinks.every(link => link.height >= 44),
        "Mobile archive navigation links must remain comfortably tappable"
      );
      assert.ok(
        geometry.ornament.top <= geometry.mobileToolbar.bottom + 3,
        "Archive content must not duplicate the global toolbar gap: " + JSON.stringify({
          toolbar: geometry.mobileToolbar,
          ornament: geometry.ornament
        })
      );
      assert.ok(
        geometry.mobileSubnav.top >= geometry.ornament.bottom - 2,
        "Mobile archive subnavigation should follow the ornament strip"
      );
    } else {
      assert.equal(geometry.mobileSubnavDisplay, "none",
        "Mobile archive subnavigation should not duplicate the desktop navigation");
    }

    assert.ok(
      geometry.heroTitle.left >= -2 && geometry.heroTitle.right <= geometry.viewport + 2,
      "Hero title must remain fully inside the viewport at " + width + "px: " + JSON.stringify(geometry.heroTitle)
    );

    if (width <= 620) {
      assert.ok(
        geometry.heroIllustration.height <= 250,
        "Mobile hero illustration should stay compact: " + JSON.stringify(geometry.heroIllustration)
      );
      assert.equal(geometry.heroActions.length, 2, "Mobile hero must expose both primary actions");
      assert.ok(
        geometry.heroActions[1].top >= geometry.heroActions[0].bottom - 1,
        "Mobile hero actions must stack vertically instead of squeezing side by side"
      );
      assert.ok(
        geometry.heroActions.every(action => action.right <= geometry.viewport + 2 && action.left >= -2),
        "Mobile hero actions must stay inside viewport"
      );
    }
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
    assert.ok(await page.locator("#author-dialog .author-dossier-nav button").count() === 5,
      "Dossier must expose its five reading sections");
    assert.equal(
      await page.locator("#author-dialog .author-dossier-timeline-item").count(),
      await page.locator("#author-dialog .author-work-card").count(),
      "Dossier chronology must represent every documented work"
    );

    await page.locator('[data-dossier-target="author-dossier-research-section"]').click();
    await page.locator("#author-dossier-research-section").waitFor({ state: "visible" });
    await page.locator("[data-live-author-search]").click();
    await page.waitForFunction(() =>
      document.querySelectorAll(".author-live-result").length >= 4
    );

    assert.ok(
      (await page.locator(".author-live-result").first().textContent()).includes("De l'égalité des races humaines"),
      "Federated author search must surface the mocked Firmin work"
    );
    assert.ok(
      (await page.locator(".author-live-result-head strong").first().textContent()).includes("YA ESTÁ EN LA FICHA"),
      "Federated result matching a curated title must be recognized as already curated"
    );

    const motorGeometry = await page.evaluate(() => {
      const reader = document.querySelector(".author-dossier-reader");
      const section = document.querySelector("#author-dossier-research-section");
      const results = document.querySelector(".author-live-results");
      return {
        readerClient: reader?.clientWidth || 0,
        readerScroll: reader?.scrollWidth || 0,
        sectionClient: section?.clientWidth || 0,
        sectionScroll: section?.scrollWidth || 0,
        resultsClient: results?.clientWidth || 0,
        resultsScroll: results?.scrollWidth || 0
      };
    });

    assert.ok(
      motorGeometry.readerScroll <= motorGeometry.readerClient + 2,
      "Dossier reader must not overflow horizontally after federated results: " + JSON.stringify(motorGeometry)
    );
    assert.ok(
      motorGeometry.sectionScroll <= motorGeometry.sectionClient + 2 &&
      motorGeometry.resultsScroll <= motorGeometry.resultsClient + 2,
      "Motor section must remain within its reading column: " + JSON.stringify(motorGeometry)
    );

    await settlePaint(page);
    await page.screenshot({
      path: ARTIFACTS + "/dossier-" + width + "-motor-light.png",
      animations: "disabled"
    });

    assert.ok((await page.locator("#author-dossier-index").textContent()).includes("#0380"),
      "Dossier must retain the canonical author identifier");

    await settlePaint(page);
    await page.screenshot({
      path: ARTIFACTS + "/dossier-" + width + "-light.png",
      animations: "disabled"
    });

    await page.locator('[data-dossier-target="author-dossier-works-section"]').click();
    await page.locator("#author-dossier-works-section").waitFor({ state: "visible" });
    await settlePaint(page);
    await page.screenshot({
      path: ARTIFACTS + "/dossier-" + width + "-works-light.png",
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

    const inventoryState = await page.evaluate(async () => {
      const response = await fetch("./src/data/latin-american-philosophers-metadata.json");
      const payload = await response.json();
      const inventory = Array.isArray(payload)
        ? payload
        : payload.philosophers || payload.authors || payload.items || [];
      const last = inventory[inventory.length - 1] || null;
      return {
        total: inventory.length,
        lastName: last?.name || null
      };
    });

    assert.equal(
      seededTotal,
      inventoryState.total,
      "Completed archive must have a bibliographic record for every canonical author"
    );
    assert.equal(
      await page.locator('[data-status-filter="pending"]').count(),
      0,
      "Completed archive must not expose a pending-author filter"
    );
    assert.ok(inventoryState.lastName, "Canonical inventory must expose its last author");
    await page.locator("#author-search").fill(inventoryState.lastName);
    await page.waitForFunction(name =>
      document.querySelector("#author-directory")?.textContent?.includes(name)
    , inventoryState.lastName);

    const finalCard = page.locator("#author-directory .author-card").first();
    assert.equal(
      await finalCard.evaluate(element => element.tagName),
      "BUTTON",
      "Every canonical author must open a bibliographic dossier after full coverage"
    );
    assert.ok(
      (await finalCard.locator(".author-state").textContent()).includes("ficha bibliográfica"),
      "Completed author cards must be marked as bibliographic dossiers"
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
        return /80 de [\d,.]+ fichas cargadas/.test(text);
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

    await settlePaint(page);
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
