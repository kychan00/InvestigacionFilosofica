import {EVIDENCE_SCHEMA} from "./author-authority-evidence-v2.js";
import {resolveAuthorityV2} from "./author-authority-resolution-v2.js";
import {normalizeAuthorName} from "./remote-author-resolution.js";
const list=v=>Array.isArray(v)?v:[];
const unique=v=>[...new Set(v.filter(Boolean))].sort();
const name=v=>normalizeAuthorName(v||"");
const oa=v=>/^(?:https?:\/\/openalex\.org\/)?A?(\d+)$/i.exec(String(v||""))?.[1]||null;
const orcid=v=>{
 const s=String(v||"").replace(/^https?:\/\/orcid\.org\//i,"").trim().toUpperCase();
 if(!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s))return null;
 let n=0;const digits=s.replace(/-/g,"");for(const d of digits.slice(0,15))n=(n+Number(d))*2;
 const check=(12-n%11)%11;return digits[15]===(check===10?"X":String(check))?s:null;
};
const doi=v=>{const s=String(v||"").replace(/^https?:\/\/doi\.org\//i,"").replace(/^doi:/i,"").trim().toLowerCase();return /^10\.\d{4,9}\/\S+$/.test(s)?s:null;};
function ordered(v){
 const s=String(v||"").trim(),p=s.split(",");
 return name(p.length===2&&p.every(x=>x.trim())?p[1]+" "+p[0]:s);
}
function roleOf(p,provider){
 const raw=String(p?.role||"").toLowerCase();
 if(/coord/.test(raw))return "coordinator";
 if(/edit/.test(raw))return "editor";
 if(/trad|translat/.test(raw))return "translator";
 if(/compil/.test(raw))return "compiler";
 if(/review|reseñ/.test(raw))return "reviewer";
 if(/author|autor/.test(raw))return "author";
 // Registry listings and unstructured creator fields are not necessarily authorship.
 return !raw&&["OpenAlex Philosophy","Crossref"].includes(provider)?"author":"unknown";
}
const snapshotProvider=p=>p==="OpenAlex Philosophy"||p==="OpenAlex Philosophy · Hugging Face";
const supported=new Set(["OpenAlex Philosophy","OpenAlex Philosophy · Hugging Face","Crossref","Internet Archive","ORCID","CUCSH Filosofía"]);
function rawRecord(work,provider,revision){
 const records=list(work.sourceRecords);
 const providers=unique([...list(work.providers),...records.map(r=>r.provider)]);
 const relevant=records.filter(r=>r.provider===provider);
 // No copying a merged work's primary author list into another provider.
 const original=providers.length===1&&providers[0]===provider;
 const explicit=relevant.find(r=>Array.isArray(r.authors)&&r.authors.length);
 const rawCreators=original?list(work.authors):list(explicit?.authors);
 const sourceId=String(explicit?.sourceId||relevant[0]?.sourceId||(original?work.id:"")||"").trim();
 if(!sourceId||!supported.has(provider))return null;
 const ref="source:"+JSON.stringify([provider,sourceId,revision]);
 const recordDoi=doi(original?work.doi:explicit?.doi);
 return {ref,provider,sourceId,revision,doi:recordDoi,rawCreators,original,
   title:String(original?work.title:explicit?.title||""),year:original?work.year??null:explicit?.year??null,
   lineageKey:recordDoi?"doi:"+recordDoi:snapshotProvider(provider)?"snapshot:"+revision:"record:"+JSON.stringify([provider,sourceId])};
}
// Inputs are records captured before catalogue deduplication. The selected
// profile is a hypothesis, not an authenticated human identity.
export function evaluateBibliographicRecord({author,work,provider,datasetRevision,registryOrcid=null}){
 if(!author||!work||typeof datasetRevision!=="string"||!datasetRevision.trim())throw new TypeError("Missing bibliography context");
 const record=rawRecord(work,provider,datasetRevision);
 if(!record)return {record:null,contributions:[],reason:"missing-source-record"};
 const expectedId=oa(author.id);
 const expectedOrcid=orcid(author.orcid);
 const aliases=unique([author.displayName,author.sourceDisplayName,...list(author.aliases)].map(ordered));
 // A scoped candidate key identifies this hypothesis only; no global name IDs.
 const objectRef="profile:"+JSON.stringify([expectedId,expectedOrcid,author.displayName||author.sourceDisplayName||""]);
 const contributions=record.rawCreators.map((p,index)=>{
  const subjectRef=record.ref+":creator:"+index;
  const evidence=[];
  const add=(kind,polarity="supports")=>evidence.push({schemaVersion:EVIDENCE_SCHEMA,id:subjectRef+":"+kind,subjectRef,objectRef,scope:"contribution",kind,polarity,reliability:"asserted",sourceRefs:[record.ref],lineageKey:record.lineageKey,revision:datasetRevision});
  const candidateName=ordered(p?.name||p?.displayName);
  const matchedName=Boolean(candidateName&&aliases.includes(candidateName));
  const observedId=snapshotProvider(provider)?oa(p?.id):null;
  const observedOrcid=orcid(p?.orcid||p?.id);
  const composite=Boolean(p?.creatorComposite||p?.originalCreatorStatement||p?.rawCreator&&p.rawCreator!==p.name||/;|\bet al\b|\by colaboradores\b/iu.test(String(p?.name||""))||String(p?.name||"").split(",").length>2);
  const role=roleOf(p,provider);
  const conflict=Boolean(expectedOrcid&&observedOrcid&&expectedOrcid!==observedOrcid);
  if(matchedName)add("ordered-name-match");
  if(conflict)add("recorded-orcid-conflict","contradicts");
  if(!composite&&!conflict){
   if(snapshotProvider(provider)&&expectedId&&observedId===expectedId&&matchedName)add("snapshot-author-membership");
   if(provider==="Crossref"&&expectedOrcid&&observedOrcid===expectedOrcid&&matchedName)add("publisher-asserted-author-identifier");
   // A public registry listing is an assertion of participation, not proof
   // of sole authorship. Only the registry request actually made can bind it.
   if(provider==="ORCID"&&expectedOrcid&&orcid(registryOrcid)===expectedOrcid&&observedOrcid===expectedOrcid&&matchedName)add("registry-listed-work");
  }
  const result=resolveAuthorityV2({subjectRef,scope:"contribution",datasetRevision,candidateRefs:[objectRef],evidence});
  return {position:index,rawName:p?.name||p?.displayName||"",role,composite,decision:result.decision,evidence};
 });
 return {record,contributions,reason:record.rawCreators.length?"evaluated":"missing-source-creators"};
}
export function evaluateBibliographicBatches({author,batches=[],datasetRevision,registryOrcid=null}){
 const rows=[];const seen=new Set();
 for(const batch of batches)for(const work of list(batch.works)){
  const result=evaluateBibliographicRecord({author,work,provider:batch.provider,datasetRevision,registryOrcid:batch.provider==="ORCID"?registryOrcid:null});
  if(result.record){
   const key=JSON.stringify([result.record.ref,result.record.rawCreators,result.record.title,result.record.year]);
   if(seen.has(key))continue;seen.add(key);
  }
  rows.push(result);
 }
 const counts={confirmed:0,probable:0,ambiguous:0,unresolved:0,rejected:0,missingRecords:0};
 for(const row of rows){
  if(!row.record||!row.contributions.length)counts.missingRecords++;
  for(const c of row.contributions)counts[c.decision.status]++;
 }
 return {schemaVersion:"authority-bibliography-shadow-v2",datasetRevision,counts,rows};
}
