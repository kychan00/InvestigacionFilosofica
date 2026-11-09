#!/usr/bin/env node
// RA12-C5-C: verify the immutable overlay from the actual GitHub Pages origin.
// This injects standalone repository modules into Chromium; production code/UI stays unchanged.
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const args=process.argv.slice(2);
const value=key=>{const i=args.indexOf(key);if(i<0||i===args.length-1)throw Error("Missing "+key);return args[i+1]};
const publication=JSON.parse(await fs.readFile(value("--publication"),"utf8"));
const reference=JSON.parse(await fs.readFile(value("--reference"),"utf8"));
const output=value("--output");
if(publication.schemaVersion!=="research-atlas-ra12c5c-hf-publication-result-v1" ||
   publication.status!=="published-and-remotely-verified" || publication.remoteShaVerified!==true ||
   !/^[a-f0-9]{40}$/.test(publication.commitOid||"") ||
   publication.sourceArtifactId!==13649068736 || publication.atlasRuntimeEnabled!==false ||
   publication.semanticNeighborEnabled!==false) throw Error("Invalid C5-C publication evidence");
if(reference.schemaVersion!=="research-atlas-ra12c5c-browser-reference-v1" ||
   reference.sourceManifestSha256!==publication.overlayManifestSha256 || reference.productionEnabled!==false)
  throw Error("Invalid browser reference");
const files=publication.files||{};
for(const name of ["manifest.json","vector-index.jsonl.gz","identity-lookup.json"]){
  if(!/^[a-f0-9]{64}$/.test(files[name]?.sha256||"") || !Number.isSafeInteger(files[name]?.bytes))
    throw Error("Missing published file proof: "+name);
}
const v4=publication.v4DigestPublication;
if(!/^[a-f0-9]{40}$/.test(v4?.commitOid||"") || !/^[a-f0-9]{64}$/.test(v4?.rootSha256||""))
  throw Error("Missing pinned V4 digest publication");

function stripModule(source){return source.replace(/^import .*;\s*$/gm,"").replace(/^export /gm,"")}
const c1=stripModule(await fs.readFile(path.join(root,"src/core/research-atlas-qwen-vector-range.js"),"utf8"));
const c3=stripModule(await fs.readFile(path.join(root,"src/core/research-atlas-qwen-digest-proof.js"),"utf8"));
const c5c=stripModule(await fs.readFile(path.join(root,"src/core/research-atlas-qwen-overlay-proof.js"),"utf8"));
const injected=`(()=>{${c1}\nwindow.__RA12_C1={fetchVerifiedVectorRange,vectorByteRange,sha256Hex,cosineInt8};})();\n`+
`(()=>{const {fetchVerifiedVectorRange,vectorByteRange,sha256Hex}=window.__RA12_C1;${c3}\nwindow.__RA12_C3={fetchAuthenticatedQwenVector,RA12C3_ROOT_SHA};})();\n`+
`(()=>{const {sha256Hex,cosineInt8}=window.__RA12_C1;${c5c}\nwindow.__RA12_C5C={fetchAuthenticatedOverlayVector,cosineOverlayVectors};})();`;

