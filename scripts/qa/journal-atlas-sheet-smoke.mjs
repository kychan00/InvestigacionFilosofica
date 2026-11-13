/* Verificación funcional sin capturas ni pruebas visuales:
 * seleccionar nodos, leer resúmenes, desplegar fichas y cambiar a relacionados.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const configurations = [
  ["protrepsis", "revistas/udg/protrepsis.html", "Protrepsis", 26],
  ["sincronia", "revistas/udg/sincronia.html", "Sincronía", 91],
  ["quadripartita", "revistas/udg/quadripartita-ratio.html", "Quadripartita Ratio", 21]
];
const rows = configurations.flatMap(([slug,,journal,number]) => [
  {
    id: slug + "-a",sourceId:slug + "-a",journal,issueNumber:number,
    title: "El problema del conocimiento en " + journal,
    authors: [{name:"Julia Martínez"}],year:2025,language:"es",
    doi:"10.1234/" + slug + ".a",
    abstract:"Primer párrafo sobre filosofía, lenguaje y verdad.\n\nSegundo párrafo acerca del pensamiento.",
    subjects:["Filosofía","Lenguaje","Verdad"],
    urls:{canonical:"https://example.org/" + slug + "/original"}
  },
  {
    id:slug+"-b",sourceId:slug+"-b",journal,issueNumber:number,
    title:"Lenguaje, conocimiento y verdad en " + journal,
    authors:[{name:"Andrés Silva"}],year:2024,language:"es",
    doi:null,abstract:null,subjects:["Filosofía","Lenguaje","Verdad"],
    urls:{}
  }
]);
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
try {
  for(const [slug,pagePath] of configurations) {
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
    const page=await context.newPage();
    const failures=[];
    page.on("pageerror",error=>failures.push(error.message));
    await page.route("**/*",route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith("/src/data/cucsh-filosofia.json"))
        return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({provider:"CUCSH Filosofía",records:rows})});
      if(url.origin===new URL(base).origin)return route.continue();
      return route.abort();
    });
    const response=await page.goto(new URL(pagePath,base).href,{waitUntil:"domcontentloaded"});
    assert.equal(response?.status(),200,slug+" page");
    await page.waitForFunction(
      ()=>Number(document.querySelector("#journal-total")?.textContent)===2,
      null,{timeout:16000}
    );
    await page.locator('[data-journal-view="atlas"]').click();
    await page.waitForFunction(
      ()=>document.querySelector("#journal-atlas-status")?.textContent?.includes("2 nodos"),
      null,{timeout:16000}
    );
    assert.equal(await page.locator(".atlas-abstract-block").count(),1);
    assert.equal(await page.locator(".atlas-abstract-body p").count(),2);
    assert.match(await page.locator(".atlas-abstract-body").innerText(),/Primer párrafo/);
    assert.match(await page.locator(".atlas-abstract-body").innerText(),/Segundo párrafo/);
    const sheet=page.locator("[data-article-sheet]");
    assert.equal(await sheet.count(),1);
    assert.equal(await sheet.evaluate(e=>e.open),false);
    await sheet.locator("summary").click();
    assert.equal(await sheet.evaluate(e=>e.open),true);
    assert.match(await page.locator(".atlas-article-sheet-fields").innerText(),/Julia Martínez/);
    assert.match(await page.locator(".atlas-article-sheet-fields").innerText(),/10\.1234/);
    assert.equal(await page.locator(".atlas-article-sheet-open").getAttribute("href"),"https://example.org/"+slug+"/original");

    // A related entry can open its own bibliographic sheet from the same atlas.
    const originalTitle=await page.locator("#journal-atlas-detail h3").innerText();
    await page.locator(".atlas-related-sheet").first().click();
    const secondTitle=await page.locator("#journal-atlas-detail h3").innerText();
    assert.notEqual(secondTitle,originalTitle,slug+" related node must be selected");
    assert.equal(await page.locator("[data-article-sheet]").evaluate(e=>e.open),true);
    assert.match(await page.locator(".atlas-abstract-empty").innerText(),/No hay resumen registrado/);
    assert.match(await page.locator(".atlas-article-sheet-unavailable").innerText(),/no proporciona un enlace directo/);
    assert.equal(await page.locator(".atlas-article-sheet-open").count(),0);
    assert.deepEqual(failures,[],slug+" runtime errors");
    await context.close();
  }
  console.log("Journal Atlas abstract and article sheet functional checks OK");
} finally {
  await browser.close();
}
