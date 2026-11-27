// Authority names and catalogue spellings; never merge OpenAlex IDs by name.
// The Spanish UI displays a canonical name while retaining source metadata.
const authorities=[
  {qid:"Q859",displayName:"Platón",aliases:["Platón","Plato","Plato Plato","Πλάτων"],searchNames:["Platón","Plato"],description:"Filósofo griego de la Antigüedad",wiki:"Platón"},
  {qid:"Q868",displayName:"Aristóteles",aliases:["Aristóteles","Aristotle","Aristoteles","Aristotle Aristotle","Ἀριστοτέλης"],searchNames:["Aristóteles","Aristotle"],description:"Filósofo griego de la Antigüedad",wiki:"Aristóteles"}
];
const key=value=>String(value||"").normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/\s+/g," ").trim();
export function classicalAuthority(value) {
  const name=key(value);
  return authorities.find(a=>a.aliases.some(alias=>key(alias)===name))||null;
}
export function classicalAuthorAuthority(author) {
  if(!author || author.orcid || author.orcidId || (!author.id&&!author.wikidataId)) return null;
  const visible=classicalAuthority(author.displayName);
  const source=classicalAuthority(author.sourceDisplayName||author.displayName);
  if(!visible||visible!==source||(author.wikidataId&&author.wikidataId!==visible.qid))return null;
  return visible;
}
export function localizeClassicalAuthor(author) {
  const authority=classicalAuthorAuthority(author);
  if(!authority)return author;
  return {...author,displayName:authority.displayName,
    sourceDisplayName:author.sourceDisplayName||author.displayName,
    aliases:[...new Set([...authority.searchNames,...(author.aliases||[]),author.displayName,author.sourceDisplayName].filter(value=>value && !/^(\S+)\s+\1$/iu.test(value)))],
    // Source QID is retained if present. Reviewed authority links enrich the
    // UI without replacing the original bibliographic identifier.
    wikidataId:authority.qid,
    biography:author.biography||authority.description,
    wikipediaUrl:author.wikipediaUrl||"https://es.wikipedia.org/wiki/"+encodeURIComponent(authority.wiki)
  };
}
// Catalogue authority headings sometimes append BCE dates. Strip only an
// explicit numeric ancient-life qualifier for a reviewed mononym.
export function classicalCreatorAlias(value) {
  const raw=String(value||"").trim();
  const exact=classicalAuthority(raw);
  if(exact)return exact;
  const dated=raw.match(/^(.+?),\s*[0-9? .–—-]+\s*(?:b\.?\s*c\.?\s*(?:e\.?)?|a\.?\s*c\.?|antes de cristo)$/iu);
  return dated?classicalAuthority(dated[1]):null;
}
