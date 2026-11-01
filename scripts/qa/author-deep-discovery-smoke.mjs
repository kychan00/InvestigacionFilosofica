import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const origin=process.env.MOBILE_UI_BASE_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
await mkdir("artifacts/author-deep-discovery",{recursive:true});
const authorId="5082752736";
const orcid="0000-0002-8595-8693";
const authorName="Ángeles Eraña";

const snapshot=[
 {id:Number(authorId),wid:1001,t:"Obra del índice 1",y:2015,l:"es",ty:"article"},
 {id:Number(authorId),wid:1002,t:"Obra del índice 2",y:2017,l:"es",ty:"article"}
];
function liveWork(wid,title,year) {
 return {
  id:"https://openalex.org/W"+wid,title,display_name:title,
  publication_year:year,publication_date:year+"-06-18",
  type:"article",language:"es",doi:"https://doi.org/10.1000/"+wid,
  authorships:[{
   author:{id:"https://openalex.org/A"+authorId,display_name:authorName,
    orcid:"https://orcid.org/"+orcid}
  }],
  open_access:{is_oa:false},primary_location:null,cited_by_count:0
 };
}
let scanCalls=0, scanFilter="";
try {
 for(const theme of ["light","dark"]) {
  const page=await browser.newPage({viewport:{width:390,height:850},
   isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const errors=[];
  const failures=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("requestfailed",request=>failures.push(request.url()+" "+request.failure()?.errorText));
  await page.route("**/*",route=>{
   const url=new URL(route.request().url());
   // The app imports franc-min from esm.sh. Stub the third-party module
   // so this test isolates author discovery without requiring CDN access.
   if(url.hostname==="esm.sh"&&url.pathname.startsWith("/franc-min")) {
    return route.fulfill({status:200,contentType:"application/javascript",
     body:"export function francAll(){return [];}"}); 
   }
   if(url.hostname==="api.openalex.org"&&url.pathname==="/works"){
    scanCalls++;
    scanFilter=url.searchParams.get("filter");
    return route.fulfill({status:200,contentType:"application/json",
     body:JSON.stringify({meta:{count:4,next_cursor:null},results:[
       liveWork(1001,"Obra del índice 1",2015),
       liveWork(1002,"Obra del índice 2",2017),
       liveWork(1003,"Tercera obra verificada",2022),
       liveWork(1004,"Cuarta obra verificada",2024)
     ]})});
   }
   if(url.pathname.includes("/data/authors/author-index-v2/")){
    const body=url.pathname.includes("/works/")?
     snapshot.map(row=>JSON.stringify(row)).join("\n")+"\n":"";
    return route.fulfill({status:200,contentType:"text/plain",body});
   }
   if(url.origin===new URL(origin).origin) return route.continue();
   return route.abort();
  });

  const url=new URL(origin);
  url.searchParams.set("view","author");
  url.searchParams.set("author",authorName);
  url.searchParams.set("authorId",authorId);
  url.searchParams.set("authorOrcid","https://orcid.org/"+orcid);
  url.hash="results";
  await page.goto(url.toString(),{waitUntil:"domcontentloaded"});
  await page.locator('[data-theme-choice="'+theme+'"]').click();
  try {
   await page.waitForFunction(()=>document.body.classList.contains("author-view"),
     null,{timeout:7000});
  } catch {
   const diagnostics=await page.evaluate(()=>({
     title:document.title,
     bodyClass:document.body.className,
     status:document.querySelector("#status")?.textContent,
     scriptSources:[...document.scripts].map(x=>x.src).filter(Boolean)
   }));
   throw Error("Profile failed to initialize: "+JSON.stringify({diagnostics,errors,
     failures:failures.slice(0,12),scanCalls}));
  }
  try {
   await page.waitForFunction(()=>
    document.querySelectorAll(".author-work-grid .result-card").length>=4,
    null,{timeout:8500});
  } catch {
   const report=await page.evaluate(()=>({
    title:document.title,
    status:document.querySelector("#status")?.textContent,
    authorOnly:document.body.classList.contains("author-view"),
    cards:document.querySelectorAll(".author-work-grid .result-card").length,
    archive:document.querySelector(".author-archive-discovery")?.textContent,
    results:document.querySelector("#results")?.textContent?.slice(0,350),
    errors:[...document.querySelectorAll(".error")].map(x=>x.textContent)
   }));
   throw Error("Profile did not expand: "+JSON.stringify({report,errors,
     failures:failures.slice(0,20),scanCalls,scanFilter}));
  }
  const state=await page.evaluate(()=>{
   const cards=[...document.querySelectorAll(".author-work-grid .result-card")];
   const stats=document.querySelector("#stats");
   const bg=getComputedStyle(stats).backgroundColor;
   const ink=getComputedStyle(stats.querySelector(".stat strong")).color;
   return {
    cardCount:cards.length,
    titles:cards.map(x=>x.querySelector("h2")?.textContent.trim()),
    notice:document.querySelector(".author-archive-discovery")?.textContent,
    statsBg:bg,statsInk:ink,
    scrollWidth:document.documentElement.scrollWidth,
    width:innerWidth
   };
  });
  assert.equal(state.cardCount,4);
  assert.ok(state.titles.includes("Tercera obra verificada"));
  assert.ok(state.titles.includes("Cuarta obra verificada"));
  assert.ok(/OpenAlex|Fuentes consultadas/.test(state.notice),"Archive progress must be visible");
  assert.ok(state.scrollWidth<=state.width+2,"No mobile overflow");
  if(theme==="dark"){
    assert.equal(state.statsBg,"rgb(22, 22, 22)");
    assert.equal(state.statsInk,"rgb(244, 244, 244)");
  }
  await page.locator("#stats").scrollIntoViewIfNeeded();
  await page.screenshot({
   path:"artifacts/author-deep-discovery/"+theme+"-stats-390.png",
   animations:"disabled"
  });
  await page.locator(".author-page-works").scrollIntoViewIfNeeded();
  await page.screenshot({
   path:"artifacts/author-deep-discovery/"+theme+"-works-390.png",
   animations:"disabled"
  });
  await page.close();
  process.stdout.write("Ángeles Eraña route deep search "+theme+" OK\n");
 }
 assert.ok(scanCalls>=2,"New-tab profiles must always trigger live author scan");
 assert.equal(scanFilter,"authorships.author.id:A"+authorId);
}finally{await browser.close();}
