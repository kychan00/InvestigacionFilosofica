import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,dirname,relative,isAbsolute,sep} from "node:path";
import {pathToFileURL,fileURLToPath} from "node:url";
import {findSnapshotAuthorCandidates,resolveRemoteAuthorCandidate} from "../../src/core/remote-author-resolution.js";
import {portraitIdentity,resolveAuthorPortrait,downloadPortrait,PORTRAIT_TIMEOUT_MS,PORTRAIT_MAX_BYTES,PORTRAIT_MAX_SIDE} from "../../src/core/author-portrait-policy.js";
import {assessPortraitV2} from "../../src/core/author-authority-portrait-v2.js";
import {sanitizeAuthorOrcid,profileMatchesOrderedAuthor} from "../../src/core/author-orcid-guard.js";
import {fetchOrcidPublicProfile} from "../../src/sources/orcid.js";
const [indexDir,output]=process.argv.slice(2);
if(!indexDir||!output)throw Error("Usage: audit-portrait-live-v2.mjs INDEX_DIR OUTPUT_JSON");
const cohort=JSON.parse(await readFile(new URL("../../benchmark/author-authority/v2/portrait-live-cohort.json",import.meta.url),"utf8"));
const config=JSON.parse(await readFile(new URL("../../benchmark/author-authority/v1/config.json",import.meta.url),"utf8"));
const revision=config.expectedSource.philosophyRevision;
const root=resolve(indexDir);
const manifest=JSON.parse(await readFile(resolve(root,"manifest.json"),"utf8"));
const indexBase=pathToFileURL(root+sep);
const localFetch=async value=>{
 const url=new URL(value);
 if(url.protocol!=="file:")throw Error("Snapshot audit only reads local index partitions");
 const path=fileURLToPath(url),rel=relative(root,path);
 if(rel.startsWith("..")||isAbsolute(rel))throw Error("Index path outside release");
 try{return new Response(await readFile(path),{status:200});}
 catch(error){if(error.code==="ENOENT")return new Response("",{status:404});throw error;}
};
const allowed=new Set(["www.wikidata.org","commons.wikimedia.org","upload.wikimedia.org","thumb.wikimedia.org","pub.orcid.org"]);
const errorText=e=>String(e?.message||e).slice(0,300);
function tracedFetch(trace){
 return async (value,options={})=>{
  const u=new URL(value);
  if(u.protocol!=="https:"||!allowed.has(u.hostname))throw Error("Provider outside audit policy");
  const entry={host:u.hostname,action:u.searchParams.get("action")||"resource"};
  trace.push(entry);
  try{
   const headers=new Headers(options.headers);
   headers.set("Api-User-Agent","InvestigacionFilosofica/1.0 (https://github.com/kychan00/InvestigacionFilosofica)");
   const response=await fetch(u,{...options,headers,redirect:"error"});
   entry.httpStatus=response.status;
   if(!response.ok)entry.error="HTTP "+response.status;
   return response;
  }catch(error){entry.error=errorText(error);throw error;}
 };
}
async function settleOrcid(author){
 const clean=sanitizeAuthorOrcid(author);
 if(!clean.orcid)return {author:clean,status:clean.orcidConflict?"known-conflict":"absent",trace:[]};
 const trace=[];
 try{
  const profile=await fetchOrcidPublicProfile(clean.orcid,{signal:AbortSignal.timeout(5000),fetchImpl:tracedFetch(trace)});
  const match=profileMatchesOrderedAuthor(clean,profile);
  return {author:{...clean,orcid:match?clean.orcid:null,orcidId:match?clean.orcid:null,orcidVerified:match,orcidConflict:!match&&Boolean(profile.displayName)},status:match?"name-corroborated":profile.displayName?"name-conflict":"unverified",trace};
 }catch(error){return {author:{...clean,orcid:null,orcidId:null,orcidVerified:false},status:"provider-unavailable",error:errorText(error),trace};}
}
async function measure(author,works,independent){
 const trace=[],started=performance.now();
 const identity=portraitIdentity(author,works,{independent});
 const finish=result=>({...result,requests:trace.length,elapsedMs:Math.round(performance.now()-started),trace});
 if(!identity)return finish({status:"insufficient-profile"});
 const signal=AbortSignal.timeout(PORTRAIT_TIMEOUT_MS);
 try{
  const fetcher=tracedFetch(trace);
  const meta=await resolveAuthorPortrait(identity,{fetcher,signal});
  if(!meta)return finish({status:trace.some(t=>t.error)?"provider-unavailable":"abstained"});
  const blob=await downloadPortrait(meta,{fetcher,signal});
  if(blob.size>PORTRAIT_MAX_BYTES||meta.width>PORTRAIT_MAX_SIDE||meta.height>PORTRAIT_MAX_SIDE)throw Error("Media budget exceeded");
  const assessment=assessPortraitV2(identity,meta,revision);
  return finish({status:"downloaded",bytes:blob.size,width:meta.width,height:meta.height,license:meta.license.label,source:meta.source,entityId:meta.authorityTrace?.entityId||null,method:meta.authorityTrace?.method||null,authorityTrace:meta.authorityTrace||null,decision:assessment.decision,evidence:assessment.evidence});
 }catch(error){return finish({status:signal.aborted?"timeout":"provider-or-media-error",error:errorText(error)});}
}
async function inspectCase(item){
 const report={...item,candidates:[],candidateCount:0,evaluatedCount:0,notEvaluated:0};
 try{
  const candidates=await findSnapshotAuthorCandidates(item.name,{indexBase,fetchImpl:localFetch});
  const unique=[...new Map(candidates.map(c=>[String(c.id),c])).values()].sort((a,b)=>Number(b.cw||0)-Number(a.cw||0)||String(a.id).localeCompare(String(b.id)));
  report.candidateCount=unique.length;
  report.notEvaluated=Math.max(0,unique.length-cohort.maxCandidatesPerName);
  report.indexCandidates=unique.map(c=>({id:String(c.id),name:c.n,orcid:c.o||null,corpusWorks:c.cw||0,matchKind:c.k}));
  for(const candidate of unique.slice(0,cohort.maxCandidatesPerName)){
   const entry={id:String(candidate.id),name:candidate.n,indexOrcid:candidate.o||null};
   report.candidates.push(entry);
   try{
    const result=await resolveRemoteAuthorCandidate(candidate,{indexBase,fetchImpl:localFetch,includeProfile:false,limit:cohort.maxWorksPerCandidate});
    if(result.status!=="resolved"){entry.status="index-unresolved";continue;}
    const settled=await settleOrcid(result.author);
    entry.orcidStatus=settled.status;
    entry.orcidTrace=settled.trace;
    entry.worksLoaded=result.works.length;
    entry.legacy=await measure(settled.author,result.works,false);
    entry.experimental=await measure(settled.author,result.works,true);
    entry.status="measured";
    entry.referenceComparison=item.referenceQid&&entry.experimental.entityId?
      entry.experimental.entityId===item.referenceQid?"matches-reference":"different-reference-review-required":"not-assessed";
    entry.humanReview="pending";
   }catch(error){entry.status="index-or-profile-error";entry.error=errorText(error);}
  }
  report.evaluatedCount=report.candidates.filter(c=>c.status==="measured").length;
  report.status=unique.length?"sampled":"no-index-candidate";
 }catch(error){report.status="index-error";report.error=errorText(error);}
 return report;
}
// Small bounded concurrency. Never call the direct OpenAlex API or write media.
const results=new Array(cohort.cases.length);
let next=0;
await Promise.all(Array.from({length:2},async()=>{
 while(next<cohort.cases.length){
  const i=next++;
  results[i]=await inspectCase(cohort.cases[i]);
  console.log("SIVA_COHORT_CASE "+JSON.stringify(results[i]));
 }
}));
const measured=results.flatMap(r=>r.candidates).filter(c=>c.status==="measured");
const tally=mode=>Object.fromEntries([...new Set(measured.map(c=>c[mode].status))].sort().map(status=>[status,measured.filter(c=>c[mode].status===status).length]));
const summary={names:results.length,indexCandidates:results.reduce((n,r)=>n+r.candidateCount,0),evaluatedProfiles:measured.length,notEvaluated:results.reduce((n,r)=>n+r.notEvaluated,0),legacy:tally("legacy"),experimental:tally("experimental"),gains:measured.filter(c=>c.legacy.status!=="downloaded"&&c.experimental.status==="downloaded").length,losses:measured.filter(c=>c.legacy.status==="downloaded"&&c.experimental.status!=="downloaded").length,changedEntity:measured.filter(c=>c.legacy.entityId&&c.experimental.entityId&&c.legacy.entityId!==c.experimental.entityId).length,referenceDifferences:measured.filter(c=>c.referenceComparison==="different-reference-review-required").length,humanReviewed:0};
await mkdir(dirname(resolve(output)),{recursive:true});
await writeFile(output,JSON.stringify({schemaVersion:"siva-live-cohort-report-v1",generatedAt:new Date().toISOString(),revision,release:config.release,manifestSource:manifest.source||null,limitations:["Selected nonrandom development cohort; not accuracy or gold.","Snapshot-only author work sample, not full federated dossier.","Actual HTTP metadata and downloaded bytes; browser decode is covered separately by the live provider smoke.","Different-reference entries require human adjudication; same QID does not prove the file depicts the person.","Abstention and provider failure are separate outcomes. Human review pending."],summary,results},null,2)+"\n");
console.log("SIVA_COHORT_SUMMARY "+JSON.stringify(summary));
if(!measured.length)throw Error("No snapshot profiles could be evaluated; audit incomplete");
