// Read-only preview: never controls the canonical archive, identity, or saved data.
export const PROFILE_PREVIEW_REVISION="5a4a195085de54bf607a6c4397092ffb32716dcc";
export function authorityPreviewRevision(search=""){
 return new URLSearchParams(search).get("authorityPreview")==="1"?PROFILE_PREVIEW_REVISION:null;
}
export const PROFILE_STATES=["confirmed","probable","ambiguous","unresolved","rejected"];
const labels={confirmed:"Confirmadas",probable:"Probables",ambiguous:"Ambiguas",unresolved:"No resueltas",rejected:"Rechazadas"};
const singular={confirmed:"Confirmada",probable:"Probable",ambiguous:"Ambigua",unresolved:"No resuelta",rejected:"Rechazada"};
const roles={author:"Autoría",editor:"Edición",translator:"Traducción",coordinator:"Coordinación",compiler:"Compilación",reviewer:"Reseña",unknown:"Rol no determinado"};
const kinds={"snapshot-author-membership":"Membresía del índice filosófico","registry-listed-work":"Obra declarada en ORCID","publisher-asserted-author-identifier":"Identificador declarado por el editor","ordered-name-match":"Coincidencia nominal","recorded-orcid-conflict":"ORCID incompatible"};
const reliability={asserted:"Declarada por la fuente",corroborated:"Corroborada",verified:"Verificada"};
const arr=v=>Array.isArray(v)?v:[];
const validDoi=v=>{
 const s=String(v||"").trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,"").replace(/^doi:\s*/i,"").toLowerCase();
 return /^10\.\d{4,9}\/\S+$/.test(s)?s:null;
};
const providerName=p=>p==="OpenAlex Philosophy · Hugging Face"?"OpenAlex Philosophy":p;
function sourceKey(provider,id){
 provider=providerName(provider);
 id=String(id||"").trim();
 if(!provider||!id)return null;
 if(provider==="OpenAlex Philosophy"){
  const match=/^(?:https?:\/\/openalex\.org\/)?(W\d+)$/i.exec(id);
  if(match)id=match[1].toUpperCase();
 }
 return "source:"+JSON.stringify([provider,id]);
}
function documentKeys(work){
 const keys=new Set();
 const doi=validDoi(work?.doi);
 if(doi)keys.add("doi:"+doi);
 for(const record of arr(work?.sourceRecords)){
  const key=sourceKey(record?.provider,record?.sourceId);
  if(key)keys.add(key);
 }
 // A canonical ID is meaningful only in its own provider namespace.
 const providers=[...new Set(arr(work?.providers).map(providerName))];
 if(providers.length===1){
  const key=sourceKey(providers[0],work?.id);
  if(key)keys.add(key);
 }
 const oa=/^(?:https?:\/\/openalex\.org\/)?(W\d+)$/i.exec(String(work?.id||work?.openalexId||""));
 if(oa)keys.add(sourceKey("OpenAlex Philosophy",oa[1]));
 return keys;
}

