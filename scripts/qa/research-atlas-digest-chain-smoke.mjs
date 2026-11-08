#!/usr/bin/env node
// RA12-C3 manual post-publication smoke: actual GitHub Pages origin in Chromium.
// Test only; injects trusted local modules without changing the deployed site.
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = process.argv.slice(2);
function value(flag) {
  const p=cli.indexOf(flag);
  if(p<0 || p===cli.length-1) throw Error("Missing argument: "+flag);
  return cli[p+1];
}
const publication = JSON.parse(await fs.readFile(value("--publication"),"utf8"));
if(publication.status!=="published-and-remotely-verified" ||
   publication.atlasRuntimeEnabled!==false ||
   !/^[a-f0-9]{40}$/.test(publication.commitOid) ||
   publication.hashManifestSha256!=="38067b5876de5f53abe5c7431b8618464d3fe711058a70fdde700fce7c50d961")
  throw Error("No verified immutable HF publication evidence");

const reader1=await fs.readFile(path.join(project,"src/core/research-atlas-qwen-vector-range.js"),"utf8");
const reader3=await fs.readFile(path.join(project,"src/core/research-atlas-qwen-digest-proof.js"),"utf8");
const injection=reader1.replace(/^export /gm,"")+"\n"+
  reader3.replace(/^import .*;\s*$/gm,"").replace(/^export /gm,"")+
  "\nwindow.__RA12C3={fetchAuthenticatedQwenVector};";
const samples=[
  {cluster:220,ordinal:0},
  {cluster:208,ordinal:260},
  {cluster:10,ordinal:6471}
];
const output={
  schemaVersion:"research-atlas-ra12c3-live-pages-proof-v1",
  status:"blocked",
  origin:"https://kychan00.github.io",
  publicationOid:publication.commitOid,
  pinnedRootSha256:publication.hashManifestSha256,
  cases:[],
  allShaStepsVerified:false,
  independentLookupJoinMeasured:false,
  productionEnabled:false,
  modelDownloaded:false,
  browserNetworkPayloadFullyMeasured:false
};
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  await page.goto("https://kychan00.github.io/InvestigacionFilosofica/",{
    waitUntil:"domcontentloaded",timeout:45000
  });
  if(await page.evaluate(()=>location.origin)!==output.origin)
    throw Error("Not in canonical Pages origin");
  await page.addScriptTag({content:injection});
  const result=await page.evaluate(async({samples,oid})=>{
    const output=[];
    for(const entry of samples){
      const abort=new AbortController();
      const timer=setTimeout(()=>abort.abort(),20000);
      const started=performance.now();
      const item=await window.__RA12C3.fetchAuthenticatedQwenVector({
        oid,cluster:entry.cluster,ordinal:entry.ordinal,signal:abort.signal
      });
      clearTimeout(timer);
      output.push({
        cluster:entry.cluster,
        ordinal:entry.ordinal,
        status:item.state,
        reason:item.reason||null,
        bytesAccepted:item.bytesAccepted||0,
        durationMs:Math.round(performance.now()-started),
        proof:item.proof||null,
        sourceRevision:item.sourceRevision||null
      });
    }
    return output;
  },{samples,oid:publication.commitOid});
  output.cases=result;
  output.allShaStepsVerified=result.every(x=>x.status==="verified" &&
    x.proof==="root-sha:index-sha:tile-sha:vector-sha");
  output.status=output.allShaStepsVerified?"pass":"blocked";
}catch(error){
  output.status="blocked";
  output.browserError=String(error).slice(0,300);
}finally{
  await browser.close();
}
await fs.mkdir(path.dirname(value("--output")),{recursive:true});
await fs.writeFile(value("--output"),JSON.stringify(output,null,2)+"\n","utf8");
console.log(JSON.stringify({
  status:output.status,
  oid:output.publicationOid,
  samples:output.cases.map(x=>({cluster:x.cluster,ordinal:x.ordinal,status:x.status,reason:x.reason}))
}));
if(output.status!=="pass") process.exitCode=1;
