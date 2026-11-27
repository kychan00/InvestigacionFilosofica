import { intellectualHistory, BIO_BATCH, BIO_TYPES } from "./author-intellectual-history.js?v=20261127-v5";
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

export function buildIntellectualHistoryPanel(author,state){
  const history=intellectualHistory(author);
  if(!history)return null;
  if(state.bioKey!==history.id){
    state.bioKey=history.id;
    state.bioOpen=false;
    state.bioLimit=BIO_BATCH;
  }
  const section=el("section","author-intellectual-history");
  section.setAttribute("aria-label","Historia intelectual documentada");
  const panel=el("div","author-intellectual-history-body");
  panel.id="author-intellectual-history-body";
  const toggle=button("","author-intellectual-history-toggle",()=>{
    state.bioOpen=!state.bioOpen;
    if(!state.bioOpen)state.bioLimit=BIO_BATCH;
    render();
  });
  toggle.setAttribute("aria-controls",panel.id);
  const title=el("span","author-intellectual-history-toggle-copy");
  title.append(el("strong","","Vida e historia intelectual"),el("span","",history.events.length+" hitos documentados"+(history.region==="china"?" · Tradición china":"")));
  const chevron=el("span","author-intellectual-history-chevron");
  chevron.setAttribute("aria-hidden","true");
  toggle.append(title,chevron);
  section.append(toggle,panel);
  function render(){
    toggle.setAttribute("aria-expanded",String(Boolean(state.bioOpen)));
    chevron.textContent=state.bioOpen?"−":"+";
    panel.hidden=!state.bioOpen;
    panel.replaceChildren();
    if(!state.bioOpen)return;
    panel.append(el("p","author-intellectual-history-note","Acontecimientos de la vida y fechas originales; independientes de las ediciones recuperadas en la bibliografía. Las fechas tradicionales y los testimonios textuales se señalan expresamente."));
    const entries=el("ol","author-intellectual-history-track");
    const limit=state.bioLimit||BIO_BATCH;
    for(const event of history.events.slice(0,limit)){
      const item=el("li","author-intellectual-history-event");
      item.dataset.motif=historicalPeriod(event.year,history.region).motif;
      item.id="author-intellectual-event-"+event.id;
      const details=el("div","author-intellectual-history-copy");
      details.append(
        el("span","author-intellectual-history-date",event.date),
        el("strong","author-intellectual-history-title",event.title),
        el("span","author-intellectual-history-kind",BIO_TYPES[event.type])
      );
      const source=el("a","author-intellectual-history-source",event.source.name+" ↗");
      source.href=event.source.url;
      source.target="_blank";
      source.rel="noopener noreferrer";
      source.setAttribute("aria-label","Consultar fuente: "+event.source.name+" — "+event.title);
      details.append(source);
      for(const evidence of event.additionalSources||[]){
        const alternative=el("a","author-intellectual-history-source",evidence.name+" · contraste ↗");
        alternative.href=evidence.url;
        alternative.target="_blank";
        alternative.rel="noopener noreferrer";
        alternative.setAttribute("aria-label","Consultar fuente alternativa: "+evidence.name+" — "+event.title);
        details.append(alternative);
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
      const next=panel.querySelectorAll(".author-intellectual-history-event")[limit]?.querySelector("a");
      next?.focus();
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
