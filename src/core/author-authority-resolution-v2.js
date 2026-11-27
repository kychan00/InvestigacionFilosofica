import {DECISION_SCHEMA, validateEvidenceV2, validateDecisionV2, independentEvidenceGroups} from "./author-authority-evidence-v2.js";

export const AUTHORITY_ENGINE_VERSION="2.0.0-experimental.1";
// Rules apply to the proposition's scope, not to a famous name or work list.
// Unknown evidence types remain traceable but cannot establish identity.
const policy={
 identity:{
  anchors:["verified-person-identifier","verified-authority-link","reviewed-identity-decision"],
  strong:["authored-work-overlap","documented-name-variant","identified-coauthor-network","institutional-identity-link"],
  context:["ordered-name-match","affiliation-overlap","active-period-compatible","topic-overlap"],
  veto:["verified-person-identifier-conflict","verified-distinct-person","reviewed-identity-conflict"]
 },
 contribution:{
  anchors:["verified-authorship","verified-author-position-identifier","reviewed-contribution-decision"],
  strong:["authored-work-overlap","identified-coauthor-network","institutional-bibliography","publisher-authorship"],
  context:["ordered-name-match","affiliation-overlap","active-period-compatible","topic-overlap","venue-overlap"],
  veto:["verified-author-position-conflict","verified-distinct-person","verified-impossible-original-date","verified-noncontributor","reviewed-contribution-conflict"]
 },
 portrait:{
  anchors:["verified-depicted-person","reviewed-portrait-identity"],
  strong:["authority-image-link","documented-image-caption"],
  context:["ordered-name-match"],
  veto:["verified-distinct-person","verified-image-identity-conflict"]
 }
};
const compare=(a,b)=>a<b?-1:a>b?1:0;
const sortedUnique=items=>[...new Set(items)].sort(compare);
const trusted=e=>e.reliability==="verified"||e.reliability==="corroborated";
const validText=s=>typeof s==="string"&&s.trim().length>0;
function assertInput({subjectRef,scope,datasetRevision,candidateRefs,evidence}){
 if(!validText(subjectRef)||!validText(datasetRevision)||!Object.hasOwn(policy,scope))throw new TypeError("Invalid resolution context");
 if(!Array.isArray(candidateRefs)||!candidateRefs.every(validText)||new Set(candidateRefs).size!==candidateRefs.length)throw new TypeError("Invalid candidate references");
 if(!Array.isArray(evidence)||new Set(evidence.map(e=>e?.id)).size!==evidence.length)throw new TypeError("Duplicate or missing evidence");
 const candidates=new Set(candidateRefs);
 for(const e of evidence){
  if(validateEvidenceV2(e).length||e.scope!==scope||e.subjectRef!==subjectRef||!candidates.has(e.objectRef))throw new TypeError("Evidence outside resolution context");
 }
}
// Lineage aliases cannot turn the same source record into independent
// corroboration. Collapse connected provenance components transitively.
function provenanceGroups(evidence){
 const groups=independentEvidenceGroups(evidence);
 const parent=groups.map((_,i)=>i);
 function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
 const seen=new Map();
 groups.forEach((g,i)=>{
  for(const ref of new Set(g.assertions.flatMap(e=>e.sourceRefs))){
   if(seen.has(ref))parent[root(i)]=root(seen.get(ref));
   else seen.set(ref,i);
  }
 });
 const merged=new Map();
 groups.forEach((g,i)=>{
  const k=root(i);
  if(!merged.has(k))merged.set(k,[]);
  merged.get(k).push(...g.assertions);
 });
 return [...merged.values()].map(assertions=>({assertions,polarities:[...new Set(assertions.map(e=>e.polarity))]}));
}
// Distinct kinds AND independent provenance components are necessary.
function converges(groups,strongKinds){
 const usable=groups.filter(g=>!g.polarities.includes("contradicts"))
   .map(g=>new Set(g.assertions.filter(e=>e.polarity==="supports"&&trusted(e)&&strongKinds.includes(e.kind)).map(e=>e.kind)));
 for(let i=0;i<usable.length;i++)for(let j=i+1;j<usable.length;j++)
  if([...usable[i]].some(a=>[...usable[j]].some(b=>a!==b)))return true;
 return false;
}
function assess(ref,scope,evidence){
 const p=policy[scope],groups=provenanceGroups(evidence);
 const positive=evidence.filter(e=>e.polarity==="supports");
 const negative=evidence.filter(e=>e.polarity==="contradicts");
 const hard=negative.filter(e=>e.reliability==="verified"&&p.veto.includes(e.kind));
 const anchor=positive.some(e=>e.reliability==="verified"&&p.anchors.includes(e.kind));
 const convergence=converges(groups,p.strong);
 const strong=positive.some(e=>trusted(e)&&p.strong.includes(e.kind));
 const conflict=negative.some(e=>e.reliability==="verified"|| (trusted(e)&&p.veto.includes(e.kind)));
 let status="unresolved",reason="insufficient-evidence";
 if(hard.length){
  // Preserve contradictory verified anchors rather than deleting an identity.
  status=anchor?"ambiguous":"rejected";reason=anchor?"conflicting-verified-anchors":"verified-veto";
 }else if(conflict&&(anchor||convergence||strong)){
  status="ambiguous";reason="material-contradiction";
 }else if(!conflict&&(anchor||convergence)){
  status="confirmed";reason=anchor?"verified-anchor":"independent-strong-convergence";
 }else if(!conflict&&strong){
  status="probable";reason="corroborated-but-incomplete";
 }
 return {candidateRef:ref,status,reasonCodes:[reason],evidenceRefs:sortedUnique(evidence.map(e=>e.id)),independentLineages:groups.length};
}
export function resolveAuthorityV2({subjectRef,scope,datasetRevision,candidateRefs=[],evidence=[]}={}){
 assertInput({subjectRef,scope,datasetRevision,candidateRefs,evidence});
 const evaluations=[...candidateRefs].sort(compare).map(ref=>assess(ref,scope,evidence.filter(e=>e.objectRef===ref)));
 const confirmed=evaluations.filter(e=>e.status==="confirmed");
 const probable=evaluations.filter(e=>e.status==="probable");
 const ambiguous=evaluations.filter(e=>e.status==="ambiguous");
 let status="unresolved",winner=null,reason="no-confirming-evidence";
 if(confirmed.length===1&&!ambiguous.length){winner=confirmed[0];status="confirmed";reason=winner.reasonCodes[0];}
 else if(confirmed.length>1||ambiguous.length||probable.length>1){status="ambiguous";reason="competing-or-conflicting-identities";}
 else if(probable.length===1){winner=probable[0];status="probable";reason=winner.reasonCodes[0];}
 else if(evaluations.length===1&&evaluations[0].status==="rejected"){winner=evaluations[0];status="rejected";reason=winner.reasonCodes[0];}
 else if(evaluations.length&&evaluations.every(e=>e.status==="rejected")){reason="all-candidates-rejected";}
 else if(!evaluations.length){reason="no-candidates";}
 // The identifier belongs to the decision slot, not to the person. A ledger
 // must version successive decisions instead of overwriting prior revisions.
 const decision={schemaVersion:DECISION_SCHEMA,id:"decision:"+JSON.stringify([scope,subjectRef,datasetRevision,AUTHORITY_ENGINE_VERSION]),subjectRef,scope,status,objectRef:winner?.candidateRef||null,
  algorithmVersion:AUTHORITY_ENGINE_VERSION,datasetRevision,reasonCodes:[reason],
  evidenceRefs:winner?winner.evidenceRefs:sortedUnique(evidence.map(e=>e.id))};
 const errors=validateDecisionV2(decision,evidence);
 if(errors.length)throw Error("Engine produced invalid decision: "+errors.join(","));
 return {decision,evaluations};
}
