import {
  authorNameSignature,
  normalizeAuthorName,
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
    id,n:String(candidate?.n||candidate?.displayName||"").trim(),
    o:candidate?.o||candidate?.orcid||null,
    cw:Math.max(0,Number(candidate?.cw||candidate?.corpusWorks||0)),
    k:confidence,
    source:"huggingface-snapshot"
  }:null;
}

export function chooseSnapshotAuthorIdentity(name,resolution,{orcid=null}={}) {
  const expected=normalizedOrcid(orcid);
  if(resolution?.status==="resolved") {
    const source=resolution.author||{};
    const candidate=candidateFromIndex({
      id:source.id,n:source.sourceDisplayName||source.displayName,
      o:source.orcid,cw:source.corpusWorks
    });
    if(!candidate) return {status:"none",candidates:[]};
    if(expected&&normalizedOrcid(candidate.o)!==expected)
      return {status:"none",candidates:[]};
    return {status:"resolved",candidate,candidates:[candidate]};
  }
  if(resolution?.status==="ambiguous"){
    const candidates=(resolution.candidates||[])
      .map(item=>candidateFromIndex(item))
      .filter(Boolean)
      .filter(item=>!expected||normalizedOrcid(item.o)===expected);
    if(candidates.length===1)
      return {status:"resolved",candidate:candidates[0],candidates};
    return candidates.length
      ? {status:"ambiguous",candidates}
      : {status:"none",candidates:[]};
  }
  if(resolution?.status==="unavailable")
    return {status:"unavailable",candidates:[],error:resolution.error};
  return {status:"none",candidates:[]};
}

export async function findSnapshotAuthorIdentity(name,{
  orcid=null,signal,resolverImpl=resolveRemoteAuthor,
  resolverOptions={}
}={}) {
  const query=String(name||"").trim();
  if(!query) return {status:"none",candidates:[]};
  try {
    const resolution=await resolverImpl(query,{
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