const report={
  schemaVersion:"research-atlas-ra12c5c-live-pages-proof-v1",status:"blocked",
  origin:"https://kychan00.github.io",publicationOid:publication.commitOid,
  sourceArtifactId:publication.sourceArtifactId,sourceArtifactZipSha256:publication.sourceArtifactZipSha256,
  overlayManifestSha256:publication.overlayManifestSha256,v4DigestOid:v4.commitOid,
  v4DigestRootSha256:v4.rootSha256,overlayVectors:[],v4Vectors:[],overlayCosine:[],crossCosine:[],
  modelDownloaded:false,secondSearchPerformed:false,atlasRuntimeChanged:false,semanticNeighborEnabled:false
};
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  await page.goto("https://kychan00.github.io/InvestigacionFilosofica/",{waitUntil:"domcontentloaded",timeout:45_000});
  if(await page.evaluate(()=>location.origin)!==report.origin) throw Error("Canonical Pages origin not reached");
  await page.addScriptTag({content:injected});
  if(!await page.evaluate(()=>Boolean(window.__RA12_C5C?.fetchAuthenticatedOverlayVector&&window.__RA12_C3?.fetchAuthenticatedQwenVector)))
    throw Error("Experimental proof modules unavailable");
  const result=await page.evaluate(async({publication,reference})=>{
    const overlay=[];
    for(const ordinal of reference.overlaySamples){
      const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),20_000);const started=performance.now();
      const r=await window.__RA12_C5C.fetchAuthenticatedOverlayVector({
        oid:publication.commitOid,ordinal,
        expectedManifestSha256:publication.files["manifest.json"].sha256,
        expectedManifestBytes:publication.files["manifest.json"].bytes,
        expectedIndexSha256:publication.files["vector-index.jsonl.gz"].sha256,
        expectedIndexBytes:publication.files["vector-index.jsonl.gz"].bytes,
        expectedLookupSha256:publication.files["identity-lookup.json"].sha256,
        expectedLookupBytes:publication.files["identity-lookup.json"].bytes,
        signal:abort.signal
      });clearTimeout(timer);
      overlay.push({ordinal,state:r.state,reason:r.reason||null,identity:r.identity||null,
        proof:r.proof||null,vectorSha256:r.vectorSha256||null,bytesAccepted:r.bytesAccepted||0,
        durationMs:Math.round(performance.now()-started),bytes:r.state==="verified"?Array.from(r.bytes):null});
    }
    const v4=[];
    for(const sample of reference.v4Samples){
      const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),20_000);const started=performance.now();
      const r=await window.__RA12_C3.fetchAuthenticatedQwenVector({oid:publication.v4DigestPublication.commitOid,
        cluster:sample.cluster,ordinal:sample.ordinal,expectedRootSha:publication.v4DigestPublication.rootSha256,signal:abort.signal});
      clearTimeout(timer);
      v4.push({cluster:sample.cluster,ordinal:sample.ordinal,state:r.state,reason:r.reason||null,
        proof:r.proof||null,vectorSha256:r.vectorSha256||null,bytesAccepted:r.bytesAccepted||0,
        durationMs:Math.round(performance.now()-started),bytes:r.state==="verified"?Array.from(r.bytes):null});
    }
    const overlayCosine=[];
    for(const pair of reference.overlayCosine){
      const a=overlay.find(x=>x.ordinal===pair.ordinals[0]);const b=overlay.find(x=>x.ordinal===pair.ordinals[1]);
      if(a?.bytes&&b?.bytes){
        const score=window.__RA12_C5C.cosineOverlayVectors(Int8Array.from(a.bytes),Int8Array.from(b.bytes));
        overlayCosine.push({ordinals:pair.ordinals,score,referenceCosine:pair.referenceCosine,
          absoluteError:Math.abs(score-pair.referenceCosine)});
      }
    }
    const crossCosine=[];
    for(const pair of reference.crossPairs){
      const a=v4[pair.v4Sample];const b=overlay.find(x=>x.ordinal===pair.overlayOrdinal);
      if(a?.bytes&&b?.bytes){
        const score=window.__RA12_C5C.cosineOverlayVectors(Int8Array.from(a.bytes),Int8Array.from(b.bytes));
        crossCosine.push({v4:{cluster:a.cluster,ordinal:a.ordinal},overlayOrdinal:pair.overlayOrdinal,score});
      }
    }
    return {overlay,v4,overlayCosine,crossCosine};
  },{publication,reference});
  report.overlayVectors=result.overlay.map(({bytes,...x})=>x);
  report.v4Vectors=result.v4.map(({bytes,...x})=>x);
  report.overlayCosine=result.overlayCosine;report.crossCosine=result.crossCosine;
  const overlayOk=result.overlay.every(x=>x.state==="verified"&&x.proof==="manifest-sha:index-sha:digest-sha:lookup-sha:range206:vector-sha");
  const v4Ok=result.v4.every(x=>x.state==="verified"&&x.proof==="root-sha:index-sha:tile-sha:vector-sha");
  const parity=result.overlayCosine.length===reference.overlayCosine.length&&result.overlayCosine.every(x=>Number.isFinite(x.score)&&x.absoluteError<=1e-12);
  const cross=result.crossCosine.length===reference.crossPairs.length&&result.crossCosine.every(x=>Number.isFinite(x.score)&&x.score>=-1&&x.score<=1);
  report.overlayRange206Verified=overlayOk;report.v4DigestChainVerified=v4Ok;
  report.overlayCosineParityVerified=parity;report.crossCosineComputedFromTwoAuthenticatedVectors=cross;
  report.status=overlayOk&&v4Ok&&parity&&cross?"pass":"blocked";
}catch(error){report.status="blocked";report.browserError=String(error).slice(0,400)}
finally{await browser.close()}
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(report,null,2)+"\n","utf8");
console.log(JSON.stringify({status:report.status,overlay:report.overlayVectors.map(x=>({ordinal:x.ordinal,state:x.state,reason:x.reason})),
  v4:report.v4Vectors.map(x=>({cluster:x.cluster,ordinal:x.ordinal,state:x.state,reason:x.reason})),
  overlayCosine:report.overlayCosine,crossCosine:report.crossCosine}));
if(report.status!=="pass") process.exitCode=1;
