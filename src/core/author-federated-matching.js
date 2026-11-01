import {
  normalizeAuthorName,
  cleanAuthorDisplayName
} from "./remote-author-resolution.js";

/*
 * Federated catalogue names are not uniformly structured. Archive.org may
 * publish several creators as ONE string; treat those as evidence of a
 * collective work, not as evidence of a single-author publication.
 * Keep false positives out: a name appearing in the title or description
 * alone is not enough to claim authorship.
 */
const HONORIFIC = /^(?:(?:dra?|doctor(?:a)?|prof(?:esora|esor)?|lic(?:enciada|enciado)?|mtr[oa])\.?\s+)+/iu;
const COLLECTIVE = /\b(coordinadores?|coordinadoras?|co-?editors?|editores?|editoras?|compiladores?|compiladoras?|colaboradores?|colaboradoras?|y varios|et al)\b/iu;

function plain(value) {
  return normalizeAuthorName(value);
}

export function normalizeAuthorAliases(name, aliases = []) {
  const values = [name, ...aliases]
    .map(value => cleanAuthorDisplayName(value).replace(HONORIFIC, "").trim())
    .filter(Boolean);
  const seen = new Set();
  return values.filter(value => {
    const key = plain(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

export function splitCreatorMetadata(authors = []) {
  return (authors || []).flatMap(author => {
    const raw=String(author?.name||"").trim();
    if (!raw) return [];
    const parts=raw.split(/\s*[,;]\s*/).filter(Boolean);
    // A two-part "Surname, Given" is ambiguous and remains intact.
    const split=parts.length >= 3 ||
      (parts.length === 2 && parts.every(part =>
        plain(part).split(" ").filter(Boolean).length >= 2));
    return (split ? parts : [raw]).map(name => ({
      ...author,name:name.replace(/\s+(?:y colaboradores?|coordinadores?|coordinadoras?)$/iu,"").trim(),
      rawCreator: raw,
      creatorComposite: split || COLLECTIVE.test(raw)
    })).filter(item => item.name);
  });
}

function orcid(value) {
  const input=String(value||"").trim();
  return /(?:orcid\.org\/)?(\d{4}-\d{4}-\d{4}-[\dX]{4})$/i.exec(input)?.[1]?.toUpperCase()||"";
}

function prefixedName(candidate, expected) {
  const actual = plain(candidate).split(" ").filter(Boolean);
  const wanted = plain(expected).split(" ").filter(Boolean);
  if(wanted.length < 2 || actual.length <= wanted.length ||
    actual.length > wanted.length + 2) return false;
  return wanted.every((token,index) => actual[index]===token);
}

export function matchFederatedWork(work, name, {
  aliases=[],expectedOrcid=null
}={}) {
  const variants=normalizeAuthorAliases(name,aliases);
  const knownOrcid=orcid(expectedOrcid);
  const all=splitCreatorMetadata(work?.authors||[]);
  let best=null;
  for(const creator of all) {
    const candidate=plain(creator.name);
    const observedOrcid=orcid(creator.orcid||creator.id);
    if(knownOrcid && observedOrcid && knownOrcid!==observedOrcid)continue;
    const exact=variants.some(value=>candidate===plain(value));
    const longer=variants.some(value=>prefixedName(creator.name,value));
    // Concatenated creator strings must have explicit collective markers
    // to avoid classifying unrelated authors based on mere word overlap.
    const collective=COLLECTIVE.test(creator.rawCreator||"") ||
      COLLECTIVE.test(String(work?.title||""));
    const embedded=variants.some(value => {
      const stem=plain(value),full=plain(creator.name);
      return stem.split(" ").length>=2 && full.startsWith(stem+" ") &&
        collective;
    });
    const byOrcid=Boolean(knownOrcid && observedOrcid===knownOrcid);
    if(!exact && !longer && !embedded && !byOrcid)continue;
    const score=byOrcid?4:exact?3:longer?2:1;
    if(!best||score>best.score) {
      const display=exact?creator.name:
        (longer && !collective ? creator.name :
          variants.sort((a,b)=>plain(b).length-plain(a).length)[0]);
      best={matchedAuthor:creator,score,displayName:display,
        identityEvidence:byOrcid?"orcid":exact?"exact-name":
          embedded?"collective-creator":"name-variant"};
    }
  }
  if(!best)return null;
  const collective=all.length>1 ||
    all.some(item => COLLECTIVE.test(item.rawCreator||"")) ||
    COLLECTIVE.test(String(work?.title||""));
  // A structured list of authors, or an explicit "coordinadores" marker,
  // is evidence of collaboration; an incomplete single creator is NOT
  // evidence of sole authorship.
  const matched=all.find(x=>x===best.matchedAuthor);
  const compositeStatement=all.length===1 &&
    all[0]?.creatorComposite && collective
    ? all[0].rawCreator : null;
  // A source may concatenate multiple coordinators into ONE creator.
  // Never turn the concatenated string into a clickable person name.
  const authors=all.length>1 ? all : compositeStatement
    ? [{
        id:best.matchedAuthor?.id||null,
        name:best.displayName,
        role:"coordinación",
        originalCreatorStatement:compositeStatement
      }] : (work?.authors||[]);
  return {
    ...work,
    authors,
    creatorStatement:compositeStatement,
    matchedAuthor:matched||best.matchedAuthor,
    matchedAuthorEvidence:best.identityEvidence,
    matchedAuthorDisplayName:best.displayName,
    attributionEvidence:best.identityEvidence,
    collectiveWork:collective,
    coauthorCount:collective ? Math.max(1,all.length-1) :
      work?.coauthorCount ?? null
  };
}

export function discoveredAuthorVariants(works, searchedName, aliases=[]) {
  const known=normalizeAuthorAliases(searchedName,aliases);
  const names=[];
  const prefix=plain(searchedName).split(" ").filter(Boolean);
  for(const work of works) {
    for(const author of splitCreatorMetadata(work.authors||[])) {
      const tokens=plain(author.name).split(" ").filter(Boolean);
      if(prefix.length<2||tokens.length<=prefix.length||tokens.length>4 ||
        !prefix.every((part,index)=>part===tokens[index]))continue;
      if(COLLECTIVE.test(author.name))continue;
      names.push(author.name);
    }
  }
  return normalizeAuthorAliases(searchedName,[...aliases,...names])
    .filter(value=>!known.some(old=>plain(old)===plain(value)))
    .slice(0,3);
}
