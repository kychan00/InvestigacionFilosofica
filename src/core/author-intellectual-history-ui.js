import { intellectualHistory, BIO_BATCH, BIO_TYPES } from "./author-intellectual-history.js?v=20261127-history-evidence-v1";
import { historicalPeriod } from "./author-historical-periods.js?v=20261127-historical-v4";

function el(tag,cls,text){
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text)node.textContent=text;
  return node;
}
function button(label,cls,handler){
  const b=el("button",cls,label);
  b.type="button";
  b.addEventListener("click",handler);
  return b;
}

let publicEvidencePromise;
function loadPublicEvidence(){
  if(!publicEvidencePromise){
    publicEvidencePromise=import("./author-history-public-v1.js?v=20261127-history-evidence-v1")
      .then(module=>module.publicHistoryEvidence)
      .catch(error=>{publicEvidencePromise=undefined;throw error;});
  }
  return publicEvidencePromise;
}
const sourceLabels={
  "plato.stanford.edu":"Stanford Encyclopedia of Philosophy",
  "iep.utm.edu":"Internet Encyclopedia of Philosophy",
  "www.cambridge.org":"Cambridge University Press",
  "www.cervantesvirtual.com":"Biblioteca Virtual Miguel de Cervantes",
  "cvc.cervantes.es":"Centro Virtual Cervantes",
  "colnal.mx":"El Colegio Nacional",
  "enciclopedia.udg.mx":"Enciclopedia UdeG",
  "sites.google.com":"Archivo y Taller de Historia Oral · UNAM",
  "filosoficas.unam.mx":"Instituto de Investigaciones Filosóficas · UNAM",
  "dianoia.filosoficas.unam.mx":"Diánoia · UNAM",
  "bibliotecavirtual.clacso.org.ar":"CLACSO",
  "biblioteca.clacso.edu.ar":"CLACSO",
  "www.hannaharendt.net":"HannahArendt.net · Vita",
  "www.dhm.de":"Deutsches Historisches Museum · LeMO",
  "filosofiamexicana.org":"Centro de Estudios de Filosofía Mexicana",
  "tesiunamdocumentos.dgb.unam.mx":"Repositorio de tesis · UNAM",
  "mariazambrano.org":"Glosario María Zambrano",
  "bolivare.unam.mx":"Archivo Bolívar Echeverría · UNAM",
  "unamglobal.unam.mx":"UNAM Global",
  "www.fpa.es":"Fundación Princesa de Asturias"
};
function sourceLink(url,label,title){
  const link=el("a","author-intellectual-history-source",label+" ↗");
  link.href=url;link.target="_blank";link.rel="noopener noreferrer";
  link.setAttribute("aria-label","Consultar fuente: "+label+" — "+title);
  return link;
}
function appendOriginalSources(parent,event,matrix=false){
  for(const [index,evidence] of [event.source,...(event.additionalSources||[])].filter(Boolean).entries()){
    parent.append(sourceLink(evidence.url,evidence.name+(!matrix&&index?" · contraste":""),event.title));
  }
}
function buildEvidenceDisclosure(event,history,state){
  const disclosure=el("details","author-history-evidence");
  const summary=el("summary","author-history-evidence-summary","Contexto y fuentes");
  const body=el("div","author-history-evidence-body");
  body.setAttribute("aria-live","polite");
  disclosure.append(summary,body);
  let loaded=false,loading=false;
  async function load(){
    if(loaded||loading)return;
    loading=true;
    body.replaceChildren(el("p","author-history-evidence-text","Cargando referencias…"));
    try{
      const data=await loadPublicEvidence();
      const record=data.entries[event.id];
      if(!record?.sources?.length)throw Error("Missing evidence");
      body.replaceChildren();
      if(record.note){
        body.append(el("strong","author-history-evidence-label","Nota historiográfica"),el("p","author-history-evidence-text",record.note));
      }
      body.append(el("strong","author-history-evidence-label","Referencias consultadas"));
      const list=el("ul","author-history-evidence-list");
      for(const [index,locator] of record.sources){
        const url=data.urls[index];
        const host=new URL(url).hostname;
        const item=el("li","author-history-evidence-reference");
        item.append(sourceLink(url,sourceLabels[host]||host,event.title),el("p","author-history-evidence-text",locator));
        list.append(item);
      }
      body.append(list);
      loaded=true;
    }catch{
      body.replaceChildren(el("p","author-history-evidence-text","No se pudieron cargar las notas y referencias editoriales. Puede cerrar y volver a abrir este apartado. Referencias originales del inventario:"));
      appendOriginalSources(body,event);
    }finally{loading=false;}
  }
  disclosure.addEventListener("toggle",()=>{
    if(state.bioKey!==history.id||!disclosure.isConnected)return;
    const ids=new Set(state.bioEvidenceOpen||[]);
    if(disclosure.open){ids.add(event.id);void load();}else ids.delete(event.id);
    state.bioEvidenceOpen=[...ids];
  });
  if((state.bioEvidenceOpen||[]).includes(event.id)){
    disclosure.open=true;
    void load();
  }
  return disclosure;
}

export function buildIntellectualHistoryPanel(author,state,{archiveHref=null}={}){
  return buildHistoryPanel(intellectualHistory(author),state,{archiveHref,identityContext:author?.historyIdentityContext});
}

