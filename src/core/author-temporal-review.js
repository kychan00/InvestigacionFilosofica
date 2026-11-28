// Presentation-only temporal assessment. A date is not an identity decision.
const norm=value=>String(value||"").normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
// Reviewed title aliases, tied to stable canonical publication milestones.
const publicationFamilies={
 Q60025:[
  ["Q60025-4",["Los orígenes del totalitarismo","The Origins of Totalitarianism","Hannah Arendt, The Origins Of Totalitarianism"]],
  ["Q60025-5",["La condición humana","The Human Condition"]],
  ["Q60025-6",["Sobre la revolución","On Revolution"]],
  ["Q60025-8",["La vida del espíritu","The Life of the Mind"]]
 ],
 Q33760:[
  ["Q33760-3",["Los principios de las matemáticas","Los principios de la matemática","The Principles of Mathematics"]],
  ["Q33760-4",["Sobre la denotación","On Denoting"]],
  ["Q33760-5",["Principia Mathematica"]]
 ],
 Q9235:[
  ["Q9235-1",["Fenomenología del espíritu","Phenomenology of Spirit","Phänomenologie des Geistes"]],
  ["Q9235-3",["Enciclopedia de las ciencias filosóficas"]],
  ["Q9235-5",["Principios de la filosofía del derecho","Elements of the Philosophy of Right","Grundlinien der Philosophie des Rechts"]]
 ],
 Q601364:[
  ["Q601364-6",["El problema de México y la ideología nacional"]],
  ["Q601364-7",["La persona humana y el Estado totalitario"]]
 ],
 Q183074:[
  ["Q183074-1",["Inundación castálida"]],
  ["Q183074-2",["Carta atenagórica"]]
 ]
};
const titleClues={Q33760:[["Bertrand Russell, Last's Message 1970",1970]]};
const formatted=y=>y<0?Math.abs(y)+" a. C.":String(y);
function exactLifeYear(event){
 if(!event||!Number.isInteger(event.year))return null;
 return event.date===formatted(event.year)?event.year:null;
}
function reportedDateYears(work){
 return [work.publicationDate,work.publication_date,work.publishedDate,work.published_date,work.date]
  .filter(v=>typeof v==="string")
  .map(v=>v.trim().match(/^(\d{4})(?:-\d{2}(?:-\d{2})?)?$/)?.[1])
  .filter(Boolean).map(Number).filter(y=>y>0&&y<=3000);
}
export function assessAuthorWorkDate(work, date, history){
 if(!history?.id||!Array.isArray(history.events)||!Number.isInteger(date?.year))return null;
 const y=date.year, title=norm(work?.title);
 const birth=history.events.find(e=>e.type==="birth");
 const death=history.events.find(e=>e.type==="death");
 const start=exactLifeYear(birth),end=exactLifeYear(death);
 const family=(publicationFamilies[history.id]||[]).find(([,names])=>names.some(n=>norm(n)===title));
 const event=family&&history.events.find(e=>e.id===family[0]&&["publication","posthumous"].includes(e.type));
 const make=(code,label,detail,review=false)=>({code,label,detail,review,reportedYear:y,...(event?{referenceEventId:event.id,referenceDate:event.date}:{})});
 if(reportedDateYears(work||{}).some(n=>n!==y))return make("conflicting-metadata","Fecha por revisar","El año registrado ("+formatted(y)+") no coincide con otra fecha del mismo registro. Se conserva el dato original.",true);
 if(start!==null&&y<start)return make("before-birth","Fecha por revisar","El año registrado ("+formatted(y)+") es anterior al nacimiento documentado ("+birth.date+"). Puede ser un error de catálogo o de identidad; no se ha corregido automáticamente.",true);
 if(event&&y<event.year)return make("before-first-publication","Fecha por revisar","El año registrado ("+formatted(y)+") precede a la publicación documentada ("+event.date+"). Puede tratarse de otro texto, un manuscrito o un error de catálogo.",true);
 const clue=(titleClues[history.id]||[]).find(([name])=>norm(name)===title);
 if(clue&&y!==clue[1])return make("title-year-disagreement","Fecha por revisar","El catálogo registra "+formatted(y)+", pero el título contiene "+clue[1]+". Esa mención no acredita el año de esta edición.",true);
 if(event){
  const last=event.id==="Q9235-5"?1821:event.id==="Q33760-5"?1913:event.year;
  if(y>=event.year&&y<=last)return make(event.type==="posthumous"?"documented-posthumous":"documented-publication","Fecha compatible con la historia intelectual","Coincide con la cronología documentada ("+event.date+"); no certifica que este ejemplar sea la edición original.");
  if(y>last)return make("later-version-possible","Posible edición o reproducción posterior","La publicación documentada es de "+event.date+". El catálogo registra "+formatted(y)+"; falta confirmar la edición o reproducción concreta.");
 }
 if(end!==null&&y>end)return make("after-death","Registro posterior al fallecimiento","El año del catálogo es posterior al fallecimiento ("+death.date+"). Puede corresponder a una edición, traducción, digitalización, publicación póstuma o a otra identidad. No acredita coautoría en vida.");
 return null;
}
