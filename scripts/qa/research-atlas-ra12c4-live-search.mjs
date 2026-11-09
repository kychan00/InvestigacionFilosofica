#!/usr/bin/env node
// RA12-C4 — capture real federated SearchResponses in a browser against current source adapters.
// No semantic graph mutation, no overlay embedding, no production write.
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const args=process.argv.slice(2);
function value(flag){const i=args.indexOf(flag);if(i<0||i===args.length-1)throw Error("Missing "+flag);return args[i+1];}
const querySet=JSON.parse(await fs.readFile(value("--queries"),"utf8"));
const output=value("--output");
const base=value("--base-url");
if(querySet.schemaVersion!=="research-atlas-ra12c4-live-query-set-v1") throw Error("Bad query set");

const browser=await chromium.launch({headless:true});
const report={
  schemaVersion:"research-atlas-ra12c4-live-search-capture-v1",
  startedAt:new Date().toISOString(),
  baseUrl:base,
  querySetSchema:querySet.schemaVersion,
  providerPolicy:querySet.federation,
  runs:[],
  productionChanged:false,
  qwenOverlayEmbeddingGenerated:false
};
try{
  const page=await browser.newPage();
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:60000});
  for(const item of querySet.queries){
    const result=await page.evaluate(async({query,policy})=>{
      const map=await fetch("./src/data/philosophy-map.json").then(r=>{
        if(!r.ok) throw Error("philosophy-map HTTP "+r.status);
        return r.json();
      });
      const [{searchPhilosophy},{semanticAliases,overlayDocumentText,overlayStableIdentity}]=await Promise.all([
        import("./src/core/search-engine.js"),
        import("./src/core/research-atlas-semantic-coverage.js")
      ]);
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),120000);
      const started=performance.now();
      try{
        const response=await searchPhilosophy(query,map,{
          signal:controller.signal,
          maxQueries:policy.maxQueries,
          delayBetweenExpansions:0,
          openAlex:{enabled:false},
          openAlexPhilosophy:{enabled:true,rows:policy.rowsPerProvider},
          cucshFilosofia:{enabled:true,rows:policy.rowsPerProvider},
          crossref:{enabled:true,rows:policy.rowsPerProvider},
          internetArchive:{enabled:true,rows:policy.rowsPerProvider}
        });
        const serializable=response.results.slice(0,50).map((r,index)=>({
          rank:index+1,
          id:r.id??null,
          title:r.title??"",
          abstract:r.abstract??null,
          year:r.year??null,
          doi:r.doi??null,
          openalexId:r.openalexId??r.openalex_id??null,
          crossrefId:r.crossrefId??r.crossref_id??null,
          providers:[...(r.providers||[])],
          sourceRecords:(r.sourceRecords||[]).map(x=>({
            provider:x.provider??null,sourceId:x.sourceId??null,rank:x.rank??null
          })),
          urls:{canonical:r.urls?.canonical??null,doi:r.urls?.doi??null},
          semanticAliases:semanticAliases(r),
          overlayIdentity:overlayStableIdentity(r),
          overlayTextBytes:overlayDocumentText(r)?new TextEncoder().encode(overlayDocumentText(r)).length:0
        }));
        return {
          durationMs:Math.round(performance.now()-started),
          resultCount:response.results.length,
          errors:response.errors||[],
          stats:response.stats||{},
          results:serializable
        };
      }finally{clearTimeout(timeout);}
    },{query:item.query,policy:querySet.federation});
    report.runs.push({id:item.id,query:item.query,...result});
    await new Promise(resolve=>setTimeout(resolve,900));
  }
}finally{
  await browser.close();
}
report.completedAt=new Date().toISOString();
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({
  queries:report.runs.length,
  resultCounts:report.runs.map(x=>({id:x.id,count:x.resultCount,errors:x.errors.length,durationMs:x.durationMs}))
}));