const stateOf=c=>c?.decision?.scope==="contribution"&&PROFILE_STATES.includes(c.decision.status)?c.decision.status:"unresolved";
// A contribution decision must never imply a human identity decision.
export function projectIdentityState(decision){
 return decision?.scope==="identity"&&PROFILE_STATES.includes(decision.status)?decision.status:"unresolved";
}
function workState(states){
 if(states.includes("ambiguous")||(states.includes("rejected")&&(states.includes("confirmed")||states.includes("probable"))))return "ambiguous";
 if(states.includes("confirmed"))return "confirmed";
 if(states.includes("probable"))return "probable";
 if(states.length&&states.every(s=>s==="rejected"))return "rejected";
 return "unresolved";
}
export function projectAuthorityProfile(shadow){
 const map=new Map(),counts=Object.fromEntries(PROFILE_STATES.map(s=>[s,0]));
 let missingRecords=0,mentions=0;
 for(const row of arr(shadow?.rows)){
  const record=row?.record;
  if(!record?.provider||!record?.sourceId){missingRecords++;continue;}
  const doi=validDoi(record.doi);
  // Exact identifiers only; never merge editions or people by similar title.
  const key=doi?"doi:"+doi:sourceKey(record.provider,record.sourceId);
  if(!map.has(key))map.set(key,{key,title:record.title||"",year:record.year??null,doi,records:[],states:[]});
  const group=map.get(key);
  if(!group.title&&record.title)group.title=record.title;
  const contributions=arr(row.contributions);
  mentions+=contributions.length;
  if(!contributions.length)missingRecords++;
  group.records.push({provider:record.provider,sourceId:record.sourceId,ref:record.ref,title:record.title,year:record.year,revision:record.revision,rawCreators:arr(record.rawCreators),snapshotMembership:record.snapshotMembership||null,contributions,reason:row.reason});
  group.states.push(...contributions.map(stateOf));
 }
 const works=[...map.values()].map(({states,...group})=>({...group,status:workState(states)})).sort((a,b)=>a.title.localeCompare(b.title,"es")||a.key.localeCompare(b.key));
 for(const w of works)counts[w.status]++;
 return {works,counts,mentions,missingRecords,diagnostics:arr(shadow?.diagnostics)};
}
function el(doc,tag,txt,cls){
 const node=doc.createElement(tag);
 if(txt!==undefined)node.textContent=String(txt);
 if(cls)node.className=cls;
 return node;
}
export function mountAuthorAuthorityPreview(root,{shadow,loading=false,archive=null,onOpenWork,identityDecision=null}={}){
 if(!root)return;
 const d=root.ownerDocument;
 root.replaceChildren();
 root.append(el(d,"p","Author Profile V2 · evaluación experimental","authority-preview-kicker"),el(d,"h2","Evidencia bibliográfica"),el(d,"p","Se evalúan atribuciones al perfil seleccionado, no se certifica la identidad de la persona. El archivo habitual, la cronología y sus estadísticas siguen siendo los originales."));
 const identityState=projectIdentityState(identityDecision);
 root.append(el(d,"p","Identidad humana V2: "+singular[identityState]+". La evaluación bibliográfica es independiente.","authority-preview-identity"));
 if(loading||!shadow||shadow.error){
  const status=el(d,"p",loading?"Evaluando las fuentes recuperadas…":shadow?.error?"Evaluación no disponible. El archivo habitual sigue accesible.":"Todavía no hay evidencia evaluada.");
  status.setAttribute("role","status");root.append(status);return;
 }
 const model=archive?.profile||projectAuthorityProfile(shadow);
 const analysis=archive?.analysis||summarizeAuthorityAuthorship(model.works);
 const metrics=el(d,"div",undefined,"authority-preview-metrics");
 for(const state of PROFILE_STATES){
  const tile=el(d,"div",undefined,"authority-preview-metric");
  tile.append(el(d,"strong",model.counts[state]),el(d,"span",labels[state]));metrics.append(tile);
 }
 root.append(metrics,el(d,"p",model.works.length+" agrupaciones documentales · "+model.mentions+" menciones evaluadas. Los registros sin DOI común pueden permanecer separados."));
 root.append(renderAuthorityAnalysis(d,analysis));
 if(model.missingRecords||model.diagnostics.length)root.append(el(d,"p","Cobertura parcial: "+model.missingRecords+" registros sin creadores o procedencia; "+model.diagnostics.length+" diagnósticos de captura."));
 const controls=el(d,"div",undefined,"authority-preview-controls");
 const label=el(d,"label","Estado de atribución");
 const filter=el(d,"select");filter.id="authority-preview-filter";label.htmlFor=filter.id;
 for(const state of ["all",...PROFILE_STATES]){
  const option=el(d,"option",state==="all"?"Todos los estados":labels[state]);option.value=state;filter.append(option);
 }
 const search=el(d,"input");search.type="search";search.placeholder="Buscar por título…";search.setAttribute("aria-label","Buscar evidencia por título");
 controls.append(label,filter,search);root.append(controls);
 const list=el(d,"div",undefined,"authority-preview-list");
 const count=el(d,"p");count.setAttribute("aria-live","polite");
 const more=el(d,"button","Mostrar más atribuciones","authority-preview-more");more.type="button";
 root.append(count,list,more);
 let limit=12;
 function render(){
  const query=search.value.trim().toLocaleLowerCase("es");
  const found=model.works.filter(w=>(filter.value==="all"||w.status===filter.value)&&(!query||w.title.toLocaleLowerCase("es").includes(query)));
  list.replaceChildren();
  for(const work of found.slice(0,limit)){
   const detail=el(d,"details",undefined,"authority-preview-work");
   const summary=el(d,"summary");
   summary.append(el(d,"strong",work.title||"Registro sin título"),el(d,"span",singular[work.status]+(work.year!=null?" · "+work.year:""),"authority-preview-state"));
   detail.append(summary);
   const body=el(d,"div",undefined,"authority-preview-evidence");
   detail.append(body);
   // Render evidence lazily to avoid thousands of DOM nodes for large archives.
   detail.addEventListener("toggle",()=>{
    if(!detail.open||body.childNodes.length)return;
    const linked=archive?.byGroup.get(work.key);
    if(linked&&typeof onOpenWork==="function"){
     const open=el(d,"button","Abrir ficha bibliográfica","authority-preview-open");open.type="button";
     open.addEventListener("click",()=>onOpenWork(linked.work));body.append(open);
    } else if(archive){body.append(el(d,"p","Sin vínculo inequívoco con una ficha del archivo habitual."));}
    if(work.doi){
     const a=el(d,"a","Consultar DOI: "+work.doi);a.href="https://doi.org/"+encodeURI(work.doi);a.target="_blank";a.rel="noopener noreferrer";body.append(a);
    }
    for(const record of work.records){
     const source=el(d,"section",undefined,"authority-preview-source");
     source.append(el(d,"h3",record.provider),el(d,"p","Registro: "+record.sourceId));
     if(record.title&&record.title!==work.title)source.append(el(d,"p","Título de la fuente: "+record.title));
     if(!record.contributions.length)source.append(el(d,"p","No se conserva una lista de creadores específica de esta fuente."));
     for(const contribution of record.contributions){
      const status=stateOf(contribution);
      source.append(el(d,"p",(contribution.rawName||"Creador sin nombre")+" · "+(roles[contribution.role]||roles.unknown)+" · "+singular[status]+(contribution.synthesizedCreator?" · Nombre sintetizado del perfil":"")));
      const ul=el(d,"ul");
      for(const e of arr(contribution.evidence)){
       ul.append(el(d,"li",(kinds[e.kind]||e.kind||"Evidencia")+" · "+(reliability[e.reliability]||"Fiabilidad no indicada")+(e.polarity==="contradicts"?" · Contradice la atribución":"")));
      }
      if(ul.childNodes.length)source.append(ul);
      else source.append(el(d,"p","Evidencia insuficiente para una atribución concluyente."));
     }
     body.append(source);
    }
   });
   list.append(detail);
  }
  count.textContent=found.length?"Mostrando "+Math.min(found.length,limit)+" de "+found.length+" registros.":"No hay registros en este filtro.";
  more.hidden=found.length<=limit;
 }
 filter.addEventListener("change",()=>{limit=12;render();});
 search.addEventListener("input",()=>{limit=12;render();});
 more.addEventListener("click",()=>{limit+=12;render();});
 render();
}

