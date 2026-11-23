import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const THEMES = ["default", "territory", "marginalia", "observatory"];
const MODES = ["light", "dark"];
const WIDTHS = [320, 390, 768, 1280];
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
await mkdir("artifacts/corpus-appearance", { recursive: true });

const result = [
  '<article class="result-card">',
  '<div class="result-visual"><span class="result-initial">Φ</span><span class="result-rank">01</span></div>',
  '<div class="result-content"><div class="result-title-row">',
  '<h2>La fenomenología del espíritu y la experiencia de la conciencia</h2>',
  '<span class="relevance-pill">Relevancia 95 %</span></div>',
  '<p class="meta">Georg Wilhelm Friedrich Hegel · 1807 · <a href="#results">OpenAlex</a></p>',
  '<p class="result-abstract">Estudio académico sobre el movimiento de la conciencia.</p>',
  '<span class="provider">OpenAlex Philosophy</span>',
  '<div class="result-links"><button type="button" class="record-open">Ver ficha</button>',
  '<a href="#results" class="result-doi-link">DOI</a></div></div>',
  '<div class="score-panel"><span class="score">95</span></div>',
  '</article>'
].join("");

const author = [
  '<article class="author-page">',
  '<header class="author-page-hero"><div class="author-page-identity">',
  '<a href="./" class="author-page-back">Volver a la búsqueda</a>',
  '<span class="author-page-eyebrow">Archivo de autor</span>',
  '<h1>Georg Wilhelm Friedrich Hegel</h1>',
  '<p class="author-page-biography">Obras y trayectoria bibliográfica.</p>',
  '</div></header>',
  '<div class="author-page-metrics"><div><span>Obras</span><strong>157</strong></div></div>',
  '<section class="author-work-browser"><label class="author-work-search">',
  '<span>Buscar obras</span><div class="author-work-search-field">',
  '<input type="search" placeholder="Buscar en archivo"></div></label></section>',
  '<div class="author-work-grid">', result, '</div>',
  '<section id="author-timeline-root" class="author-timeline">',
  '<div class="author-timeline-heading"><h2>Archivo cronológico</h2></div>',
  '<div class="author-timeline-periods"><button class="author-timeline-period is-active">',
  '<span class="author-timeline-marker"></span><span class="author-timeline-date">1807</span></button>',
  '</div><div class="author-timeline-detail"><button class="author-timeline-work">',
  '<span class="author-timeline-work-name">Fenomenología del espíritu</span>',
  '</button></div></section></article>'
].join("");

const record = [
  '<article class="record-cinematic"><header class="record-cinematic-hero">',
  '<div class="record-hero-content"><span class="record-level-pill">Autor</span>',
  '<h2 class="record-cinematic-title" id="record-modal-title">Fenomenología del espíritu</h2>',
  '<p class="record-cinematic-byline">Georg Wilhelm Friedrich Hegel · 1807</p>',
  '</div></header><div class="record-cinematic-layout">',
  '<aside class="record-cinematic-sidebar"><section class="cinematic-score-card">',
  '<span class="score-eyebrow">Relevancia</span><strong class="cinematic-score-number">95</strong>',
  '</section><section class="cinematic-author-card"><strong>Hegel</strong></section></aside>',
  '<main class="record-cinematic-main"><section class="cinematic-section">',
  '<div class="cinematic-section-heading"><span class="section-number">01</span>',
  '<h3>Ficha bibliográfica</h3></div><div class="cinematic-metadata-grid">',
  '<div class="cinematic-meta-card"><span>Autor</span><strong>Hegel</strong></div>',
  '</div></section><section class="cinematic-section">',
  '<div class="cinematic-section-heading"><h3>Resumen</h3></div>',
  '<div class="cinematic-abstract">',
  "La conciencia atraviesa distintas figuras de experiencia. ".repeat(65),
  '</div></section><section class="cinematic-section">',
  '<div class="cinematic-actions"><a class="cinematic-action primary" href="#record-modal-title">',
  'Acceso abierto</a><a class="cinematic-action" href="#record-modal-title">DOI</a></div>',
  '</section></main></div></article>'
].join("");

