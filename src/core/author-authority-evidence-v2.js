export const EVIDENCE_SCHEMA="author-authority-evidence-v2";
export const DECISION_SCHEMA="author-authority-decision-v2";
const text=v=>typeof v==="string"&&v.trim().length>0;
const refs=v=>Array.isArray(v)&&v.length>0&&v.every(text)&&new Set(v).size===v.length;
const scopes=new Set(["identity","contribution","portrait"]);
const states=new Set(["confirmed","probable","ambiguous","unresolved","rejected"]);
export function validateEvidenceV2(e){
 const errors=[];
 if(e?.schemaVersion!==EVIDENCE_SCHEMA)errors.push("schemaVersion");
 for(const field of ["id","subjectRef","objectRef","kind","lineageKey","revision"])if(!text(e?.[field]))errors.push(field);
 if(!scopes.has(e?.scope))errors.push("scope");
 if(!["supports","contradicts"].includes(e?.polarity))errors.push("polarity");
 if(!["asserted","corroborated","verified"].includes(e?.reliability))errors.push("reliability");
 if(!refs(e?.sourceRefs))errors.push("sourceRefs");
 return errors;
}
export function validateDecisionV2(d,evidence=[]){
 const errors=[];
 if(d?.schemaVersion!==DECISION_SCHEMA)errors.push("schemaVersion");
 for(const field of ["id","subjectRef","algorithmVersion","datasetRevision"])if(!text(d?.[field]))errors.push(field);
 if(!scopes.has(d?.scope))errors.push("scope");
 if(!states.has(d?.status))errors.push("status");
 if(!refs(d?.reasonCodes))errors.push("reasonCodes");
 if(!Array.isArray(d?.evidenceRefs)||!d.evidenceRefs.every(text)||new Set(d.evidenceRefs).size!==d.evidenceRefs.length)errors.push("evidenceRefs");
 else {
  const byId=new Map(evidence.map(e=>[e.id,e]));
  const linked=d.evidenceRefs.map(id=>byId.get(id));
  if(linked.some(e=>!e||validateEvidenceV2(e).length||e.scope!==d.scope||e.subjectRef!==d.subjectRef))errors.push("invalidEvidenceLink");
  if(["confirmed","probable","rejected"].includes(d.status)&&!text(d.objectRef))errors.push("objectRef");
  if(linked.some(e=>e&&d.objectRef&&e.objectRef!==d.objectRef))errors.push("objectMismatch");
  if(["confirmed","probable"].includes(d.status)&&!linked.some(e=>e?.polarity==="supports"))errors.push("missingSupport");
  if(d.status==="confirmed"&&linked.some(e=>e?.polarity==="contradicts"&&e.reliability==="verified"))errors.push("verifiedContradiction");
  if(d.status==="rejected"&&!linked.some(e=>e?.polarity==="contradicts"&&e.reliability!=="asserted"))errors.push("missingCorroboratedContradiction");
 }
 return errors;
}
// A provider mirror and its original record share a lineage key. Counts
// are descriptive, never an automatic confidence score or decision.
export function independentEvidenceGroups(evidence=[]){
 const groups=new Map();
 for(const e of evidence){
  if(validateEvidenceV2(e).length)throw new TypeError("Invalid evidence assertion");
  const key=JSON.stringify([e.scope,e.subjectRef,e.objectRef,e.lineageKey]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(e);
 }
 return [...groups.values()].map(items=>({lineageKey:items[0].lineageKey,scope:items[0].scope,subjectRef:items[0].subjectRef,objectRef:items[0].objectRef,assertions:items,polarities:[...new Set(items.map(e=>e.polarity))]}));
}
