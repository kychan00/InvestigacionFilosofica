import {
  authorNameSignature,
  normalizeAuthorName,
  cleanAuthorDisplayName,
  findSnapshotAuthorCandidates,
  resolveRemoteAuthor
} from "./remote-author-resolution.js";

/*
 * Identity lookup WITHOUT api.openalex.org.
 * Uses the prebuilt author-index-v2/aliases buckets published on GitHub Pages.
 * Those buckets were generated from OpenAlex snapshots hosted on Hugging Face
 * (including CristianPelayo/openalex-philosophy).
 * Wikidata may refine existing resolver candidates; it does not spend
 * OpenAlex API credits.
 */

function normalizedOrcid(value) {
  return String(value||"").replace(/^https?:\/\/orcid\.org\//i,"")
    .trim().toUpperCase();
}

function authorId(value) {
  return String(value||"").match(/(?:^|openalex\.org\/)A?(\d+)$/i)?.[1]||null;
}

export function matchAuthorName(query,candidate) {
  const request=normalizeAuthorName(query);
  if(!request) return "none";
  const names=[candidate?.display_name,
    ...(candidate?.display_name_alternatives||[])];
  if(names.some(name=>authorNameSignature(name)===authorNameSignature(request)))
    return "exact";
  const tokens=request.split(" ").filter(Boolean);
  if(tokens.length<2) return "none";
  return names.some(name=>{
    const words=normalizeAuthorName(name).split(" ").filter(Boolean);
    return tokens.every(token=>words.includes(token));
  })?"partial":"none";
}

function candidateFromIndex(candidate,confidence="snapshot") {
  const id=authorId(candidate?.id);
  return id ? {
    id,
    n:cleanAuthorDisplayName(candidate?.n||candidate?.displayName||""),
    o:candidate?.o||candidate?.orcid||null,
    cw:Math.max(0,Number(candidate?.cw||candidate?.corpusWorks||0)),
    k:confidence,
    source:"huggingface-snapshot"
  }:null;
}

function authorGroup(candidates) {
  const list=[...candidates].sort((a,b)=>
    normalizeAuthorName(b.n).split(" ").length -
      normalizeAuthorName(a.n).split(" ").length ||
    b.cw-a.cw || a.n.localeCompare(b.n,"es"));
  const [primary]=list;
  return {
    ...primary,
    linkedAuthorIds:list.map(x=>x.id),
    aliases:[...new Set(list.map(x=>x.n))]
  };
}

export function chooseSnapshotAuthorIdentity(name,resolution,{orcid=null}={}) {
  const expected=normalizedOrcid(orcid);
  let candidates=[];
  if(resolution?.status==="resolved") {
    const source=resolution.author||{};
    candidates=[candidateFromIndex({
      id:source.id,n:source.sourceDisplayName||source.displayName,
      o:source.orcid,cw:source.corpusWorks
    })].filter(Boolean);
  } else if(resolution?.status==="ambiguous"||
            resolution?.status==="candidates") {
    candidates=(resolution.candidates||[])
      .map(item=>candidateFromIndex(item,item.k))
      .filter(Boolean);
  } else if(resolution?.status==="unavailable") {
    return {status:"unavailable",candidates:[],error:resolution.error};
  }

  const unique=new Map();
  for(const candidate of candidates) {
    if(expected && normalizedOrcid(candidate.o)!==expected) continue;
    if(!unique.has(candidate.id))unique.set(candidate.id,candidate);
  }
  const filtered=[...unique.values()];
  if(!filtered.length) return {status:"none",candidates:[]};
  if(filtered.length===1) {
    return {status:"resolved",
      candidate:authorGroup(filtered),candidates:filtered};
  }

  // A shared ORCID *unambiguously* joins distinct IDs. A name alone
  // never does: another Dinora Hernández can be a different scholar.
  const orcids=new Set(filtered.map(x=>normalizedOrcid(x.o)).filter(Boolean));
  const allHaveOrcid=filtered.every(x=>normalizedOrcid(x.o));
  if(orcids.size===1&&allHaveOrcid) {
    return {status:"resolved",
      candidate:authorGroup(filtered),
      candidates:filtered,
      joinedBy:"orcid"};
  }
  return {status:"ambiguous",candidates:filtered};
}


export async function findSnapshotAuthorIdentity(name,{
  orcid=null,signal,resolverImpl=resolveRemoteAuthor,
  candidatesImpl=findSnapshotAuthorCandidates,
  resolverOptions={}
}={}) {
  const query=String(name||"").trim();
  if(!query) return {status:"none",candidates:[]};
  try {
    // The corpus's alias partitions include exact names, academic titles,
    // given+first-family variants and stable author IDs. Keep every
    // candidate so that homonyms are never silently collapsed.
    // Explicit resolver stubs retain the original integration contract.
    const direct = resolverImpl===resolveRemoteAuthor
      ? await candidatesImpl(query,{...resolverOptions,signal})
      : [];
    const resolution=direct.length
      ? {status:"candidates",candidates:direct}
      : await resolverImpl(query,{
          ...resolverOptions,signal,includeProfile:false
        });
    return {...chooseSnapshotAuthorIdentity(query,resolution,{orcid}),
      provider:"OpenAlex Philosophy · Hugging Face"};
  }catch(error){
    if(signal?.aborted||error?.name==="AbortError") throw error;
    return {status:"unavailable",candidates:[],
      provider:"OpenAlex Philosophy · Hugging Face",
      error:String(error?.message||error)};
  }
}
