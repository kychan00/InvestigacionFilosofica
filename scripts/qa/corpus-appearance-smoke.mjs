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
  '<div class="author-timeline-historical-track" data-region="europe"><section class="author-timeline-era" data-motif="republic">',
  '<div class="author-timeline-era-header"><h3>Siglo XIX</h3></div>',
  '<div class="author-timeline-nodes"><button class="author-timeline-work">',
  '<span class="author-timeline-work-copy"><span class="author-timeline-entry-date">1807</span><span class="author-timeline-work-name">Fenomenología del espíritu</span></span>',
  '</button></div></section></div></section></article>'
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
        // Every visual state starts from the public-search layout. The fixture
        // temporarily enables author-view later and must never leak it.
        document.body.classList.remove("author-view");
        document.documentElement.dataset.theme = mode;
        document.documentElement.style.colorScheme = mode;
        document.documentElement.dataset.corpusShell = shell;
        // Update the actual menu aria-pressed indicators after the fixture
        // changes root theme without pressing an interface button.
        window.dispatchEvent(new CustomEvent("philosophythemechange", {
          detail: { theme: mode }
        }));
      }, { mode, shell });


      if (shell === "territory") {
        const kant = await page.evaluate(async () => {
          const hero = getComputedStyle(document.querySelector(".hero-shell"), "::after");
          const tile = getComputedStyle(document.querySelector("#results .result-visual"));
          const url = [...hero.backgroundImage.matchAll(/url\("([^"]+)"\)/g)]
            .map(m => m[1]).find(v => v.endsWith("/territory-kant.jpg"));
          if (!url) throw new Error("Territorio: falta el retrato de portada");
          const image = new Image();
          image.src = url;
          await image.decode();
          return { local: new URL(url).origin === location.origin,
            width: image.naturalWidth, height: image.naturalHeight,
            coverVisible: Number(hero.opacity) > 0 && hero.display !== "none",
            coverHits: hero.pointerEvents, tile: tile.backgroundImage };
        });
        assert.deepEqual({local:kant.local,width:kant.width,height:kant.height},
          {local:true,width:677,height:845});
        assert.ok(kant.coverVisible && kant.coverHits === "none");
        assert.ok(kant.tile.includes("territory-kant.jpg"));
      } else {
        const other = await page.evaluate(() => [
          getComputedStyle(document.querySelector(".hero-shell"), "::after").backgroundImage,
          getComputedStyle(document.querySelector("#results .result-visual")).backgroundImage
        ]);
        assert.ok(other.every(value => !value.includes("territory-kant.jpg")),
          "Kant artwork leaked into " + shell);
      }

      if (shell === "territory") {
        // The base theme uses 240ms background/border transitions. Read the
        // final computed colors, not the previous frame of an active transition.
        await page.waitForFunction(({ surface, accent }) => {
          const panel = document.querySelector(".hero-shell .search-panel");
          const workspace = document.querySelector("#research-workspace");
          return panel && workspace &&
            getComputedStyle(panel).backgroundColor === surface &&
            getComputedStyle(workspace).borderTopColor === accent;
        }, {
          surface: mode === "light" ? "rgb(255, 252, 245)" : "rgb(34, 51, 42)",
          accent: mode === "light" ? "rgb(122, 69, 52)" : "rgb(232, 184, 147)"
        }, { timeout: 3000 });

        const editorial = await page.evaluate(() => {
          const paint = selector => {
            const element = document.querySelector(selector);
            if (!element) throw new Error("Territory missing UI: " + selector);
            const style = getComputedStyle(element);
            return { background: style.backgroundColor, color: style.color };
          };
          return {
            panel: paint(".hero-shell .search-panel"),
            bodyClass: document.body.className,
            panelMatches: document.querySelector(".hero-shell .search-panel").matches(
              'html[data-corpus-shell="territory"] body:not(.author-view) .hero-shell .search-panel'
            ),
            navigation: paint(".philo-nav"),
            mobileToolbar: paint(".site-mobile-toolbar"),
            desktopRail: paint(".site-desktop-rail"),
            drawer: paint(".site-menu-drawer"),
            workspaceTop: getComputedStyle(
              document.querySelector("#research-workspace")
            ).borderTopColor,
            menuToggle: paint(".site-menu-toggle"),
            firstNavigationMarker: getComputedStyle(
              document.querySelector(".philo-nav-links a"), "::before"
            ).color
          };
        });
        const surface = mode === "light" ? "rgb(255, 252, 245)" : "rgb(34, 51, 42)";
        const ink = mode === "light" ? "rgb(37, 55, 47)" : "rgb(242, 238, 227)";
        const caption = mode === "light" ? "rgb(112, 66, 50)" : "rgb(237, 193, 158)";
        for (const key of ["panel", "navigation", "mobileToolbar", "desktopRail", "drawer"]) {
          assert.equal(editorial[key].background, surface,
            "Territory navigation/surface mismatch: " + JSON.stringify({ key, width, mode, editorial }));
        }
        for (const key of ["mobileToolbar", "drawer", "menuToggle"]) {
          assert.equal(editorial[key].color, ink,
            "Territory ink mismatch: " + JSON.stringify({ key, width, mode, editorial }));
        }
        assert.equal(editorial.firstNavigationMarker, caption,
          "Territory navigation marker must not keep Carbon blue");

        const searchControls = await page.evaluate(() => {
          const depth = document.querySelector("#search-depth");
          const modeTab = document.querySelector(".search-mode-option.is-active");
          const label = document.querySelector(".hero-shell .search-panel");
          const account = document.querySelector(".account-trigger");
          return {
            depthBackground: getComputedStyle(depth).backgroundColor,
            depthText: getComputedStyle(depth).color,
            depthRadius: getComputedStyle(depth).borderTopLeftRadius,
            activeUnderline: getComputedStyle(modeTab,"::after").backgroundColor,
            caption: getComputedStyle(label,"::before").color,
            accountBorder: getComputedStyle(account).borderTopColor
          };
        });
        const controlBackground = mode === "light" ? "rgb(239, 238, 229)" : "rgb(26, 44, 35)";
        const accountBorder = mode === "light" ? "rgb(187, 198, 184)" : "rgb(99, 121, 104)";
        const expectedAccent = mode === "light" ? "rgb(122, 69, 52)" : "rgb(232, 184, 147)";
        assert.equal(searchControls.depthBackground, controlBackground,
          "Search depth selector must not inherit an unthemed white pill: " + JSON.stringify({ width, mode, searchControls }));
        assert.equal(searchControls.depthText, ink, "Search depth selector has low-contrast text");
        assert.equal(searchControls.depthRadius, "0px", "Search depth selector has old rounded geometry");
        assert.equal(searchControls.activeUnderline, expectedAccent, "Old blue search-mode active underline");
        assert.equal(searchControls.caption, caption, "Old blue search-panel caption");
        assert.equal(searchControls.accountBorder, accountBorder, "Account control has old blue border");

        assert.equal(editorial.workspaceTop,
          mode === "light" ? "rgb(122, 69, 52)" : "rgb(232, 184, 147)",
          "Territory workspace accent must win over old !important borders");

        // Verify the real menu action, not merely computed styles of a hidden drawer.
        const navTrigger = width <= 820
          ? ".site-menu-toggle"
          : ".site-desktop-menu-toggle";
        await page.locator(navTrigger).click();
        await page.locator(".site-menu-drawer.is-open").waitFor();
        const openMenuPaint = await page.evaluate(() => {
          const drawer = document.querySelector(".site-menu-drawer");
          return {
            background: getComputedStyle(drawer).backgroundColor,
            inert: drawer.inert,
            hidden: drawer.getAttribute("aria-hidden")
          };
        });
        assert.equal(openMenuPaint.background, surface);
        assert.equal(openMenuPaint.inert, false);
        assert.equal(openMenuPaint.hidden, "false");
        if (width === 390 || width === 1280) {
          await page.locator(".site-menu-drawer").screenshot({
            path: "artifacts/corpus-appearance/navigation-territory-" + mode + "-" + width + ".png",
            animations: "disabled"
          });
        }
        await page.locator(".site-menu-close").click();
        await page.waitForFunction(() => {
          const menu = document.querySelector(".site-menu-drawer");
          return menu?.inert === true && menu.getAttribute("aria-hidden") === "true";
        });

        if (width === 390 || width === 1280) {
          await page.locator(".hero-shell").screenshot({
            path: "artifacts/corpus-appearance/landing-territory-" + mode + "-" + width + ".png",
            animations: "disabled"
          });
        }
      }

      if (shell === "marginalia") {
        // 240 ms transition on the underlying theme: inspect the settled
        // colors, not the previous frame.
        const surface = mode === "light" ? "rgb(252, 250, 244)" : "rgb(43, 42, 42)";
        const ink = mode === "light" ? "rgb(41, 45, 48)" : "rgb(242, 236, 228)";
        const subtle = mode === "light" ? "rgb(232, 229, 221)" : "rgb(52, 51, 50)";
        const accent = mode === "light" ? "rgb(120, 64, 57)" : "rgb(225, 173, 154)";
        const caption = mode === "light" ? "rgb(112, 59, 54)" : "rgb(231, 180, 161)";
        await page.waitForFunction(({ surface, accent }) =>
          getComputedStyle(document.querySelector(".hero-shell .search-panel")).backgroundColor === surface &&
          getComputedStyle(document.querySelector("#research-workspace")).borderTopColor === accent,
          { surface, accent }, { timeout: 3000 }
        );
        const p = await page.evaluate(() => {
          const color = selector => getComputedStyle(document.querySelector(selector)).color;
          const bg = selector => getComputedStyle(document.querySelector(selector)).backgroundColor;
          return {
            panel: bg(".hero-shell .search-panel"),
            toolbar: bg(".site-mobile-toolbar"),
            nav: bg(".philo-nav"),
            rail: bg(".site-desktop-rail"),
            drawer: bg(".site-menu-drawer"),
            select: bg("#search-depth"),
            selectText: color("#search-depth"),
            account: color(".account-trigger"),
            note: getComputedStyle(document.querySelector(".hero-shell .search-panel"), "::before").color,
            activeUnderline: getComputedStyle(document.querySelector(".search-mode-option.is-active"), "::after").backgroundColor,
            recordAction: getComputedStyle(document.querySelector("#results .result-card .result-links .record-open")).backgroundColor,
            recordActionInk: getComputedStyle(document.querySelector("#results .result-card .result-links .record-open")).color
          };
        });
        for (const key of ["panel", "toolbar", "nav", "rail", "drawer"]) {
          assert.equal(p[key], surface,
            "Marginalia surface mismatch: " + JSON.stringify({ width, mode, key, p }));
        }
        assert.equal(p.select, subtle, "Marginalia select inherited an unthemed white background");
        assert.equal(p.selectText, ink, "Marginalia select low contrast");
        assert.equal(p.account, ink);
        assert.equal(p.note, caption);
        assert.equal(p.activeUnderline, accent);
        assert.equal(p.recordAction,
          mode === "light" ? "rgb(53, 70, 80)" : "rgb(101, 66, 61)",
          "Marginalia primary result action must use editorial ink, not pale generic accent");
        assert.equal(p.recordActionInk, "rgb(255, 255, 255)");
        const socrates = await page.evaluate(() => ({
          cover: getComputedStyle(document.querySelector(".hero-shell")).backgroundImage,
          index: getComputedStyle(document.querySelector("#results .result-visual"), "::before").backgroundImage
        }));
        for (const [surface, image] of Object.entries(socrates)) {
          assert.ok(image.includes("marginalia-socrates.jpg"),
            "Marginalia Socrates image missing on " + surface + ": " + image);
        }
        const artwork = await page.evaluate(async () => {
          const css = getComputedStyle(document.querySelector(".hero-shell")).backgroundImage;
          const url = [...css.matchAll(/url\("([^"]+)"\)/g)]
            .map(match => match[1]).find(value => value.endsWith("/marginalia-socrates.jpg"));
          if (!url) throw new Error("Socrates CSS URL missing");
          const picture = new Image();
          picture.src = url;
          await picture.decode();
          return { local: new URL(url).origin === location.origin,
            width: picture.naturalWidth, height: picture.naturalHeight };
        });
        assert.deepEqual(artwork, { local: true, width: 1400, height: 2250 },
          "Socrates must actually decode from the local server, not merely match a CSS string");

        if (width === 1280) {
          const filters = await page.evaluate(() => {
            const grid = document.querySelector(".hero-shell .search-filter-grid");
            const labels = [...grid.querySelectorAll(":scope > label")];
            const fields = [...grid.querySelectorAll(":scope > label > :is(select, input)")];
            return {
              columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
              rows: labels.map(label => Math.round(label.getBoundingClientRect().top)),
              fieldWidths: fields.map(field => field.getBoundingClientRect().width),
              overflow: grid.scrollWidth - grid.clientWidth
            };
          });
          assert.equal(filters.columns, 6, "Editorial filter grid must use six tracks");
          assert.equal(new Set(filters.rows).size, 2,
            "Five filters must read as three plus two: " + JSON.stringify(filters));
          assert.ok(filters.fieldWidths.every(w => w >= 95),
            "Filter values must fit without clipping: " + JSON.stringify(filters));
          assert.ok(filters.overflow <= 1, "Filter grid must not create horizontal overflow");
        }

        const trigger = width <= 820 ? ".site-menu-toggle" : ".site-desktop-menu-toggle";
        await page.locator(trigger).click();
        await page.locator(".site-menu-drawer.is-open").waitFor();
        const open = await page.evaluate(() => {
          const drawer = document.querySelector(".site-menu-drawer");
          return {
            hidden: drawer.getAttribute("aria-hidden"),
            inert: drawer.inert,
            color: getComputedStyle(drawer).backgroundColor
          };
        });
        assert.equal(open.hidden, "false");
        assert.equal(open.inert, false);
        assert.equal(open.color, surface);
        if (width === 390 || width === 1280) {
          await page.locator(".site-menu-drawer").screenshot({
            path: "artifacts/corpus-appearance/navigation-marginalia-" + mode + "-" + width + ".png",
            animations: "disabled"
          });
        }
        await page.locator(".site-menu-close").click();
        await page.waitForFunction(() => {
          const drawer = document.querySelector(".site-menu-drawer");
          return drawer.inert && drawer.getAttribute("aria-hidden") === "true";
        });
        if (width === 390 || width === 1280) {
          await page.locator(".hero-shell").screenshot({
            path: "artifacts/corpus-appearance/landing-marginalia-" + mode + "-" + width + ".png",
            animations: "disabled"
          });
          await page.locator("#results > .result-card").first().screenshot({
            path: "artifacts/corpus-appearance/results-marginalia-" + mode + "-" + width + ".png",
            animations: "disabled"
          });
        }
      }

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

      if (shell === "territory" && width <= 820) {
        const rankSpace = await page.evaluate(() => {
          const card = document.querySelector("#results > .result-card");
          const title = card.querySelector(".result-title-row");
          const badge = card.querySelector(".result-visual");
          const gap = badge.getBoundingClientRect().left -
            title.getBoundingClientRect().right;
          return {
            rightInset: parseFloat(getComputedStyle(title).paddingInlineEnd),
            badgeLeft: badge.getBoundingClientRect().left,
            titleRight: title.getBoundingClientRect().right,
            gap
          };
        });
        assert.ok(rankSpace.rightInset >= 54,
          "Mobile Territory title must reserve rank space: " + JSON.stringify(rankSpace));
      }

      if (shell !== "default") assert.notEqual(work.hero, "none");
      if (shell === "territory" && (width === 390 || width === 1280)) {
        await page.locator("#results > .result-card").first().screenshot({
          path: "artifacts/corpus-appearance/results-territory-" + mode + "-" + width + ".png",
          animations: "disabled"
        });
      }
      await page.locator(".record-open").first().evaluate(el => el.focus({ preventScroll: true }));

      await page.evaluate(html => {
        const modal = document.querySelector("#record-modal");
        document.querySelector("#record-modal-content").innerHTML = html;
        modal.classList.remove("hidden");
      }, record);
      if (shell === "marginalia") {
        const image = await page.evaluate(() =>
          getComputedStyle(document.querySelector("#record-modal .record-cinematic-hero"), "::after")
            .backgroundImage
        );
        assert.ok(image.includes("marginalia-socrates.jpg"),
          "Marginalia full record hero should display the Socrates watermark");
      }
      const kantFolio = await page.evaluate(() => {
        const watermark = getComputedStyle(document.querySelector("#record-modal .record-cinematic-hero"), "::after");
        return { image: watermark.backgroundImage, hits: watermark.pointerEvents,
          opacity: Number(watermark.opacity) };
      });
      assert.equal(kantFolio.image.includes("territory-kant.jpg"), shell === "territory");
      if (shell === "territory") {
        assert.ok(kantFolio.opacity > 0 && kantFolio.hits === "none");
      }
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
      const kantAuthor = await page.evaluate(() => {
        const tile = document.querySelector(".author-work-grid .result-visual");
        const rank = tile.querySelector(".result-rank");
        const rect = tile.getBoundingClientRect();
        return { image: getComputedStyle(tile).backgroundImage,
          rank: getComputedStyle(rank).color, width: rect.width, height: rect.height,
          rankDisplay: getComputedStyle(rank).display };
      });
      assert.equal(kantAuthor.image.includes("territory-kant.jpg"), shell === "territory",
        "Author bookplate must follow active theme: " + JSON.stringify({ width, mode, shell, kantAuthor }));
      if (shell === "territory") {
        assert.equal(kantAuthor.rank, mode === "light" ? "rgb(247, 243, 231)" : "rgb(247, 241, 227)",
          "Rank must retain readable ink over the author portrait");
        assert.ok(kantAuthor.width > 0 && kantAuthor.height > 0 && kantAuthor.rankDisplay !== "none");
      }
      const archive = await page.evaluate(() => {
        const root = document.querySelector(".author-page");
        const scroll = document.querySelector(".author-timeline-historical-track");
        const hero = document.querySelector(".author-page-hero");
        const r = root.getBoundingClientRect();
        return {
          left: r.left, right: r.right,
          scrollWidth: document.documentElement.scrollWidth,
          timelineWidth: scroll.scrollWidth, timelineClient: scroll.clientWidth,
          hero: getComputedStyle(hero).backgroundImage
        };
      });
      assert.ok(archive.left >= -2 && archive.right <= width + 2,
        "Author dossier outside viewport: " + JSON.stringify({ width, mode, shell, archive }));
      assert.ok(archive.scrollWidth <= width + 3, "Author dossier creates horizontal overflow");
      assert.ok(archive.timelineWidth <= archive.timelineClient + 2, "Timeline horizontal overflow");
      if (shell === "territory") {
        const searchInput = await page.evaluate(() => {
          const input = document.querySelector(".author-work-search-field input");
          const root = document.querySelector(".author-work-search-field");
          return {
            placeholderColor: getComputedStyle(input,"::placeholder").color,
            placeholderOpacity: getComputedStyle(input,"::placeholder").opacity,
            focusBorder: getComputedStyle(root).borderTopColor
          };
        });
        const mutedColor = mode === "light" ? "rgb(82, 100, 89)" : "rgb(193, 208, 194)";
        assert.equal(searchInput.placeholderColor, mutedColor,
          "Author search placeholder must be readable: " + JSON.stringify({ mode, width, searchInput }));
        assert.equal(searchInput.placeholderOpacity, "1");
        assert.equal(searchInput.focusBorder,
          mode === "light" ? "rgb(187, 198, 184)" : "rgb(99, 121, 104)");
      }


      if (shell === "territory") {
        const toolbarColor = await page.evaluate(() =>
          getComputedStyle(document.querySelector(".site-mobile-toolbar")).backgroundColor
        );
        assert.equal(toolbarColor, mode === "light" ? "rgb(255, 252, 245)" : "rgb(34, 51, 42)",
          "Author dossier toolbar must inherit the same Territory palette");
      }

      if (shell === "marginalia") {
        const dossier = await page.evaluate(() => {
          const input = document.querySelector(".author-work-search-field input");
          return {
            toolbar: getComputedStyle(document.querySelector(".site-mobile-toolbar")).backgroundColor,
            placeholder: getComputedStyle(input, "::placeholder").color,
            placeholderOpacity: getComputedStyle(input, "::placeholder").opacity
          };
        });
        assert.equal(dossier.toolbar, mode === "light" ? "rgb(252, 250, 244)" : "rgb(43, 42, 42)");
        assert.equal(dossier.placeholder, mode === "light" ? "rgb(85, 93, 97)" : "rgb(195, 187, 178)");
        assert.equal(dossier.placeholderOpacity, "1");
      }

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
