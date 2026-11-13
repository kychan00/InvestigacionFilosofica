import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
await mkdir("artifacts/journal-pages", { recursive: true });

const records = [
  {
    id: "cucsh:p1", sourceId: "p1", journal: "Protrepsis",
    title: "Ética, responsabilidad y vida común", year: 2024, language: "es",
    authors: [{ name: "Ana Pérez" }], doi: "10.32870/prot.i20.279",
    abstract: "La ética y la responsabilidad articulan problemas de justicia y vida común.",
    subjects: ["Ética", "Responsabilidad"],
    urls: { canonical: "https://example.org/p1" }
  },
  {
    id: "cucsh:p2", sourceId: "p2", journal: "Protrepsis",
    title: "Justicia política y responsabilidad", year: 2021, language: "es",
    authors: [{ name: "Luis Gómez" }], doi: "10.32870/prot.i20.280",
    abstract: "Discusión sobre justicia política, responsabilidad y comunidad.",
    subjects: ["Filosofía política"],
    urls: { canonical: "https://example.org/p2" }
  },
  {
    id: "cucsh:p3", sourceId: "p3", journal: "Protrepsis",
    title: "Lenguaje y verdad", year: 2018, language: "en",
    authors: [{ name: "María López" }], doi: "10.32870/prot.i18.267",
    abstract: "Lenguaje, significado y verdad en la discusión filosófica.",
    subjects: ["Lenguaje"],
    urls: { canonical: "https://example.org/p3" }
  },
  {
    id: "cucsh:p4", sourceId: "p4", journal: "Protrepsis",
    title: "La causalidad ¿Delirios de la mente?", year: 2011, language: "es",
    authors: [{ name: "René Rivera López" }], doi: "10.32870/prot.i1.11",
    issue: "1", issueLabel: "1", issueNumbers: [1], issueNumber: 1,
    historicalSource: "OpenAlex",
    abstract: "Problematización filosófica del principio de causalidad.",
    subjects: ["Filosofía"],
    urls: { canonical: "https://example.org/p4" }
  },
  {
    id: "cucsh:s1", sourceId: "s1", journal: "Sincronía", issueNumber: 90,
    title: "Memoria, cultura y sociedad", year: 2026, language: "es",
    authors: [{ name: "Diana Ruiz" }], doi: null,
    abstract: "Memoria cultural y sociedad se cruzan en prácticas contemporáneas.",
    subjects: ["Cultura", "Memoria"],
    urls: { canonical: "https://example.org/s1" }
  },
  {
    id: "cucsh:s2", sourceId: "s2", journal: "Sincronía", issueNumber: 90,
    title: "Cultura digital y memoria", year: 2026, language: "es",
    authors: [{ name: "Diana Ruiz" }], doi: null,
    abstract: "Tecnología digital, cultura y memoria como espacios de relación.",
    subjects: ["Tecnología", "Cultura"],
    urls: { canonical: "https://example.org/s2" }
  },
  {
    id: "cucsh:q1", sourceId: "q1", journal: "Quadripartita Ratio",
    title: "Argumentación, lógica y diálogo", year: 2024, language: "es",
    authors: [{ name: "Carlos Vega" }], doi: "10.32870/qr.v9i17.185",
    abstract: "Argumentación y lógica formal en contextos de diálogo filosófico.",
    subjects: ["Argumentación", "Lógica"],
    urls: { canonical: "https://example.org/q1" }
  },
  {
    id: "cucsh:q2", sourceId: "q2", journal: "Quadripartita Ratio",
    title: "Razones y estructuras argumentativas", year: 2019, language: "es",
    authors: [{ name: "Irene Mora" }], doi: "10.32870/qr.v9i17.186",
    abstract: "Estructuras de argumentación, razones e inferencias.",
    subjects: ["Argumentación"],
    urls: { canonical: "https://example.org/q2" }
  }
];

const pages = [
  ["protrepsis", "revistas/udg/protrepsis.html", 4],
  ["sincronia", "revistas/udg/sincronia.html", 2],
  ["quadripartita", "revistas/udg/quadripartita-ratio.html", 2]
];

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

