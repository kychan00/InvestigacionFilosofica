/* Functional, no screenshots: Protrepsis mural, quick navigator,
   live article reader and full-width semantic relations. */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE=process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const records=[
  {
    id:"pro-ux-a",sourceId:"pro-ux-a",journal:"Protrepsis",issueNumber:27,
    title:"El lenguaje y la verdad en la filosofía contemporánea",
    abstract:"El lenguaje y la verdad constituyen preguntas centrales de la filosofía.\n\nEl conocimiento filosófico se comunica mediante argumentos y diálogos que relacionan lenguaje y verdad.",
    authors:[{name:"María González"}],year:2025,language:"es",
    doi:"10.1234/pro-ux-a",subjects:["Lenguaje","Filosofía"],
    urls:{canonical:"https://example.org/pro-a"}
  },
  {
    id:"pro-ux-b",sourceId:"pro-ux-b",journal:"Protrepsis",issueNumber:28,
    title:"Lenguaje, conocimiento y verdad en el pensamiento filosófico",
    abstract:"La verdad y el lenguaje permiten examinar el conocimiento y las formas de argumentación.\n\nEl pensamiento filosófico relaciona preguntas, conocimiento, argumentos y lenguaje.",
    authors:[{name:"José Martínez"}],year:2024,language:"es",
    doi:"10.1234/pro-ux-b",subjects:["Lenguaje","Filosofía"],
    urls:{canonical:"https://example.org/pro-b"}
  }
];
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});

try {
  for(const [name,width,height,theme] of [
    ["phone",390,844,"light"],
    ["tablet",820,1180,"light"],
    ["desktop",1440,900,"dark"]
  ]) {
    const context=await browser.newContext({
      viewport:{width,height},colorScheme:theme,reducedMotion:"reduce"
    });
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.route("**/*",route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith("/src/data/cucsh-filosofia.json"))
        return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({provider:"CUCSH Filosofía",records})});
      if(url.origin===new URL(BASE).origin) return route.continue();
      return route.abort();
    });
    const response=await page.goto(new URL("revistas/udg/protrepsis.html",BASE).href,{waitUntil:"domcontentloaded"});
    assert.equal(response?.status(),200,name+" load");
    await page.waitForFunction(()=>document.querySelector("#journal-total")?.textContent==="2",null,{timeout:18000});
    assert.equal(await page.locator(".pro-museum-art").count(),1);
    assert.equal(await page.locator(".pro-museum-caption").count(),1);
    assert.equal(await page.locator(".pro-museum-corner,.pro-museum-seal,.pro-museum-plaque").count(),0);

    const topics=page.locator("#pro-explorer-tab-topics");
    const issues=page.locator("#pro-explorer-tab-issues");
    const filters=page.locator("#pro-explorer-tab-filters");
    assert.equal(await topics.getAttribute("aria-selected"),"true");
    assert.equal(await page.locator("#pro-explorer-topics").isVisible(),true);
    assert.equal(await page.locator("#pro-explorer-issues").isVisible(),false);
    await issues.click();
    assert.equal(await issues.getAttribute("aria-selected"),"true");
    assert.equal(await page.locator("#pro-explorer-issues").isVisible(),true);
    assert.equal(await page.locator("#pro-explorer-topics").isVisible(),false);
    await filters.click();
    assert.equal(await page.locator("#pro-explorer-filters").isVisible(),true);
    assert.equal(await page.locator(".journal-filter-body").isVisible(),true);
    await filters.press("Home");
    assert.equal(await topics.getAttribute("aria-selected"),"true");
    await topics.press("ArrowRight");
    assert.equal(await issues.getAttribute("aria-selected"),"true");

    // At the Atlas, the reader is separate from the map and relations
    // occupy their own region, with live article navigation intact.
    await page.locator('[data-journal-view="atlas"]').click();
    await page.waitForFunction(()=>document.querySelector("#journal-atlas-status")?.textContent?.includes("2 nodos"),null,{timeout:20000});
    assert.equal(await page.locator(".pro-atlas-reader").count(),1);
    assert.equal(await page.locator("#journal-atlas-relations").count(),1);
    assert.equal(await page.locator(".pro-atlas-map-footer #journal-atlas-legend").count(),1);
    assert.equal(await page.locator("#journal-atlas-detail .atlas-related-section").count(),0);
    assert.equal(await page.locator("#journal-atlas-relations .atlas-related-section").count(),1);
    assert.equal(await page.locator("#journal-atlas-detail .atlas-abstract-body p").count(),2);

    const originalTitle=await page.locator("#journal-atlas-detail h3").innerText();
    assert.match(await page.locator("#journal-atlas-detail .atlas-abstract-body").innerText(),/lenguaje/i);
    const sheet=page.locator("#journal-atlas-detail [data-article-sheet]");
    await sheet.locator("summary").click();
    assert.equal(await sheet.evaluate(element=>element.open),true);
    assert.match(await page.locator("#journal-atlas-detail .atlas-article-sheet-fields").innerText(),/Protrepsis/);
    assert.ok(await page.locator("#journal-atlas-relations .atlas-related-focus").count()>=1);

    await page.locator("#journal-atlas-relations .atlas-related-sheet").first().click();
    const nextTitle=await page.locator("#journal-atlas-detail h3").innerText();
    assert.notEqual(nextTitle,originalTitle,name+" related article navigation");
    assert.equal(await page.locator("#journal-atlas-detail [data-article-sheet]").evaluate(element=>element.open),true);
    assert.equal(await page.locator("#journal-atlas-relations .atlas-related-section").count(),1);
    assert.deepEqual(errors,[],name+" browser exceptions");
    await context.close();
  }
  console.log("Protrepsis article reading desk and quick explorer functional regression OK");
} finally {
  await browser.close();
}