const MATRIX_TYPES={"archive-publication":"Publicación consignada","archive-record":"Fecha bibliográfica consignada","archive-thesis":"Tesis","archive-edition":"Edición o versión de una obra previa","archive-contribution":"Contribución intelectual"};
export function buildHistoryPanel(history,state,{archiveHref=null,matrix=false,identityContext=null}={}){
  if(!history?.events?.length)return null;
  if(state.bioKey!==history.id){
    state.bioKey=history.id;
    state.bioOpen=false;
    state.bioLimit=BIO_BATCH;
    state.bioEvidenceOpen=[];
  }
  const section=el("section","author-intellectual-history");
  section.setAttribute("aria-label",matrix?"Cronología del expediente":"Historia intelectual documentada");
  const panel=el("div","author-intellectual-history-body");
  panel.id="author-intellectual-history-body";
  const toggle=button("","author-intellectual-history-toggle",()=>{
    state.bioOpen=!state.bioOpen;
    if(!state.bioOpen){state.bioLimit=BIO_BATCH;state.bioEvidenceOpen=[];}
    render();
  });
  toggle.setAttribute("aria-controls",panel.id);
  const title=el("span","author-intellectual-history-toggle-copy");
  title.append(el("strong","",matrix?"Cronología del expediente":"Vida e historia intelectual"),el("span","",history.events.length+(matrix?" registros fechados":" hitos documentados")+(history.region==="china"?" · Tradición china":"")+(identityContext==="confucius-reviewed-catalogue"?" · Identificación contextual":"")));
  const chevron=el("span","author-intellectual-history-chevron");
  chevron.setAttribute("aria-hidden","true");
  toggle.append(title,chevron);
  section.append(toggle,panel);
  if(archiveHref){
    const archive=el("a","author-intellectual-history-archive","Consultar ficha del archivo latinoamericano ↗");
    archive.href=archiveHref;
    section.append(archive);
  }
  function render(){
    toggle.setAttribute("aria-expanded",String(Boolean(state.bioOpen)));
    chevron.textContent=state.bioOpen?"−":"+";
    panel.hidden=!state.bioOpen;
    panel.replaceChildren();
    if(!state.bioOpen)return;
    panel.append(el("p","author-intellectual-history-note",matrix?"Proyección de las fechas ya consignadas en esta ficha, no una nueva curaduría biográfica. Las fuentes generales no acreditan por sí solas cada registro. Consulte la sección Fuentes para el expediente completo.":"Selección de acontecimientos y fechas originales, independiente de las ediciones recuperadas en la bibliografía. Abra «Contexto y fuentes» para consultar las referencias de cada hito y los matices disponibles. El contraste editorial no equivale a revisión por pares. Las fechas aproximadas, tradicionales y los testimonios textuales se señalan cuando corresponde."));
    if(identityContext==="confucius-reviewed-catalogue"){
      const note=el("p","author-intellectual-history-note","Identificación contextual: el catálogo atribuye las Analectas a un nombre histórico reconocido por autoridades bibliográficas. Esto no confirma la autoría de todas las obras ni convierte los Cuatro Libros en una obra independiente de Confucio. ");
      const source=el("a","author-intellectual-history-source","Autoridad Getty ULAN ↗");
      source.href="https://www.getty.edu/vow/ULANFullDisplay?subjectid=500355288&find=&role=&nation=";source.target="_blank";source.rel="noopener noreferrer";note.append(source);
      panel.append(note);
    }
    const entries=el("ol","author-intellectual-history-track");
    const limit=state.bioLimit||BIO_BATCH;
    for(const event of history.events.slice(0,limit)){
      const item=el("li","author-intellectual-history-event");
      item.dataset.motif=historicalPeriod(event.year,history.region).motif;
      item.id="author-intellectual-event-"+event.id;
      item.tabIndex=-1;
      const details=el("div","author-intellectual-history-copy");
      details.append(
        el("span","author-intellectual-history-date",event.date),
        el("strong","author-intellectual-history-title",event.title),
        el("span","author-intellectual-history-kind",BIO_TYPES[event.type]||MATRIX_TYPES[event.type]||"Registro")
      );
      if(event.certainty)details.append(el("span","author-intellectual-history-kind","Precisión: "+event.certainty));
      if(event.editionOf)details.append(el("span","author-intellectual-history-kind","Vinculada a la obra "+event.editionOf+" en el expediente"));
      if(event.role)details.append(el("span","author-intellectual-history-kind","Responsabilidad: "+event.role));
      if(event.evidenceScope)details.append(el("span","author-intellectual-history-kind",event.evidenceScope));
      if(!matrix&&/^Q\d+$/.test(history.id)&&event.id.startsWith(history.id+"-")){
        details.append(buildEvidenceDisclosure(event,history,state));
      }else{
        appendOriginalSources(details,event,matrix);
      }
      item.append(details);
      entries.append(item);
    }
    panel.append(entries);
    const count=el("p","author-intellectual-history-note",Math.min(limit,history.events.length)+" de "+history.events.length+" hitos");
    count.setAttribute("role","status");
    panel.append(count);
    if(limit<history.events.length)panel.append(button("Mostrar más hitos","author-intellectual-history-more",()=>{
      state.bioLimit=limit+BIO_BATCH;
      render();
      const next=panel.querySelectorAll(".author-intellectual-history-event")[limit];
      (next?.querySelector("a")||next)?.focus();
    }));
    if(limit>BIO_BATCH)panel.append(button("Mostrar menos hitos","author-intellectual-history-more",()=>{
      state.bioLimit=BIO_BATCH;
      render();
      panel.querySelector(".author-intellectual-history-more")?.focus();
    }));
  }
  render();
  return section;
}
