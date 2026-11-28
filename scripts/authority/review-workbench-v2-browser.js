// Bundled into an offline HTML document by build-review-workbench-v2.mjs.
const packet=JSON.parse(document.getElementById("packet-data").textContent);
const $=id=>document.getElementById(id);
const labels={"identity-pair":"Identidad de personas","name-retrieval":"Variantes nominales","reference-person-retrieval":"Filósofos de referencia","contribution-role-review":"Autoría y participación","portrait-subject-review":"Identidad del retrato","same-person":"Misma persona","different-person":"Personas diferentes","unresolved":"Sin resolver","target-present":"Perfil coincidente documentado","target-absent-from-returned-candidates":"No coincide con los candidatos presentados","author":"Autoría","editor":"Edición","translator":"Traducción","coordinator":"Coordinación","compiler":"Compilación","reviewer":"Reseña","other-role":"Otro rol","no-contribution":"Sin participación documentada","reviewed":"Evaluar opciones de imagen","correct-subject":"Persona correcta","wrong-subject":"Persona incorrecta"};
const cohorts={pilot:"Piloto · identidad",documentary:"Muestra documental",contribution:"Autorías",portrait:"Retratos"};
const el=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);if(cls)n.className=cls;return n;};
function link(parent,value,caption){const url=safeReviewURL(value);if(!url)return;const a=el("a",caption||url);a.href=url;a.target="_blank";a.rel="noopener noreferrer";parent.append(a);}
const arr=reviewArray;
let judgments=new Map(),filtered=[],position=0,dirty=false;
const current=()=>filtered[position];
function status(message,error=false){$("status").textContent=message;$("status").dataset.error=String(error);}
function title(s){return labels[s]||s;}
function profileCard(p,heading){
 const section=el("section",undefined,"profile");
 section.append(el("p",heading||"Perfil del índice","eyebrow"),el("h3",p.displayName||p.name||"Nombre no disponible"),el("p","Identificador A"+p.authorId,"muted"));
 link(section,p.openAlexUrl||p.source,"Registro bibliográfico");
 for(const o of [...arr(p.orcids),p.indexOrcid].filter(Boolean)){const id=String(o).replace(/^https?:\/\/orcid\.org\//i,"");if(/^\d{4}-\d{4}-\d{4}-[\dX]{4}$/i.test(id))link(section,"https://orcid.org/"+id,"ORCID observado: "+id);}
 if(arr(p.observedNames).length)section.append(el("p","Nombres observados: "+p.observedNames.join(" · ")));
 if(p.activeYears)section.append(el("p","Años de publicación observados: "+(p.activeYears.min??"—")+" – "+(p.activeYears.max??"—")));
 if(p.workCountObserved!=null)section.append(el("p","Registros observados: "+p.workCountObserved));
 const works=arr(p.works);
 if(works.length){const list=el("ol");for(const w of works)list.append(workCard(w));section.append(list);}
 return section;
}
function workCard(w){
 const li=el("li",undefined,"work");li.append(el("strong",w.title||"Sin título"),el("p",[w.year,w.type,w.language,w.authorPosition].filter(Boolean).join(" · "),"muted"));
 const url=w.source||(/^\d+$/.test(String(w.workId||""))?"https://openalex.org/W"+w.workId:null);link(li,url,"Registro de la obra");
 if(arr(w.coauthors).length)li.append(el("p","Coautores observados: "+w.coauthors.map(a=>a.name||a.authorId).join(" · ")));
 return li;
}
function renderEvidence(c){
 const area=$("evidence");area.replaceChildren();
 if(c.query)area.append(el("h2","Consulta: "+c.query));
 if(c.reference){
  const ref=el("section",undefined,"reference");ref.append(el("h3","Referencia documental de partida"));
  for(const s of arr(c.reference.sources))link(ref,s.url,s.name||s.url);
  if(c.reference.qid)link(ref,"https://www.wikidata.org/wiki/"+c.reference.qid,"Identificador de referencia");
  if(c.reference.inventoryId)ref.append(el("p","Inventario editorial: "+c.reference.inventoryId));
  if(c.reference.source)ref.append(el("p",typeof c.reference.source==="string"?c.reference.source:JSON.stringify(c.reference.source)));
  area.append(ref);
 }
 if(c.task==="contribution-role-review"){
  const grid=el("div",undefined,"profiles");grid.append(profileCard(c.target,"Persona cuya participación se evalúa"),profileCard(c.snapshotMembership.observedProfile,"Perfil observado en el índice"));
  area.append(grid,el("h3","Obra que debe verificarse"),workCard(c.work));return;
 }
 if(c.task==="portrait-subject-review"){
  area.append(profileCard(c.target,"Identidad del perfil que se evalúa"));
  for(const s of arr(c.referenceSources))link(area,typeof s==="string"?s:s.url,typeof s==="string"?s:s.name);
  if(!arr(c.options).length){area.append(el("p","No hay imágenes recuperadas para revisar. No se puede juzgar la identidad visual.","notice"));return;}
  for(const o of c.options){const box=el("section",undefined,"profile");box.append(el("h3","Opción "+o.option_id),el("p","Licencia declarada: "+(o.license||"sin dato")));link(box,o.source,"Abrir imagen y ficha de Commons");if(/^Q[1-9]\d*$/.test(o.entityId||""))link(box,"https://www.wikidata.org/wiki/"+o.entityId,"Declaración de identidad de origen");area.append(box);}
  return;
 }
 const grid=el("div",undefined,"profiles");
 for(const [i,p] of arr(c.profiles).entries())grid.append(profileCard(p,"Perfil "+(i+1)));
 if(!grid.children.length)grid.append(el("p","No se recuperaron candidatos. Esto no demuestra ausencia del corpus.","notice"));
 area.append(grid);
 if(arr(c.unsampledCandidateIds).length)area.append(el("p","Candidatos sin expediente: "+c.unsampledCandidateIds.join(", ")+". No se puede concluir ausencia.","notice"));
 if(c.task==="name-retrieval")area.append(el("p","La variante nominal se compara con el perfil de prueba presentado; no es una medición de recuperación en vivo.","muted"));
}
function selectOptions(select,values,placeholder="Seleccione un juicio"){
 select.replaceChildren(new Option(placeholder,""));for(const v of values)select.add(new Option(title(v),v));
}
function updateProgress(){
 $("total").textContent=judgments.size+" / "+packet.cases.length+" revisados";
 $("progress").value=judgments.size;$("progress").max=packet.cases.length;
 const progress=workbenchProgress(packet,[...judgments.values()]);$("task-progress").replaceChildren();
 for(const [task,v] of Object.entries(progress))$("task-progress").append(el("div",title(task)+": "+v.reviewed+"/"+v.total+" · "+v.resolved+" resueltos"));
}
function render(){
 const c=current();$("review").hidden=!c;$("empty").hidden=Boolean(c);
 $("position").textContent=filtered.length?(position+1)+" / "+filtered.length:"0 / 0";
 $("previous").disabled=position===0;$("next").disabled=position>=filtered.length-1;$("pending").disabled=!filtered.some(c=>!judgments.has(c.audit_id));
 updateProgress();if(!c)return;
 const j=judgments.get(c.audit_id);$("case-id").textContent=c.audit_id+" · "+cohorts[c.cohort];$("case-task").textContent=title(c.task);
 renderEvidence(c);let values=REVIEW_LABELS[c.task];
 if(c.task==="portrait-subject-review")values=arr(c.options).length?["reviewed"]:["unresolved"];
 selectOptions($("judgment"),values);$("judgment").value=j?.judgment||"";
 $("note").value=j?.note||"";$("sources").value=arr(j?.evidence).join("\n");
 if(j)$("reviewer").value=j.reviewer;
 const extra=$("extra");extra.replaceChildren();
 if(c.task==="name-retrieval"||c.task==="reference-person-retrieval"){
  extra.append(el("p","Seleccione los perfiles coincidentes únicamente si puede documentarlos."));
  for(const p of arr(c.profiles)){const label=el("label",undefined,"choice");const input=el("input");input.type="checkbox";input.name="matched";input.value=String(p.authorId);input.checked=arr(j?.matchedCandidateIds).includes(input.value);label.append(input,el("span",p.displayName||p.name||input.value));extra.append(label);}
 }
 if(c.task==="portrait-subject-review"){
  for(const o of arr(c.options)){const label=el("label",undefined,"field");label.append(el("span","Juicio de "+o.option_id));const select=el("select");select.dataset.optionId=o.option_id;selectOptions(select,["correct-subject","wrong-subject","unresolved"]);select.value=arr(j?.options).find(x=>x.option_id===o.option_id)?.judgment||"";label.append(select);extra.append(label);}
 }
 dirty=false;status(j?"Juicio guardado en esta sesión.":"Pendiente de revisión.");
}
function filter(){
 const cohort=$("cohort").value,task=$("task").value,only=$("only").checked;
 filtered=packet.cases.filter(c=>(cohort==="all"||c.cohort===cohort)&&(task==="all"||c.task===task)&&(!only||!judgments.has(c.audit_id)));position=0;render();
}
function allowNavigation(){return !dirty||confirm("Hay cambios sin guardar. ¿Descartarlos?");}
function move(n){if(!allowNavigation())return;position=Math.max(0,Math.min(filtered.length-1,n));render();}
function save(){
 const c=current();if(!c)return;
 const j={audit_id:c.audit_id,task:c.task,reviewer:$("reviewer").value.trim(),reviewedAt:new Date().toISOString(),judgment:$("judgment").value,note:$("note").value.trim(),evidence:$("sources").value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)};
 if(c.task==="name-retrieval"||c.task==="reference-person-retrieval")j.matchedCandidateIds=[...$("extra").querySelectorAll('input[name="matched"]:checked')].map(x=>x.value);
 if(c.task==="portrait-subject-review")j.options=[...$("extra").querySelectorAll("select[data-option-id]")].map(x=>({option_id:x.dataset.optionId,judgment:x.value}));
 try{validateWorkbenchJudgment(c,j);judgments.set(c.audit_id,j);dirty=false;updateProgress();status("Juicio guardado en la sesión. Exporte el archivo para conservarlo.");if($("only").checked)filter();}
 catch(e){status(e.message,true);}
}
function download(value,name){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+"\n"],{type:"application/json"}));const a=el("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
for(const [key,value] of Object.entries(cohorts))$("cohort").add(new Option(value,key));
for(const key of Object.keys(REVIEW_LABELS))$("task").add(new Option(title(key),key));
for(const id of ["cohort","task","only"]){$(id).addEventListener("change",()=>{if(allowNavigation())filter();else{status("Guarde el juicio antes de cambiar los filtros.",true);}});}
$("previous").onclick=()=>move(position-1);$("next").onclick=()=>move(position+1);
$("pending").onclick=()=>{const offset=filtered.findIndex((c,i)=>i>position&&!judgments.has(c.audit_id));move(offset>=0?offset:filtered.findIndex(c=>!judgments.has(c.audit_id)));};
$("save").onclick=save;
$("review").addEventListener("input",()=>{dirty=true;});
$("export").onclick=()=>{try{download(makeWorkbenchExport(packet,[...judgments.values()]),"authority-v2-judgments.json");status("Exportación de los juicios guardados iniciada.");}catch(e){status(e.message,true);}};
$("export-pilot").onclick=()=>{try{download(makePilotExport(packet,[...judgments.values()]),"authority-v2-pilot-judgments.json");}catch(e){status(e.message,true);}};
$("import").onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>12*1024*1024)throw Error("Archivo demasiado grande.");if(!allowNavigation())return;const imported=validateWorkbenchExport(packet,JSON.parse(await f.text()));for(const j of imported){const old=judgments.get(j.audit_id);if(old&&JSON.stringify(old)!==JSON.stringify(j))throw Error("Conflicto de juicio para "+j.audit_id+". Exporte su sesión antes de reemplazar.");}for(const j of imported)judgments.set(j.audit_id,j);filter();status("Se importaron "+imported.length+" juicios de esta muestra.");}catch(error){status(error.message,true);}finally{e.target.value="";}};
window.addEventListener("beforeunload",e=>{if(dirty||judgments.size){e.preventDefault();e.returnValue="";}});
$("revision").textContent=packet.datasetRevision;
filter();
