import {readFile,mkdir,writeFile} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {matchFederatedWork} from "../../src/core/author-federated-matching.js";
import {profileMatchesOrderedAuthor} from "../../src/core/author-orcid-guard.js";
import {resolveAuthorMention} from "../../src/core/author-authority-resolution.js";
const labels=["accept","reject","abstain"];
export function measure(cases){
 const matrix=Object.fromEntries(labels.map(a=>[a,Object.fromEntries(labels.map(b=>[b,0]))]));
 for(const c of cases){
  if(!labels.includes(c.expected)||!labels.includes(c.actual))throw Error("Invalid benchmark label");
  matrix[c.expected][c.actual]++;
 }
 const tp=matrix.accept.accept,fp=matrix.reject.accept,fn=matrix.accept.reject+matrix.accept.abstain;
 const ratio=(a,b)=>b?a/b:null;
 const precision=ratio(tp,tp+fp),recall=ratio(tp,tp+fn);
 return {count:cases.length,matrix,precision,recall,f1:precision===null||recall===null?null:precision+recall===0?0:2*precision*recall/(precision+recall),falseAccepts:fp,falseNegatives:fn,unsafeAcceptOnAbstain:matrix.abstain.accept,abstentions:labels.reduce((s,k)=>s+matrix[k].abstain,0),agreement:ratio(labels.reduce((s,k)=>s+matrix[k][k],0),cases.length)};
}
export function runRuntimeBaseline(fixture){
 if(fixture?.schemaVersion!=="authority-runtime-regressions-v2-phase1"||!Array.isArray(fixture.cases)||!fixture.cases.length)throw Error("Invalid fixture");
 const ids=new Set();
 const results=fixture.cases.map(c=>{
  if(ids.has(c.id)||!c.id||!["documented","synthetic"].includes(c.kind)||!labels.includes(c.expected))throw Error("Invalid case");
  ids.add(c.id);
  if(c.kind==="documented"&&(!Array.isArray(c.sources)||!c.sources.length))throw Error("Missing evidence");
  let actual,reason;
  if(c.task==="contribution"){
   const result=matchFederatedWork(c.work,c.name,{aliases:c.aliases||[],expectedOrcid:c.orcid});
   actual=result?"accept":"reject";reason=result?.matchedAuthorEvidence||"no-match";
  }else if(c.task==="orcid"){
   actual=profileMatchesOrderedAuthor(c.author,c.profile)?"accept":"reject";reason="ordered-public-name";
  }else if(c.task==="identity"){
   const decision=resolveAuthorMention(c.mention,c.candidates);
   actual=decision.status==="confirmed"?"accept":decision.explanationCode==="all-candidates-vetoed"?"reject":"abstain";reason=decision.explanationCode;
  }else throw Error("Unknown task");
  return {id:c.id,kind:c.kind,task:c.task,expected:c.expected,actual,reason,match:c.expected===actual,sources:c.sources||[]};
 });
 return {schemaVersion:"author-authority-runtime-baseline-v2",base:fixture.base,scope:"offline reconstructed regression cases, not population estimates",results,byTask:Object.fromEntries(["identity","contribution","orcid"].map(task=>[task,measure(results.filter(r=>r.task===task))])),byKind:Object.fromEntries(["documented","synthetic"].map(kind=>[kind,measure(results.filter(r=>r.kind===kind))]))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const fixture=JSON.parse(await readFile(new URL("../../benchmark/author-authority/v2/runtime-regressions.json",import.meta.url),"utf8"));
 const report=runRuntimeBaseline(fixture);
 const output=resolve(process.argv[2]||"artifacts/author-authority-v2/runtime-baseline.json");
 await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({output,byTask:report.byTask,mismatches:report.results.filter(r=>!r.match)},null,2));
 // Known legacy errors are measured, not disguised as a passing quality gate.
}