try {
  for (const [journal, path, expected] of pages) {
    for (const [name, width, height] of [
      ["phone", 390, 844],
      ["tablet", 820, 1180],
      ["desktop", 1440, 900]
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1
      });
      const page = await context.newPage();
      const external = [];

      page.on("request", request => {
        const url = new URL(request.url());
        if (url.origin !== new URL(BASE).origin) external.push(url.href);
      });

      await page.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith("/src/data/cucsh-filosofia.json")) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ provider: "CUCSH Filosofía", records })
          });
        }
        if (url.origin === new URL(BASE).origin) return route.continue();
        return route.abort();
      });

      await page.goto(new URL(path, BASE).href, { waitUntil: "networkidle" });
      await page.waitForFunction(expectedCount =>
        Number(document.querySelector("#journal-total")?.textContent) === expectedCount,
        expected
      );

      assert.equal(await page.locator(".journal-card").count(), expected);
      assert.ok(await page.locator(".taxonomy-chip").count() >= 1);
      assert.ok(await page.locator(".journal-card-byline .journal-author-link").count() >= 1);
      const authorHref = await page.locator(".journal-card-byline .journal-author-link").first().getAttribute("href");
      assert.ok(authorHref && authorHref.includes("view=author") && authorHref.includes("author="));
      const cardGap = await page.locator(".journal-card-grid").evaluate(element =>
        Number.parseFloat(getComputedStyle(element).gap || "0")
      );
      assert.ok(cardGap >= 14, journal + " " + name + " cards need breathing room");
      assert.ok(await page.locator("#journal-category option").count() >= 2);
      assert.ok(await page.locator("#journal-issue option").count() >= 2);
      assert.ok(await page.locator(".issue-taxonomy-chip").count() >= 1);
      if (journal === "protrepsis") {
        const historicalIssueOneCount = await page
          .locator(".issue-taxonomy-chip")
          .evaluateAll(elements =>
            elements.filter(element =>
              element.querySelector("span")?.textContent?.trim() === "Núm. 1"
            ).length
          );
        assert.equal(
          historicalIssueOneCount,
          1,
          "Protrepsis must expose historical issue 1 in the editorial map"
        );
        assert.equal(
          (await page.locator("#journal-year-span").innerText()).trim(),
          "2011—2024",
          "Protrepsis fixture must preserve the historical year span"
        );
      }
      if (width <= 820) {
        if (journal === "protrepsis") {
          await page.locator('[data-pro-explorer-tab="filters"]').click();
          assert.equal(await page.locator("#pro-explorer-filters").isVisible(),true);
          assert.equal(await page.locator(".journal-filter-body").isVisible(),true);
        } else if (journal === "sincronia") {
          await page.locator('[data-sn-explorer-tab="filters"]').click();
          assert.equal(await page.locator("#sn-explorer-filters").isVisible(),true);
          assert.equal(await page.locator("#journal-filter-toggle").getAttribute("aria-expanded"), "true");
          assert.equal(await page.locator(".journal-filter-body").isVisible(),true);
        } else {
          assert.equal(await page.locator("#journal-filter-toggle").getAttribute("aria-expanded"), "false");
          assert.equal(await page.locator(".journal-filter-body").isVisible(), false);
          await page.locator("#journal-filter-toggle").click();
          assert.equal(await page.locator(".journal-filter-body").isVisible(), true);
        }
      }
      assert.equal(await page.locator("#journal-qwen-toggle").getAttribute("aria-pressed"), "false");

      await page.locator('[data-journal-view="atlas"]').click();
      await page.waitForFunction(() =>
        document.querySelector("#journal-atlas-status")?.textContent.includes("nodos")
      );
      assert.match(await page.locator("#journal-atlas-status").innerText(), /0 vectores Qwen/);
      // External fonts are intentional visual assets for the Protrepsis paper
      // identity; they are not semantic searches or Qwen requests.
      const unexpectedExternal = external.filter(url => {
        const host = new URL(url).hostname;
        return host !== "fonts.googleapis.com" && host !== "fonts.gstatic.com";
      });
      assert.equal(unexpectedExternal.length, 0, "Unexpected network/Qwen request: " + unexpectedExternal.join(", "));
      const edgeCount = Number(await page.locator("#journal-atlas-canvas").getAttribute("data-atlas-edges"));
      const issueCount = Number(await page.locator("#journal-atlas-canvas").getAttribute("data-atlas-issues"));
      const relatedCount = await page.locator(".atlas-related-item").count();
      assert.ok(relatedCount >= 1, journal + " selected node must expose semantic relations");
      assert.ok(await page.locator(".atlas-relation-badge.method").count() >= 1);
      assert.ok(await page.locator(".atlas-relation-badge.score").count() >= 1);
      assert.match(await page.locator(".atlas-related-header").innerText(), /RELACIONES SEMÁNTICAS/i);
      if (expected >= 3) assert.ok(edgeCount >= 2, journal + " must keep multiple semantic neighbors");
      else assert.ok(edgeCount >= 1, journal + " must keep at least one semantic neighbor");
      assert.ok(issueCount >= 1, journal + " must expose editorial issue clusters");
      if (journal === "protrepsis") assert.ok(issueCount >= 2, "Protrepsis fixture must split issue colors");

      const selectedTitleBefore = await page.locator("#journal-atlas-detail h3").innerText();
      await page.locator(".atlas-related-focus").first().click();
      await page.waitForTimeout(40);
      const selectedTitleAfter = await page.locator("#journal-atlas-detail h3").innerText();
      assert.notEqual(selectedTitleAfter, selectedTitleBefore, journal + " related card must navigate to its node");

      const canvasLocator = page.locator("#journal-atlas-canvas");
      await canvasLocator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(60);
      const canvas = await canvasLocator.boundingBox();
      assert.ok(canvas && canvas.width > 250 && canvas.height > 350);

      if (width <= 820) {
        assert.equal(
          await canvasLocator.getAttribute("data-atlas-touch-mode"),
          "pan-pinch",
          journal + " " + name + " must expose touch pan/pinch mode"
        );
        assert.equal(
          await page.locator('[data-atlas-action="pan-right"]').isVisible(),
          false,
          journal + " " + name + " must hide directional controls"
        );
        assert.equal(
          await page.locator('[data-atlas-action="zoom-in"]').isVisible(),
          false,
          journal + " " + name + " must hide zoom controls"
        );
        assert.equal(
          await page.locator('[data-atlas-action="fit"]').isVisible(),
          false,
          journal + " " + name + " must hide fit controls"
        );
        assert.equal(
          await page.locator('[data-atlas-action="reset"]').isVisible(),
          false,
          journal + " " + name + " must hide reorder controls"
        );
        assert.equal(
          await page.locator("#journal-qwen-toggle").isVisible(),
          true,
          journal + " " + name + " must keep Qwen control visible"
        );
        const touchAction = await canvasLocator.evaluate(element => getComputedStyle(element).touchAction);
        assert.equal(touchAction, "none", journal + " " + name + " canvas must own touch gestures");
      } else {
        const zoomBefore = Number(await canvasLocator.getAttribute("data-atlas-zoom"));
        await page.locator('[data-atlas-action="zoom-in"]').click();
        await page.waitForTimeout(40);
        const zoomAfter = Number(await canvasLocator.getAttribute("data-atlas-zoom"));
        assert.ok(zoomAfter > zoomBefore, journal + " desktop zoom control must change the view");

        const panBeforeX = Number(await canvasLocator.getAttribute("data-atlas-pan-x"));
        const panBeforeY = Number(await canvasLocator.getAttribute("data-atlas-pan-y"));
        await page.locator('[data-atlas-action="pan-right"]').click();
        await page.locator('[data-atlas-action="pan-down"]').click();
        await page.waitForTimeout(60);
        const panAfterX = Number(await canvasLocator.getAttribute("data-atlas-pan-x"));
        const panAfterY = Number(await canvasLocator.getAttribute("data-atlas-pan-y"));
        assert.ok(
          panAfterX > panBeforeX && panAfterY > panBeforeY,
          journal + " desktop pan controls must move the Atlas"
        );
      }

      await page.locator('[data-journal-view="archive"]').click();
      if (journal === "protrepsis") {
        await page.locator('[data-pro-explorer-tab="filters"]').click();
      } else if (journal === "sincronia") {
        await page.locator('[data-sn-explorer-tab="filters"]').click();
      }
      await page.locator("#journal-query").fill(journal === "protrepsis" ? "verdad" : journal === "sincronia" ? "digital" : "inferencias");
      await page.waitForTimeout(30);
      assert.equal(await page.locator(".journal-card").count(), 1);

      if (width <= 820) {
        await page.locator(".site-menu-toggle").click();
        const journalHref = await page.locator('.site-menu-link[href*="/revistas/udg/"]').first().getAttribute("href");
        assert.ok(journalHref && journalHref.includes("/revistas/udg/"));
        await page.locator('[data-site-theme="dark"]').click();
        await page.locator(".site-menu-close").click();
      } else {
        await page.locator('[data-theme-choice="dark"]').click();
      }
      assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");

      const geometry = await page.evaluate(() => ({
        viewport: innerWidth,
        scroll: document.documentElement.scrollWidth,
        accent: getComputedStyle(document.documentElement).getPropertyValue("--journal-accent").trim()
      }));
      assert.ok(geometry.scroll <= geometry.viewport + 2, journal + " " + name + " horizontal overflow");
      assert.ok(geometry.accent.length > 0);

      if (name !== "tablet") {
        await page.screenshot({
          path: "artifacts/journal-pages/" + journal + "-" + name + ".png",
          fullPage: true,
          animations: "disabled"
        });
      }

      await context.close();
    }
  }

  process.stdout.write("Journal pages responsive smoke OK\n");
} finally {
  await browser.close();
}
