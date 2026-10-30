import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"]
});

await mkdir("artifacts/mobile-ui", { recursive: true });

async function prepareFixture(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    [...document.styleSheets].some(sheet =>
      sheet.href?.includes("mobile-carbon.css") &&
      sheet.cssRules.length > 0
    )
  );

  await page.evaluate(() => {
    const workspace = document.querySelector("#research-workspace");
    const filters = document.querySelector("#filters");
    const stats = document.querySelector("#stats");
    const results = document.querySelector("#results");
    workspace.classList.remove("hidden");
    filters.classList.remove("hidden");
    stats.classList.remove("hidden");

    filters.innerHTML = [
      '<h2>Filtros</h2><div class="filter-grid">',
      '<label>Año desde<input type="number" placeholder="1900"></label>',
      '<label>Año hasta<input type="number" placeholder="2026"></label>',
      '<label>Idioma<select><option>Español</option></select></label>',
      '<label>Tipo<select><option>Artículo académico</option></select></label>',
      '</div>'
    ].join("");

    stats.innerHTML = [
      '<div class="stat-grid">',
      '<div class="stat"><strong>451823</strong> documentos</div>',
      '<div class="stat"><strong>20</strong> resultados</div>',
      '<div class="stat"><strong>4</strong> fuentes</div>',
      '<div class="stat"><strong>96</strong> precisión</div>',
      '</div>'
    ].join("");

    results.innerHTML = [
      '<article class="result-card">',
      '<div class="result-visual" aria-hidden="true">',
      '<span class="result-rank">01</span>',
      '<span class="result-initial">Φ</span>',
      '</div>',
      '<div class="result-content">',
      '<div class="result-title-row">',
      '<span class="relevance-pill">P1</span>',
      '<h2>La genealogía del problema ontológico y la racionalidad crítica contemporánea</h2>',
      '</div>',
      '<p class="meta">Autor de ejemplo · 2026 · Revista académica</p>',
      '<p class="result-abstract">Una investigación filosófica para comprobar el texto de los resultados sin cortes horizontales.</p>',
      '<div class="provider-row"><span class="provider">Crossref</span>',
      '<span class="provider">OpenAlex Philosophy</span></div>',
      '<div class="result-links">',
      '<button class="record-open">Ver ficha</button>',
      '<button class="institutional-card-link">Biblioteca Virtual UdeG ↗</button>',
      '<a class="result-secondary-link result-open-link" href="#results">Abrir</a>',
      '<a class="result-secondary-link result-doi-link" href="#results">DOI</a>',
      '</div>',
      '</div>',
      '<div class="score-panel"><div class="score">87</div><span>Relevancia</span></div>',
      '</article>'
    ].join("");
  });
}

function rectOf(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height
  };
}

try {
  for (const width of [320, 375, 390, 620, 768]) {
    const page = await browser.newPage({
      viewport: { width, height: 812 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });

    await page.route("**/*", route =>
      route.request().url().startsWith(BASE)
        ? route.continue()
        : route.abort()
    );
    await prepareFixture(page);

    const values = await page.evaluate(() => {
      const rect = element => {
        const box = element.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          width: box.width,
          height: box.height,
          top: box.top
        };
      };

      const find = selector => rect(document.querySelector(selector));
      return {
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        panel: find(".search-panel"),
        input: find("#search-input"),
        select: find("#search-depth"),
        submit: find(".search-form button"),
        workspace: find("#research-workspace"),
        title: find(".result-card h2"),
        result: find(".result-card"),
        recordButton: find(".record-open"),
        nav: [...document.querySelectorAll(".philo-nav-links a")].map(rect),
        filtersColumnCount:
          getComputedStyle(document.querySelector(".filter-grid"))
            .gridTemplateColumns.split(" ").length
      };
    });

    assert.ok(
      values.scrollWidth <= values.viewport + 2,
      "Document overflows at " + width + "px: " + JSON.stringify(values)
    );
    for (const key of ["panel", "input", "submit", "workspace", "result", "title"]) {
      assert.ok(
        values[key].left >= -2 && values[key].right <= values.viewport + 2,
        key + " is clipped at " + width + "px: " + JSON.stringify(values[key])
      );
    }

    assert.ok(values.submit.height >= 44, "Submit tap target too small");
    assert.ok(values.recordButton.height >= 44, "Result tap target too small");
    if (width <= 620) {
      assert.ok(
        Math.abs(values.input.left - values.select.left) < 2 &&
        Math.abs(values.select.left - values.submit.left) < 2,
        "Search controls must stack on phones"
      );
      assert.ok(values.nav.every(link => link.height >= 44));
    } else {
      assert.ok(
        Math.abs(values.select.top - values.submit.top) < 2,
        "Tablet select and submit should share one row"
      );
    }

    if (width <= 359) {
      assert.equal(values.filtersColumnCount, 1);
    }

    if (width === 375 || width === 768) {
      await page.screenshot({
        path: "artifacts/mobile-ui/search-" + width + ".png",
        fullPage: true,
        animations: "disabled"
      });
    }

    if (width === 375) {
      await page.evaluate(() => {
        document.body.classList.add("author-view");
        document.querySelector(".workspace-main").innerHTML = [
          '<section class="author-page">',
          '<div class="author-page-hero"><div>',
          '<h1>Georg Wilhelm Friedrich Hegel</h1>',
          '<p class="author-page-biography">Archivo de obras y metadatos.</p>',
          '</div></div>',
          '<div class="author-page-metrics">',
          '<div><strong>260</strong><span>Obras</span></div>',
          '<div><strong>140</strong><span>Artículos</span></div>',
          '</div></section>'
        ].join("");
      });
      const author = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
        heroRight: document.querySelector(".author-page-hero").getBoundingClientRect().right
      }));
      assert.ok(
        author.scrollWidth <= author.viewport + 2 &&
        author.heroRight <= author.viewport + 2,
        "Author page overflows in mobile view"
      );
      await page.screenshot({
        path: "artifacts/mobile-ui/author-375.png",
        fullPage: true,
        animations: "disabled"
      });
    }

    await page.close();
    process.stdout.write("mobile layout OK: " + width + "px\n");
  }

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desktop.route("**/*", route =>
    route.request().url().startsWith(BASE)
      ? route.continue()
      : route.abort()
  );
  await prepareFixture(desktop);
  const desktopValues = await desktop.evaluate(() => ({
    mobileStylesMatched:
      [...document.styleSheets]
        .filter(sheet => sheet.href?.includes("mobile-carbon.css"))
        .flatMap(sheet => [...sheet.cssRules])
        .filter(rule => rule.conditionText && matchMedia(rule.conditionText).matches)
        .length,
    columns: getComputedStyle(document.querySelector(".hero-shell")).gridTemplateColumns
  }));
  assert.equal(desktopValues.mobileStylesMatched, 0, "Desktop must not match mobile overrides");
  assert.ok(desktopValues.columns.split(" ").length >= 12, "Desktop grid must stay intact");
  await desktop.close();
  process.stdout.write("desktop layout isolation OK: 1280px\n");
} finally {
  await browser.close();
}