const metrics = () => {
  const rectangle = selector => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width, height: r.height };
  };
  const background = selector => getComputedStyle(document.querySelector(selector)).backgroundColor;
  const color = selector => getComputedStyle(document.querySelector(selector)).color;
  return { rectangle, background, color };
};

try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({
      viewport: { width, height: 860 },
      hasTouch: width <= 768,
      isMobile: width <= 768,
      deviceScaleFactor: 1
    });
    await page.route("**/*", route =>
      route.request().url().startsWith(BASE) ? route.continue() : route.abort());
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
      [...document.styleSheets].some(sheet =>
        sheet.href?.includes("corpus-appearance-author-atlas.css") && sheet.cssRules.length > 0
      )
    );
    // Populate the actual embedded Atlas from an in-repository fixture.
    // A blank canvas is not a meaningful visual test of its color palette.
    await page.evaluate(async () => {
      const response = await fetch("./benchmark/research-atlas/v2/search-response-fixtures.json");
      if (!response.ok) throw new Error("Atlas fixture unavailable");
      const fixtures = await response.json();
      await import("./js/research-atlas-embed.js?v=20261122-corpus-appearance-phase4");
      window.dispatchEvent(new CustomEvent("research-atlas:search-response", {
        detail: { phase: "partial", response: fixtures.partials[1] }
      }));
    });
    await page.waitForFunction(() =>
      document.querySelector("#research-atlas-count")?.textContent.trim() === "2"
    );
    await page.evaluate(result => {
      document.querySelector("#research-workspace").classList.remove("hidden");
      document.querySelector("#results").innerHTML = result;
    }, result);

    for (const mode of MODES) for (const shell of THEMES) {
      await page.evaluate(({ mode, shell }) => {
        document.documentElement.dataset.theme = mode;
        document.documentElement.style.colorScheme = mode;
        document.documentElement.dataset.corpusShell = shell;
      }, { mode, shell });

      const work = await page.evaluate(() => {
        const visual = document.querySelector("#results .result-visual");
        return {
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          visualWidth: visual?.getBoundingClientRect().width,
          card: getComputedStyle(document.querySelector("#results .result-card")).backgroundColor,
          hero: getComputedStyle(document.querySelector(".hero-shell")).backgroundImage
        };
      });
      assert.ok(work.scrollWidth <= width + 3,
        "Result horizontal overflow " + JSON.stringify({ width, mode, shell, work }));
      assert.ok(work.visualWidth > 0, "Result rank/visual must stay visible");
      if (shell !== "default") assert.notEqual(work.hero, "none");
      await page.locator(".record-open").first().evaluate(el => el.focus({ preventScroll: true }));

      await page.evaluate(html => {
        const modal = document.querySelector("#record-modal");
        document.querySelector("#record-modal-content").innerHTML = html;
        modal.classList.remove("hidden");
      }, record);
      const folio = await page.evaluate(() => {
        const panel = document.querySelector("#record-modal .record-modal-panel");
        const close = document.querySelector("#record-modal .record-modal-close");
        const r = panel.getBoundingClientRect();
        const c = close.getBoundingClientRect();
        return {
          panelLeft: r.left, panelRight: r.right,
          closeWidth: c.width, closeHeight: c.height,
          scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight,
          background: getComputedStyle(panel).backgroundColor
        };
      });
      assert.ok(folio.panelLeft >= -2 && folio.panelRight <= width + 2,
        "Detail modal outside viewport: " + JSON.stringify({ width, mode, shell, folio }));
      assert.ok(folio.closeWidth >= 44 && folio.closeHeight >= 44,
        "Close dialog target is too small");
      assert.ok(folio.scrollHeight > folio.clientHeight,
        "Full bibliography must scroll independently");

      const shot = (width === 390 || width === 1280) && shell !== "default";
      if (shot) await page.screenshot({
        path: "artifacts/corpus-appearance/folio-" + shell + "-" + mode + "-" + width + ".png",
        animations: "disabled"
      });
      await page.evaluate(() => {
        document.querySelector("#record-modal").classList.add("hidden");
        document.querySelector("#record-modal-content").replaceChildren();
      });

      await page.evaluate(html => {
        document.body.classList.add("author-view");
        document.querySelector("#results").innerHTML = html;
      }, author);
      const archive = await page.evaluate(() => {
        const root = document.querySelector(".author-page");
        const scroll = document.querySelector(".author-timeline-periods");
        const hero = document.querySelector(".author-page-hero");
        const r = root.getBoundingClientRect();
        return {
          left: r.left, right: r.right,
          scrollWidth: document.documentElement.scrollWidth,
          timelineOverflow: getComputedStyle(scroll).overflowX,
          hero: getComputedStyle(hero).backgroundImage
        };
      });
      assert.ok(archive.left >= -2 && archive.right <= width + 2,
        "Author dossier outside viewport: " + JSON.stringify({ width, mode, shell, archive }));
      assert.ok(archive.scrollWidth <= width + 3, "Author dossier creates horizontal overflow");
      assert.equal(archive.timelineOverflow, "auto");
      // Reset the viewport before each image: earlier modal interactions
      // may scroll the document while an author fixture is being inserted.
      const authorViewport = await page.evaluate(() => {
        const hero = document.querySelector(".author-page-hero");
        hero.scrollIntoView({ block: "start", behavior: "instant" });
        window.scrollBy({ top: -56, behavior: "instant" });
        const r = hero.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, viewportHeight: innerHeight };
      });
      assert.ok(
        authorViewport.bottom > 80 && authorViewport.top < authorViewport.viewportHeight * .55,
        "Author hero must be visible in evidence screenshot: " + JSON.stringify(authorViewport)
      );
      if (shot) await page.screenshot({
        path: "artifacts/corpus-appearance/author-" + shell + "-" + mode + "-" + width + ".png",
        animations: "disabled"
      });
      await page.evaluate(result => {
        document.body.classList.remove("author-view");
        document.querySelector("#results").innerHTML = result;
      }, result);
      // Use the real switcher rather than manually unveiling an empty panel.
      await page.locator('[data-research-view="atlas"]').click();
      await page.waitForFunction(() =>
        !document.querySelector("#research-atlas-panel")?.classList.contains("hidden")
      );
      const atlasViewport = await page.evaluate(() => {
        const stage = document.querySelector("#research-atlas-stage");
        stage.scrollIntoView({ block: "center", behavior: "instant" });
        const r = stage.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, viewportHeight: innerHeight };
      });
      assert.ok(atlasViewport.bottom > 100 &&
        atlasViewport.top < atlasViewport.viewportHeight - 100,
        "Atlas canvas must be visible in screenshot: " + JSON.stringify(atlasViewport)
      );
      const atlas = await page.evaluate(() => {
        const root = document.querySelector("#research-atlas-panel");
        const stage = document.querySelector("#research-atlas-stage");
        const list = document.querySelector("#research-atlas-list");
        const r = root.getBoundingClientRect();
        const s = stage.getBoundingClientRect();
        return {
          left: r.left, right: r.right,
          stageHeight: s.height,
          list: getComputedStyle(list).display,
          canvasTouch: getComputedStyle(stage.querySelector("canvas")).touchAction,
          color: getComputedStyle(document.documentElement)
            .getPropertyValue("--corpus-atlas-blue").trim()
        };
      });
      assert.ok(atlas.left >= -2 && atlas.right <= width + 2,
        "Embedded Atlas outside viewport: " + JSON.stringify({ width, mode, shell, atlas }));
      assert.ok(atlas.stageHeight >= 450, "Atlas canvas stage was collapsed");
      assert.ok(atlas.list !== "none", "Populated Atlas node list should be visible");
      assert.equal(atlas.canvasTouch, "none", "Canvas pan/zoom interaction must remain available");
      if (shell !== "default") assert.match(atlas.color, /^#[\da-f]{6}$/i);
      if (shot) await page.screenshot({
        path: "artifacts/corpus-appearance/atlas-" + shell + "-" + mode + "-" + width + ".png",
        animations: "disabled"
      });
      await page.locator('[data-research-view="results"]').click();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    }

    await page.close();
    process.stdout.write("Corpus appearance responsive smoke OK: " + width + "px\n");
  }
} finally {
  await browser.close();
}
