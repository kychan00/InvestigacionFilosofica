import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
await mkdir("artifacts/theme-contrast",{recursive:true});

function luminance(v) {
  const n = v / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
}
function contrast(a,b) {
  const val = s => {
    const rgba = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    assert.ok(rgba,"Unsupported computed colour: "+s);
    const channels = rgba.slice(1,4).map(Number);
    return channels.reduce((sum,n,index)=>
      sum + luminance(n)*[.2126,.7152,.0722][index],0);
  };
  const [x,y] = [val(a),val(b)].sort((u,v)=>v-u);
  return (x+.05)/(y+.05);
}
function checkContrasts(rows,minimum=4.5) {
  for(const entry of rows) {
    const score=contrast(entry.foreground,entry.background);
    assert.ok(score >= minimum,
      entry.selector+" contrast "+score.toFixed(2)+
      " must exceed "+minimum+": "+JSON.stringify(entry));
    assert.ok(Number(entry.fontSize.replace("px","")) >= 11,
      entry.selector+" font must not disappear at tiny sizes");
    assert.equal(entry.opacity,"1",entry.selector+" must not be faded");
  }
}

const workList=[
  {id:"W1",title:"Die Phänomenologie des Geistes",year:1807,type:"book"},
  {id:"W2",title:"Wissenschaft der Logik",year:1812,type:"book"},
  {id:"W3",title:"Enzyklopädie der philosophischen Wissenschaften",year:1817,type:"book"}
];

try {
  for(const width of [320,375,390,768,1280]) {
    const page=await browser.newPage({
      viewport:{width,height:850},
      hasTouch:width<=768,isMobile:width<=768,deviceScaleFactor:1
    });
    await page.route("**/*",route =>
      route.request().url().startsWith(BASE) ? route.continue() : route.abort());
    await page.goto(BASE,{waitUntil:"domcontentloaded"});
    await page.waitForFunction(() =>
      document.querySelector('[data-theme-choice="light"]')?.getAttribute("aria-pressed") !== "false" ||
      document.querySelector('[data-theme-choice="dark"]')?.getAttribute("aria-pressed") !== "false"
    );
    for(const theme of ["light","dark"]) {
      await page.locator('[data-theme-choice="'+theme+'"]').click();
      await page.waitForFunction(theme =>
        document.documentElement.dataset.theme===theme,theme);
      const state=await page.evaluate(() => {
        const theme=document.documentElement.dataset.theme;
        const doc=document.documentElement;
        const targets=[
          ".search-filter-grid label",
          ".search-filter-grid input",
          ".search-filter-grid select",
          ".search-filters-heading p",
          ".search-filters-heading h2",
          ".search-filter-footer .filter-count",
          ".search-mode-note",
          '.theme-switch button:not([aria-pressed="true"])',
          '.theme-switch button[aria-pressed="true"]'
        ];
        const rows=targets.map(selector=>{
          const el=document.querySelector(selector);
          const style=getComputedStyle(el);
          const raw=style.backgroundColor;
          const bg=raw==="rgba(0, 0, 0, 0)" ?
            getComputedStyle(el.parentElement).backgroundColor : raw;
          return {selector,foreground:style.color,background:bg,
            fontSize:style.fontSize,opacity:style.opacity,
            bounds:el.getBoundingClientRect().toJSON()};
        });
        return {
          theme,
          storage:localStorage.getItem("investigacion-filosofica-theme"),
          selected:document.querySelector('[data-theme-choice="'+theme+'"]').getAttribute("aria-pressed"),
          other:document.querySelector('[data-theme-choice="'+(theme==="light"?"dark":"light")+'"]').getAttribute("aria-pressed"),
          documentWidth:doc.scrollWidth,innerWidth,
          icons:[...document.querySelectorAll(".theme-switch .theme-icon")].map(e=>{
            const r=e.getBoundingClientRect();return {width:r.width,height:r.height,display:getComputedStyle(e).display};
          }),
          choices:[...document.querySelectorAll(".theme-switch button")].map(e=>{
            const r=e.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};
          }),
          rows
        };
      });
      assert.equal(state.storage,theme);
      assert.equal(state.selected,"true");
      assert.equal(state.other,"false");
      assert.ok(state.documentWidth <= width+2,
        "Page overflows after theme switch "+width);
      assert.ok(state.icons.every(icon=>icon.width>=18&&icon.height>=18&&icon.display!=="none"),
        "Sun and moon icons must be visible");
      assert.ok(state.choices.every(choice=>
        choice.height>=44 && choice.width>=44 && choice.left>=-2 && choice.right<=width+2),
        "Appearance actions must remain tappable and within screen");
      checkContrasts(state.rows);
      await page.screenshot({
        path:"artifacts/theme-contrast/search-"+theme+"-"+width+".png",
        animations:"disabled"
      });

      await page.evaluate(async works => {
        const {mountAuthorTimeline}=await import("./src/core/author-timeline-ui.js");
        const results=document.querySelector("#results");
        document.body.classList.add("author-view");
        document.querySelector("#research-workspace").classList.remove("hidden");
        results.innerHTML='<article class="author-page"><section id="author-timeline-root"></section></article>';
        mountAuthorTimeline(document.querySelector("#author-timeline-root"),works,
          {unit:"year",selectedKey:null,visibleLimit:60});
      },workList);
      const timeline=await page.evaluate(()=>{
        const targets=[
          ".author-timeline-heading h2",
          ".author-timeline-coverage",
          ".author-timeline-period:not(.is-active)",
          ".author-timeline-period.is-active",
          ".author-timeline-work",
          ".author-timeline-work-type"
        ];
        return targets.map(selector=>{
          const style=getComputedStyle(document.querySelector(selector));
          return {selector,foreground:style.color,background:style.backgroundColor,
            fontSize:style.fontSize,opacity:style.opacity};
        });
      });
      const nonOpaque=timeline.filter(x=>x.background==="rgba(0, 0, 0, 0)");
      // Parent-based backgrounds for nested headings and labels.
      for(const item of nonOpaque) {
        if(item.selector===".author-timeline-heading h2")
          item.background=theme==="dark"?"rgb(22, 22, 22)":"rgb(255, 255, 255)";
        if(item.selector===".author-timeline-work-type")
          item.background=theme==="dark"?"rgb(38, 38, 38)":"rgb(255, 255, 255)";
      }
      checkContrasts(timeline,4.5);
      assert.equal(await page.locator(".author-timeline-work").count(),1);
      if(width===375||width===1280)await page.screenshot({
        path:"artifacts/theme-contrast/timeline-"+theme+"-"+width+".png",
        animations:"disabled"
      });
      await page.evaluate(()=>{
        document.body.classList.remove("author-view");
        document.querySelector("#research-workspace").classList.add("hidden");
        document.querySelector("#results").replaceChildren();
      });
    }

    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>
      document.querySelector('[data-theme-choice="dark"]')?.getAttribute("aria-pressed")==="true");
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),"dark",
      "Theme choice must persist after reload");
    await page.close();
    process.stdout.write("theme contrast OK "+width+"px\n");
  }
} finally {
  await browser.close();
}
