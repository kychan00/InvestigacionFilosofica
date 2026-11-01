import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const BASE=process.env.MOBILE_UI_BASE_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
await mkdir("artifacts/author-federated-coverage",{recursive:true});

const archiveItems=[
 {identifier:"dinora-perspectiva",title:"La perspectiva de la imbricación",creator:"Dinora Hernández",year:1900},
 {identifier:"dinora-frankfurt-2010",title:"La escuela de Frankfurt, acercamiento a su filosofía",creator:"Dinora Hernández",year:2010},
 {identifier:"dinora-coordinacion-2019",title:"Teoría crítica, planteamientos, desplazamientos, tensiones",creator:"Dinora Hernández López Hermann Omar Amaya Velasco Coordinadores",year:2019},
 {identifier:"dinora-teoria-2023",title:"Dinora Hernández y colaboradores: Teoría crítica, planteamientos, desplazamientos, tensiones",creator:"Dinora Hernández, Hermann Omar Amaya, Santiago Roggerone",year:2023},
 {identifier:"dinora-escuela-2024",title:"La escuela de Frankfurt: un entramado de disonancias, Dr Dinora Hernández López",creator:"Dinora Hernández López Hermann Omar Amaya Velasco Coordinadores",year:2024},
 {identifier:"dinora-adorno",title:"Theodor W. Adorno: resistencia y briznas",creator:"Dra Dinora Hernández",year:2022},
 {identifier:"noise",title:"Gracias, Dinora",creator:"Sister McCusker",year:1972}
];
try{
 for(const theme of ["light","dark"]){
  const page=await browser.newPage({
    viewport:{width:390,height:850},isMobile:true,hasTouch:true,deviceScaleFactor:1
  });
  const requests=[],errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",route=>{
    const url=new URL(route.request().url());
    if(url.hostname==="api.openalex.org"){
      requests.push("FORBIDDEN OpenAlex");return route.abort();
    }
    if(url.hostname==="esm.sh"&&url.pathname.startsWith("/franc-min"))
      return route.fulfill({status:200,contentType:"application/javascript",
        body:"export function francAll(){return [];}"});
    if(url.hostname==="www.wikidata.org")
      return route.fulfill({status:200,contentType:"application/json",
        headers:{"access-control-allow-origin":"*"},
        body:JSON.stringify({search:[],entities:{}})});
    if(url.pathname.includes("/data/authors/author-index-v2/"))
      return route.fulfill({status:200,contentType:"text/plain",body:""});
    if(url.pathname.endsWith("/src/data/cucsh-filosofia.json"))
      return route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({records:[
          {id:"cucsh:dinora2024",title:"La Escuela de Frankfurt: Un entramado de disonancias",year:2024,
            authors:[{name:"Dinora Hernández López"}],language:"es",type:"journal-article"}
        ]})});
    if(url.hostname==="archive.org"&&url.pathname==="/advancedsearch.php"){
      requests.push("archive "+url.searchParams.get("q"));
      return route.fulfill({status:200,contentType:"application/json",
        headers:{"access-control-allow-origin":"*"},
        body:JSON.stringify({response:{numFound:archiveItems.length,docs:archiveItems}})});
    }
    if(url.hostname==="api.crossref.org"){
      requests.push("crossref "+url.searchParams.get("query.author"));
      return route.fulfill({status:200,contentType:"application/json",
        headers:{"access-control-allow-origin":"*"},
        body:JSON.stringify({message:{items:[
          {DOI:"10.1111/dinora.2016",type:"journal-article",title:["Reseña crítica de Walter Benjamin"],
            author:[{given:"Dinora",family:"Hernandez"}],
            published:{"date-parts":[[2016]]}},
          {DOI:"10.1111/unrelated.1972",type:"journal-article",title:["Gracias, Dinora"],
            author:[{given:"Peter",family:"McCusker"}],
            published:{"date-parts":[[1972]]}}
        ]}})});
    }
    if(url.origin===new URL(BASE).origin)return route.continue();
    return route.abort();
  });
  const u=new URL(BASE);u.searchParams.set("view","author");
  u.searchParams.set("author","Dra Dinora Hernández");u.hash="results";
  await page.goto(u.toString(),{waitUntil:"domcontentloaded"});
  await page.locator('[data-theme-choice="'+theme+'"]').click();
  try{
    await page.waitForFunction(()=>
      document.querySelectorAll(".author-work-grid .result-card").length>=8 &&
      document.querySelector(".author-archive-discovery")?.textContent.includes("obras"),
      null,{timeout:30000});
  }catch{
    const state=await page.evaluate(()=>({
      heading:document.querySelector(".author-page-hero h1")?.textContent,
      cards:document.querySelectorAll(".author-work-grid .result-card").length,
      text:document.querySelector("#results")?.textContent?.slice(0,900),
      status:document.querySelector("#status")?.textContent,
      summary:document.querySelector(".author-archive-discovery")?.textContent
    }));
    throw new Error("Federated profile failed "+JSON.stringify({theme,state,errors,requests}));
  }
  const titles=await page.locator(".author-work-grid .result-card h2").allTextContents();
  for(const year of [2019,2023,2024]){
    assert.ok(titles.some(t=>t.toLowerCase().includes(year===2024?"entramado":"teoría crítica")),
      "Missing collaborative edition "+year);
  }
  assert.ok(!titles.some(t=>t.includes("Gracias, Dinora")));
  assert.ok(await page.locator(".author-collaboration-tag").count()>=3);
  assert.equal(await page.locator(".author-individual-tag").count(),0);
  const heading=await page.locator(".author-page-hero h1").textContent();
  assert.match(heading,/Dinora Hernández López/);
  assert.ok(requests.some(x=>x.includes("Dinora Hernández López")),
    "Full name discovered from UdeG creators should be searched");
  assert.equal(requests.some(x=>x.startsWith("FORBIDDEN")),false);
  await page.locator(".author-collaboration-summary").scrollIntoViewIfNeeded();
  await page.screenshot({path:"artifacts/author-federated-coverage/dinora-"+theme+".png",
    animations:"disabled"});
  await page.close();
  process.stdout.write("Verified collective Dinora archive: "+theme+"\n");
 }
}finally{await browser.close();}
