import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const base=process.env.MOBILE_UI_BASE_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
await mkdir("artifacts/author-profile-visibility",{recursive:true});
function lum(rgb){
 const m=rgb.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
 assert.ok(m,"Cannot read RGB "+rgb);
 return m.slice(1,4).map(Number).map(c=>{
  const v=c/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
 }).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
}
function ratio(a,b){const v=[lum(a),lum(b)].sort((x,y)=>y-x);return(v[0]+.05)/(v[1]+.05);}
const cards=[
 '<article class="result-card"><div class="result-visual" aria-hidden="true">',
 '<span class="result-rank">1</span><span class="result-initial">G</span>',
 '<span class="result-visual-caption">Archivo filosófico</span></div>',
 '<div class="result-content"><div class="result-title-row">',
 '<span class="relevance-pill">Autor</span>',
 '<h2>Hegel’s Preface to the Phenomenology of Spirit</h2></div>',
 '<p class="meta"><a class="author-profile-link" href="#">Georg Wilhelm Friedrich Hegel</a> · 2021</p>',
 '<div class="provider-row"><span class="provider">OpenAlex Philosophy</span>',
 '<span class="provider">English</span></div>',
 '<div class="result-links"><button class="record-open">Ver ficha</button>',
 '<a class="result-secondary-link result-open-link" href="#">Abrir</a></div>',
 '<div class="explain">Autoría directa confirmada en el corpus · identidad normalizada</div>',
 '</div><aside class="score-panel"><div class="score">100</div>',
 '<span>Autoría</span><div class="score-meter"><i style="width:100%"></i></div>',
 '</aside></article>'
].join("");
const wrapper=[
 '<article class="author-page">',
 '<section class="author-page-taxonomy" aria-label="Idiomas y tipos documentales">',
 '<div><span class="author-section-kicker">Idiomas</span>',
 '<div><span>English <strong>45</strong></span><span>PL <strong>1</strong></span></div></div>',
 '<div><span class="author-section-kicker">Tipos de obra</span>',
 '<div><span>Libro <strong>33</strong></span><span>Artículo académico <strong>9</strong></span></div></div>',
 '</section><section class="author-page-works"><div class="author-page-works-heading">',
 '<div><span class="author-section-kicker">Bibliografía</span><h2>Obras en el corpus</h2></div>',
 '<p>La vista contiene las 46 obras publicables disponibles en el índice.</p></div>',
 '<div class="author-work-grid"></div></section></article>'
].join("");
try{
 for(const width of [320,375,390,768,1280,1600]){
  const page=await browser.newPage({viewport:{width,height:900},
   hasTouch:width<=768,isMobile:width<=768,deviceScaleFactor:1});
  await page.route("**/*",route=>route.request().url().startsWith(base)?
   route.continue():route.abort());
  await page.goto(base,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>[...document.styleSheets].some(
   x=>x.href?.includes("author-visibility-repair.css")&&x.cssRules.length>0));
  for(const theme of ["light","dark"]){
   await page.locator('[data-theme-choice="'+theme+'"]').click();
   await page.evaluate(({wrapper,cards})=>{
    document.body.classList.add("author-view");
    document.querySelector("#research-workspace").classList.remove("hidden");
    document.querySelector("#results").innerHTML=wrapper;
    document.querySelector(".author-work-grid").innerHTML=cards+cards;
   },{wrapper,cards});
   await page.locator(".author-page-taxonomy").scrollIntoViewIfNeeded();
   const rep=await page.evaluate(()=>{
    const sels=[
     ".author-page-taxonomy > div > div > span",
     ".author-page-taxonomy strong",
     ".author-page-works-heading h2",
     ".author-page-works-heading p",
     ".author-work-grid .result-card h2",
     ".author-work-grid .result-card .meta",
     ".author-work-grid .result-card .meta a",
     ".author-work-grid .result-card .relevance-pill",
     ".author-work-grid .result-card .provider",
     ".author-work-grid .result-card .explain",
     ".author-work-grid .result-card .score-panel .score",
     ".author-work-grid .result-card .score-panel > span",
     ".author-work-grid .result-card .record-open",
     ".author-work-grid .result-card .result-open-link"
    ];
    const bg=el=>{
     for(let n=el;n;n=n.parentElement){
      const v=getComputedStyle(n).backgroundColor;
      if(v!=="rgba(0, 0, 0, 0)")return v;
     }return"rgb(255, 255, 255)";
    };
    const samples=sels.map(selector=>{
     const el=document.querySelector(selector),st=getComputedStyle(el);
     return {selector,color:st.color,bg:bg(el),size:parseFloat(st.fontSize),opacity:st.opacity};
    });
    const rect=selector=>{
     const b=document.querySelector(selector).getBoundingClientRect();
     return {left:b.left,right:b.right,width:b.width,height:b.height};
    };
    return {samples,card:rect(".author-work-grid .result-card"),
     title:rect(".author-work-grid .result-card h2"),
     links:rect(".author-work-grid .result-card .result-links"),
     linkBG:getComputedStyle(document.querySelector(".author-work-grid .result-links")).backgroundColor,
     pageWidth:document.documentElement.scrollWidth,
     eyebrow:getComputedStyle(document.querySelector(".hero-shell .eyebrow")).color,
     panelCaption:getComputedStyle(document.querySelector(".hero-shell .search-panel"),"::before").color};
   });
   assert.ok(rep.pageWidth<=width+2,theme+" "+width+" page wider than viewport");
   assert.ok(rep.card.left>=-2&&rep.card.right<=width+2,
    theme+" "+width+" card clipped "+JSON.stringify(rep.card));
   assert.ok(rep.title.width>=100&&rep.title.height>=24,
    theme+" "+width+" invisible title "+JSON.stringify(rep.title));
   assert.ok(rep.title.left>=rep.card.left-2&&rep.title.right<=rep.card.right+2,
    theme+" "+width+" clipped title");
   assert.ok(rep.links.left>=rep.card.left-2&&rep.links.right<=rep.card.right+2,
    theme+" "+width+" action clipping");
   assert.equal(rep.linkBG,"rgba(0, 0, 0, 0)","gray strip behind buttons");
   for(const x of rep.samples){
    const c=ratio(x.color,x.bg);
    assert.ok(c>=4.5,theme+" "+width+" contrast "+c.toFixed(2)+" "+JSON.stringify(x));
    assert.ok(x.size>=10,theme+" tiny label "+x.selector);
    assert.equal(x.opacity,"1",theme+" faded label "+x.selector);
   }
   assert.equal(rep.eyebrow,theme==="light"?"rgb(0, 67, 206)":"rgb(166, 200, 255)");
   assert.equal(rep.panelCaption,theme==="light"?"rgb(0, 67, 206)":"rgb(166, 200, 255)");
   await page.locator(".author-page-works").scrollIntoViewIfNeeded();
   await page.screenshot({path:"artifacts/author-profile-visibility/"+theme+"-"+width+".png",
    animations:"disabled"});
   await page.evaluate(()=>{
    document.body.classList.remove("author-view");
    document.querySelector("#results").replaceChildren();
    document.querySelector("#research-workspace").classList.add("hidden");
   });
  }
  await page.close();
  process.stdout.write("author profile visible "+width+"px\n");
 }
}finally{await browser.close();}
