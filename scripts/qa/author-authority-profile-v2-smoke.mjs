import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
const base=process.env.MOBILE_UI_BASE_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
await mkdir("artifacts/author-authority-profile-v2",{recursive:true});
try{
 for(const width of [320,390,768,1024,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.route("**/*",r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.goto(base,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.includes("author-authority-profile-v2.css")));
  await page.evaluate(async()=>{
   const {mountAuthorAuthorityPreview,buildAuthorityArchiveView}=await import("./src/core/author-authority-profile-v2.js");
   document.body.classList.add("author-view");
   const workspace=document.querySelector("#research-workspace");workspace.classList.remove("hidden");
   const results=document.querySelector("#results");results.innerHTML='<article class="author-page"><section class="author-authority-preview"></section></article>';
   const rows=Array.from({length:15},(_,i)=>({record:{provider:"OpenAlex Philosophy",sourceId:"W"+i,title:"Obra "+i+" "+("título muy extenso ".repeat(5)),year:2020},contributions:[{rawName:"Nombre de prueba",role:"author",decision:{scope:"contribution",status:i===0?"ambiguous":"probable"},evidence:[{kind:"snapshot-author-membership",reliability:"asserted",polarity:"supports"}]}]}));
   const legacy=[{id:"W0",providers:["OpenAlex Philosophy"],title:"Original"}];
   window.authorityOpened=null;
   mountAuthorAuthorityPreview(results.querySelector("section"),{shadow:{rows},archive:buildAuthorityArchiveView({rows},legacy),onOpenWork:work=>{window.authorityOpened=work.id;}});
  });
  const root=page.locator(".author-authority-preview");
  await root.scrollIntoViewIfNeeded();
  assert.equal(await root.locator("details").count(),12);
  await root.getByRole("button",{name:"Mostrar más atribuciones"}).click();
  assert.equal(await root.locator("details").count(),15);
  await root.locator("select").selectOption("ambiguous");
  assert.equal(await root.locator("details").count(),1);
  await root.locator(".authority-preview-work summary").click();
  await root.getByText("Membresía del índice filosófico",{exact:false}).waitFor();
  await root.getByRole("button",{name:"Abrir ficha bibliográfica"}).click();
  assert.equal(await page.evaluate(()=>window.authorityOpened),"W0");
  await root.getByText("Ver distribución cronológica",{exact:false}).click();
  await root.getByText("2020 · 0 confirmadas · 14 probables",{exact:true}).waitFor();
  for(const theme of ["light","dark"])for(const shell of ["default","territory","marginalia","observatory"]){
   await page.evaluate(({theme,shell})=>{
    document.documentElement.dataset.theme=theme;
    document.documentElement.style.colorScheme=theme;
    document.documentElement.dataset.corpusShell=shell;
    window.dispatchEvent(new CustomEvent("philosophythemechange",{detail:{theme}}));
   },{theme,shell});
   const geometry=await root.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,viewport:innerWidth,right:el.getBoundingClientRect().right,left:el.getBoundingClientRect().left}));
   assert.ok(geometry.scroll<=geometry.width+2&&geometry.right<=geometry.viewport+2&&geometry.left>=-2,JSON.stringify({width,theme,shell,geometry}));
   if(width===390||width===1440)await root.screenshot({path:"artifacts/author-authority-profile-v2/"+width+"-"+theme+"-"+shell+".png",animations:"disabled"});
  }
  await page.close();
 }
 console.log("Authority profile preview: 5 viewport widths, 4 corpus themes, both color modes, filters, pagination and evidence disclosure");
}finally{await browser.close();}
