import {EVIDENCE_SCHEMA} from "./author-authority-evidence-v2.js";
import {resolveAuthorityV2} from "./author-authority-resolution-v2.js";
import {normalizeAuthorName} from "./remote-author-resolution.js";
const list=v=>Array.isArray(v)?v:[];
const unique=v=>[...new Set(v.filter(Boolean))].sort();
const orcid=v=>{
 const s=String(v||"").replace(/^https?:\/\/orcid\.org\//i,"").trim().toUpperCase();
 if(!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s))return null;
 const digits=s.replace(/-/g,"");let total=0;
 for(const d of digits.slice(0,15))total=(total+Number(d))*2;
 const check=(12-total%11)%11;
 return digits[15]===(check===10?"X":String(check))?s:null;
};
const intersect=(a,b)=>unique(a.filter(x=>b.includes(x)));
const numericId=v=>/^\d+$/.test(String(v||""))?String(v):null;
function profileSignals(p){
 const workIds=unique(list(p.works).map(w=>numericId(w.workId)));
 const collaborators=unique(list(p.works).flatMap(w=>list(w.coauthors).map(a=>numericId(a.authorId))).filter(id=>id&&id!==String(p.authorId)));
 return {names:unique([p.displayName,...list(p.observedNames)].map(normalizeAuthorName)),orcids:unique(list(p.orcids).map(orcid)),workIds,collaborators};
}
// A single derived snapshot cannot independently authenticate a person.
// Keep all observed metadata at asserted level. Shared works may even be
// a duplicate authorship within a record; do not treat them as proof.
export function evaluateSnapshotPair(pair,{datasetRevision}={}){
 if(!pair?.audit_id||!numericId(pair.left?.authorId)||!numericId(pair.right?.authorId)||String(pair.left.authorId)===String(pair.right.authorId))throw Error("Invalid snapshot pair");
 const left=profileSignals(pair.left),right=profileSignals(pair.right);
 const subjectRef="snapshot-author:"+pair.left.authorId,objectRef="snapshot-author:"+pair.right.authorId;
 const evidence=[];
 const add=(kind,polarity,sourceRefs)=>evidence.push({schemaVersion:EVIDENCE_SCHEMA,id:pair.audit_id+":"+kind,subjectRef,objectRef,scope:"identity",kind,polarity,reliability:"asserted",sourceRefs:unique(sourceRefs),lineageKey:"hf-snapshot:"+datasetRevision,revision:datasetRevision});
 const profileRefs=[subjectRef,objectRef];
 if(intersect(left.names,right.names).length)add("ordered-name-match","supports",profileRefs);
 const sharedOrcid=intersect(left.orcids,right.orcids);
 if(sharedOrcid.length)add("snapshot-orcid-match","supports",profileRefs);
 if(left.orcids.length&&right.orcids.length&&!sharedOrcid.length)add("snapshot-orcid-conflict","contradicts",profileRefs);
 const sharedWorks=intersect(left.workIds,right.workIds);
 if(sharedWorks.length)add("authored-work-overlap","supports",sharedWorks.map(id=>"snapshot-work:"+id));
 const sharedCoauthors=intersect(left.collaborators,right.collaborators);
 if(sharedCoauthors.length>=2)add("identified-coauthor-network","supports",unique([...left.workIds,...right.workIds]).map(id=>"snapshot-work:"+id));
 const result=resolveAuthorityV2({subjectRef,scope:"identity",datasetRevision,candidateRefs:[objectRef],evidence});
 return {auditId:pair.audit_id,decision:result.decision,evaluations:result.evaluations,evidence,observations:{sharedOrcid,sharedWorks,sharedCoauthors,worksSampled:[left.workIds.length,right.workIds.length],workCountsObserved:[pair.left.workCountObserved??null,pair.right.workCountObserved??null]}};
}
export function compareSnapshotShadow({cases,manifestItems,datasetRevision}){
 if(!Array.isArray(cases)||!Array.isArray(manifestItems)||!cases.length)throw Error("Missing shadow sample");
 const byId=new Map(manifestItems.map(m=>[m.audit_id,m]));
 if(byId.size!==manifestItems.length||cases.length!==byId.size||new Set(cases.map(c=>c.audit_id)).size!==cases.length)throw Error("Mismatched shadow sample");
 const results=cases.map(pair=>{
  const manifest=byId.get(pair.audit_id);
  if(!manifest||!["same-person","different-person"].includes(manifest.current_relation)||String(manifest.left.authorId)!==String(pair.left.authorId)||String(manifest.right.authorId)!==String(pair.right.authorId))throw Error("Missing or mismatched legacy pair");
  // Labels from the legacy partition are only joined AFTER evaluation.
  const evaluated=evaluateSnapshotPair(pair,{datasetRevision});
  const shadowRelation=evaluated.decision.status==="confirmed"?"same-person":evaluated.decision.status==="rejected"?"different-person":"unresolved";
  return {...evaluated,stratum:manifest.stratum,legacyRelation:manifest.current_relation,shadowRelation,agreement:shadowRelation===manifest.current_relation};
 });
 const byStratum={};
 for(const r of results){
  const s=byStratum[r.stratum]??={pairs:0,agreed:0,unresolved:0,disagreements:0};
  s.pairs++;if(r.agreement)s.agreed++;else s.disagreements++;if(r.shadowRelation==="unresolved")s.unresolved++;
 }
 return {schemaVersion:"authority-snapshot-shadow-v2",datasetRevision,scope:"diagnostic disagreement, not human accuracy",count:results.length,agreed:results.filter(r=>r.agreement).length,unresolved:results.filter(r=>r.shadowRelation==="unresolved").length,byStratum,results};
}
