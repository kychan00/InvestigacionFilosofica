import { WORLD_HISTORY_ANCHORS } from "./world-history-anchors.js?v=20261127-world-v1";
import { LATAM_HISTORY_ANCHORS } from "./latin-american-history-anchors.js?v=20261127-latam-v1";
import { intellectualHistory } from "./author-intellectual-history.js?v=20261127-history-evidence-v1";
import { REVIEWED_HISTORY_TITLE_FAMILIES } from "./reviewed-history-title-families.js?v=20261127-history-context-07ab-v1";
// Documentary corroboration for this view only. Translations and editions
// of one work count as one anchor; no external requests or identity mutation.
const anchors=[
 ["Q7197",["Simone de Beauvoir","Beauvoir, Simone de"],[
 ["Le sang des autres","The Blood of Others","La sangre de los otros"],
 ["Le deuxième sexe","Le deuxième sexe. Vol. I: Les faits et les mythes","Segundo Sexo, Simone De Beauvoir","El segundo sexo","The Second Sex"],
 ["The Ethics of Ambiguity","Pour une morale de l'ambiguïté","Para una moral de la ambigüedad"],
 ["L'Amérique au jour le jour","America Day by Day"]]],
 ["Q601364",["Antonio Caso","Antonio Caso Andrade","Caso, Antonio","Caso Andrade, Antonio"],[
 ["La existencia como economía como desinterés y como caridad","La existencia como economía, desinterés y caridad"],
 ["Positivismo, neopositivismo y fenomenología"],["El problema de México y la ideología nacional"],["La persona humana y el Estado totalitario"]]],
 // Analects is transmitted teaching, not an independently authored book.
 // The Four Books is a later collection including it; never count it separately.
 ["Q4604",["Confucio","Confucius","孔子","Kongzi","Kong Qiu","Kǒng Fūzǐ","孔丘","Kong Fuzi"],[
 ["Analectas","Analectas, Confucio","Analects","The Analects of Confucius","Lunyu","論語"]]],
 ["Q9235",["Georg Wilhelm Friedrich Hegel","G. W. F. Hegel","Hegel, Georg Wilhelm Friedrich","Hegel"],[
 ["Fenomenología del espíritu","Phenomenology of Spirit","Phänomenologie des Geistes"],
 ["Ciencia de la lógica","Science of Logic","Wissenschaft der Logik"],["Principios de la filosofía del derecho","Elements of the Philosophy of Right"]]],
 ["Q9358",["Friedrich Nietzsche","Friedrich Wilhelm Nietzsche","Nietzsche, Friedrich"],[
 ["Más allá del bien y del mal","Beyond Good and Evil","Jenseits von Gut und Böse"],
 ["Así habló Zaratustra","Thus Spoke Zarathustra","Also sprach Zarathustra"],["La genealogía de la moral","On the Genealogy of Morality","Zur Genealogie der Moral"]]]
];
anchors.push(...LATAM_HISTORY_ANCHORS.map(([,qid,names,titles])=>[qid,names,titles]), ...WORLD_HISTORY_ANCHORS.map(([qid,names,titles])=>[qid,names,titles]));
const norm=v=>String(v||"").normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
function creatorName(v){return norm(String(v||"").replace(/,\s*\d{1,4}[? .–—-]+\d{1,4}\s*(?:b\.?\s*c\.?\s*(?:e\.?)?|a\.?\s*c\.?)?\s*$/iu,""));}
// Historical authority heading as supplied by the catalogue, not dates inferred from a title.
function confuciusLifeHeading(v){return /,\s*55[12]\s*[? .–—-]+\s*479\s*(?:a\.?\s*c\.?|b\.?\s*c\.?\s*(?:e\.?)?)\s*$/iu.test(String(v||""));}
function confuciusViaf(v){return /^(?:https?:\/\/(?:www\.)?viaf\.org\/viaf\/)?89664672\/?$/i.test(String(v||"").trim());}
function isCreator(p){
 const role=norm(p?.role||p?.contributorRole||p?.authorRole);
 return !role||["author","autor","autora","creator","creador","creadora","coauthor","coautor","coautora"].includes(role);
}
function oa(v){return String(v||"").match(/^(?:https?:\/\/(?:api\.)?openalex\.org\/(?:authors\/)?)?A?(\d+)$/i)?.[1]||null;}
export function timelineHistoryAuthor(author,works=[]){
 if(!author||typeof author!=="object"||author.wikidataId||author.orcid||author.orcidId)return author;
 const visible=norm(author.displayName||author.name), source=norm(author.sourceDisplayName||author.displayName||author.name);
 const candidates=anchors.filter(([qid,names])=>{
  const keys=names.map(norm);
  return qid==="Q4604"?keys.includes(creatorName(author.displayName||author.name))&&keys.includes(creatorName(author.sourceDisplayName||author.displayName||author.name)):keys.includes(visible)&&keys.includes(source);
 });
 if(candidates.length!==1)return author;
 const [qid,aliases,titles]=candidates[0], names=new Set(aliases.map(norm));
 const linked=new Set([oa(author.openalexId||author.sourceId||author.id),...(Array.isArray(author.linkedAuthorIds)?author.linkedAuthorIds.map(oa):[])].filter(Boolean));
 const groups=titles.map(g=>new Set(g.map(norm))), matched=new Set(), observedIds=new Set();
 const reviewed=REVIEWED_HISTORY_TITLE_FAMILIES[qid];
 const originalGroups=groups.map(g=>new Set(g));
 if(reviewed){
  for(const extension of reviewed.extend){
   const group=groups.find(g=>g.has(norm(extension.base)));
   if(group)for(const title of extension.titles)group.add(norm(title));
  }
  for(const family of reviewed.families)groups.push(new Set(family.map(norm)));
 }
 let reviewedMatch=false;
 if(qid==="Q4604"&&(author.viafId||author.viaf)&&!confuciusViaf(author.viafId||author.viaf))return author;
 let confuciusContext=false;
 let confuciusCorroborated=qid==="Q4604"&&(confuciusViaf(author.viafId||author.viaf)||confuciusLifeHeading(author.sourceDisplayName)||confuciusLifeHeading(author.displayName));
 for(const work of Array.isArray(works)?works:[]){
  const i=groups.findIndex(g=>g.has(norm(work?.title)));
  if(i<0||!Array.isArray(work?.authors))continue;
  if(work.authors.filter(p=>{
   if(!isCreator(p)||!names.has(creatorName(typeof p==="string"?p:p?.name||p?.displayName||p?.sourceDisplayName)))return false;
   const id=oa(p?.openalexId||p?.sourceId||p?.id);
   return !(qid==="Q4604"&&(p?.viafId||p?.viaf)&&!confuciusViaf(p.viafId||p.viaf))&&!(id&&linked.size&&!linked.has(id))&&!p?.orcid&&!p?.orcidId&&(!p?.wikidataId||p.wikidataId===qid);
  }).map(p=>{
   const id=oa(p?.openalexId||p?.sourceId||p?.id);if(id)observedIds.add(id);
   if(qid==="Q4604"&&(confuciusLifeHeading(typeof p==="string"?p:p?.name||p?.displayName||p?.sourceDisplayName)||confuciusViaf(p?.viafId||p?.viaf)))confuciusCorroborated=true;
   // Getty ULAN 500355288 and Open Library OL40315A independently
   // identify these reviewed names with Confucius (VIAF 89664672).
   // A federated Analects record with exact creator metadata supports
   // a contextual panel only, not a canonical corpus identity or authorship.
   if(qid==="Q4604"&&author.catalog==="federated"&&!linked.size&&!id&&
      (work.authorIdentity?.exact===true||work.attributionEvidence==="exact-name")&&
      Array.isArray(work.sourceRecords)&&work.sourceRecords.some(r=>r?.provider==="Internet Archive"&&typeof r.sourceId==="string"&&r.sourceId.trim())&&
      names.has(norm(typeof p==="string"?p:p?.name||p?.displayName||p?.sourceDisplayName)))confuciusContext=true;
   return p;
  }).length){matched.add(i);if(reviewed&&!originalGroups[i]?.has(norm(work.title)))reviewedMatch=true;}
 }
 if(!linked.size&&observedIds.size>1)return author;
 // No unreviewed external authority ID can unlock the newly reviewed variants.
 if(reviewedMatch&&(author.viafId||author.viaf))return author;
 if(qid==="Q4604" ? !(matched.size===1&&(confuciusCorroborated||confuciusContext)) : matched.size<2)return author;
 const scoped={...author,wikidataId:qid,...(qid==="Q4604"&&!names.has(visible)?{displayName:"Confucio"}:{}),...(qid==="Q4604"&&!confuciusCorroborated&&confuciusContext?{historyIdentityContext:"confucius-reviewed-catalogue"}:reviewedMatch?{historyIdentityContext:"reviewed-title-families"}:{})};
 return intellectualHistory(scoped)?scoped:author;
}
