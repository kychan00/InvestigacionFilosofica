import {readFile,mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {authorNameSignature,normalizeAuthorName} from "../../src/core/remote-author-resolution.js";
import {intellectualHistoryReferenceInventory} from "../../src/core/author-intellectual-history.js";
import {readSnapshotJsonl} from "./read-snapshot-jsonl.mjs";
const [indexRoot,nominalRoot,referenceRoot,out]=process.argv.slice(2);
if(!out)throw Error("Usage: build-documentary-review-v2.mjs INDEX NOMINAL REFERENCE OUTPUT");
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const sha=b=>createHash("sha256").update(b).digest("hex");
const index=await read(join(indexRoot,"manifest.json"));
async function load(root){
 const manifest=await read(join(root,"manifest.json"));
 const sampleBytes=await readFile(join(root,"sample.jsonl"));
 const evidence=await read(join(root,"evidence.json"));
 if(manifest.datasetRevision!==index.source?.philosophy_revision||sha(sampleBytes)!==manifest.sampleSha256||evidence.sampleSha256!==manifest.sampleSha256)throw Error("Review source binding mismatch");
 return {manifest,cases:sampleBytes.toString("utf8").trim().split(/\r?\n/).map(JSON.parse),evidence:evidence.cases};
}
const [nominal,reference]=await Promise.all([load(nominalRoot),load(referenceRoot)]);
const all=[...nominal.cases,...reference.cases],seen=new Set();
for(const c of all){if(seen.has(c.audit_id)||c.judgment!==null)throw Error("Duplicate or pre-labeled review case");seen.add(c.audit_id);}
if(all.length!==300||nominal.cases.length!==130||reference.cases.length!==170)throw Error("Expected 300 selected review cases");
const priorIds=new Set(all.flatMap(c=>(c.profiles||[]).map(p=>p.authorId)));
const refsByQid=new Map(intellectualHistoryReferenceInventory().map(r=>[r.qid,r.names]));
const missing=reference.cases.filter(c=>!c.candidates.length);
const searches=new Map(),signatures=new Map(),exactNames=new Map();
function add(map,key,id){if(!key)return;if(!map.has(key))map.set(key,new Set());map.get(key).add(id);}
for(const c of missing){
 const names=[...new Set([c.query,...(refsByQid.get(c.reference?.qid)||[])])];
 searches.set(c.audit_id,{audit_id:c.audit_id,query:c.query,documentedNames:names,aliasMatches:new Map(),creatorMatches:new Map()});
 for(const n of names){add(signatures,authorNameSignature(n),c.audit_id);add(exactNames,normalizeAuthorName(n),c.audit_id);}
}
const diagnostics={invalidJsonRows:0,samples:[]};
// Scan the complete local alias and creator inventories independently of
// the public resolver. Matches are hypotheses, never identity decisions.
for(const item of index.files?.aliases||[]){
 for await(const row of readSnapshotJsonl(join(indexRoot,item.path),{tolerant:true,diagnostics})){
  const ids=signatures.get(row.s);if(!ids)continue;
  for(const id of ids){
   const entry=searches.get(id),key=String(row.id);
   const existing=entry.aliasMatches.get(key)||{authorId:key,name:row.n||null,kinds:[],alreadyInReview:priorIds.has(key)};
   if(row.k&&!existing.kinds.includes(row.k))existing.kinds.push(row.k);
   entry.aliasMatches.set(key,existing);
  }
 }
}
for(const item of index.files?.work_authors||[]){
 for await(const row of readSnapshotJsonl(join(indexRoot,item.path),{tolerant:true,diagnostics})){
  for(const a of row.a||[]){
   const ids=exactNames.get(normalizeAuthorName(a.n));if(!ids)continue;
   for(const id of ids){
    const entry=searches.get(id),key=String(a.id);
    const existing=entry.creatorMatches.get(key)||{authorId:key,name:a.n||null,workIds:[],alreadyInReview:priorIds.has(key)};
    if(existing.workIds.length<12&&!existing.workIds.includes(String(row.wid)))existing.workIds.push(String(row.wid));
    entry.creatorMatches.set(key,existing);
   }
  }
 }
}
const gaps=[...searches.values()].map(({aliasMatches,creatorMatches,...c})=>{
 const aliases=[...aliasMatches.values()],creators=[...creatorMatches.values()];
 const supported=aliases.filter(a=>a.kinds.some(k=>["full","given-first-family","suffix","initial"].includes(k)));
 return {...c,status:supported.length?"eligible-signature-candidate":aliases.length?"unsupported-alias-kind":creators.length?"creator-name-without-alias-hit":"no-observed-exact-name",aliasCandidates:aliases,creatorCandidates:creators};
});
const gapCounts=Object.fromEntries([...new Set(gaps.map(g=>g.status))].map(s=>[s,gaps.filter(g=>g.status===s).length]));
const nominalEvidence=new Map(nominal.evidence.map(e=>[e.audit_id,e.profiles]));
const refEvidence=new Map(reference.evidence.map(e=>[e.audit_id,e.profile]));
const review=all.map(c=>{
 const profiles=c.task==="reference-person-retrieval"?c.profiles.map((p,i)=>refEvidence.get(c.audit_id+":"+i)):nominalEvidence.get(c.audit_id);
 if(!Array.isArray(profiles)||profiles.some(p=>!p))throw Error("Missing candidate evidence "+c.audit_id);
 return {audit_id:c.audit_id,task:c.task,stratum:c.stratum,query:c.query||null,reference:c.reference||null,profiles,
  // IDs not sampled for documentary evidence remain visible as incomplete.
  unsampledCandidateIds:(c.candidates||[]).slice(c.profiles.length).map(p=>p.authorId),
  judgment:null,note:"",evidence:[]};
});
const reviewText=review.map(c=>JSON.stringify(c)).join("\n")+"\n";
const reviewSha256=sha(reviewText);
await mkdir(out,{recursive:true});
await writeFile(join(out,"review-cases.jsonl"),reviewText);
await writeFile(join(out,"judgments.template.jsonl"),review.map(c=>JSON.stringify({audit_id:c.audit_id,task:c.task,judgment:null,note:"",evidence:[]})).join("\n")+"\n");
await writeFile(join(out,"no-candidate-diagnostics.json"),JSON.stringify({schemaVersion:"authority-v2-no-candidate-diagnostics-v1",datasetRevision:index.source.philosophy_revision,counts:gapCounts,diagnostics,cases:gaps,limitations:["Exact names and alias signatures only; absence is not proof of absence from the corpus.","Diagnostic candidates are not admitted to the frozen review sample or declared same person."]},null,2)+"\n");
const report={schemaVersion:"authority-v2-documentary-review-v1",datasetRevision:index.source.philosophy_revision,reviewSha256,nominalSampleSha256:nominal.manifest.sampleSha256,referenceSampleSha256:reference.manifest.sampleSha256,totalCases:review.length,reviewed:0,byTask:Object.fromEntries([...new Set(review.map(c=>c.task))].map(t=>[t,review.filter(c=>c.task===t).length])),noCandidateQueries:missing.length,gapCounts,diagnostics};
await writeFile(join(out,"manifest.json"),JSON.stringify(report,null,2)+"\n");
await writeFile(join(out,"README.md"),"# Documentary review packet V2\n\nReview one case at a time using documented external sources. For identity-pair use same-person, different-person or unresolved. For name-retrieval and reference-person-retrieval use target-present, target-absent-from-returned-candidates or unresolved; record the matching candidate ID(s) in your note and cite evidence. Do not infer identity from a matching name alone, and do not mark an unsampled candidate as absent. A query with zero results is not proof of corpus absence. Keep the three tasks separate. All judgments are blank; no model-generated gold. The diagnostics file is separate from the reviewer packet; inspect it only after first-pass review. Contribution and portrait adjudication require separate scoped packets. This artifact cannot authorize release.\n");
console.log("AUTHORITY_V2_DOCUMENTARY_REVIEW "+JSON.stringify(report));
