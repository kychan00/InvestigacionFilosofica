import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {authorBucket,authorNameSignature} from "../../src/core/remote-author-resolution.js";

const BASE=process.env.MOBILE_UI_BASE_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
await mkdir("artifacts/author-name-lookup",{recursive:true});
const name="Dinora Hernández",authorId="7654321";
const bucket=(id)=>String(authorBucket(id)).padStart(4,"0");
const aliasBucket=bucket(authorNameSignature(name));
const workBucket=bucket(authorId);
const candidate={s:authorNameSignature(name),id:Number(authorId),
  n:"Dinora Hernández",o:null,cw:4,w:4,c:0,k:"full"};
const works=[
  ["101","Teoría crítica y filosofía",2020],
  ["102","Adorno y la dialéctica",2021],
  ["103","Filosofía feminista",2023],
  ["104","Resistencia y pensamiento crítico",2024]
].map(([wid,t,y])=>({id:Number(authorId),wid:Number(wid),t,y,l:"es",ty:"article"}));

try{
 for(const theme of ["light","dark"]){
  const page=await browser.newPage({
    viewport:{width:390,height:850},isMobile:true,hasTouch:true,deviceScaleFactor:1
  });
  const errors=[],requests=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",route=>{
    const url=new URL(route.request().url());
    if(url.hostname==="api.openalex.org"){
      requests.push("FORBIDDEN "+url.href);
      return route.abort();
    }
    if(url.hostname==="esm.sh"&&url.pathname.startsWith("/franc-min"))
      return route.fulfill({status:200,contentType:"application/javascript",
        body:"export function francAll(){return [];}"}); 
    if(url.hostname==="www.wikidata.org")
      return route.fulfill({status:200,contentType:"application/json",
        headers:{"access-control-allow-origin":"*"},
        body:JSON.stringify({search:[],entities:{}})});
    if(url.pathname.includes("/data/authors/author-index-v2/")){
      requests.push("SNAPSHOT "+url.pathname);
      let body="";
      if(url.pathname.endsWith("/aliases/"+aliasBucket+".jsonl"))
        body=JSON.stringify(candidate)+"\n";
      if(url.pathname.endsWith("/works/"+workBucket+".jsonl"))
        body=works.map(x=>JSON.stringify(x)).join("\n")+"\n";
      return route.fulfill({status:200,contentType:"text/plain",body});
    }
    if(url.origin===new URL(BASE).origin)return route.continue();
    return route.abort();
  });
  const url=new URL(BASE);
  url.searchParams.set("view","author");
  url.searchParams.set("author",name);
  url.hash="results";
  await page.goto(url.toString(),{waitUntil:"domcontentloaded"});
  await page.locator('[data-theme-choice="'+theme+'"]').click();
  try{
    await page.waitForFunction(()=>
      document.querySelectorAll(".author-work-grid .result-card").length===4,
      null,{timeout:18000});
  }catch{
    const info=await page.evaluate(()=>({
      status:document.querySelector("#status")?.textContent,
      authorOnly:document.body.classList.contains("author-view"),
      count:document.querySelectorAll(".author-work-grid .result-card").length,
      resultText:document.querySelector("#results")?.textContent?.slice(0,550)
    }));
    throw new Error("Name-only profile failed "+JSON.stringify({info,errors,requests}));
  }
  assert.ok(requests.some(x=>x.includes("/aliases/"+aliasBucket+".jsonl")),
    "Name-only profile must consult Hugging Face-derived aliases");
  assert.ok(requests.some(x=>x.includes("/works/"+workBucket+".jsonl")),
    "Works must load from static author shard");
  assert.equal(requests.some(x=>x.startsWith("FORBIDDEN")),false,
    "Profile must not use OpenAlex API tokens");
  const titles=await page.locator(".author-work-grid .result-card h2").allTextContents();
  for(const entry of works)assert.ok(titles.some(x=>x.includes(entry.t)));
  await page.locator(".author-page-works").scrollIntoViewIfNeeded();
  await page.screenshot({path:"artifacts/author-name-lookup/dinora-"+theme+"-390.png",
    animations:"disabled"});
  await page.close();
  process.stdout.write("Hugging Face name-only author "+theme+" OK\n");
 }
}finally{await browser.close();}
