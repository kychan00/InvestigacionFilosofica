import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
const BASE=process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
await mkdir("artifacts/author-timeline",{recursive:true});
try {
  for(const width of [320,375,390,768,1280]) for(const mode of ["light","dark"]) {
    const page=await browser.newPage({viewport:{width,height:820},hasTouch:width<=768,isMobile:width<=768,deviceScaleFactor:1});
    const evidenceRequests=[];
    page.on("request",request=>{if(new URL(request.url()).pathname.endsWith("/author-history-public-v1.js"))evidenceRequests.push(request.url());});
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
    // Real renderer, pilot history must remain separate from catalogue works.
    await page.evaluate(()=>window.__timelineFixture(
      {wikidataId:"Q9235",displayName:"Georg Wilhelm Friedrich Hegel",biography:"German philosopher"},
      [{title:"Edición moderna",year:2020,type:"book"}]
    ));
    const life=page.locator(".author-intellectual-history");
    const toggle=life.locator(".author-intellectual-history-toggle");
    assert.equal(await toggle.getAttribute("aria-expanded"),"false");
    assert.equal(await life.locator(".author-intellectual-history-event").count(),0);
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"),"true");
    assert.equal(await life.locator(".author-intellectual-history-event").count(),3);
    assert.equal(await nodes.count(),1);
    assert.equal(evidenceRequests.length,0,"Editorial data must not load until a disclosure is opened");
    const firstEvidence=life.locator(".author-history-evidence").nth(1);
    const evidenceSummary=firstEvidence.locator("summary");
    assert.equal(await firstEvidence.locator("a").count(),0);
    const simulateFailure=width===320&&mode==="light";
    if(simulateFailure){
      await page.route(url=>url.pathname.endsWith("/author-history-public-v1.js"),route=>route.abort(),{times:1});
    }
    await evidenceSummary.focus();
    await evidenceSummary.press("Enter");
    if(simulateFailure){
      await firstEvidence.getByText(/No se pudieron cargar las notas/).waitFor({state:"visible"});
      assert.ok(await firstEvidence.locator("a").count()>0,"Fallback links remain usable");
      await evidenceSummary.click();
      await evidenceSummary.click();
    }
    await firstEvidence.getByText("Referencias consultadas",{exact:true}).waitFor({state:"visible"});
    assert.match(await firstEvidence.textContent(),/1806.*1807/);
    assert.equal(await firstEvidence.locator("a").count(),1);
    assert.match(await firstEvidence.locator("a").first().getAttribute("href"),/^https:/);
    assert.equal(await firstEvidence.locator("a").first().getAttribute("rel"),"noopener noreferrer");
    assert.equal(evidenceRequests.length,simulateFailure?2:1,"Load once, with one explicit retry after failure");
    await life.getByRole("button",{name:"Mostrar más hitos"}).click();
    assert.equal(await life.locator(".author-intellectual-history-event").count(),6);
    await firstEvidence.getByText("Referencias consultadas",{exact:true}).waitFor({state:"visible"});
    assert.equal(await firstEvidence.getAttribute("open"),"");
    await life.getByRole("button",{name:"Mostrar más hitos"}).click();
    assert.equal(await life.locator(".author-intellectual-history-event").count(),7);
    await life.getByRole("button",{name:"Mostrar menos hitos"}).click();
    assert.equal(await life.locator(".author-intellectual-history-event").count(),3);
    await firstEvidence.getByText("Referencias consultadas",{exact:true}).waitFor({state:"visible"});
    assert.equal(evidenceRequests.length,simulateFailure?2:1,"No extra module requests after pagination");
    for(const shell of ["default","territory","marginalia","observatory"]){
      await page.evaluate(shell=>{document.documentElement.dataset.corpusShell=shell;},shell);
      await geometry();
      const issues=await life.evaluate(section=>{
        const r=section.getBoundingClientRect();
        return [...section.querySelectorAll("button,li,strong,a,span,details,summary,ul,p")].filter(e=>{
          const b=e.getBoundingClientRect();
          return b.width>0&&(b.left<r.left-1||b.right>r.right+1||e.scrollWidth>e.clientWidth+2&&e.clientWidth>0&&getComputedStyle(e).display!=="inline");
        }).map(e=>e.className||e.tagName);
      });
      assert.deepEqual(issues,[],JSON.stringify({width,mode,shell,issues}));
      if(width===390||width===1280)await life.screenshot({path:"artifacts/author-timeline/life-"+shell+"-"+mode+"-"+width+".png",animations:"disabled"});
    }
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"),"false");
    await toggle.click();
    assert.equal(await life.locator(".author-history-evidence[open]").count(),0,"Closing the biography clears disclosures");
    await toggle.click();
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q9235",displayName:"Otro autor"},[{title:"Otra obra",year:2020}]));
    assert.equal(await life.count(),0);
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q859",displayName:"Platón"},[]));
    assert.equal(await life.count(),1,"History can be rendered without bibliographic records");
    await life.locator(".author-intellectual-history-toggle").click();
    assert.match(await life.locator(".author-intellectual-history-date").first().textContent(),/a. C./);
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q1879022",displayName:"Leopoldo Zea Aguilar"},[{title:"Edición moderna",year:2020}]));
    assert.equal(await life.count(),1);
    await life.locator(".author-intellectual-history-toggle").click();
    assert.equal(await life.locator(".author-intellectual-history-event").count(),3);
    assert.equal(await life.locator(".author-intellectual-history-date").first().textContent(),"1912");
    await geometry();
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q60025",displayName:"Hannah Arendt"},[{title:"Edición",year:2020}]));
    await life.locator(".author-intellectual-history-toggle").click();
    await life.getByRole("button",{name:"Mostrar más hitos"}).click();
    await life.getByRole("button",{name:"Mostrar más hitos"}).click();
    assert.equal(await life.locator(".author-intellectual-history-kind").last().textContent(),"Publicación póstuma");
    assert.match(await life.locator(".author-intellectual-history-date").nth(1).textContent(),/1928.*1929/);
    const arendt=life.locator(".author-history-evidence").nth(1);
    await arendt.locator("summary").click();
    await arendt.getByText("Referencias consultadas",{exact:true}).waitFor({state:"visible"});
    assert.equal(await arendt.locator("a").count(),3);
    assert.ok(await arendt.locator('a[href*="hannaharendt.net"]').count());
    await geometry();
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q4604",displayName:"孔子"},[{title:"Registro antiguo",year:-500},{title:"Edición moderna",year:2020}]));
    await life.locator(".author-intellectual-history-toggle").click();
    assert.match(await life.locator(".author-intellectual-history-date").first().textContent(),/tradicional/);
    assert.equal(await eras.first().textContent(),"China antigua · a. C.");
    await life.getByRole("button",{name:"Mostrar más hitos"}).click();
    assert.equal(await life.locator(".author-intellectual-history-event").count(),4);
    await geometry();
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q6291218",displayName:"José Carlos Mariátegui"},[{title:"Obra",year:2020}]));
    assert.equal(await life.count(),0);
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q8011",displayName:"ابن سينا"},[{title:"Edición crítica",year:1020}]));
    await life.locator(".author-intellectual-history-toggle").click();
    assert.match(await life.locator(".author-intellectual-history-date").first().textContent(),/970 o 980/);
    const avicenna=life.locator(".author-intellectual-history-event").first();
    assert.equal(await avicenna.locator("a").count(),0);
    await avicenna.locator("summary").click();
    await avicenna.getByText("Referencias consultadas",{exact:true}).waitFor({state:"visible"});
    assert.equal(await avicenna.locator("a").count(),2);
    assert.equal(await eras.first().textContent(),"Siglo 11 d. C.");
    await geometry();
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q171195",displayName:"Nāgārjuna"},[{title:"Edición moderna",year:2020}]));
    await life.locator(".author-intellectual-history-toggle").click();
    assert.equal(await life.locator(".author-intellectual-history-event").count(),2);
    assert.equal(await life.getByRole("button",{name:"Mostrar más hitos"}).count(),0);
    assert.match(await life.locator(".author-intellectual-history-date").last().textContent(),/fecha desconocida/);
    await geometry();
    // Curated intellectual context takes precedence over a birthplace adjective.
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q365193",displayName:"Adolfo Sánchez Vázquez",biography:"Spanish philosopher"},[{title:"Edición",year:1967}]));
    assert.equal(await eras.first().textContent(),"Periodo contemporáneo");
    assert.match(await page.locator(".author-timeline-context").textContent(),/latinoamericana/);
    assert.equal(await life.locator(".author-intellectual-history-archive").getAttribute("href"),"./filosofia-latinoamericana.html#autor-0071");
    await life.locator(".author-intellectual-history-toggle").click();
    assert.equal(await life.locator(".author-intellectual-history-event").count(),3);
    await geometry();
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q601364",displayName:"Antonio Caso"},[{title:"Edición",year:2020}]));
    await life.locator(".author-intellectual-history-toggle").click();
    await life.getByRole("button",{name:"Mostrar más hitos"}).click();
    assert.equal(await life.locator(".author-intellectual-history-kind").nth(4).textContent(),"Edición revisada");
    const caso=life.locator(".author-intellectual-history-event").nth(4);
    assert.equal(await caso.locator("a").count(),0);
    await caso.locator("summary").click();
    await caso.getByText("Referencias consultadas",{exact:true}).waitFor({state:"visible"});
    assert.equal(await caso.locator("a").count(),3);
    assert.ok(await caso.locator('a[href*="tesiunamdocumentos.dgb.unam.mx"]').count());
    await geometry();
    await page.evaluate(()=>window.__timelineFixture({wikidataId:"Q5711746",displayName:"Sebastián Salazar Bondy"},[{title:"Obra",year:2020}]));
    assert.equal(await life.count(),0);
    // Production-shaped inputs: no synthetic QID supplied to renderer.
    for(const c of [{"author":{"id":"5033760928","displayName":"Simone de Beauvoir"},"titles":["Le sang des autres","Segundo Sexo, Simone De Beauvoir","The Ethics of Ambiguity"],"qid":"Q7197","date":"1908"},{"author":{"catalog":"federated","displayName":"Antonio Caso Andrade","sourceDisplayName":"Antonio Caso"},"titles":["La existencia como economia como desinteres y como caridad","Positivismo, neopositivismo y fenomenología"],"qid":"Q601364","date":"1883"},{"author":{"catalog":"federated","displayName":"Confucio","viafId":"89664672"},"titles":["Analectas, Confucio"],"qid":"Q4604","date":"551"}]){
      await page.evaluate(c=>window.__timelineFixture(c.author,c.titles.map((title,i)=>({title,year:1900+i,authors:[{name:c.author.displayName}]}))),c);
      assert.equal(await life.count(),1,c.author.displayName+" missing historical panel");
      await life.locator(".author-intellectual-history-toggle").click();
      assert.match(await life.locator(".author-intellectual-history-date").first().textContent(),new RegExp(c.date));
      await geometry();
    }
    await page.evaluate(()=>window.__timelineFixture({displayName:"Confucio"},[{title:"Analectas",year:1900,authors:[{name:"Confucio"}]},{title:"Los cuatro libros",year:1961,authors:[{name:"Confucio"}]}]));
    assert.equal(await life.count(),0,"Anthology and included text do not establish independent evidence");
    // Reconstructed catalogue title families from production PDFs.
    for(const c of [{"qid":"Q8011","name":"Avicena","catalog":"federated","count":5,"positive":["De anima latine","Prima primi canonis Avicenne sectio","Principis Auicennae... De corde, eiusque facultatibus libells"],"noise":["PENGARUH ATRIBUT PRODUK DAN GAYA HIDUP TERHADAP KEPUTUSAN PEMBELIAN SAMMRTPHONE REDMI DI ROYAL CELL BIMA","Comparative Investigation on Tool Wear during End Milling of AISI H13 Steel with Different Tool Path Strategies"]},{"qid":"Q183074","name":"Sor Juana Inés de la Cruz","catalog":"federated","count":5,"positive":["Loa Al Auto Sacramental Del Divino Narciso Sor Juana Ines De La Cruz","Loa To The Divine Narcissus","Obras escogidas y Los empeños de una casa","From “La Respuesta” (1691)"],"noise":["Sor Juana Inés De La Cruz, Francisco Ramírez Santacruz","The Tenth Muse"]},{"qid":"Q171195","name":"Nāgārjuna","catalog":"openalex","count":2,"positive":["[ Nagarjuna] Middle Way","SUHṚLLEKHA","Suh-ki-li-lih-kiu: The Suhṛillekha Or 'friendly Letter' Addressed to King Sadvaha"],"noise":["Khichdi Viplava Dekha Mamne","Kumbhipak","Nai Paudh","AKAAL AUR USKE BAAD - HINDI NAGARJUNA","Nāgārjuna Philosophy Middle Path"]}]){
      await page.evaluate(c=>window.__timelineFixture({displayName:c.name,catalog:c.catalog},[...c.positive,...c.noise].map(title=>({title,authors:[{name:c.name}],year:2020}))),c);
      assert.equal(await life.count(),1,c.name+" contextual history missing");
      await life.locator(".author-intellectual-history-toggle").click();
      assert.match(await life.locator(".author-intellectual-history-toggle").textContent(),/Identificación contextual/);
      assert.match(await life.textContent(),/No confirman que todas las obras/);
      assert.equal(await life.locator(".author-intellectual-history-event").count(),Math.min(3,c.count));
      await life.locator(".author-history-evidence summary").first().click();
      await life.getByText("Referencias consultadas",{exact:true}).first().waitFor({state:"visible"});
      await geometry();
    }
    await page.close();
    process.stdout.write("author timeline OK: "+width+"px "+mode+"\n");
  }
} finally {await browser.close();}
