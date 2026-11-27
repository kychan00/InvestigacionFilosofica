// Editorial time bands, not claims of intellectual affiliation.
export const TIMELINE_BATCH = 4;
const latin = /\b(mexican[oa]?|argentin[oa]?|brasilen[oa]|brazilian|colombian[oa]?|peruan[oa]|peruvian|chilean|chilen[oa]|venezuelan[oa]?|cuban[oa]?|bolivian[oa]?|ecuatorian[oa]|ecuadorian|uruguayan|uruguay[oa]|paraguayan|paraguay[oa]|guatemalan|guatemaltec[oa]|costarricense|costa rican|puertorriquen[oa]|puerto rican|dominican[oa]?|honduran|honduren[oa]|salvadoran|salvadoren[oa]|nicaraguan|nicaraguense|panamanian|panamen[oa]|haitian[oa]?|latin american|latinoamerican[oa])\b/u;
const europe = /\b(aleman[a]?|german|frances[a]?|french|italian[oa]?|espanol[a]?|spanish|british|britanic[oa]|english|ingles[a]?|greek|grieg[oa]|roman[oa]|austrian|austriac[oa]|dutch|neerlandes[a]?|portuguese|portugues[a]?|polish|polac[oa]|swiss|suiz[oa]|danish|danes[a]?|norwegian|norueg[oa]|swedish|suec[oa]|irish|irlandes[a]?|belgian|belga|finnish|finlandes[a]?|european|europe[oa])\b/u;
export function authorHistoricalContext(author) {
  const qid = String(author?.wikidataId || "");
  if (qid === "Q859" || qid === "Q868") return {region:"europe",label:"Grecia antigua · siglo IV a. C.",motif:"ancient"};
  const description = /^Q\d+$/.test(qid) ? String(author?.biography || "").normalize("NFD").replace(/\p{M}/gu,"").toLowerCase() : "";
  const l=latin.test(description), e=europe.test(description);
  if(l&&!e) return {region:"latin",label:"Contexto latinoamericano",motif:"republic"};
  if(e&&!l) return {region:"europe",label:"Contexto europeo",motif:"archive"};
  return {region:"neutral",label:"",motif:"archive"};
}
const band=(key,label,motif)=>({key,label,motif});
export function historicalPeriod(year,region="neutral") {
  if(!Number.isInteger(year)||year===0) return band("unknown","Sin fecha","archive");
  if(region==="latin"){
    if(year<1492)return band("precolonial","América precolonial","precolonial");
    if(year<1800)return band("colonial","Periodo colonial","colonial");
    if(year<1850)return band("independence","Independencias y formación republicana","republic");
    if(year<1910)return band("nation","Construcción nacional","republic");
    return band("contemporary","Periodo contemporáneo","contemporary");
  }
  if(region==="europe"){
    if(year<0)return band("bce","Antigüedad · a. C.","ancient");
    if(year<500)return band("ancient","Antigüedad · d. C.","ancient");
    if(year<1400)return band("medieval","Edad Media","medieval");
    if(year<1600)return band("renaissance","Transición medieval y Renacimiento","renaissance");
    if(year<1800)return band("early-modern","Modernidad temprana","modern");
    if(year<1900)return band("nineteenth","Siglo XIX","nineteenth");
    return band("contemporary","Periodo contemporáneo","contemporary");
  }
  if(year<0)return band("bce","Antes de nuestra era","archive");
  if(year<1500)return band("before1500","Antes de 1500","archive");
  const century=Math.floor((year-1)/100)+1;
  return band("century-"+century,"Siglo "+century,"archive");
}
export function historicalTimelineSlice(model,context,limit=TIMELINE_BATCH){
  const sections=[];
  let remaining=Math.max(0,Number.isFinite(limit)?Math.floor(limit):TIMELINE_BATCH);
  for(const group of model.groups){
    if(!remaining)break;
    const period=historicalPeriod(group.year,context.region);
    let section=sections.at(-1);
    if(!section||section.key!==period.key){section={...period,entries:[]};sections.push(section);}
    const nodes=group.nodes.slice(0,remaining);
    section.entries.push(...nodes.map(node=>({...node,dateLabel:group.label})));
    remaining-=nodes.length;
  }
  return sections;
}
