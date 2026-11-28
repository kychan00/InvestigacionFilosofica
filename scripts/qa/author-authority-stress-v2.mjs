import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
const base=process.env.MOBILE_UI_BASE_URL||"http://127.0.0.1:4173/";
const output="artifacts/author-authority-profile-v2/stress.json";
await mkdir("artifacts/author-authority-profile-v2",{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const reports=[];
try{
 for(const scenario of [{width:320,rows:1200,cpu:4},{width:390,rows:5000,cpu:4},{width:1440,rows:5000,cpu:1}]){
  const page=await browser.newPage({viewport:{width:scenario.width,height:900},deviceScaleFactor:1});
  await page.route("**/*",r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.goto(base,{waitUntil:"domcontentloaded"});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate",{rate:scenario.cpu});
  const result=await page.evaluate(async({rows:count})=>{
   const {authorityPreviewRevision,mountAuthorAuthorityPreview,buildAuthorityArchiveView}=await import("./src/core/author-authority-profile-v2.js");
   const {createAuthorPortraitSession}=await import("./js/author-portrait-session.js");
   const check=(ok,msg)=>{if(!ok)throw Error(msg);};
   check(!authorityPreviewRevision("")&&!authorityPreviewRevision("?authorityPreview=0")&&!authorityPreviewRevision("?authorityPreview=true")&&Boolean(authorityPreviewRevision("?authorityPreview=1")),"preview activation contract");
   document.body.classList.add("author-view");
   document.querySelector("#research-workspace").classList.remove("hidden");
   const results=document.querySelector("#results");
   const setup=()=>{results.innerHTML='<article class="author-page"><header class="author-page-hero"><div class="author-page-identity"><h1>Autor de prueba</h1></div><div class="siva-author-portrait-slot"><div class="author-page-seal"><span>AP</span></div><figure class="siva-portrait" hidden></figure></div></header><section class="author-authority-preview"></section></article>';return results.querySelector("section");};
   let root=setup();
   const rows=Array.from({length:count},(_,i)=>({record:{provider:"OpenAlex Philosophy",sourceId:"W"+(i+1),title:"Obra "+String(i).padStart(5,"0"),year:1900+i%125},contributions:[{rawName:"Autor de prueba",role:"author",decision:{scope:"contribution",status:i%10===0?"ambiguous":"probable"},evidence:[]}]}));
   const legacy=rows.map(r=>({id:r.record.sourceId,providers:["OpenAlex Philosophy"],title:r.record.title}));
   const now=()=>performance.now();
   const timed=fn=>{const t=now();fn();void root.offsetHeight;return now()-t;};
   const t=now(),archive=buildAuthorityArchiveView({rows},legacy),projectionMs=now()-t;
   check(archive.profile.works.length===count&&archive.byGroup.size===count,"all documents linked");
   const mountMs=timed(()=>mountAuthorAuthorityPreview(root,{shadow:{rows},archive}));
   const visible=()=>root.querySelectorAll(".authority-preview-work").length;
   const heading=()=>root.querySelector(".authority-preview-work summary strong")?.textContent;
   let maxVisible=visible(),maxNodes=root.querySelectorAll("*").length;
   const durations=[];
   const click=label=>{const b=[...root.querySelectorAll("button")].find(x=>x.textContent===label&&!x.hidden);check(b,"missing "+label);durations.push(timed(()=>b.click()));maxVisible=Math.max(maxVisible,visible());maxNodes=Math.max(maxNodes,root.querySelectorAll("*").length);};
   const initial=heading();
   for(let i=0;i<30;i++)click("Siguientes atribuciones");
   check(heading()!==initial,"pagination did not advance");
   for(let i=0;i<30;i++)click("Atribuciones anteriores");
   check(heading()===initial,"pagination did not return");
   const search=root.querySelector('input[type="search"]');
   durations.push(timed(()=>{search.value="Obra "+String(count-1).padStart(5,"0");search.dispatchEvent(new Event("input"));}));
   check(visible()===1,"last work not searchable");
   durations.push(timed(()=>{search.value="no match fixture";search.dispatchEvent(new Event("input"));}));
   check(visible()===0,"no-result state");
   durations.push(timed(()=>{search.value="";search.dispatchEvent(new Event("input"));}));
   const filter=root.querySelector("select");
   durations.push(timed(()=>{filter.value="ambiguous";filter.dispatchEvent(new Event("change"));}));
   check(visible()===12&&[...root.querySelectorAll(".authority-preview-state")].every(x=>x.textContent.startsWith("Ambigua")),"filter status");
   check(maxVisible<=12,"unbounded result list");
   const bounds=root.getBoundingClientRect();
   check(root.scrollWidth<=root.clientWidth+3&&bounds.right<=innerWidth+3,"preview horizontal overflow");
   const blob=await new Promise(resolve=>{const canvas=document.createElement("canvas");canvas.width=20;canvas.height=20;canvas.getContext("2d").fillRect(0,0,20,20);canvas.toBlob(resolve,"image/png");});
   const slot=()=>results.querySelector(".siva-author-portrait-slot");
   const portraitMeta=id=>({width:20,height:20,credit:"Fixture",source:"https://commons.wikimedia.org/wiki/File:Test.jpg",license:{label:"CC BY 4.0",url:"https://creativecommons.org/licenses/by/4.0/"},identity:"https://www.wikidata.org/wiki/Q"+id,authorityTrace:{entityId:"Q"+id,authorityFile:"Test.jpg",commonsFile:"File:Test.jpg",method:"openalex-bridge"}});
   let requests=0,aborts=0,creates=0,revokes=0,peakActive=0;
   const live=new Set();
   const author=i=>({id:String(1000+i),displayName:"Autor "+i});
   const session=createAuthorPortraitSession({authorityRevision:"fixture",resolve:async(identity,{signal})=>{
    requests++;signal.addEventListener("abort",()=>aborts++,{once:true});
    return portraitMeta(identity.openalex.slice(1));
   },download:async()=>blob,createURL:b=>{const u=URL.createObjectURL(b);live.add(u);creates++;peakActive=Math.max(peakActive,live.size);return u;},revokeURL:u=>{check(live.delete(u),"duplicate revocation");revokes++;URL.revokeObjectURL(u);}});
   for(let i=0;i<20;i++){
    root=setup();await session.open(author(i),slot());
    check(slot().querySelector("img")?.alt==="Retrato de Autor "+i,"wrong portrait session");
    const before=requests;
    root=setup();await session.open(author(i),slot());
    check(requests===before&&slot().querySelector("img"),"same-author rerender requested media again");
   }
   session.close();check(!live.size&&!slot().querySelector("img"),"portrait leak after close");
   // Deliberately resolve old requests after a new author has completed.
   const pending=new Map();
   const rapid=createAuthorPortraitSession({authorityRevision:"fixture",resolve:identity=>new Promise(r=>pending.set(identity.openalex,r)),download:async()=>blob});
   const tasks=[];
   for(let i=0;i<10;i++){root=setup();tasks.push(rapid.open(author(i),slot()));}
   pending.get("A1009")(portraitMeta("1009"));await tasks[9];
   for(let i=8;i>=0;i--)pending.get("A"+(1000+i))(portraitMeta(String(1000+i)));
   await Promise.all(tasks);
   check(slot().querySelector("img")?.alt==="Retrato de Autor 9","late resolution replaced current author");
   rapid.close();check(!slot().querySelector("img"),"rapid session did not close");
   // Default route remains visually separate from the experimental labels.
   const legacySession=createAuthorPortraitSession({resolve:async()=>portraitMeta("1000"),download:async()=>blob});
   await legacySession.open(author(0),slot());
   check(slot().querySelector("img")&&!slot().querySelector(".siva-authority-preview"),"legacy mode changed");
   legacySession.close();
   const sorted=durations.slice().sort((a,b)=>a-b);
   return {projectionMs,mountMs,interactionP95Ms:sorted[Math.ceil(sorted.length*.95)-1],interactionMaxMs:Math.max(...durations),maxVisible,maxNodes,interactions:durations.length,portrait:{requests,aborts,creates,revokes,peakActive,activeAfterClose:live.size,rapidSwitches:10}};
  },scenario);
  const report={...scenario,...result};reports.push(report);
  console.log("AUTHORITY_V2_STRESS "+JSON.stringify(report));
  assert.equal(result.maxVisible,12);assert.equal(result.portrait.requests,20);assert.equal(result.portrait.creates,20);assert.equal(result.portrait.revokes,20);assert.equal(result.portrait.peakActive,1);assert.equal(result.portrait.activeAfterClose,0);assert.equal(result.portrait.aborts,20);
  // Generous CI regression ceilings, not promised end-user latency.
  assert.ok(result.projectionMs<5000&&result.mountMs<3000&&result.interactionMaxMs<1000,JSON.stringify(report));
  await page.close();
 }
}finally{
 await writeFile(output,JSON.stringify({schemaVersion:"authority-v2-stress-v1",scenarios:reports,limitations:["Synthetic browser fixtures, no live network or real author identity evidence.","CPU throttle approximates slower devices, not actual iPhone or Android hardware.","Synchronous JavaScript plus layout timing, not end-to-end search latency.","Blob URL counts and DOM counts are resource proxies, not heap or total memory measurements."]},null,2)+"\n");
 await browser.close();
}
