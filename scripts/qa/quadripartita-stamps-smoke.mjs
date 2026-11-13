import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const out = "artifacts/quadripartita-stamps";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const viewports = [
  ["phone",390,844],["tablet",768,1050],["desktop",1440,900]
];
try {
  for (const [name,width,height] of viewports) {
    for (const theme of ["light","dark"]) {
      const context = await browser.newContext({
        viewport:{width,height},colorScheme:theme,reducedMotion:"reduce"
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror",e=>errors.push(e.message));
      await page.route("**/*",route=>{
        const u = new URL(route.request().url());
        if (u.origin === new URL(BASE).origin) return route.continue();
        return route.abort();
      });
      const response = await page.goto(new URL(
        "revistas/udg/quadripartita-ratio.html",BASE).href,
        {waitUntil:"domcontentloaded"}
      );
      assert.equal(response?.status(),200);
      await page.waitForFunction(()=>Number(document.querySelector("#journal-total")?.textContent)===88,null,{timeout:20000});
      await page.waitForFunction(()=>{
        const cards=document.querySelectorAll("#journal-card-grid > .journal-card");
        return cards.length===18 && [...cards].every(card=>card.dataset.qrStampReady==="true");
      },null,{timeout:20000});
      assert.equal(await page.locator(".qr-stamp-card").count(),18);
      assert.equal(await page.locator(".qr-stamp-engraving svg").count(),18);
      assert.equal(await page.locator(".qr-stamp-engraving svg path").count()>250,true);
      assert.equal(await page.locator(".qr-stamp-number").count(),18);
      assert.equal(await page.locator('a[href="quadripartita-ratio-institucional.html"]').count()>=2,true);
      assert.equal(await page.locator("#journal-year-span").innerText(),"2016—2026");
      assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
      const geometry=await page.evaluate(()=>{
        const r=el=>el.getBoundingClientRect();
        const hero=document.querySelector(".journal-hero");
        const title=document.querySelector(".journal-hero h1");
        const art=document.querySelector(".journal-hero-aside");
        const card=document.querySelector(".qr-stamp-card");
        const paper=document.querySelector(".qr-stamp-paper");
        const mask=getComputedStyle(paper).maskImage;
        const root=document.documentElement;
        return {
          width:innerWidth,scrollWidth:root.scrollWidth,
          titleScroll:title.scrollWidth,titleClient:title.clientWidth,
          hero:r(hero).width,heroTitle:r(title).right,
          artRight:r(art).right,cardRight:r(card).right,
          paperRight:r(paper).right,paperHeight:r(paper).height,
          mask,paperBackground:getComputedStyle(paper).backgroundColor,
          bodyBackground:getComputedStyle(document.body).backgroundColor
        };
      });
      assert.ok(geometry.scrollWidth<=width+3,name+" "+theme+" horizontal overflow: "+JSON.stringify(geometry));
      assert.ok(geometry.titleScroll<=geometry.titleClient+3,name+" clipped heading: "+JSON.stringify(geometry));
      assert.ok(geometry.heroTitle<=width+3,name+" title off screen");
      assert.ok(geometry.artRight<=width+3,name+" illustration off screen");
      assert.ok(geometry.paperRight<=width+3,name+" stamp off screen");
      assert.ok(geometry.paperHeight>310,name+" stamp missing body");
      assert.ok(geometry.mask!=="none",name+" stamp perforation mask absent");
      assert.ok(await page.locator(".qr-stamp-card .journal-card-byline a").count()>=1);
      assert.ok(await page.locator(".qr-stamp-card .journal-card-details").count()>=1);
      await page.locator(".qr-stamp-card .journal-card-actions button").first().click();
      assert.equal(await page.locator(".qr-stamp-card").first().getAttribute("class").then(x=>x.includes("is-expanded")),true);
      assert.equal(await page.locator(".qr-stamp-card .journal-card-details").first().isVisible(),true);
      await page.screenshot({path:out+"/revista-"+name+"-"+theme+".png",fullPage:true,animations:"disabled"});

      // Re-rendering by incremental loading must never remove stamp artwork.
      const load=page.locator("#journal-load-more");
      assert.equal(await load.isVisible(),true);
      await load.click();
      await page.waitForFunction(()=>{
        const cards=document.querySelectorAll("#journal-card-grid > .journal-card");
        return cards.length===36 && [...cards].every(card=>card.classList.contains("qr-stamp-card"));
      });
      assert.equal(await page.locator(".qr-stamp-paper").count(),36);
      assert.equal(await page.locator(".journal-card-byline").count(),36);
      // Filtering also re-renders the card set; no stale or duplicated stamps.
      const select=page.locator("#journal-issue");
      const first=await select.locator('option:not([value="all"])').first().getAttribute("value");
      assert.ok(first);
      await select.selectOption(first);
      await page.waitForFunction(()=>{
        const cards=[...document.querySelectorAll("#journal-card-grid > .journal-card")];
        return cards.length>0&&cards.length<18&&cards.every(c=>c.dataset.qrStampReady==="true");
      });
      assert.equal(await page.locator(".qr-stamp-paper").count(),await page.locator(".journal-card").count());
      await page.locator("#journal-reset").click();
      await page.locator('[data-journal-view="atlas"]').click();
      assert.equal(await page.locator("#journal-atlas-panel").isVisible(),true);
      await page.locator('[data-journal-view="archive"]').click();
      assert.equal(await page.locator("#journal-archive-panel").isVisible(),true);
      assert.deepEqual(errors,[],name+" "+theme+" JavaScript errors");
      await context.close();
    }
  }

  for(const [name,width,height] of viewports){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:"reduce",colorScheme:"light"});
    const page=await context.newPage();
    await page.route("**/*",route=>{
      if(new URL(route.request().url()).origin===new URL(BASE).origin)return route.continue();
      return route.abort();
    });
    const response=await page.goto(new URL("revistas/udg/quadripartita-ratio-institucional.html",BASE).href,{waitUntil:"domcontentloaded"});
    assert.equal(response?.status(),200);
    assert.equal(await page.locator(".qr-institutional-engraving").count(),1);
    assert.equal(await page.locator(".qr-profile-return").count(),1);
    assert.ok(await page.locator(".profile").count()>=1);
    assert.ok(await page.locator(".source-list a").count()>=4);
    const data=await page.evaluate(()=>({
      scrollWidth:document.documentElement.scrollWidth,
      titleScroll:document.querySelector(".ji h1")?.scrollWidth,
      titleClient:document.querySelector(".ji h1")?.clientWidth
    }));
    assert.ok(data.scrollWidth<=width+3,"institutional "+name+" overflow: "+JSON.stringify(data));
    assert.ok(data.titleScroll<=data.titleClient+3,"institutional "+name+" headline clipped");
    await page.screenshot({path:out+"/equipo-"+name+".png",fullPage:true,animations:"disabled"});
    await context.close();
  }
  console.log("Quadripartita cobalt-and-stamp responsive smoke OK");
} finally {
  await browser.close();
}