// Separate participation from authorship: an editor or translator is not
// counted as the author's original intellectual production.
export function summarizeAuthorityAuthorship(works=[]){
 const counts={confirmed:0,probable:0,review:0,otherRoles:0,rejected:0};
 const years=new Map(), undated={confirmed:0,probable:0};
 const collaborators=new Map();
 for(const w of works){
  const entries=w.records.flatMap(r=>r.contributions.map(c=>({r,c})));
  const authors=entries.filter(({c})=>c.role==="author");
  const authorState=workState(authors.map(({c})=>stateOf(c)));
  const supportedOther=entries.some(({c})=>c.role!=="author"&&["confirmed","probable"].includes(stateOf(c)));
  if(w.status==="rejected"){counts.rejected++;continue;}
  if(w.status==="ambiguous"||authorState==="ambiguous"){counts.review++;continue;}
  if(!["confirmed","probable"].includes(authorState)){
   counts[supportedOther?"otherRoles":"review"]++;continue;
  }
  counts[authorState]++;
  // Conflicting dates or no dates are not resolved by preferring a source.
  const observed=[...new Set(w.records.map(r=>r.year).filter(y=>y!==null&&y!==undefined&&y!=="").map(Number).filter(y=>Number.isInteger(y)&&y!==0&&Math.abs(y)<=3000))];
  if(observed.length!==1)undated[authorState]++;
  else {
   const year=observed[0];
   if(!years.has(year))years.set(year,{year,confirmed:0,probable:0});
   years.get(year)[authorState]++;
  }
  // Network preview only from a record with confirmed author contribution.
  // Identifiers are observed candidate identifiers, not verified human identities.
  // Never borrow coauthors from merged legacy metadata or synthesized names.
  if(authorState!=="confirmed")continue;
  const seen=new Set();
  for(const {r,c} of authors){
   if(stateOf(c)!=="confirmed"||c.synthesizedCreator||r.snapshotMembership)continue;
   for(const [index,creator] of r.rawCreators.entries()){
    if(index===c.position||!creator?.name||creator.creatorComposite)continue;
    if(r.contributions.some(other=>other.position===index&&["confirmed","probable","ambiguous"].includes(stateOf(other))))continue;
    if(creator.role&&!/^(author|autor)$/i.test(creator.role))continue;
    if(!creator.role&&!["Crossref","OpenAlex Philosophy"].includes(providerName(r.provider)))continue;
    const observed=String(creator.orcid||creator.id||"").trim();
    const orcid=/^(?:https?:\/\/orcid\.org\/)?(\d{4}-\d{4}-\d{4}-\d{3}[\dX])$/i.exec(observed);
    const oa=/^https?:\/\/openalex\.org\/(A\d+)$/i.exec(observed);
    let key=oa?"oa:"+oa[1].toUpperCase():null;
    if(orcid){
     const digits=orcid[1].toUpperCase().replace(/-/g,"");
     let n=0;for(const digit of digits.slice(0,15))n=(n+Number(digit))*2;
     const check=(12-n%11)%11;
     if(digits[15]===(check===10?"X":String(check)))key="orcid:"+orcid[1].toUpperCase();
    }
    if(!key||seen.has(key))continue;
    const target=r.rawCreators[c.position];
    if(target&&(target.id===observed||target.orcid===observed))continue;
    seen.add(key);
    const previous=collaborators.get(key);
    collaborators.set(key,{key,name:creator.name,count:(previous?.count||0)+1});
   }
  }
 }
 return {counts,years:[...years.values()].sort((a,b)=>a.year-b.year),undated,collaborators:[...collaborators.values()].sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key))};
}
export function buildAuthorityArchiveView(shadow,legacyWorks=[]){
 const profile=projectAuthorityProfile(shadow);
 const index=new Map(),byGroup=new Map(),byWork=new Map(),candidates=new Map();
 for(const group of profile.works){
  const keys=new Set([group.doi?"doi:"+group.doi:null,...group.records.map(r=>sourceKey(r.provider,r.sourceId))].filter(Boolean));
  for(const key of keys){
   if(!index.has(key))index.set(key,new Set());
   index.get(key).add(group);
  }
 }
 for(const work of arr(legacyWorks)){
  const matched=new Set();
  for(const key of documentKeys(work))for(const group of index.get(key)||[])matched.add(group);
  if(matched.size!==1){
   byWork.set(work,{status:matched.size?"ambiguous":"unresolved",linked:false,reason:matched.size?"multiple-document-groups":"no-exact-link"});
   continue;
  }
  const group=[...matched][0];
  if(!candidates.has(group.key))candidates.set(group.key,[]);
  candidates.get(group.key).push(work);
 }
 for(const group of profile.works){
  const matches=candidates.get(group.key)||[];
  for(const work of matches){
   const linked=matches.length===1;
   byWork.set(work,{status:linked?group.status:"ambiguous",linked,reason:linked?"exact-document-link":"multiple-legacy-records",groupKey:group.key});
   if(linked)byGroup.set(group.key,{work});
  }
 }
 return {profile,analysis:summarizeAuthorityAuthorship(profile.works),byGroup,byWork};
}
export function authorityArchiveLabel(match){
 return match?.linked?"Atribución V2: "+singular[match.status]:
  match?.status==="ambiguous"?"Vínculo V2 ambiguo":"Atribución V2 sin vínculo exacto";
}
function renderAuthorityAnalysis(d,analysis){
 const panel=el(d,"section",undefined,"authority-preview-analysis");
 const c=analysis.counts;
 panel.append(el(d,"h3","Autoría y cronología evaluadas"),el(d,"p",c.confirmed+" autorías confirmadas · "+c.probable+" probables · "+c.otherRoles+" agrupaciones con otros roles · "+c.review+" en revisión · "+c.rejected+" rechazadas."));
 panel.append(el(d,"p","Las autorías probables no se suman a las confirmadas. La cronología V2 solo incluye ambas categorías por separado; excluye otros roles, rechazos y casos en revisión."));
 const dates=el(d,"details");
 dates.append(el(d,"summary","Ver distribución cronológica ("+analysis.years.length+" periodos)"));
 const rows=el(d,"div",undefined,"authority-preview-year-list");
 dates.addEventListener("toggle",()=>{
  if(!dates.open||rows.childNodes.length)return;
  for(const y of analysis.years){
   const label=y.year<0?Math.abs(y.year)+" a. C.":String(y.year);
   rows.append(el(d,"p",label+" · "+y.confirmed+" confirmadas · "+y.probable+" probables"));
  }
  rows.append(el(d,"p","Sin año único corroborable en los registros: "+analysis.undated.confirmed+" confirmadas · "+analysis.undated.probable+" probables."));
 });
 dates.append(rows);panel.append(dates);
 const network=el(d,"details");
 network.append(el(d,"summary","Coautorías documentadas en registros con autoría confirmada ("+analysis.collaborators.length+")"));
 const ul=el(d,"ul");
 network.addEventListener("toggle",()=>{
  if(!network.open||ul.childNodes.length)return;
  if(!analysis.collaborators.length)ul.append(el(d,"li","Todavía no hay coautores elegibles. Esto no implica ausencia de colaboraciones."));
  for(const person of analysis.collaborators)ul.append(el(d,"li",person.name+" · "+person.count+" registros agrupados · identificador observado, identidad no verificada"));
 });
 network.append(ul);panel.append(network);
 return panel;
}
