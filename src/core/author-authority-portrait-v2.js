import {EVIDENCE_SCHEMA} from "./author-authority-evidence-v2.js";
import {resolveAuthorityV2} from "./author-authority-resolution-v2.js";
const Q=/^Q[1-9]\d{0,14}$/;
const methods=new Set(["orcid-bridge","openalex-bridge","historical-authority","bibliographic-bridge"]);
function filename(value){
 const s=String(value||"").normalize("NFC").replace(/^File:/i,"").replace(/_/g," ").trim();
 return s.length&&s.length<=300?s[0].toUpperCase()+s.slice(1):"";
}
// Called only with metadata from the existing SIVA resolver. An authority
// claim is asserted, not verified; the Commons license never proves identity.
export function assessPortraitV2(identity,meta,datasetRevision){
 const subjectRef="portrait-slot:"+JSON.stringify([identity?.key||"unknown"]);
 const trace=meta?.authorityTrace;
 const candidateRefs=[],evidence=[];
 const file=filename(trace?.authorityFile);
 if(trace&&identity&&Q.test(trace.entityId)&&methods.has(trace.method)&&file&&
    file===filename(trace.commonsFile)&&
    meta.identity==="https://www.wikidata.org/wiki/"+trace.entityId&&
    (!identity.qid||identity.qid===trace.entityId)){
  const objectRef="commons-file:"+file;
  const sourceRef="wikidata:"+trace.entityId+":P18";
  candidateRefs.push(objectRef);
  evidence.push({schemaVersion:EVIDENCE_SCHEMA,id:subjectRef+":"+objectRef+":authority-image-link",
   subjectRef,objectRef,scope:"portrait",kind:"authority-image-link",polarity:"supports",
   reliability:"asserted",sourceRefs:[sourceRef],lineageKey:sourceRef,
   revision:trace.entityRevision?"wikidata:"+trace.entityRevision:"live-unversioned"});
 }
 const result=resolveAuthorityV2({subjectRef,scope:"portrait",datasetRevision,candidateRefs,evidence});
 return {...result,evidence,method:evidence.length?trace.method:null,
  source:evidence.length?meta.identity:null,mediaSource:evidence.length?meta.source:null,
  mediaLicense:evidence.length?meta.license?.label||null:null};
}
