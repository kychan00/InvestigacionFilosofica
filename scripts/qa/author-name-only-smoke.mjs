import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const BASE=process.env.MOBILE_UI_BASE_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
await mkdir("artifacts/author-name-lookup",{recursive:true});

const name="Dinora Hernández";
const full="Dinora Hernández López";
const authorId="7654321";
const works=[
  ["101","Teoría crítica y filosofía",2020],
  ["102","Adorno y la dialéctica",2021],
  ["103","Filosofía feminista",2023],
  ["104","Resistencia y pensamiento crítico",2024]
].map(([id,title,year])=>({
  id:"https://openalex.org/W"+id,title,
  display_name:title,publication_year:year,
  publication_date:year+"-04-21",type:"article",
  language:"es",doi:"https://doi.org/10.5678/"+id,
  authorships:[{author:{id:"https://openalex.org/A"+authorId,
    display_name:full}}],
  open_access:{is_oa:false},primary_location:null,cited_by_count:0
}));

try {
  for(const theme of ["light","dark"]){
    const page=await browser.newPage({
      viewport:{width:390,height:850},isMobile:true,hasTouch:true,deviceScaleFactor:1
    });
    const errors=[],requests=[];
    page.on("pageerror",err=>errors.push(err.message));
    page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text())});
    await page.route("**/*",route=>{
      const url=new URL(route.request().url());
      if(url.hostname==="esm.sh"&&url.pathname.startsWith("/franc-min")){
        return route.fulfill({status:200,contentType:"application/javascript",
          body:"export function francAll(){return [];}"});
      }
      if(url.hostname==="api.openalex.org"&&url.pathname==="/authors"){
        requests.push({kind:"authors",query:url.searchParams.get("search")});
        return route.fulfill({status:200,contentType:"application/json",
          headers:{"access-control-allow-origin":"*"},
          body:JSON.stringify({meta:{count:1},results:[{
            id:"https://openalex.org/A"+authorId,
            display_name:full,
            display_name_alternatives:[name],
            works_count:4,orcid:null,
            last_known_institutions:[{display_name:"Universidad de Guadalajara"}]
          }]})});
      }
      if(url.hostname==="api.openalex.org"&&url.pathname==="/works"){
        requests.push({kind:"works",filter:url.searchParams.get("filter")});
        return route.fulfill({status:200,contentType:"application/json",
          headers:{"access-control-allow-origin":"*"},
          body:JSON.stringify({meta:{count:4,next_cursor:null},results:works})});
      }
      if(url.pathname.includes("/data/authors/author-index-v2/")){
        return route.fulfill({status:200,contentType:"text/plain",body:""});
      }
      if(url.origin===new URL(BASE).origin)return route.continue();
      return route.abort();
    });
    const url=new URL(BASE);
    url.searchParams.set("utm_source","chatgpt.com");
    url.searchParams.set("view","author");
    url.searchParams.set("author",name);
    url.hash="results";
    await page.goto(url.toString(),{waitUntil:"domcontentloaded"});
    await page.locator('[data-theme-choice="'+theme+'"]').click();
    try{
      await page.waitForFunction(()=>
        document.querySelectorAll(".author-work-grid .result-card").length===4,
        null,{timeout:19000});
    }catch{
      const info=await page.evaluate(()=>({
        status:document.querySelector("#status")?.textContent,
        authorOnly:document.body.classList.contains("author-view"),
        count:document.querySelectorAll(".author-work-grid .result-card").length,
        candidateCount:document.querySelectorAll(".author-candidate").length,
        resultText:document.querySelector("#results")?.textContent?.slice(0,500)
      }));
      throw new Error("Name-only author route failed "+JSON.stringify({info,errors,requests}));
    }
    assert.ok(requests.some(row=>row.kind==="authors"&&row.query===name),
      "Profile must search /authors on every name-only URL");
    assert.ok(requests.some(row=>row.kind==="works"&&
      row.filter==="authorships.author.id:A"+authorId),
      "Works must be fetched only by verified author ID");

    const titles=await page.locator(".author-work-grid .result-card h2")
      .allTextContents();
    for(const item of works) assert.ok(titles.some(x=>x.includes(item.title)));
    const heading=await page.locator(".author-page-hero h1").first()
      .textContent();
    assert.match(heading,/Dinora Hernández López/);
    await page.locator(".author-page-works").scrollIntoViewIfNeeded();
    await page.screenshot({
      path:"artifacts/author-name-lookup/dinora-"+theme+"-390.png",
      animations:"disabled"
    });
    await page.close();
    process.stdout.write("Direct name-only Dinora deep scan "+theme+" OK\n");
  }
}finally{await browser.close();}
