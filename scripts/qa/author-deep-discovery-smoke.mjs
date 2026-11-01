import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {authorBucket,authorNameSignature} from "../../src/core/remote-author-resolution.js";

const BASE=process.env.MOBILE_UI_BASE_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
await mkdir("artifacts/author-deep-discovery",{recursive:true});
const name="Ángeles Eraña",id="5082752736",orcid="0000-0002-8595-8693";
const bucket=value=>String(authorBucket(value)).padStart(4,"0");
const aliasBucket=bucket(authorNameSignature(name)),workBucket=bucket(id);
const rows=[
  ["1001","Filosofía y experiencia",2015],
  ["1002","Teoría del conocimiento",2017],
  ["1003","Tercera publicación indexada",2022],
  ["1004","Cuarta publicación indexada",2024]
].map(([wid,t,y])=>({id:Number(id),wid:Number(wid),t,y,l:"es",ty:"article"}));
const alias={s:authorNameSignature(name),id:Number(id),
  n:name,o:"https://orcid.org/"+orcid,cw:4,w:4,c:4,k:"full"};

try{
 for(const theme of ["light","dark"]){
  const page=await browser.newPage({
    viewport:{width:390,height:850},isMobile:true,hasTouch:true,deviceScaleFactor:1
  });
  const urls=[];
  page.on("request",request=>{
    if(request.url().includes("api.openalex.org"))urls.push(request.url());
  });
  await page.route("**/*",route=>{
    const url=new URL(route.request().url());
    if(url.hostname==="api.openalex.org")return route.abort();
    if(url.hostname==="esm.sh"&&url.pathname.startsWith("/franc-min"))
      return route.fulfill({status:200,contentType:"application/javascript",
        body:"export function francAll(){return [];}"}); 
    if(url.hostname==="www.wikidata.org")
      return route.fulfill({status:200,contentType:"application/json",
        headers:{"access-control-allow-origin":"*"},
        body:JSON.stringify({search:[],entities:{}})});
    if(url.pathname.includes("/data/authors/author-index-v2/")){
      let body="";
      if(url.pathname.endsWith("/aliases/"+aliasBucket+".jsonl"))
        body=JSON.stringify(alias)+"\n";
      if(url.pathname.endsWith("/works/"+workBucket+".jsonl"))
        body=rows.map(x=>JSON.stringify(x)).join("\n")+"\n";
      return route.fulfill({status:200,contentType:"text/plain",body});
    }
    if(url.origin===new URL(BASE).origin)return route.continue();
    return route.abort();
  });
  const url=new URL(BASE);
  url.searchParams.set("view","author");
  url.searchParams.set("author",name);
  url.searchParams.set("authorId",id);
  url.searchParams.set("authorOrcid","https://orcid.org/"+orcid);
  url.hash="results";
  await page.goto(url.toString(),{waitUntil:"domcontentloaded"});
  await page.locator('[data-theme-choice="'+theme+'"]').click();
  await page.waitForFunction(()=>
    document.querySelectorAll(".author-work-grid .result-card").length===4,
    null,{timeout:20000});
  assert.equal(urls.length,0,"Direct OpenAlex API must not be called");
  const state=await page.evaluate(()=>{
    const cards=[...document.querySelectorAll(".author-work-grid .result-card")];
    const stats=document.querySelector("#stats");
    return {
      cards:cards.length,
      titles:cards.map(x=>x.querySelector("h2")?.textContent.trim()),
      status:document.querySelector(".author-archive-discovery")?.textContent,
      bg:getComputedStyle(stats).backgroundColor,
      ink:getComputedStyle(stats.querySelector(".stat strong")).color
    };
  });
  assert.equal(state.cards,4);
  assert.ok(state.titles.includes("Tercera publicación indexada"));
  assert.match(state.status,/Hugging Face/);
  if(theme==="dark"){
    assert.equal(state.bg,"rgb(22, 22, 22)");
    assert.equal(state.ink,"rgb(244, 244, 244)");
  }
  await page.locator(".author-page-works").scrollIntoViewIfNeeded();
  await page.screenshot({
    path:"artifacts/author-deep-discovery/"+theme+"-profile-390.png",
    animations:"disabled"
  });
  await page.close();
  process.stdout.write("Hugging Face author archive "+theme+" OK\n");
 }
}finally{await browser.close();}
