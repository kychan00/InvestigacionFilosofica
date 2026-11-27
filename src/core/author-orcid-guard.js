// A valid ORCID identifies its registrant, not every bibliographic attribution.
import { normalizedAuthorOrcid } from "./author-provenance.js";

const fold=value=>String(value||"").normalize("NFKD").replace(/\p{M}/gu,"")
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
function orderedName(value){
  const raw=String(value||"").trim();
  const parts=raw.split(",");
  const name=parts.length===2 && parts.every(p=>p.trim()) ? parts[1]+" "+parts[0] : raw;
  return fold(name).replace(/^(?:dr|dra|doctor|doctora|prof|profesor|profesora) /,"");
}
const rejected=[
  {orcid:"0000-0003-0282-8605",names:["walter benjamin","walter bendix schonflies benjamin","walter benedix schonflies benjamin"],
    authority:"Q61078",evidence:"https://doi.org/10.5194/tc-14-1779-2020"}
];
export function rejectedAuthorOrcid(name,id){
  const o=normalizedAuthorOrcid(id);
  return rejected.some(x=>x.orcid===o && x.names.includes(orderedName(name)));
}
export function sanitizeAuthorOrcid(author){
  if(!author)return author;
  const name=author.displayName||author.name||author.sourceDisplayName;
  if(!rejectedAuthorOrcid(name,author.orcid))return author;
  return {...author,orcid:null,orcidId:null,orcidProfile:null,orcidConflict:true,
    linkedAuthorIds:author.id?[author.id]:[],
    aliases:(author.aliases||[]).filter(alias=>orderedName(alias)===orderedName(name))};
}
export function profileMatchesOrderedAuthor(author,profile){
  if(!author||!profile)return false;
  const expected=orderedName(author.displayName||author.name||author.sourceDisplayName);
  if(!expected||rejectedAuthorOrcid(expected,author.orcid))return false;
  const given=profile.givenName||profile.givenNames;
  const structured=given&&profile.familyName?orderedName(given+" "+profile.familyName):"";
  const names=[structured,orderedName(profile.displayName),orderedName(profile.creditName),
    ...(profile.otherNames||[]).map(orderedName)].filter(Boolean);
  // Never accept an arbitrary permutation of given and family names.
  // Explicit comma-separated library names are normalized above.
  return names.includes(expected);
}
export function removeRejectedWorkOrcid(work,author){
  if(!work)return work;
  const clean=person=>{
    if(!person||typeof person!=="object")return person;
    const name=person.name||person.displayName||author?.displayName;
    return rejectedAuthorOrcid(name,person.orcid||person.orcidId)
      ? {...person,orcid:null,orcidId:null}:person;
  };
  return {...work,...(Array.isArray(work.authors)?{authors:work.authors.map(clean)}:{}),
    ...(work.authorIdentity?{authorIdentity:clean(work.authorIdentity)}:{})};
}
