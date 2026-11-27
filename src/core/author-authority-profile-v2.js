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
const validDoi=v=>/^10\.\d{4,9}\/\S+$/i.test(String(v||""))?String(v).toLowerCase():null;
const stateOf=c=>c?.decision?.scope==="contribution"&&PROFILE_STATES.includes(c.decision.status)?c.decision.status:"unresolved";
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
  const key=doi?"doi:"+doi:JSON.stringify([record.provider,record.sourceId]);
  if(!map.has(key))map.set(key,{key,title:record.title||"",year:record.year??null,doi,records:[],states:[]});
  const group=map.get(key);
  if(!group.title&&record.title)group.title=record.title;
  const contributions=arr(row.contributions);
  mentions+=contributions.length;
  if(!contributions.length)missingRecords++;
  group.records.push({provider:record.provider,sourceId:record.sourceId,ref:record.ref,title:record.title,year:record.year,revision:record.revision,contributions,reason:row.reason});
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
export function mountAuthorAuthorityPreview(root,{shadow,loading=false}={}){
 if(!root)return;
 const d=root.ownerDocument;
 root.replaceChildren();
 root.append(el(d,"p","Author Profile V2 · evaluación experimental","authority-preview-kicker"),el(d,"h2","Evidencia bibliográfica"),el(d,"p","Se evalúan atribuciones al perfil seleccionado, no se certifica la identidad de la persona. El archivo habitual, la cronología y sus estadísticas siguen siendo los originales."));
 if(loading||!shadow||shadow.error){
  const status=el(d,"p",loading?"Evaluando las fuentes recuperadas…":shadow?.error?"Evaluación no disponible. El archivo habitual sigue accesible.":"Todavía no hay evidencia evaluada.");
  status.setAttribute("role","status");root.append(status);return;
 }
 const model=projectAuthorityProfile(shadow);
 const metrics=el(d,"div",undefined,"authority-preview-metrics");
 for(const state of PROFILE_STATES){
  const tile=el(d,"div",undefined,"authority-preview-metric");
  tile.append(el(d,"strong",model.counts[state]),el(d,"span",labels[state]));metrics.append(tile);
 }
 root.append(metrics,el(d,"p",model.works.length+" agrupaciones documentales · "+model.mentions+" menciones evaluadas. Los registros sin DOI común pueden permanecer separados."));
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
