import {readFile,mkdir,writeFile} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {runRuntimeBaseline,measure} from "./audit-runtime-v2.mjs";
import {resolveAuthorityV2} from "../../src/core/author-authority-resolution-v2.js";
import {EVIDENCE_SCHEMA} from "../../src/core/author-authority-evidence-v2.js";
import {normalizeAuthorName} from "../../src/core/remote-author-resolution.js";
const normalizeOrcid=v=>String(v||"").replace(/^https?:\/\/orcid\.org\//i,"").trim().toUpperCase();
const name=v=>normalizeAuthorName(v||"");
const label=s=>s==="confirmed"?"accept":s==="rejected"?"reject":"abstain";
// Replay only recorded fields. Expected labels and legacy outcomes are NOT
// passed to the evidence adapter. Neither an ORCID-shaped string nor a
// nominal match establishes independent verification.
export function adaptRecordedCase(c,datasetRevision){
 const scope=c.task==="contribution"?"contribution":"identity";
 const subjectRef="regression:"+c.id;
 const candidates=c.task==="identity"?c.candidates.map(x=>({ref:x.id,name:x.name,orcid:x.orcid})):
 c.task==="orcid"?[{ref:"registry:profile",name:c.profile?.displayName,orcid:c.author?.orcid}]:
 [{ref:"author:requested",name:c.name,orcid:c.orcid}];
 const evidence=[];
 const add=(ref,kind,polarity)=>evidence.push({schemaVersion:EVIDENCE_SCHEMA,id:subjectRef+":"+ref+":"+kind,subjectRef,objectRef:ref,scope,kind,polarity,reliability:"asserted",sourceRefs:[subjectRef+":record"],lineageKey:subjectRef+":record",revision:datasetRevision});
 for(const target of candidates){
  const people=c.task==="contribution"?c.work?.authors||[]:c.task==="orcid"?[c.author]:[c.mention];
  const exact=people.filter(p=>name(p?.name||p?.displayName)===name(target.name)&&name(target.name));
  if(exact.length)add(target.ref,"ordered-name-match","supports");
  const observed=(c.task==="orcid"?[]:people).filter(p=>c.task==="identity"||exact.includes(p)).map(p=>normalizeOrcid(p?.orcid)).filter(Boolean);
  const expected=normalizeOrcid(target.orcid);
  if(expected&&observed.includes(expected))add(target.ref,"recorded-orcid-match","supports");
  else if(expected&&observed.length)add(target.ref,"recorded-orcid-conflict","contradicts");
 }
 return {subjectRef,scope,datasetRevision,candidateRefs:candidates.map(x=>x.ref),evidence};
}
export function compareRuntimeShadow(fixture,reviewed=null){
 if(reviewed&&(reviewed.schemaVersion!=="authority-reviewed-replay-v2"||!Array.isArray(reviewed.cases)||!reviewed.reviewedOn))throw Error("Invalid reviewed evidence");
 const overlays=new Map((reviewed?.cases||[]).map(c=>[c.id,c]));
 if(overlays.size!==(reviewed?.cases||[]).length||[...overlays.keys()].some(id=>!fixture.cases.some(c=>c.id===id)))throw Error("Unknown or duplicate reviewed case");
 const baseline=runRuntimeBaseline(fixture);
 const byId=new Map(baseline.results.map(r=>[r.id,r]));
 const results=fixture.cases.map(c=>{
  const {expected,kind,sources,...record}=c;
  const context=adaptRecordedCase(record,fixture.base);
  const {decision,evaluations}=resolveAuthorityV2(context);
  const overlay=overlays.get(c.id);
  let enriched=null;
  if(overlay){
   if(kind!=="documented"||JSON.stringify(overlay.record)!==JSON.stringify(record)||context.candidateRefs.length!==1||!Array.isArray(overlay.assertions)||!overlay.assertions.length)throw Error("Reviewed evidence binding mismatch: "+c.id);
   const additions=overlay.assertions.map((a,i)=>({...a,schemaVersion:EVIDENCE_SCHEMA,id:context.subjectRef+":reviewed:"+i,subjectRef:context.subjectRef,objectRef:context.candidateRefs[0],scope:context.scope,revision:reviewed.reviewedOn}));
   const allEvidence=[...context.evidence,...additions];
   const outcome=resolveAuthorityV2({...context,evidence:allEvidence});
   enriched={actual:label(outcome.decision.status),decision:outcome.decision,evaluations:outcome.evaluations,evidence:allEvidence};
  }
  return {id:c.id,task:c.task,kind,expected,legacy:byId.get(c.id).actual,actual:label(decision.status),status:decision.status,decision,evaluations,evidence:context.evidence,enriched};
 });
 const byTask=Object.fromEntries(["identity","contribution","orcid"].map(task=>{
  const rows=results.filter(r=>r.task===task);
  return [task,{legacy:measure(rows.map(r=>({...r,actual:r.legacy}))),shadow:measure(rows)}];
 }));
 const reviewedRows=results.filter(r=>r.enriched);
 const reviewedComparison={count:reviewedRows.length,legacy:measure(reviewedRows.map(r=>({...r,actual:r.legacy}))),raw:measure(reviewedRows),enriched:measure(reviewedRows.map(r=>({...r,actual:r.enriched.actual})))};
 return {schemaVersion:"authority-runtime-shadow-v2",base:fixture.base,reviewedComparison,scope:"reconstructed raw-record replay; no externally verified assertions supplied; not representative accuracy",byTask,results,changed:results.filter(r=>r.legacy!==r.actual).length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const fixture=JSON.parse(await readFile(new URL("../../benchmark/author-authority/v2/runtime-regressions.json",import.meta.url),"utf8"));
 const reviewed=JSON.parse(await readFile(new URL("../../benchmark/author-authority/v2/reviewed-replay-evidence.json",import.meta.url),"utf8"));
 const report=compareRuntimeShadow(fixture,reviewed);
 const out=resolve(process.argv[2]||"artifacts/author-authority-v2/runtime-shadow.json");
 await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({changed:report.changed,byTask:report.byTask,reviewedComparison:report.reviewedComparison},null,2));
}
