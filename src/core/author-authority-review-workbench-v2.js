// Browser-safe review contract. An exported judgment is not independent gold
// until its documentary evidence and reviewer independence are checked.
export const REVIEW_LABELS=Object.freeze({
 "identity-pair":["same-person","different-person","unresolved"],
 "name-retrieval":["target-present","target-absent-from-returned-candidates","unresolved"],
 "reference-person-retrieval":["target-present","target-absent-from-returned-candidates","unresolved"],
 "contribution-role-review":["author","editor","translator","coordinator","compiler","reviewer","other-role","no-contribution","unresolved"],
 "portrait-subject-review":["reviewed","unresolved"]
});
const reviewArray=v=>Array.isArray(v)?v:[];
export function safeReviewURL(value){
 try{const u=new URL(value);return u.protocol==="https:"&&u.hostname&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function validateWorkbenchJudgment(c,j){
 if(!c||!j||c.audit_id!==j.audit_id||c.task!==j.task||!REVIEW_LABELS[c.task]?.includes(j.judgment))throw Error("Caso o juicio incompatible.");
 if(typeof j.reviewer!=="string"||!j.reviewer.trim()||j.reviewer.length>120||!Number.isFinite(Date.parse(j.reviewedAt))||typeof j.note!=="string"||!j.note.trim()||j.note.length>12000)throw Error("Indique revisor, fecha y justificación.");
 if(!Array.isArray(j.evidence)||!j.evidence.length||j.evidence.length>30||j.evidence.some(v=>typeof v!=="string"||v.length>2000||!safeReviewURL(v)))throw Error("Incluya al menos una URL HTTPS documental válida.");
 if(c.task==="name-retrieval"||c.task==="reference-person-retrieval"){
  const ids=reviewArray(j.matchedCandidateIds);
  if(ids.some(id=>typeof id!=="string"||!reviewArray(c.profiles).some(p=>String(p.authorId)===id))||new Set(ids).size!==ids.length)throw Error("Identificador fuera de los perfiles presentados.");
  if(j.judgment==="target-present"&&!ids.length)throw Error("Seleccione el perfil documentado.");
  if(j.judgment!=="target-present"&&ids.length)throw Error("Solo un juicio positivo admite perfiles coincidentes.");
  if(j.judgment==="target-absent-from-returned-candidates"&&reviewArray(c.unsampledCandidateIds).length)throw Error("Hay candidatos sin expediente. No se puede concluir ausencia.");
 }
 if(c.task==="portrait-subject-review"){
  const options=reviewArray(c.options),judgments=reviewArray(j.options);
  if(!options.length){if(j.judgment!=="unresolved"||judgments.length)throw Error("Sin imagen no se puede juzgar un retrato.");}
  else {
   if(j.judgment!=="reviewed"||judgments.length!==options.length||new Set(judgments.map(o=>o.option_id)).size!==options.length||judgments.some(o=>!options.some(p=>p.option_id===o.option_id)||!["correct-subject","wrong-subject","unresolved"].includes(o.judgment)))throw Error("Evalúe cada imagen por separado.");
  }
 }
 return j;
}
export function validateWorkbenchExport(packet,value){
 if(value?.schemaVersion!=="authority-v2-workbench-judgments-v1"||value.datasetRevision!==packet.datasetRevision||value.packetSha256!==packet.packetSha256||!Array.isArray(value.judgments))throw Error("El archivo pertenece a otra muestra.");
 const rows=new Map(packet.cases.map(c=>[c.audit_id,c])),seen=new Set();
 for(const j of value.judgments){if(seen.has(j.audit_id))throw Error("Juicio duplicado.");seen.add(j.audit_id);validateWorkbenchJudgment(rows.get(j.audit_id),j);}
 return value.judgments;
}
export function workbenchProgress(packet,judgments){
 const byTask={},seen=new Map(judgments.map(j=>[j.audit_id,j]));
 for(const c of packet.cases){
  const r=byTask[c.task]??={total:0,reviewed:0,resolved:0,unresolved:0};r.total++;
  const j=seen.get(c.audit_id);if(!j)continue;r.reviewed++;
  if(j.judgment==="unresolved"||reviewArray(j.options).some(o=>o.judgment==="unresolved"))r.unresolved++;else r.resolved++;
 }
 return byTask;
}
export function makeWorkbenchExport(packet,judgments){
 const value={schemaVersion:"authority-v2-workbench-judgments-v1",datasetRevision:packet.datasetRevision,packetSha256:packet.packetSha256,judgments};
 validateWorkbenchExport(packet,value);return value;
}
export function makePilotExport(packet,judgments){
 validateWorkbenchExport(packet,makeWorkbenchExport(packet,judgments));
 const ids=new Set(packet.cases.filter(c=>c.cohort==="pilot").map(c=>c.audit_id));
 return {schemaVersion:"authority-v2-reviewed-pilot-v1",datasetRevision:packet.datasetRevision,sampleSha256:packet.sources.pilot.sampleSha256,judgments:judgments.filter(j=>ids.has(j.audit_id))};
}
