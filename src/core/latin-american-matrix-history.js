// Read-only projection of the canonical LATAM dossier. Never infer identities,
// original publications, birth/death dates, or evidence from an external index.
const year = y=>Number.isInteger(y)&&y!==0&&y>=-10000&&y<=new Date().getFullYear();
const fmt=y=>y<0?Math.abs(y)+" a. C.":String(y);
const text=v=>typeof v==="string"?v.trim():"";
const label=v=>text(v).replaceAll("_"," ");
function safeUrl(v){
  try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
function evidence(row){
  return [...new Set((Array.isArray(row?.evidence_urls)?row.evidence_urls:[]).map(safeUrl).filter(Boolean))].map(url=>({name:"Evidencia del registro",url}));
}
const LIFE_CERTAINTY=new Set(["standard","verified","approximate","source_conflict","project_primary_source","national_library_authority","bibliographic_source_year","documented","historically_verified","exact","confirmed"]);
function lifeDate(d,flat){
  if(d&&typeof d==="object"){
    const c=text(d.certainty);
    if(!LIFE_CERTAINTY.has(c))return null;
    if(c==="source_conflict"){
      const candidates=Array.isArray(d.candidates)?[...new Set(d.candidates.filter(year))].sort((a,b)=>a-b):[];
      if(candidates.length<2||candidates.length!==d.candidates.length)return null;
      return {year:candidates[0],date:candidates.map(fmt).join(" o ")+" (discutido)",certainty:c};
    }
    if(year(d.year))return {year:d.year,date:(c==="approximate"?"c. ":"")+fmt(d.year),certainty:c};
    return null;
  }
  return year(flat)?{year:flat,date:fmt(flat),certainty:"año consignado sin grado de certeza explícito"}:null;
}
const PUBLICATION=new Set(["publication","first_edition","bibliographically_documented_publication","first_edition_facsimile_and_catalog","rotaprint_publication","serial_publication_range","publication_context"]);
const COMPOSITION=new Set(["composition","composition_year","composition_range","manuscript","manuscript_date","written","written_year"]);
const CONTRIBUTIONS=new Set(["historically_verified","attributed_by_historical_sources","documented","documented_in_national_library_and_academic_sources","documented_in_institutional_or_scholarly_sources"]);
function dateFrom(d){
  if(!d||typeof d!=="object")return null;
  if(year(d.start)&&year(d.end)&&d.start<=d.end)return {year:d.start,date:fmt(d.start)+(d.start===d.end?"":"–"+fmt(d.end))};
  if(year(d.year))return {year:d.year,date:fmt(d.year)};
  if(Number.isInteger(d.century)&&d.century>0&&d.century<=Math.ceil(new Date().getFullYear()/100))return {year:(d.century-1)*100+1,date:"Siglo "+d.century+" (sin año preciso)"};
  return null;
}
function workDate(w){
  const d=w.original_date||{},c=text(d.certainty),original=dateFrom(d),pub=year(w.first_publication_year)?w.first_publication_year:null;
  if(COMPOSITION.has(c)&&original)return {...original,type:"composition",certainty:c};
  if(c==="doctoral_dissertation"&&original)return {...original,type:"archive-thesis",certainty:c};
  if(PUBLICATION.has(c)&&original&&(!pub||pub===original.year))return {...original,type:"archive-publication",certainty:c};
  if(pub&&(!original||original.year===pub||d.century))return {year:pub,date:fmt(pub),type:"archive-record",certainty:"first_publication_year consignado; "+(c||"precisión no especificada")};
  if(original&&c)return {...original,type:"archive-record",certainty:c};
  return null;
}
export function matrixIntellectualHistory(record){
  const id=record?.author_id;
  if(!Number.isInteger(id)||id<1||id>1504||!text(record.canonical_name)||record.coverage?.status!=="seeded"||/identity_or_bibliography_requires_verification/.test(record.coverage?.works_status||""))return null;
  const dossierSources=(Array.isArray(record.sources)?record.sources:[]).filter(s=>text(s?.title)&&(safeUrl(s.url)||text(s.locator)));
  if(!dossierSources.length)return null;
  const events=[];
  function add(key,dated,type,title,row,role){
    const direct=evidence(row);
    events.push({id:"latam-"+id+"-"+key,year:dated.year,date:dated.date,type,title,
      source:direct[0]||null,additionalSources:direct.slice(1),
      evidenceScope:direct.length?"Evidencia asociada al registro":"Fuentes generales del expediente; no atribuidas individualmente al hito",
      certainty:label(dated.certainty),role:label(role)});
  }
  for(const [field,flat,type,title] of [["born","birth_year","birth","Nacimiento"],["died","death_year","death","Fallecimiento"]]){
    const date=lifeDate(record.life?.[field],record.life?.[flat]);
    if(date)add(field,date,type,title,record.life?.[field]);
  }
  for(const [i,w] of (Array.isArray(record.works)?record.works:[]).entries()){
    const title=text(w?.title),role=text(w?.authorship_status);
    if(!title||!role||/unverified|disputed|uncertain|requires_verification|rejected|not_verified|not_authored|misattributed/.test(role))continue;
    const dated=workDate(w);
    if(dated)add("work-"+i,dated,dated.type,title,w,role);
  }
  for(const [i,c] of (Array.isArray(record.non_bibliographic_contributions)?record.non_bibliographic_contributions:[]).entries()){
    if(!text(c?.title)||!CONTRIBUTIONS.has(c.authorship_status))continue;
    const dated=dateFrom(c.period);
    if(dated&&text(c.period?.certainty)){
      if(c.period.certainty==="approximate")dated.date="c. "+dated.date;
      add("contribution-"+i,{...dated,certainty:c.period.certainty},"archive-contribution",c.title,c,c.authorship_status);
    }
  }
  events.sort((a,b)=>a.year-b.year);
  return events.length?{id:"latam-"+id,region:"latin",events}:null;
}
