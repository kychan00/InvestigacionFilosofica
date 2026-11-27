import assert from "node:assert/strict";
import {chromium} from "playwright";
import {mkdir} from "node:fs/promises";
const base=process.env.MOBILE_UI_BASE_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
await mkdir("artifacts/corpus-appearance",{recursive:true});
try {
 for(const width of [320,390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
  await page.route("**/*",r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.goto(base,{waitUntil:"domcontentloaded"});
  for(const mode of ["light","dark"])for(const shell of ["default","territory","marginalia","observatory"]){
   const result=await page.evaluate(async({mode,shell})=>{
    const {createAuthorPortraitSession}=await import("./js/author-portrait-session.js?v=20261126-siva-v3");
    document.body.classList.add("author-view");document.documentElement.dataset.theme=mode;document.documentElement.dataset.corpusShell=shell;
    const workspace=document.querySelector("#research-workspace");workspace.classList.remove("hidden");
    const results=document.querySelector("#results");
    const fixture=()=>{results.innerHTML='<article class="author-page"><header class="author-page-hero"><div class="author-page-identity"><h1>Autor de prueba</h1><p class="author-page-biography">Archivo académico</p></div><div class="siva-author-portrait-slot"><div class="author-page-seal" aria-hidden="true"><span>AP</span></div><figure class="siva-portrait" hidden></figure></div></header></article>';return results.querySelector(".siva-author-portrait-slot");};
    const blob=await new Promise(resolve=>{const canvas=document.createElement("canvas");canvas.width=80;canvas.height=100;const c=canvas.getContext("2d");c.fillStyle="#728478";c.fillRect(0,0,80,100);canvas.toBlob(resolve,"image/png");});
    let requests=0,revokes=0,abort=false;
    const manager=createAuthorPortraitSession({resolve:async(_,o)=>{requests++;o.signal.addEventListener("abort",()=>abort=true);return{url:"https://upload.wikimedia.org/example",width:80,height:100,credit:"Fotógrafo de prueba",source:"https://commons.wikimedia.org/wiki/File:Test.jpg",license:{label:"CC BY 4.0",url:"https://creativecommons.org/licenses/by/4.0/"},identity:"https://www.wikidata.org/wiki/Q123"};},download:async()=>blob,revokeURL:url=>{revokes++;URL.revokeObjectURL(url);}});
    const identity={displayName:"Autor de prueba",orcid:"0000-0002-1825-0097"};
    let slot=fixture();await manager.open(identity,slot);
    const image=slot.querySelector("img");await image.decode();const first=image.src;
    slot=fixture();await manager.open(identity,slot);const next=slot.querySelector("img");await next.decode();
    const rect=slot.querySelector("figure").getBoundingClientRect();
    const report={ready:slot.hasAttribute("data-siva-ready"),requests,same:first===next.src,
      source:slot.querySelector("figcaption a").href,license:slot.querySelector("figcaption").textContent,
      visible:rect.width>0&&rect.height>0,overflow:document.documentElement.scrollWidth>innerWidth+3,
      browserBytes:blob.size};
    manager.close();report.closed=!slot.querySelector("img")&&!slot.hasAttribute("data-siva-ready");report.revokes=revokes;report.abort=abort;
    return report;
   },{mode,shell});
   assert.ok(result.ready&&result.same&&result.visible&&!result.overflow,JSON.stringify({width,mode,shell,result}));
   assert.equal(result.requests,1);assert.equal(result.revokes,1);assert.ok(result.closed&&result.abort);
   assert.ok(result.license.includes("CC BY 4.0")&&result.source.includes("commons.wikimedia.org"));
  }
  await page.close();
 }
}finally{await browser.close();}
console.log("SIVA portrait: 32 viewport/theme scenarios, transient blob reuse, attribution and cleanup verified.");
