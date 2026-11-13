/* Contrato funcional, sin capturas ni diffs visuales: filtros por tema y número,
 * selección accesible, reinicios independientes, móvil y movimiento reducido.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
const BASE=process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const records=[
  ["p1","Ética, responsabilidad y vida común",21,"Es un estudio ético y moral.",["Ética"]],
  ["p2","Política y ciudadanía democrática",21,"Un estudio político sobre ciudadanía.",["Política"]],
  ["p3","Epistemología del conocimiento",22,"Conocimiento y epistemología.",["Conocimiento"]],
  ["p4","Estética de las imágenes",22,"Estética y arte en la filosofía.",["Estética"]],
  ["p5","Ontología de la realidad",23,"Ontología y metafísica.",["Ontología"]],
  ["p6","Ética y virtud",23,"Ética y responsabilidad.",["Ética"]]
].map(([id,title,issueNumber,abstract,subjects])=>({
  id:"cucsh:"+id,sourceId:id,journal:"Protrepsis",issueNumber,
  title,year:2024,language:"es",authors:[{name:"Autora de prueba"}],
  doi:"10.32870/prot.i"+issueNumber+"."+id,
  abstract,subjects,urls:{canonical:"https://example.org/"+id}
}));

const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try {
  for(const [theme,reducedMotion] of [["light","no-preference"],["dark","reduce"]]){
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme,reducedMotion});
    const page=await context.newPage();
    const pageErrors=[];
    page.on("pageerror",error=>pageErrors.push(error.message));
    await page.route("**/*",route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith("/src/data/cucsh-filosofia.json"))
        return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({provider:"CUCSH Filosofía",records})});
      if(url.origin===new URL(BASE).origin)return route.continue();
      return route.abort();
    });
    const response=await page.goto(new URL("revistas/udg/protrepsis.html",BASE).href,{waitUntil:"domcontentloaded"});
    assert.equal(response?.status(),200);
    await page.waitForFunction(()=>Number(document.querySelector("#journal-total")?.textContent)===6,null,{timeout:16000});
    assert.equal(await page.locator("#journal-card-grid .journal-card").count(),6);
    assert.equal(await page.locator("#journal-category-all").getAttribute("aria-pressed"),"true");
    assert.equal(await page.locator("#journal-issue-all").getAttribute("aria-pressed"),"true");
    const issues=page.locator("#journal-issue-chips");
    assert.equal(await issues.locator("button").count(),3);
    const maxHeight=await issues.evaluate(node=>getComputedStyle(node).maxHeight);
    assert.equal(maxHeight,"none","Ningún número debe quedar escondido en una lista recortada");
    const firstCategory=page.locator('#journal-category-chips button[data-taxonomy-value="Ética"]');
    assert.equal(await firstCategory.count(),1);
    await firstCategory.click();
    assert.equal(await page.locator("#journal-card-grid .journal-card").count(),2);
    assert.equal(await firstCategory.getAttribute("aria-pressed"),"true");
    assert.equal(await page.locator("#journal-category-all").getAttribute("aria-pressed"),"false");
    assert.equal(await page.locator("#journal-issue-all").getAttribute("aria-pressed"),"true");

    // El mismo chip funciona como interruptor, sin obligar a buscar un reset.
    await firstCategory.click();
    assert.equal(await page.locator("#journal-card-grid .journal-card").count(),6);
    assert.equal(await firstCategory.getAttribute("aria-pressed"),"false");

    const issue21=issues.locator("button").filter({hasText:"Núm. 21"});
    await issue21.click();
    assert.equal(await page.locator("#journal-card-grid .journal-card").count(),2);
    assert.equal(await issue21.getAttribute("aria-pressed"),"true");
    assert.equal(await page.locator("#journal-issue-all").getAttribute("aria-pressed"),"false");

    await page.locator("#journal-issue-all").click();
    assert.equal(await page.locator("#journal-card-grid .journal-card").count(),6);
    assert.equal(await issue21.getAttribute("aria-pressed"),"false");
    assert.equal(await page.locator("#journal-issue-all").getAttribute("aria-pressed"),"true");

    // Dos filtros simultáneos: al liberar uno, el otro permanece vigente.
    await firstCategory.click();
    const issue23=issues.locator("button").filter({hasText:"Núm. 23"});
    await issue23.click();
    assert.equal(await page.locator("#journal-card-grid .journal-card").count(),1);
    await page.locator("#journal-issue-all").click();
    assert.equal(await page.locator("#journal-card-grid .journal-card").count(),2);
    assert.equal(await firstCategory.getAttribute("aria-pressed"),"true");
    await page.locator("#journal-category-all").click();
    assert.equal(await page.locator("#journal-card-grid .journal-card").count(),6);

    // En móvil, los selects tradicionales viven dentro del panel plegable.
    // Abrirlo antes de comprobar selectOption y el reset global.
    const filterToggle=page.locator("#journal-filter-toggle");
    if(await filterToggle.getAttribute("aria-expanded")==="false") await filterToggle.click();
    assert.equal(await page.locator(".journal-filter-body").isVisible(),true);
    // El selector tradicional debe reflejarse en los chips.
    const politicalValue=await page.locator("#journal-category option").evaluateAll(
      options=>options.find(option=>option.textContent?.includes("Política"))?.value
    );
    assert.ok(politicalValue,"Must find the Política navigation category");
    await page.locator("#journal-category").selectOption(politicalValue);
    assert.equal(await page.locator("#journal-card-grid .journal-card").count(),1);
    assert.equal(await page.locator('#journal-category-chips button[data-taxonomy-value="Política"]').getAttribute("aria-pressed"),"true");
    await page.locator("#journal-reset").click();
    assert.equal(await page.locator("#journal-card-grid .journal-card").count(),6);
    assert.equal(await page.locator("#journal-category-all").getAttribute("aria-pressed"),"true");
    assert.equal(await page.locator("#journal-issue-all").getAttribute("aria-pressed"),"true");

    const cardMotion=await page.locator("#journal-card-grid .journal-card").first()
      .evaluate(node=>getComputedStyle(node).animationName);
    if(reducedMotion==="reduce")assert.equal(cardMotion,"none");
    else assert.match(cardMotion,/pro-curatorial-results/);
    assert.deepEqual(pageErrors,[],theme+" page errors");
    await context.close();
  }
  console.log("Protrepsis museum taxonomy smoke OK: mobile facets, reset, accessibility, full issues, and reduced motion.");
} finally {
  await browser.close();
}
