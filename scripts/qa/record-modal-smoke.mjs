import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  headless: true, args: ["--no-sandbox"]
});
await mkdir("artifacts/record-detail", { recursive: true });

const fixture = [
  "<article class='record-cinematic'>",
  "<header class='record-cinematic-hero'>",
  "<div class='record-hero-symbol' aria-hidden='true'>Φ</div>",
  "<div class='record-hero-content'>",
  "<div class='record-hero-kicker'>",
  "<span class='record-level-pill level-p1'>Autor</span>",
  "<span class='record-score-pill'>100/100</span>",
  "<span class='record-provider-pill'>OpenAlex Philosophy · Crossref</span>",
  "</div>",
  "<h2 id='record-modal-title' class='record-cinematic-title'>Hegel's Preface to the Phenomenology of Spirit</h2>",
  "<p class='record-cinematic-byline'><span class='record-cinematic-byline-authors'><a class='record-author-link record-author-link-byline' href='/?view=author&author=Georg+Wilhelm+Friedrich+Hegel&authorId=123#results' target='_blank'><span>Georg Wilhelm Friedrich Hegel</span><span class='record-author-link-arrow'>↗</span></a></span><span class='record-cinematic-byline-meta'> · 2021</span></p>",
  "</div></header>",
  "<div class='record-cinematic-layout'>",
  "<aside class='record-cinematic-sidebar'>",
  "<section class='cinematic-score-card'><span class='score-eyebrow'>Relevancia</span>",
  "<div class='cinematic-score-number'>100</div><div class='cinematic-score-track'><span style='width:100%'></span></div>",
  "<div class='score-level'>Autoría directa</div></section>",
  "<section class='cinematic-author-card'><div class='author-orbit'><span class='author-initial'>G</span></div>",
  "<span class='author-card-caption'>Archivo filosófico</span><strong class='record-author-name'><a class='record-author-link record-author-link-card' href='/?view=author&author=Georg+Wilhelm+Friedrich+Hegel&authorId=123#results' target='_blank'><span>Georg Wilhelm Friedrich Hegel</span><span class='record-author-link-arrow'>↗</span></a></strong></section>",
  "<section class='cinematic-quick-grid'>",
  "<div><span>Año</span><strong>2021</strong></div>",
  "<div><span>Idioma</span><strong>English</strong></div>",
  "<div><span>Tipo</span><strong>Libro</strong></div>",
  "<div><span>Citas</span><strong>120</strong></div>",
  "</section></aside>",
  "<main class='record-cinematic-main'>",
  "<section class='cinematic-section'>",
  "<div class='cinematic-section-heading'><span class='section-number'>01</span>",
  "<div><span class='section-eyebrow'>Registro</span><h3>Ficha bibliográfica</h3></div></div>",
  "<div class='cinematic-metadata-grid'>",
  "<div class='cinematic-meta-card cinematic-meta-card-authors'><span>Autores</span><strong class='record-author-list'><a class='record-author-link record-author-link-metadata' href='/?view=author&author=Georg+Wilhelm+Friedrich+Hegel&authorId=123#results' target='_blank'><span>Georg Wilhelm Friedrich Hegel</span><span class='record-author-link-arrow'>↗</span></a></strong></div>",
  "<div class='cinematic-meta-card'><span>Fuente</span><strong>Phenomenology of Spirit: Studies in Modern Philosophy</strong></div>",
  "<div class='cinematic-meta-card'><span>Proveedores</span><strong>OpenAlex Philosophy · Crossref</strong></div>",
  "</div></section>",
  "<section class='cinematic-section'>",
  "<div class='cinematic-section-heading'><span class='section-number'>02</span><div><h3>Resumen</h3></div></div>",
  "<div class='cinematic-abstract'>Esta investigación examina la relación entre conciencia, negación y experiencia en la fenomenología hegeliana. El registro preserva la atribución de fuentes bibliográficas.</div>",
  "</section>",
  "<section class='cinematic-section'>",
  "<div class='cinematic-section-heading'><span class='section-number'>03</span><div><h3>Temas</h3></div></div>",
  "<div class='cinematic-topics'><span class='cinematic-topic'>Fenomenología</span><span class='cinematic-topic'>Idealismo alemán</span></div>",
  "</section>",
  "<section class='cinematic-section'>",
  "<div class='cinematic-section-heading'><span class='section-number'>04</span><div><h3>Acceso</h3></div></div>",
  "<div class='cinematic-actions'>",
  "<a class='cinematic-action primary' href='#record-modal-title'>Acceso abierto</a>",
  "<a class='cinematic-action' href='#record-modal-title'>DOI</a>",
  "<a class='cinematic-action' href='#record-modal-title'>Registro original</a>",
  "</div></section>",
  "<section class='cinematic-section institutional-cinematic'>",
  "<div class='cinematic-section-heading'><span class='section-number'>05</span><div><h3>Biblioteca UdeG</h3></div></div>",
  "<p class='cinematic-note'>La búsqueda se abre en otra pestaña.</p>",
  "<div class='cinematic-institution-grid'><button type='button' class='cinematic-institution-link'>",
  "<span class='institution-icon'>⌂</span><span>Abrir Biblioteca Virtual UdeG</span><span class='institution-arrow'>↗</span>",
  "</button></div></section>",
  "<section class='cinematic-section'>",
  "<div class='cinematic-section-heading'><span class='section-number'>06</span><div><h3>Procedencia bibliográfica</h3></div></div>",
  "<ul class='cinematic-provenance'><li><span class='provenance-source'>OpenAlex</span>posición 1</li></ul>",
  "</section>",
  "<section class='cinematic-section explanation-cinematic'>",
  "<div class='cinematic-section-heading'><span class='section-number'>07</span><div><h3>Por qué aparece</h3></div></div>",
  "<details class='explanation'><summary>¿Por qué aparece este resultado?</summary>",
  "<div class='explanation-body'>Coincidencia bibliográfica directa.</div></details>",
  "</section></main></div></article>"
].join("");

