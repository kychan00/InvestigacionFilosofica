/* Functional browser smoke for the Protrepsis editorial rebuild.
 * No screenshots, visual comparisons, pixel measurements or image artifacts.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

async function visit(context, pathname) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === new URL(BASE).origin) return route.continue();
    return route.abort();
  });
  const response = await page.goto(new URL(pathname, BASE).href, {waitUntil:"domcontentloaded"});
  assert.equal(response?.status(), 200, "HTTP status of " + pathname);
  return {page, errors};
}

try {
  for (const [name, width, height, theme] of [
    ["phone",390,844,"light"],
    ["tablet",820,1180,"light"],
    ["desktop",1440,900,"dark"]
  ]) {
    const context = await browser.newContext({
      viewport: {width,height}, colorScheme:theme, reducedMotion:"reduce"
    });
    const {page,errors} = await visit(context,"revistas/udg/protrepsis.html");
    await page.waitForFunction(
      () => Number(document.querySelector("#journal-total")?.textContent) === 248,
      null,{timeout:20000}
    );
    assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
    assert.equal(await page.locator(".pro-museum-art").count(),1);
    assert.equal(await page.locator(".pro-museum-caption").count(),1);
    assert.equal(await page.locator(".pro-museum-corner").count(),0);
    assert.equal(await page.locator(".pro-museum-seal").count(),0);
    assert.equal(await page.locator('[data-pro-explorer-tab="topics"]').getAttribute("aria-selected"),"true");
    assert.equal(await page.locator(".pro-editorial-feature-link").count(),1);
    assert.equal(
      await page.locator(".pro-museum-art").evaluate(img => img.complete && img.naturalWidth>0),
      true,"local original mural must load"
    );
    assert.equal(
      await page.locator("body").evaluate(el => /jardín de las preguntas/i.test(el.innerText)),
      false,"the rejected concept may not appear in public labels"
    );
    await page.waitForFunction(
      () => {
        const cards=document.querySelectorAll("#journal-card-grid > .journal-card");
        return cards.length===18 && [...cards].every(card=>
          card.classList.contains("pro-catalog-card") &&
          !!card.querySelector(".pro-catalog-art svg") &&
          !!card.querySelector(".journal-card-body h3") &&
          !!card.querySelector(".journal-card-actions button")
        );
      },null,{timeout:20000}
    );
    const firstCard=page.locator(".pro-catalog-card").first();
    const title=(await firstCard.locator("h3").innerText()).trim();
    assert.ok(title.length>0);
    assert.ok(await firstCard.locator(".journal-card-byline").count());
    await firstCard.locator(".journal-card-actions button").click();
    assert.equal(await firstCard.locator(".journal-card-details").isVisible(),true);
    const load=page.locator("#journal-load-more");
    assert.equal(await load.isVisible(),true);
    await load.click();
    await page.waitForFunction(
      () => {
        const cards=[...document.querySelectorAll("#journal-card-grid > .journal-card")];
        return cards.length===36 && cards.every(card=>
          card.classList.contains("pro-catalog-card") &&
          card.querySelector(".pro-catalog-art svg") &&
          card.querySelector(".journal-card-byline")
        );
      },null,{timeout:20000}
    );
    await page.locator('[data-pro-explorer-tab="filters"]').click();
    assert.equal(await page.locator("#pro-explorer-filters").isVisible(),true);
    const filterToggle=page.locator("#journal-filter-toggle");
    if(await filterToggle.getAttribute("aria-expanded")==="false") await filterToggle.click();
    await page.locator("#journal-query").fill(title);
    await page.waitForFunction(
      () => {
        const cards=[...document.querySelectorAll("#journal-card-grid > .journal-card")];
        return cards.length>0 && cards.length<36 && cards.every(card=>
          card.classList.contains("pro-catalog-card"));
      },null,{timeout:12000}
    );
    await page.locator("#journal-reset").click();
    await page.locator('[data-journal-view="atlas"]').click();
    assert.equal(await page.locator("#journal-atlas-panel").isVisible(),true);
    assert.equal(await page.locator("#journal-atlas-relations").count(),1);
    assert.equal(await page.locator(".pro-atlas-reader").count(),1);
    await page.locator('[data-journal-view="insights"]').click();
    assert.equal(await page.locator("#journal-insights-panel").isVisible(),true);
    await page.locator('[data-journal-view="archive"]').click();
    assert.equal(await page.locator("#journal-archive-panel").isVisible(),true);
    assert.equal(await page.locator(".site-menu-link[href*='-institucional.html']").count(),0);
    if(width<=820) {
      await page.locator(".site-menu-toggle").click();
      assert.equal(await page.locator("#site-mobile-menu").getAttribute("aria-hidden"),"false");
      await page.locator(".site-menu-close").click();
    }
    assert.deepEqual(errors,[],name+" page errors");
    await context.close();
  }

  const context = await browser.newContext({viewport:{width:390,height:844},colorScheme:"light"});
  const {page,errors} = await visit(context,"revistas/udg/protrepsis-institucional.html");
  assert.equal(await page.locator(".person").count(),69);
  assert.equal(await page.locator(".pro-profile-companion").count(),1);
  assert.equal(await page.locator(".pro-profile-mural").count(),1);
  assert.equal(await page.locator(".pro-profile-mural").evaluate(img=>img.complete&&img.naturalWidth>0),true);
  assert.equal(await page.locator(".pro-profile-companion a").getAttribute("href"),"protrepsis.html#journal-views");
  assert.equal(await page.locator("body").evaluate(el=>/jardín de las preguntas/i.test(el.innerText)),false);
  assert.deepEqual(errors,[],"institutional page errors");
  await context.close();
  console.log("Protrepsis functional magazine smoke OK: 248 records, folios, metadata, filters, Atlas and directory");
} finally {
  await browser.close();
}
