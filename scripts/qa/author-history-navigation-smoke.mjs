import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {authorBucket,authorNameSignature} from "../../src/core/remote-author-resolution.js";

const BASE=process.env.MOBILE_UI_BASE_URL||"http://127.0.0.1:4173/";
const ARTIFACTS="artifacts/author-history-navigation";
await mkdir(ARTIFACTS,{recursive:true});
const bucket=id=>String(authorBucket(id)).padStart(4,"0");
// Reproduce the routes and title spellings reported in production. Network
// fixtures exercise the real index, federated resolution, app and timeline.
const cases=[
 {name:"Simone de Beauvoir",id:"5033760928",titles:["Le sang des autres","Segundo Sexo, Simone De Beauvoir","The Ethics of Ambiguity"],years:[1947,1949,1950],date:"1908"},
 {name:"Antonio Caso",creator:"Antonio Caso Andrade",titles:["La existencia como economia como desinteres y como caridad","Positivismo, neopositivismo y fenomenología"],years:[1916,1944],date:"1883",archive:"#autor-0098"},
 {name:"Confucio",titles:["Analectas, Confucio","Los cuatro libros"],years:[1900,1961],negative:true},
 {name:"Antonio Caso",creator:"Antonio Caso Andrade",titles:["La existencia como economia como desinteres y como caridad","La existencia como economía, desinterés y caridad"],years:[1916,1919],negative:true}
];
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 for(const [width,theme] of [[390,"light"],[1280,"dark"]]){
  for(const [index,c] of cases.entries()){
   const page=await browser.newPage({viewport:{width,height:900},isMobile:width<768,hasTouch:width<768,deviceScaleFactor:1});
   const errors=[],forbidden=[],requests=[];
   page.on("pageerror",e=>errors.push(e.message));
   await page.addInitScript(t=>localStorage.setItem("investigacion-filosofica-theme",t),theme);
   const creator=c.creator||c.name;
   const rows=c.titles.map((t,i)=>({id:Number(c.id),wid:910000+i,t,y:c.years[i],l:"es",ty:"book",co:0}));
   const signature=authorNameSignature(c.name);
   const candidate={s:signature,id:Number(c.id),n:c.name,o:null,cw:rows.length,w:rows.length,c:0,k:"full"};
   const json=(route,body)=>route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(body)});
   await page.route("**/*",route=>{
    const u=new URL(route.request().url());
    if(u.hostname==="api.openalex.org"){forbidden.push(u.href);return route.abort();}
    if(u.hostname==="esm.sh"&&u.pathname.startsWith("/franc-min"))return route.fulfill({status:200,contentType:"application/javascript",body:"export function francAll(){return [];}"});
    if(u.hostname==="www.wikidata.org")return json(route,{search:[],entities:{},query:{search:[]}});
    if(u.pathname.includes("/data/authors/author-index-v2/")){
     requests.push("snapshot "+u.pathname);
     let lines=[];
     if(c.id){
      if(u.pathname.endsWith("/aliases/"+bucket(signature)+".jsonl"))lines=[candidate];
      if(u.pathname.endsWith("/works/"+bucket(c.id)+".jsonl"))lines=rows;
      if(u.pathname.includes("/work-authors/"))lines=rows.filter(r=>u.pathname.endsWith("/work-authors/"+bucket(String(r.wid))+".jsonl")).map(r=>({wid:r.wid,a:[{id:Number(c.id),n:c.name,o:null,p:"first",r:true}]}));
     }
     return route.fulfill({status:200,contentType:"text/plain",body:lines.map(x=>JSON.stringify(x)).join("\n")+(lines.length?"\n":"")});
    }
    if(u.hostname==="archive.org"&&u.pathname==="/advancedsearch.php"){
     requests.push("archive "+u.searchParams.get("q"));
     const docs=c.id?[]:c.titles.map((title,i)=>({identifier:"history-fixture-"+index+"-"+i,title,creator,year:c.years[i],language:"spa",mediatype:"texts"}));
     return json(route,{response:{numFound:docs.length,docs}});
    }
    if(u.hostname==="api.crossref.org")return json(route,{message:{items:[]}});
    if(u.pathname.endsWith("/src/data/cucsh-filosofia.json"))return json(route,{records:[]});
    if(u.origin===new URL(BASE).origin)return route.continue();
    return route.abort();
   });
   const url=new URL(BASE);url.searchParams.set("view","author");url.searchParams.set("author",c.name);if(c.id)url.searchParams.set("authorId",c.id);url.hash="results";
   await page.goto(url.href,{waitUntil:"domcontentloaded"});
   try{
    await page.waitForFunction(()=>document.querySelector(".author-page-hero h1")&&document.querySelector(".author-timeline-work")&&!document.querySelector(".author-timeline-loading")&&document.querySelector(".author-archive-discovery strong")?.textContent.includes("Archivo de publicaciones recuperadas"),null,{timeout:30000});
    const panel=page.locator("#author-timeline-root .author-intellectual-history");
    if(c.negative){assert.equal(await panel.count(),0,"Two editions of one work must not establish a historical identity");}
    else{
     await panel.waitFor({state:"visible",timeout:10000});
     const toggle=panel.locator(".author-intellectual-history-toggle");
     assert.equal(await toggle.getAttribute("aria-expanded"),"false");
     await toggle.click();
     assert.equal(await panel.locator(".author-intellectual-history-event").count(),3);
     assert.ok((await panel.locator(".author-intellectual-history-date").first().textContent()).includes(c.date));
     if(c.archive)assert.equal(await panel.locator(".author-intellectual-history-archive").getAttribute("href"),"./filosofia-latinoamericana.html"+c.archive);
     const bounds=await panel.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:document.documentElement.scrollWidth};});
     assert.ok(bounds.left>=-2&&bounds.right<=width+2&&bounds.width<=width+2,JSON.stringify(bounds));
     await panel.screenshot({path:ARTIFACTS+"/"+index+"-"+width+"-"+theme+".png",animations:"disabled"});
    }
    assert.equal(forbidden.length,0,"No OpenAlex API requests");
    assert.ok(requests.some(s=>s.startsWith(c.id?"snapshot ":"archive ")),"Expected real provider route");
    assert.deepEqual(errors,[]);
   }catch(error){
    const state=await page.evaluate(()=>({heading:document.querySelector(".author-page-hero h1")?.textContent,notice:document.querySelector(".author-archive-discovery")?.textContent,results:document.querySelector("#results")?.textContent?.slice(0,1200),status:document.querySelector("#status")?.textContent}));
    throw new Error(JSON.stringify({case:c.name,negative:c.negative,width,theme,error:String(error),state,errors,requests,forbidden}));
   }finally{await page.close();}
   console.log("Historical author URL OK:",c.name,c.negative?"negative":"positive",width,theme);
  }
 }
}finally{await browser.close();}