function rgbChannels(value) {
  return (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
}

function luminance(value) {
  const channels = rgbChannels(value).map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

try {
  for (const theme of ["light", "dark"]) {
  for (const width of [320, 375, 390, 768, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: 820 },
      isMobile: width <= 768,
      hasTouch: width <= 768,
      deviceScaleFactor: 1
    });
    await page.route("**/*", route =>
      route.request().url().startsWith(BASE) ? route.continue() : route.abort()
    );
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.locator('[data-theme-choice="' + theme + '"]').click();
    await page.waitForFunction(() =>
      [...document.styleSheets].some(sheet =>
        sheet.href?.includes("record-folio-polish.css") && sheet.cssRules.length > 0
      )
    );
    await page.evaluate(html => {
      document.querySelector("#record-modal-content").innerHTML = html;
      document.querySelector("#record-modal").classList.remove("hidden");
      document.body.classList.add("modal-open");
    }, fixture);

    await page.screenshot({
      path: "artifacts/record-detail/modal-" + theme + "-" + width + ".png",
      animations: "disabled"
    });

    const info = await page.evaluate(() => {
      const box = sel => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
      };
      const style = sel => getComputedStyle(document.querySelector(sel));
      return {
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        panel: box("#record-modal .record-modal-panel"),
        hero: box("#record-modal .record-cinematic-hero"),
        title: box("#record-modal-title"),
        close: box("#record-modal .record-modal-close"),
        modalBackground: style("#record-modal .record-cinematic-hero").backgroundColor,
        metaBackground: style("#record-modal .cinematic-meta-card").backgroundColor,
        scoreBackground: style("#record-modal .cinematic-score-card").backgroundColor,
        primaryBackground: style("#record-modal .cinematic-action.primary").backgroundColor,
        otherBackground: style("#record-modal .cinematic-action:not(.primary)").backgroundColor,
        titleColor: style("#record-modal-title").color,
        titleBackground: style("#record-modal .record-cinematic-hero").backgroundColor,
        abstractColor: style("#record-modal .cinematic-abstract").color,
        abstractBackground: style("#record-modal .cinematic-abstract").backgroundColor,
        sectionBackground: style("#record-modal .cinematic-section").backgroundColor,
        authorLinkColor: style("#record-modal .record-author-link").color,
        authorLinkBackground: style("#record-modal .cinematic-author-card").backgroundColor,
        authorLinkHref: document.querySelector("#record-modal .record-author-link")?.href || "",
        authorLinkTarget: document.querySelector("#record-modal .record-author-link")?.target || "",
        titleFont: style("#record-modal-title").fontFamily,
        actionRadius: style("#record-modal .cinematic-action").borderTopLeftRadius,
        sectionRadius: style("#record-modal .cinematic-section").borderTopLeftRadius,
        panelRadius: style("#record-modal .record-modal-panel").borderTopLeftRadius,
        closeRadius: style("#record-modal .record-modal-close").borderTopLeftRadius,
        actions: [...document.querySelectorAll("#record-modal .cinematic-action")].map(x =>
          ({height:x.getBoundingClientRect().height,width:x.getBoundingClientRect().width})
        ),
        layoutColumns: style("#record-modal .record-cinematic-layout").gridTemplateColumns.split(" ").length,
        metaColumns: style("#record-modal .cinematic-metadata-grid").gridTemplateColumns.split(" ").length,
        actionColumns: style("#record-modal .cinematic-actions").gridTemplateColumns.split(" ").length,
        scrollHeight: document.querySelector("#record-modal .record-modal-panel").scrollHeight,
        clientHeight: document.querySelector("#record-modal .record-modal-panel").clientHeight
      };
    });
    assert.ok(info.documentWidth <= width + 2, "Page overflow: " + width);
    assert.ok(info.panel.left >= -2 && info.panel.right <= width + 2, "Panel overflow: " + width);
    assert.ok(info.hero.left >= info.panel.left - 2 && info.hero.right <= info.panel.right + 2, "Hero overflow");
    assert.ok(info.title.left >= info.panel.left && info.title.right <= info.panel.right, "Title overflow");
    assert.ok(info.close.width >= 44 && info.close.height >= 44, "Close tap target too small");
    assert.ok(info.close.left >= info.panel.left - 2 && info.close.right <= info.panel.right + 2, "Close outside panel");
    if (theme === "dark") {
      assert.equal(info.metaBackground, "rgb(22, 22, 22)");
      assert.equal(info.scoreBackground, "rgb(38, 38, 38)");
      assert.equal(info.sectionBackground, "rgb(38, 38, 38)");
      assert.equal(info.titleColor, "rgb(244, 244, 244)");
      assert.equal(info.authorLinkColor, "rgb(120, 169, 255)");
    } else {
      assert.equal(info.metaBackground, "rgb(255, 255, 255)");
      assert.equal(info.scoreBackground, "rgb(244, 244, 244)");
      assert.equal(info.sectionBackground, "rgb(244, 244, 244)");
      assert.equal(info.titleColor, "rgb(22, 22, 22)");
      assert.equal(info.authorLinkColor, "rgb(15, 98, 254)");
    }
    assert.equal(info.primaryBackground, "rgb(15, 98, 254)");
    assert.equal(info.otherBackground, "rgb(57, 57, 57)");
    assert.ok(contrast(info.abstractColor, info.abstractBackground) >= 4.5,
      "Abstract contrast must meet WCAG AA: " + theme + " " + width);
    assert.ok(contrast(info.authorLinkColor, info.authorLinkBackground) >= 4.5,
      "Author link contrast must meet WCAG AA: " + theme + " " + width);
    assert.match(info.authorLinkHref, /view=author/);
    assert.match(info.authorLinkHref, /author=Georg/);
    assert.equal(info.authorLinkTarget, "_blank");
    assert.match(info.titleFont, /Helvetica Neue|Avenir Next|Arial/);
    for (const val of [info.actionRadius, info.sectionRadius, info.panelRadius, info.closeRadius]) {
      assert.equal(val, "0px", "Flat corners required");
    }
    assert.ok(info.actions.every(a => a.height >= 44), "Modal actions must be tappable");
    if (width <= 600) {
      assert.equal(info.layoutColumns, 1);
      assert.equal(info.metaColumns, 1);
      assert.equal(info.actionColumns, 1);
      assert.ok(info.scrollHeight > info.clientHeight, "Long modal must scroll");
    }
    if (width === 1280) assert.equal(info.layoutColumns, 2);
    await page.locator("#record-modal .record-modal-panel").evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
    const bottom = await page.evaluate(() => {
      const p = document.querySelector("#record-modal .record-modal-panel");
      const r = document.querySelector("#record-modal .explanation-cinematic").getBoundingClientRect();
      const bounds = p.getBoundingClientRect();
      return {scrollTop:p.scrollTop,visible:r.top < bounds.bottom && r.bottom > bounds.top};
    });
    assert.ok(bottom.scrollTop > 0 && bottom.visible, "All detail sections must be reachable");
    if (width === 375 || width === 1280) {
      await page.screenshot({
        path: "artifacts/record-detail/modal-bottom-" + theme + "-" + width + ".png",
        animations: "disabled"
      });
    }
    await page.close();
    process.stdout.write("record detail " + theme + " OK " + width + "px\n");
  }
  }
} finally {
  await browser.close();
}
