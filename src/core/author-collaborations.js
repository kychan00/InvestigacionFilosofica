import {normalizeAuthorName} from "./remote-author-resolution.js";

function id(value) {
  return String(value||"").match(/(?:openalex\.org\/)?A?(\d+)$/i)?.[1]||null;
}
function orcid(value) {
  return String(value||"").replace(/^https?:\/\/orcid\.org\//i,"")
    .trim().toUpperCase();
}

export function workCollaboration(work, author={}) {
  const primaryIds = new Set([author.id,...(author.linkedAuthorIds||[])]
    .map(id).filter(Boolean));
  const expectedOrcid=orcid(author.orcid);
  const canonical=normalizeAuthorName(author.displayName);
  const aliases=new Set([canonical,...(author.aliases||[])
    .map(normalizeAuthorName)].filter(Boolean));
  const authors=Array.isArray(work.authors)?work.authors:[];
  const primary=authors.find(entry=>{
    const currentId=id(entry?.id);
    const currentOrcid=orcid(entry?.orcid||entry?.id);
    return (currentId&&primaryIds.has(currentId)) ||
      (expectedOrcid&&currentOrcid===expectedOrcid) ||
      (!currentId&&!currentOrcid&&aliases.has(normalizeAuthorName(entry?.name)));
  });
  const others=authors.filter(entry=>{
    if(!entry?.name) return false;
    if(entry===primary) return false;
    const currentId=id(entry.id),currentOrcid=orcid(entry.orcid||entry.id);
    return !(currentId&&primaryIds.has(currentId)) &&
      !(expectedOrcid&&currentOrcid===expectedOrcid);
  });
  const count=Number(work.coauthorCount);
  const fromSnapshot=work.coauthorCount!==null &&
    work.coauthorCount!==undefined && Number.isInteger(count);
  const total=Math.max(others.length,fromSnapshot?Math.max(0,count):0);
  const hasPrimary=Boolean(primary)||Boolean(work.authorIdentity?.exact)||
    (Array.isArray(work.authors)&&work.authors.length>0 &&
      work.retrievalMode==="author-index");
  let kind="unknown";
  if(hasPrimary && (total>0||authors.length>1))kind="collaboration";
  else if(hasPrimary&&fromSnapshot&&total===0)kind="individual";
  else if(hasPrimary&&authors.length===1&&work.retrievalMode!=="author-index")
    kind="individual";
  return {kind,count:kind==="collaboration"?total:0,coauthors:others};
}

export function summarizeAuthorCollaborations(author,works=[]) {
  const values={individual:0,collaboration:0,unknown:0};
  const collaborators=new Map();
  for(const work of works){
    const value=workCollaboration(work,author);
    values[value.kind]++;
    if(value.kind!=="collaboration")continue;
    for(const member of value.coauthors) {
      const key=id(member.id)||orcid(member.orcid||member.id)||
        normalizeAuthorName(member.name);
      if(!key)continue;
      const current=collaborators.get(key);
      collaborators.set(key,{key,name:member.name,
        id:member.id||null,orcid:member.orcid||null,
        count:(current?.count||0)+1});
    }
  }
  return {...values,collaborators:[...collaborators.values()]
    .sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,"es"))};
}
