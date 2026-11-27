import { WORLD_HISTORY_ANCHORS } from "./world-history-anchors.js?v=20261127-world-v1";
import { LATAM_HISTORY_ANCHORS } from "./latin-american-history-anchors.js?v=20261127-latam-v1";
import { intellectualHistory } from "./author-intellectual-history.js?v=20261127-v5";
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
 ["Q4604",["Confucio","Confucius","孔子","Kongzi"],[
 ["Analectas","Analectas, Confucio","Analects","The Analects of Confucius","Lunyu","論語"],
 ["Los cuatro libros","The Four Books","四書"]]],
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
function isCreator(p){
 const role=norm(p?.role||p?.contributorRole||p?.authorRole);
 return !role||["author","autor","autora","creator","creador","creadora","coauthor","coautor","coautora"].includes(role);
}
function oa(v){return String(v||"").match(/^(?:https?:\/\/(?:api\.)?openalex\.org\/(?:authors\/)?)?A?(\d+)$/i)?.[1]||null;}
export function timelineHistoryAuthor(author,works=[]){
 if(!author||typeof author!=="object"||author.wikidataId||author.orcid||author.orcidId)return author;
 const visible=norm(author.displayName||author.name), source=norm(author.sourceDisplayName||author.displayName||author.name);
 const candidates=anchors.filter(([,names])=>names.map(norm).includes(visible)&&names.map(norm).includes(source));
 if(candidates.length!==1)return author;
 const [qid,aliases,titles]=candidates[0], names=new Set(aliases.map(norm));
 const linked=new Set([oa(author.openalexId||author.sourceId||author.id),...(Array.isArray(author.linkedAuthorIds)?author.linkedAuthorIds.map(oa):[])].filter(Boolean));
 const groups=titles.map(g=>new Set(g.map(norm))), matched=new Set();
 for(const work of Array.isArray(works)?works:[]){
  const i=groups.findIndex(g=>g.has(norm(work?.title)));
  if(i<0||matched.has(i)||!Array.isArray(work?.authors))continue;
  if(work.authors.some(p=>{
   if(!isCreator(p)||!names.has(creatorName(typeof p==="string"?p:p?.name||p?.displayName||p?.sourceDisplayName)))return false;
   const id=oa(p?.openalexId||p?.sourceId||p?.id);
   return !(id&&linked.size&&!linked.has(id))&&!p?.orcid&&!p?.orcidId&&(!p?.wikidataId||p.wikidataId===qid);
  }))matched.add(i);
 }
 if(matched.size<2)return author;
 const scoped={...author,wikidataId:qid};
 return intellectualHistory(scoped)?scoped:author;
}
