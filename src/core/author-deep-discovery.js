import {
  normalizeAuthorName,
  resolveRemoteAuthorCandidate,
  enrichAuthorWorksWithCollaborators
} from "./remote-author-resolution.js";
import { resolveFederatedAuthor } from "./crossref-author-fallback.js?v=20261101-federated-coverage-v1";
import { getCuratedAuthorBibliography } from "./curated-author-bibliography.js?v=20261101-curated-bibliography-v1";

/*
 * Author catalogue policy: NEVER contact api.openalex.org from the
 * application. This is a static author index built from the Hugging Face
 * OpenAlex Philosophy corpus and its mirrored authorship snapshot:
 * data/authors/author-index-v2/{aliases,works}/*.jsonl
 * Crossref / Internet Archive complement the philosophy-only coverage.
 */

const DEFAULT_MAX_WORKS = 5000;
export const AUTHOR_SNAPSHOT_SOURCE = "OpenAlex Philosophy · Hugging Face";

function authorId(value) {
  return String(value || "").match(/(?:openalex\.org\/)?A?(\d+)$/i)?.[1] || null;
}

function fingerprint(work) {
  const id = String(work?.id || work?.openalexId || "")
    .match(/(?:openalex\.org\/)?(W\d+)$/i)?.[1];
  if (id) return "openalex:" + id.toLowerCase();
  const doi = String(work?.doi || "")
    .replace(/^https?:\/\/doi\.org\//i,"")
    .replace(/^doi:/i,"").trim().toLowerCase();
  if (doi) return "doi:" + doi;
  const title = normalizeAuthorName(work?.title || "");
  return title ? "title:" + title + ":" + String(work?.year || "")
    : "unknown:" + String(work?.id || "");
}

function titleFingerprint(work) {
  return normalizeAuthorName(work?.title || "") + ":" + String(work?.year || "");
}

function titleAliases(work) {
  return [work?.title,...(work?.alternativeTitles||[])]
    .map(value=>normalizeAuthorName(value||""))
    .filter(Boolean);
}

function sourceRecords(existing, incoming) {
  const seen=new Set();
  return [...(existing||[]),...(incoming||[])].filter(item=>{
    const key=[item?.provider,item?.sourceId].join("|");
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}

function enrichedWork(work) {
  return {...work,
    relevanceLevel: "Autor",
    relevanceScore: Math.max(90,Number(work.relevanceScore)||98),
    retrievalMode: work.retrievalMode || "author-index"
  };
}

export function mergeAuthorArchives(initial = [], additions = []) {
  const merged = [];
  const byId = new Map();
  const byTitle = new Map();
  const byTitleOnly = new Map();

  const register=(work,index)=>{
    const key=fingerprint(work);
    const titleKey=titleFingerprint(work);
    byId.set(key,index);
    if(titleKey!==":")byTitle.set(titleKey,index);
    for(const alias of titleAliases(work))byTitleOnly.set(alias,index);
  };

  for (const work of [...initial,...additions]) {
    if (!work || !String(work.title || "").trim()) continue;
    const key = fingerprint(work);
    const titleKey = titleFingerprint(work);
    const curated=work.metadataAuthority==="curated"||work.reviewed===true;
    const aliasIndex=curated
      ? titleAliases(work).map(alias=>byTitleOnly.get(alias)).find(index=>index!==undefined)
      : undefined;
    const index = byId.get(key) ??
      (titleKey !== ":" ? byTitle.get(titleKey) : undefined) ??
      aliasIndex;

    if (index === undefined) {
      const enriched=enrichedWork(work);
      merged.push(enriched);
      register(enriched,merged.length-1);
      continue;
    }

    const existing = merged[index];
    const existingCurated=existing.metadataAuthority==="curated"||existing.reviewed===true;
    const preferIncoming =
      (curated && !existingCurated) ||
      Boolean(work.doi && !existing.doi) ||
      Boolean(work.abstract && !existing.abstract);
    const primary = preferIncoming ? work : existing;
    const secondary = preferIncoming ? existing : work;
    const combined = {
      ...secondary,...primary,
      providers:[...new Set([...(existing.providers||[]),...(work.providers||[])])],
      sourceRecords:sourceRecords(existing.sourceRecords,work.sourceRecords),
      authors:primary.authors?.length ? primary.authors : secondary.authors,
      alternativeTitles:[...new Set([
        ...(existing.alternativeTitles||[]),
        ...(work.alternativeTitles||[]),
        existing.title,
        work.title
      ].filter(Boolean))],
      relevanceLevel:"Autor",
      relevanceScore:Math.max(90,Number(primary.relevanceScore)||98),
      retrievalMode:primary.retrievalMode || "author-index"
    };
    merged[index]=combined;
    register(combined,index);
  }
  return merged.sort((a,b)=>
    (Number(b.year)||0)-(Number(a.year)||0) ||
    String(a.title||"").localeCompare(String(b.title||""),"es"));
}

/*
 * Read the full author bucket published with this site. It was generated
 * offline from Hugging Face snapshots and uses zero live OpenAlex API calls.
 * "complete" means complete IN THE INDEX, not complete in the author's life.
 */
export async function fetchAuthorWorksFromSnapshot({
  authorId:requestedId,displayName,orcid,signal,
  linkedAuthorIds=[],
  maxWorks=DEFAULT_MAX_WORKS,
  resolverImpl=resolveRemoteAuthorCandidate,
  collaboratorsImpl=enrichAuthorWorksWithCollaborators,
  enrichCollaborators=true,
  indexOptions={}
}={}) {
  const id=authorId(requestedId);
  if(!id) return {works:[],total:null,complete:false,pages:0,reason:"no-id"};
  if(signal?.aborted) throw new DOMException("Aborted","AbortError");
  const limit=Math.max(1,Math.min(10000,Number(maxWorks)||DEFAULT_MAX_WORKS));
  const ids=[...new Set([id,...linkedAuthorIds.map(authorId).filter(Boolean)])]
    .slice(0,10);
  const responses=await Promise.all(ids.map(async currentId=>
    resolverImpl({
      id:currentId,n:displayName||"Autor",o:orcid||null,cw:0
    },{...indexOptions,signal,limit})));
  if(signal?.aborted) throw new DOMException("Aborted","AbortError");
  const successful=responses.filter(response=>response?.status==="resolved");
  if(!successful.length)
    return {works:[],total:null,complete:false,pages:0,reason:"index-unavailable"};
  let works=mergeAuthorArchives([],successful.flatMap(x=>x.works||[]))
    .slice(0,limit);
  const total=successful.reduce((sum,response)=>
    sum+Math.max(0,Number(response.author?.corpusWorks||0)),0);
  if(enrichCollaborators&&works.length) {
    works=await collaboratorsImpl(works,{
      ...indexOptions,signal,limit:24
    });
  }
  // Distinct author IDs may point to the same publication. Determine
  // index completeness per ID, not by summing counts after deduplication.
  const complete=successful.length===ids.length &&
    successful.every(response=>
      !Number(response.author?.corpusWorks||0) ||
      (response.works||[]).length>=Number(response.author.corpusWorks)) &&
    works.length<limit;
  return {
    works,total:complete?works.length:Math.max(total,works.length),
    complete,pages:successful.length,
    linkedAuthorIds:ids,
    reason:complete?"snapshot-index-complete":"snapshot-index-partial"
  };
}

export async function discoverAuthorArchive({
  author,
  initialWorks=[],
  federatedImpl=resolveFederatedAuthor,
  snapshotImpl=fetchAuthorWorksFromSnapshot,
  signal,
  onProgress=()=>{},
  snapshotOptions={},
  federatedOptions={}
}={}) {
  const name=String(author?.displayName||author?.sourceDisplayName||"").trim();
  const id=authorId(author?.id);
  const orcid=author?.orcid||null;
  const linkedAuthorIds=Array.isArray(author?.linkedAuthorIds)
    ? author.linkedAuthorIds : [];
  const curated=getCuratedAuthorBibliography(author);
  let works=mergeAuthorArchives(initialWorks,curated.works||[]);
  const errors=[];
  const sources=[...new Set([
    ...initialWorks.flatMap(work=>work.providers||[]),
    ...(curated.source?[curated.source]:[])
  ])];
  let snapshotComplete=false;
  let snapshotTotal=null;

  const emit=(source,phase)=>onProgress({
    works:[...works],source,phase,
    sources:[...new Set(sources)],errors:[...errors],
    snapshotComplete,snapshotTotal
  });
  emit(curated.works?.length
    ? "Bibliografía verificada"
    : (id?AUTHOR_SNAPSHOT_SOURCE:"Fuentes federadas"),"started");

  const jobs=[];
  if(id) {
    jobs.push((async()=>{
      try {
        const result=await snapshotImpl({
          authorId:id,displayName:name,orcid,linkedAuthorIds,
          signal,...snapshotOptions
        });
        works=mergeAuthorArchives(works,result.works||[]);
        snapshotComplete=Boolean(result.complete);
        snapshotTotal=result.total;
        if(!sources.includes(AUTHOR_SNAPSHOT_SOURCE))
          sources.push(AUTHOR_SNAPSHOT_SOURCE);
        if(!result.complete && result.reason!=="no-id")
          errors.push("El índice filosófico de Hugging Face tiene cobertura parcial para este autor.");
      }catch(error){
        if(signal?.aborted) throw error;
        errors.push("Índice Hugging Face: "+String(error.message||"No disponible"));
      }
      emit(AUTHOR_SNAPSHOT_SOURCE,"settled");
    })());
  }

  if(name) {
    jobs.push((async()=>{
      try {
        const federated=await federatedImpl(name,{
          signal,orcid,aliases:author?.aliases||[],limit:150,...federatedOptions
        });
        if(federated.status==="resolved") {
          works=mergeAuthorArchives(works,federated.works);
          sources.push(...(federated.author?.catalogSources||["Crossref","Internet Archive"]));
        } else if(federated.status==="unavailable") {
          errors.push("Fuentes complementarias temporalmente no disponibles.");
        }
      }catch(error){
        if(signal?.aborted) throw error;
        errors.push("Fuentes complementarias: "+String(error.message||"No disponibles"));
      }
      emit("Crossref / Internet Archive / CUCSH Filosofía","settled");
    })());
  }
  const results=await Promise.allSettled(jobs);
  if(signal?.aborted||results.some(item=>
    item.status==="rejected"&&item.reason?.name==="AbortError"))
    throw new DOMException("Aborted","AbortError");

  return {
    works,sources:[...new Set(sources)],errors,
    snapshotComplete,snapshotTotal,
    // Curated coverage improves the archive but does not claim a universal bibliography.
    curatedWorks:curated.works?.length||0,
    complete:false
  };
}
