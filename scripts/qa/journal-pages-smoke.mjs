import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
await mkdir("artifacts/journal-pages", { recursive: true });

const records = [
  {
    id: "cucsh:p1", sourceId: "p1", journal: "Protrepsis",
    title: "Ética, responsabilidad y vida común", year: 2024, language: "es",
    authors: [{ name: "Ana Pérez" }], doi: "10.32870/example.p1",
    abstract: "La ética y la responsabilidad articulan problemas de justicia y vida común.",
    subjects: ["Ética", "Responsabilidad"],
    urls: { canonical: "https://example.org/p1" }
  },
  {
    id: "cucsh:p2", sourceId: "p2", journal: "Protrepsis",
    title: "Justicia política y responsabilidad", year: 2021, language: "es",
    authors: [{ name: "Luis Gómez" }], doi: null,
    abstract: "Discusión sobre justicia política, responsabilidad y comunidad.",
    subjects: ["Filosofía política"],
    urls: { canonical: "https://example.org/p2" }
  },
  {
    id: "cucsh:p3", sourceId: "p3", journal: "Protrepsis",
    title: "Lenguaje y verdad", year: 2018, language: "en",
    authors: [{ name: "María López" }], doi: null,
    abstract: "Lenguaje, significado y verdad en la discusión filosófica.",
    subjects: ["Lenguaje"],
    urls: { canonical: "https://example.org/p3" }
  },
  {
    id: "cucsh:s1", sourceId: "s1", journal: "Sincronía",
    title: "Memoria, cultura y sociedad", year: 2023, language: "es",
    authors: [{ name: "Diana Ruiz" }], doi: null,
    abstract: "Memoria cultural y sociedad se cruzan en prácticas contemporáneas.",
    subjects: ["Cultura", "Memoria"],
    urls: { canonical: "https://example.org/s1" }
  },
  {
    id: "cucsh:s2", sourceId: "s2", journal: "Sincronía",
    title: "Cultura digital y memoria", year: 2020, language: "es",
    authors: [{ name: "Diana Ruiz" }], doi: null,
    abstract: "Tecnología digital, cultura y memoria como espacios de relación.",
    subjects: ["Tecnología", "Cultura"],
    urls: { canonical: "https://example.org/s2" }
  },
  {
    id: "cucsh:q1", sourceId: "q1", journal: "Quadripartita Ratio",
    title: "Argumentación, lógica y diálogo", year: 2024, language: "es",
    authors: [{ name: "Carlos Vega" }], doi: "10.32870/example.q1",
    abstract: "Argumentación y lógica formal en contextos de diálogo filosófico.",
    subjects: ["Argumentación", "Lógica"],
    urls: { canonical: "https://example.org/q1" }
  },
  {
    id: "cucsh:q2", sourceId: "q2", journal: "Quadripartita Ratio",
    title: "Razones y estructuras argumentativas", year: 2019, language: "es",
    authors: [{ name: "Irene Mora" }], doi: null,
    abstract: "Estructuras de argumentación, razones e inferencias.",
    subjects: ["Argumentación"],
    urls: { canonical: "https://example.org/q2" }
  }
];

const pages = [
  ["protrepsis", "revistas/udg/protrepsis.html", 3],
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
      assert.ok(await page.locator("#journal-category option").count() >= 2);
      assert.equal(await page.locator("#journal-qwen-toggle").getAttribute("aria-pressed"), "false");

      await page.locator('[data-journal-view="atlas"]').click();
      await page.waitForFunction(() =>
        document.querySelector("#journal-atlas-status")?.textContent.includes("nodos")
      );
      assert.match(await page.locator("#journal-atlas-status").innerText(), /0 vectores Qwen verificados/);
      assert.equal(external.length, 0, "Qwen/network must remain opt-in");

      const canvas = await page.locator("#journal-atlas-canvas").boundingBox();
      assert.ok(canvas && canvas.width > 250 && canvas.height > 350);

      await page.locator('[data-journal-view="archive"]').click();
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
