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
        skipLink: Boolean(document.querySelector(".skip-link"))
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
    assert.equal(
      await firminCard.evaluate(element => element.tagName),
      "ARTICLE",
      "Documented author cards should support a separate private save action"
    );

    const firminLink = firminCard.locator(".author-card-link");
    const firminHref = await firminLink.getAttribute("href");
    assert.match(firminHref, /^#autor-\d{4}$/,
      "Author cards must link to shareable local dossier hashes");
    assert.equal(
      await firminCard.getAttribute("role"),
      null,
      "Author cards must keep an accessible native link separate from save"
    );

    await firminLink.click();
    await page.waitForFunction(() =>
      document.querySelector("#author-dialog")?.open &&
      document.querySelector("#author-dialog-title")?.textContent?.includes("Firmin") &&
      document.querySelector("#author-dossier-works-section")
    , null, { timeout: 18000 });

    assert.equal(new URL(page.url()).pathname, new URL(PAGE_URL).pathname,
      "Opening the dossier must not navigate away from the Latin American archive");
    assert.equal(new URL(page.url()).hash, firminHref,
      "Dossier selection must retain its shareable hash");
    assert.equal(await page.locator("#author-dossier-works-section").count(), 1,
      "The original dossier must render bibliographic works");
    // Exercise live federated-result cards independently of network timing.
    // Anonymous readers can inspect the record, but cannot see save controls.
    const liveFixture = {
      id: "archive-test-firmin-1885",
      title: "De l'égalité des races humaines",
      authors: [{ name: "Anténor Firmin" }],
      year: 1885,
      type: "archive-text",
      providers: ["Internet Archive"],
      urls: { canonical: "https://archive.org/details/firmin-test-1885" },
      abstract: "Edición para investigación"
    };
    await page.evaluate(async fixture => {
      localStorage.removeItem("research-auth-verified-v1");
      const loadedModule=[...document.querySelectorAll('script[type="module"][src]')].find(script=>new URL(script.src).pathname.endsWith("/js/latin-american-philosophy.js"));
      if(!loadedModule)throw new Error("Archive entrypoint missing");
      const { renderLiveResearchResults }=await import(loadedModule.src);
      const container = document.querySelector("#author-dossier-research-section");
      const record = { canonical_name: "Anténor Firmin", alternate_names: [], works: [] };
      const results = container.querySelector(".author-live-results");
      const status = container.querySelector(".author-live-status");
      window.__liveBookmarkFixture = { renderLiveResearchResults, record, results, status, fixture };
      renderLiveResearchResults(record, { results: [fixture] }, results, status);
    }, liveFixture);
    assert.equal(await page.locator(".author-live-result").count(), 1,
      "Live federated matches must render as research cards");
    assert.equal(await page.locator(".author-live-result .research-save-button").count(), 0,
      "Anonymous visitors must never see live-work bookmark controls");
    assert.equal(await page.locator(".author-live-result a").first().getAttribute("href"),
      liveFixture.urls.canonical, "The original federated source link must remain available");

    // Simulate the verified-session display flag. Actual persistence is still
    // protected by Firebase's verified currentUser check in the save manager.
    await page.evaluate(() => {
      localStorage.setItem("research-auth-verified-v1", JSON.stringify({
        verified: true, updatedAt: Date.now()
      }));
      const { renderLiveResearchResults, record, results, status, fixture } = window.__liveBookmarkFixture;
      renderLiveResearchResults(record, { results: [fixture] }, results, status);
    });
    const liveSaveButton = page.locator(".author-live-result .research-save-button");
    assert.equal(await liveSaveButton.count(), 1,
      "Verified readers must see one bookmark for each live work");
    assert.equal(await liveSaveButton.getAttribute("aria-pressed"), "false");
    assert.equal(await liveSaveButton.getAttribute("data-save-work-key"),
      "source:archive-test-firmin-1885");
    assert.match(await liveSaveButton.getAttribute("aria-label"), /Guardar/);
    // The click would correctly redirect to login without a real verified
    // Firebase user. Here we only test the UI gate; the shared picker smoke
    // verifies actual save, multi-project assignment and unsave behavior.
    const preparedPayload = await page.evaluate(async fixture => {
      const { liveResultBookmarkPayload } = await import("./js/latin-american-live-work.js");
      return liveResultBookmarkPayload(fixture, fixture.urls.canonical);
    }, liveFixture);
    assert.equal(preparedPayload.title, liveFixture.title);
    assert.equal(preparedPayload.referenceUrl, liveFixture.urls.canonical,
      "Saved records must retain a traceable original-source URL");
    await page.evaluate(() => {
      localStorage.removeItem("research-auth-verified-v1");
      const { renderLiveResearchResults, record, results, status, fixture } = window.__liveBookmarkFixture;
      renderLiveResearchResults(record, { results: [fixture] }, results, status);
    });
    assert.equal(await page.locator(".author-live-result .research-save-button").count(), 0,
      "Returning to anonymous mode must not expose saved controls");

    const dialogBox = await page.locator("#author-dialog").boundingBox();
    assert.ok(dialogBox && dialogBox.x >= -2 && dialogBox.x + dialogBox.width <= width + 2,
      "Dossier must fit the viewport at " + width + "px: " + JSON.stringify(dialogBox));

    await settlePaint(page);
    await page.screenshot({
      path: ARTIFACTS + "/author-" + width + "-light.png",
      animations: "disabled"
    });

    await page.locator("#author-dialog-close").click();
    assert.equal(await page.locator("#author-dialog").evaluate(dialog => dialog.open), false,
      "Closing the dossier must restore the archive beneath it");

    await page.goto(PAGE_URL + firminHref, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
      document.querySelector("#author-dialog")?.open &&
      document.querySelector("#author-dialog-title")?.textContent?.includes("Firmin")
    , null, { timeout: 18000 });
    assert.equal(new URL(page.url()).pathname, new URL(PAGE_URL).pathname,
      "Opening a shared dossier link must not redirect to the homepage");
    await page.locator("#author-dialog-close").click();

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
      "ARTICLE",
      "Every canonical author must expose a dossier card after full coverage"
    );
    assert.equal(
      await finalCard.getAttribute("role"),
      null,
      "Canonical author cards must use real links instead of modal button roles"
    );
    assert.equal(
      await finalCard.locator(".author-card-link").count(),
      1,
      "Every canonical author card must expose one direct author link"
    );
    assert.ok(
      (await finalCard.locator(".author-state").textContent()).includes("archivo bibliográfico"),
      "Completed author cards must be marked as bibliographic archives"
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

    const originariosToggle = page.locator("#coleccion-originarios .period-group-toggle");
    assert.equal(
      await originariosToggle.getAttribute("aria-expanded"),
      "true",
      "Selected period must open as an expanded editorial group"
    );
    await originariosToggle.click();
    assert.equal(
      await originariosToggle.getAttribute("aria-expanded"),
      "false",
      "Period groups must be collapsible"
    );
    await originariosToggle.click();

    await page.locator("#period-author-search").fill("Firmin");
    await page.waitForFunction(() =>
      document.querySelector("#author-explorer-results")?.textContent?.includes("Anténor Firmin")
    );
    assert.ok(
      await page.locator("#author-explorer-results .author-profile-card").count() >= 1,
      "Explorer search must return a rich author card from the full canonical inventory"
    );
    await page.locator("#period-author-search").fill("");
    await page.waitForFunction(() =>
      document.querySelector("#periodized-authors")?.hidden === false
    );

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
    await page.locator("#author-directory .author-card .author-card-link").first().click();
    await page.waitForFunction(() =>
      document.querySelector("#author-dialog")?.open &&
      document.querySelector("#author-dialog-title")?.textContent?.includes("Firmin") &&
      document.querySelector("#author-dossier-works-section")
    , null, { timeout: 18000 });
    assert.equal(new URL(page.url()).pathname, new URL(PAGE_URL).pathname,
      "Dark-theme author dossier must stay on this page");
    assert.deepEqual(pageErrors, [], "Page must not emit uncaught JS errors");

    await settlePaint(page);
    await page.screenshot({
      path: ARTIFACTS + "/author-" + width + "-dark.png",
      animations: "disabled"
    });

    await page.locator("#author-dialog-close").click();
        await page.locator("#author-search").fill("");

    await page.screenshot({
      path: ARTIFACTS + "/archive-" + width + "-dark.png",
      fullPage: true,
      animations: "disabled"
    });

    // Real matrix dossier and shared renderer: no new bibliographic records.
    await page.goto(PAGE_URL+"#autor-0098",{waitUntil:"domcontentloaded"});
    await page.locator("#author-dossier-history-section").waitFor({state:"visible",timeout:18000});
    const life=page.locator("#author-dossier-history-section");
    const toggle=life.locator(".author-intellectual-history-toggle");
    assert.equal(await toggle.getAttribute("aria-expanded"),"false");
    assert.equal(await page.locator("#author-dialog-title").textContent(),"Antonio Caso");
    const originalCount=await page.locator("#author-dossier-works").textContent();
    await toggle.click();
    assert.equal(await life.locator(".author-intellectual-history-event").count(),3);
    await life.getByRole("button",{name:"Mostrar más hitos"}).click();
    assert.equal(await life.locator(".author-intellectual-history-event").count(),6);
    assert.equal(await life.locator(".author-intellectual-history-kind").nth(4).textContent(),"Edición revisada");
    assert.equal(await page.locator("#author-dossier-works").textContent(),originalCount);
    const fits=await life.evaluate(root=>{
      const r=root.getBoundingClientRect();
      return [...root.querySelectorAll("button,li,strong,a")].every(e=>{
        const b=e.getBoundingClientRect();
        return !b.width||(b.left>=r.left-1&&b.right<=r.right+1&&(e.clientWidth===0||e.scrollWidth<=e.clientWidth+2));
      });
    });
    assert.ok(fits,"Shared panel must fit the LATAM dossier");
    await life.screenshot({path:ARTIFACTS+"/history-"+width+".png",animations:"disabled"});
    await page.locator("#author-dialog-close").click();
    await page.goto(PAGE_URL+"#autor-0001",{waitUntil:"domcontentloaded"});
    await page.locator("#author-dossier-history-section").waitFor({state:"visible",timeout:18000});
    assert.match(await life.textContent(),/Cronología del expediente/);
    await toggle.click();
    assert.match(await life.locator(".author-intellectual-history-date").first().textContent(),/c\. 1398/);
    assert.match(await life.locator(".author-intellectual-history-kind").allTextContents().then(a=>a.join(" ")),/Contribución intelectual/);
    assert.equal(await life.locator(".author-intellectual-history-source").count(),0,"Do not attach dossier-wide citations to an individual event");
    await page.locator("#author-dialog-close").click();
    await page.goto(PAGE_URL+"#autor-0380",{waitUntil:"domcontentloaded"});
    await page.locator("#author-dossier-history-section").waitFor({state:"visible",timeout:18000});
    await toggle.click();
    assert.equal(await life.locator(".author-intellectual-history-event").count(),3);
    assert.ok(await life.locator(".author-intellectual-history-source").count()>0);
    await page.locator("#author-dialog-close").click();
    await page.goto(PAGE_URL+"#autor-1187",{waitUntil:"domcontentloaded"});
    await page.locator("#author-dossier-works-section").waitFor({state:"attached",timeout:18000});
    assert.equal(await page.locator("#author-dossier-history-section").count(),0);
    assert.equal(await page.locator('[data-dossier-target="author-dossier-history-section"]').isVisible(),false);
    assert.deepEqual(pageErrors,[],"Bridge must not emit uncaught JS errors");
    await context.close();
  }

  process.stdout.write("Latin American philosophy responsive smoke OK\n");
} finally {
  await browser.close();
}
