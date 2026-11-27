import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
const BASE=process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
await mkdir("artifacts/author-timeline",{recursive:true});
try {
  for(const width of [320,375,390,768,1280]) for(const mode of ["light","dark"]) {
    const page=await browser.newPage({viewport:{width,height:820},hasTouch:width<=768,isMobile:width<=768,deviceScaleFactor:1});
    await page.route("**/*",route=>route.request().url().startsWith(BASE)?route.continue():route.abort());
    await page.goto(BASE,{waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.includes("author-timeline.css")&&s.cssRules.length>0));
    await page.evaluate(async(mode)=>{
      document.documentElement.dataset.theme=mode;
      const {mountAuthorTimeline}=await import("./src/core/author-timeline-ui.js");
      const container=document.querySelector("#results");
      container.className="results";
      container.innerHTML='<article class="author-page"><section id="author-timeline-root"></section></article>';
      document.body.classList.add("author-view");
      document.querySelector("#research-workspace").classList.remove("hidden");
      const works=[
        {title:"Zeta",year:1781},{title:"Edición reciente",year:2020},
        {title:"Alfa",year:1781,publicationDate:"1781-05-15"},
        {title:"Beta",year:1781},{title:"Gamma",year:1781},
        {title:"Ética",year:1782},{title:"Obra de 1801",year:1801},
        {title:"Obra de 1807",year:1807},{title:"Obra de 1821",year:1821},
        {title:"Obra de 1890",year:1890},{title:"Obra de 1910",year:1910},
        {title:"Sin fecha"}
      ].map((w,i)=>({id:"W"+i,type:"book",...w}));
      const root=document.querySelector("#author-timeline-root");
      window.__timelineOpened=null;
      window.__timelineFixture=(author,rows=works)=>mountAuthorTimeline(root,rows,{unit:"year",timelineLimit:4},{author,onOpenWork:i=>window.__timelineOpened=i});
      window.__timelineFixture({wikidataId:"Q9312",biography:"German philosopher"});
    },mode);
    const nodes=page.locator(".author-timeline-work");
    const dates=page.locator(".author-timeline-entry-date");
    const eras=page.locator(".author-timeline-era-header h3");
    const more=page.getByRole("button",{name:/Mostrar más obras/});
    assert.equal(await nodes.count(),4);
    assert.deepEqual(await eras.allTextContents(),["Modernidad temprana"]);
    assert.equal(await dates.first().textContent(),"1781");
    await nodes.first().click();
    assert.equal(await page.evaluate(()=>window.__timelineOpened),2,"Original index survives chronological sorting");
    const geometry=async()=>{
      const m=await page.evaluate(()=>{
        const root=document.querySelector("#author-timeline-root");
        const r=root.getBoundingClientRect();
        const track=root.querySelector(".author-timeline-historical-track");
        const cards=[...root.querySelectorAll(".author-timeline-work")];
        return {doc:document.documentElement.scrollWidth,left:r.left,right:r.right,track:track.scrollWidth,trackClient:track.clientWidth,cardsFit:cards.every(c=>{const b=c.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1&&b.height>=44;})};
      });
      assert.ok(m.doc<=width+2&&m.left>=-2&&m.right<=width+2&&m.track<=m.trackClient+2&&m.cardsFit,JSON.stringify({width,mode,m}));
    };
    await geometry();
    await more.click();
    assert.equal(await nodes.count(),8);
    assert.deepEqual(await eras.allTextContents(),["Modernidad temprana","Siglo XIX"]);
    await geometry();
    await more.click();
    assert.equal(await nodes.count(),12);
    assert.equal(await more.count(),0);
    assert.deepEqual(await eras.allTextContents(),["Modernidad temprana","Siglo XIX","Periodo contemporáneo","Sin fecha"]);
    assert.equal(await dates.last().textContent(),"Sin fecha");
    await geometry();
    await page.locator("#author-timeline-root").scrollIntoViewIfNeeded();
    if(width===390||width===1280)await page.screenshot({path:"artifacts/author-timeline/expanded-"+mode+"-"+width+".png",animations:"disabled"});
    await page.getByRole("button",{name:"Mostrar menos"}).click();
    assert.equal(await nodes.count(),4);
    await page.getByRole("button",{name:"Por mes"}).click();
    assert.equal(await dates.first().textContent(),"mayo de 1781");
    assert.equal(await dates.nth(1).textContent(),"1781 · Mes no registrado");
    assert.equal(await nodes.count(),4);
    await geometry();
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q859"},[{title:"Texto antiguo",year:-380},{title:"Edición",year:2020}]));
    assert.deepEqual(await dates.allTextContents(),["380 a. C.","2020"]);
    assert.deepEqual(await eras.allTextContents(),["Antigüedad · a. C.","Periodo contemporáneo"]);
    await geometry();
    if(width===390||width===1280)await page.screenshot({path:"artifacts/author-timeline/ancient-"+mode+"-"+width+".png",animations:"disabled"});
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q1",biography:"filósofa mexicana"},[{title:"Documento A",year:1650},{title:"Documento B",year:1810},{title:"Documento C",year:1870},{title:"Documento D",year:1920}]));
    assert.deepEqual(await eras.allTextContents(),["Periodo colonial","Independencias y formación republicana","Construcción nacional","Periodo contemporáneo"]);
    await geometry();
    if(width===390||width===1280)await page.screenshot({path:"artifacts/author-timeline/latin-"+mode+"-"+width+".png",animations:"disabled"});
    // Exercise the actual chronology renderer across all profile shells,
    // including long unbroken titles and provenance labels.
    await page.evaluate(()=>window.__timelineFixture(
      {wikidataId:"Q1",biography:"filósofa mexicana"},
      [{title:"Una investigación sobre las condiciones históricas de posibilidad de la filosofía latinoamericana",year:1810,type:"Capítulo de libro y contribución académica",providers:["OpenAlex Philosophy","Internet Archive","Proveedor"+ "X".repeat(90)]},
       {title:"Obra"+ "L".repeat(160),year:1820,type:"Monografía"},
       {title:"Otra obra",year:1890,type:"Artículo"},
       {title:"Edición crítica",year:2020,type:"Libro"}]
    ));
    const paletteSignatures=new Set();
    for(const shell of ["default","territory","marginalia","observatory"]){
      await page.evaluate(shell=>{document.documentElement.dataset.corpusShell=shell;},shell);
      await geometry();
      const audit=await page.evaluate(()=>{
        const root=document.querySelector("#author-timeline-root");
        const rs=getComputedStyle(root);
        const selectors=[".author-timeline-entry-date",".author-timeline-work-name",".author-timeline-work-type",".author-timeline-provenance > span",".author-timeline-era-header h3",".author-timeline-modes button",".author-timeline-stat span"];
        const issues=[];
        const canvas=document.createElement("canvas");
        canvas.width=canvas.height=1;
        const ctx=canvas.getContext("2d",{willReadFrequently:true});
        const rgba=value=>{
          ctx.clearRect(0,0,1,1);
          ctx.fillStyle="#000";
          ctx.fillStyle=value;
          ctx.fillRect(0,0,1,1);
          return [...ctx.getImageData(0,0,1,1).data];
        };
        const lum=v=>v.slice(0,3).reduce((s,c,i)=>{const n=c/255;return s+(n<=.04045?n/12.92:((n+.055)/1.055)**2.4)*[.2126,.7152,.0722][i];},0);
        const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
        for(const selector of selectors){
          const matches=[...root.querySelectorAll(selector)];
          if(!matches.length)issues.push("Missing "+selector);
          for(const e of matches){
            const r=e.getBoundingClientRect(), style=getComputedStyle(e);
            const container=e.closest(".author-timeline-work,.author-timeline-era-header,.author-timeline-stat,.author-timeline-modes");
            const b=container?.getBoundingClientRect();
            if(b&&(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1))issues.push("Outside parent: "+selector);
            if(e.scrollWidth>e.clientWidth+2)issues.push("Overflow: "+selector);
            if(parseFloat(style.fontSize)<11)issues.push("Small label: "+selector);
            let bg=rgba(rs.getPropertyValue("--tl-surface").trim());
            for(let p=e;p;p=p.parentElement){
              const color=rgba(getComputedStyle(p).backgroundColor);
              if(color[3]===255){bg=color;break;}
              if(p===root)break;
            }
            const score=ratio(rgba(style.color),bg);
            if(score<4.5)issues.push("Contrast "+score.toFixed(2)+": "+selector);
          }
        }
        for(const card of root.querySelectorAll(".author-timeline-work")){
          const date=card.querySelector(".author-timeline-entry-date").getBoundingClientRect();
          const title=card.querySelector(".author-timeline-work-name").getBoundingClientRect();
          const type=card.querySelector(".author-timeline-work-type").getBoundingClientRect();
          const node=card.querySelector(".author-timeline-node").getBoundingClientRect();
          const rail=card.parentElement;
          const line=getComputedStyle(rail,"::before");
          const rb=rail.getBoundingClientRect();
          if(Math.abs(date.left-title.left)>1||Math.abs(date.left-type.left)>1||title.top<date.bottom-1||type.top<title.bottom-1)issues.push("Misaligned labels");
          if(Math.abs((node.top+node.bottom)/2-(date.top+date.bottom)/2)>3)issues.push("Node/date misalignment");
          if(Math.abs((node.left+node.right)/2-(rb.left+parseFloat(line.left)+parseFloat(line.width)/2))>2)issues.push("Rail/node misalignment");
        }
        const accent=getComputedStyle(root.querySelector(".author-timeline-era")).getPropertyValue("--era-accent").trim();
        const expected=rs.getPropertyValue("--era-green").trim();
        if(accent!==expected)issues.push("Era accent does not use shell palette");
        return {issues,signature:[rs.getPropertyValue("--tl-card").trim(),rs.getPropertyValue("--tl-ink").trim(),accent].join("|")};
      });
      assert.deepEqual(audit.issues,[],JSON.stringify({width,mode,shell,audit}));
      paletteSignatures.add(audit.signature);
      if(width===390||width===1280)await page.locator("#author-timeline-root").screenshot({path:"artifacts/author-timeline/shell-"+shell+"-"+mode+"-"+width+".png",animations:"disabled"});
    }
    assert.equal(paletteSignatures.size,4,"All four shells must produce distinct timeline palettes");
    await page.close();
    process.stdout.write("author timeline OK: "+width+"px "+mode+"\n");
  }
} finally {await browser.close();}
