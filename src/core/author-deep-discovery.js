import { normalizeAuthorName } from "./remote-author-resolution.js";
import { resolveFederatedAuthor } from "./crossref-author-fallback.js";
import { normalizeOpenAlexWork } from "../sources/openalex.js";

const DEFAULT_MAX_WORKS = 5000;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_TIMEOUT_MS = 15000;

function cleanOrcid(value) {
  return String(value || "").replace(/^https?:\/\/orcid\.org\//i, "")
    .trim().toUpperCase();
}

function openAlexAuthorId(value) {
  return String(value || "").match(/(?:openalex\.org\/)?A?(\d+)$/i)?.[1] || null;
}

function fingerprint(work) {
  const id = String(work?.id || work?.openalexId || "")
    .match(/(?:openalex\.org\/)?(W\d+)$/i)?.[1];
  if (id) return "openalex:" + id.toLowerCase();
  const doi = String(work?.doi || "")
    .replace(/^https?:\/\/doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .trim().toLowerCase();
  if (doi) return "doi:" + doi;
  const title = normalizeAuthorName(work?.title || "");
  return title
    ? "title:" + title + ":" + String(work?.year || "")
    : "unknown:" + String(work?.id || "");
}

function titleFingerprint(work) {
  return normalizeAuthorName(work?.title || "") + ":" + String(work?.year || "");
}

function enrichedWork(work) {
  return {
    ...work,
    relevanceLevel: "Autor",
    relevanceScore: Math.max(90, Number(work.relevanceScore) || 98),
    retrievalMode: "author-live"
  };
}

export function mergeAuthorArchives(initial = [], additions = []) {
  const merged = [];
  const byId = new Map();
  const byTitle = new Map();
  for (const work of [...initial, ...additions]) {
    if (!work || !String(work.title || "").trim()) continue;
    const key = fingerprint(work);
    const titleKey = titleFingerprint(work);
    const index = byId.get(key) ?? (titleKey !== ":" ? byTitle.get(titleKey) : undefined);
    if (index === undefined) {
      const current = enrichedWork(work);
      byId.set(key, merged.length);
      if (titleKey !== ":") byTitle.set(titleKey, merged.length);
      merged.push(current);
    } else {
      // Prefer the record with an actual DOI/abstract, without discarding the original ID.
      const existing = merged[index];
      const preferIncoming = Boolean(work.doi && !existing.doi) ||
        Boolean(work.abstract && !existing.abstract);
      const primary = preferIncoming ? work : existing;
      const secondary = preferIncoming ? existing : work;
      merged[index] = {
        ...secondary, ...primary,
        providers: [...new Set([...(existing.providers || []), ...(work.providers || [])])],
        authors: primary.authors?.length ? primary.authors : secondary.authors,
        relevanceLevel: "Autor",
        relevanceScore: Math.max(90, Number(primary.relevanceScore) || 98),
        retrievalMode: "author-live"
      };
      byId.set(key, index);
    }
  }
  return merged.sort((a,b)=>
    (Number(b.year)||0) - (Number(a.year)||0) ||
    String(a.title||"").localeCompare(String(b.title||""),"es")
  );
}

function verifiedOpenAlexAuthor(work, id, orcid) {
  const expectedOrcid = cleanOrcid(orcid);
  return (work.authorships || []).some(entry => {
    const entryId = openAlexAuthorId(entry?.author?.id);
    const observedOrcid = cleanOrcid(entry?.author?.orcid);
    return Boolean(id && entryId === id) ||
      Boolean(expectedOrcid && observedOrcid && observedOrcid === expectedOrcid);
  });
}

function withVerifiedAuthor(record, displayName, id, orcid) {
  const authors = record.authors || [];
  return {
    ...record,
    authors: authors.length ? authors : [{
      id: id ? "https://openalex.org/A" + id : null,
      name: displayName,
      orcid: orcid || null
    }],
    authorIdentity: {
      id, displayName,
      orcid: orcid || null,
      exact: true,
      metadataSource: "OpenAlex live"
    }
  };
}

async function fetchJson(url, {fetchImpl, signal, timeoutMs}) {
  const controller = new AbortController();
  const relay = () => controller.abort();
  if (signal?.aborted) throw new DOMException("Aborted","AbortError");
  signal?.addEventListener("abort",relay,{once:true});
  const timer = setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response = await fetchImpl(url,{
      signal:controller.signal,
      headers:{Accept:"application/json"}
    });
    if (!response.ok) {
      const error = new Error("OpenAlex HTTP " + response.status);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } catch(error) {
    if(signal?.aborted) throw new DOMException("Aborted","AbortError");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort",relay);
  }
}

/*
 * OpenAlex's author ID is the reliable relationship; name-only work searches
 * can return texts about the philosopher, not written by that philosopher.
 * The cursor scan continues until OpenAlex signals the final page or the cap
 * is reached. All fetched records are rechecked for that authorship ID/ORCID.
 */
export async function fetchAuthorWorksOpenAlex({
  authorId, displayName, orcid,
  fetchImpl = globalThis.fetch,
  signal,
  onPage = () => {},
  maxWorks = DEFAULT_MAX_WORKS,
  pageSize = DEFAULT_PAGE_SIZE,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  apiBase = "https://api.openalex.org/"
} = {}) {
  const id = openAlexAuthorId(authorId);
  if (!id) return {works:[], total:null, complete:false, pages:0, reason:"no-id"};
  const works = [];
  const size = Math.max(1,Math.min(100,Number(pageSize)||DEFAULT_PAGE_SIZE));
  const ceiling = Math.max(1,Math.min(10000,Number(maxWorks)||DEFAULT_MAX_WORKS));
  let cursor = "*";
  let pages = 0;
  let total = null;
  let complete = false;
  const seenCursors = new Set();

  while (works.length < ceiling && !seenCursors.has(cursor)) {
    if (signal?.aborted) throw new DOMException("Aborted","AbortError");
    seenCursors.add(cursor);
    const url = new URL("works",apiBase);
    url.searchParams.set("filter","authorships.author.id:A"+id);
    url.searchParams.set("corpus","all");
    url.searchParams.set("per_page",String(size));
    url.searchParams.set("cursor",cursor);
    url.searchParams.set("select",[
      "id","title","display_name","publication_year","publication_date","type",
      "language","doi","authorships","primary_location","open_access",
      "best_oa_location","cited_by_count"
    ].join(","));
    const data = await fetchJson(url,{fetchImpl,signal,timeoutMs});
    pages++;
    if (Number.isFinite(Number(data?.meta?.count))) total = Number(data.meta.count);
    const rows = Array.isArray(data?.results)?data.results:[];
    const verified = rows
      .filter(item=>verifiedOpenAlexAuthor(item,id,orcid))
      .map(item=>({
        ...withVerifiedAuthor(normalizeOpenAlexWork(item),displayName,id,orcid),
        publicationDate:item.publication_date || null
      }));
    works.push(...verified.slice(0,ceiling-works.length));
    onPage({works:[...works],pages,total,source:"OpenAlex"});
    const next = data?.meta?.next_cursor;
    if (!rows.length || !next || next === cursor) {
      complete = true;
      break;
    }
    cursor = next;
  }

  return {works,total,complete,pages,reason:complete?"finished":"limit"};
}

/*
 * Every profile starts with the existing philosophy index and explicitly
 * enriches it from external catalogs, even if the index reports only 2 works.
 * Publication counts describe the retrieved corpus, never claim total output.
 */
export async function discoverAuthorArchive({
  author,
  initialWorks = [],
  fetchImpl = globalThis.fetch,
  federatedImpl = resolveFederatedAuthor,
  signal,
  onProgress = () => {},
  openAlexOptions = {},
  federatedOptions = {}
} = {}) {
  const name = String(author?.displayName || author?.sourceDisplayName || "").trim();
  const id = openAlexAuthorId(author?.id);
  const orcid = author?.orcid || null;
  let works = mergeAuthorArchives(initialWorks,[]);
  const errors = [];
  const sources = [];
  let openAlexComplete = false;
  let openAlexTotal = null;

  const emit = (source,phase) => onProgress({
    works:[...works], source, phase,
    sources:[...sources],errors:[...errors],
    openAlexTotal, openAlexComplete
  });
  emit("Índice de filosofía","started");

  const jobs = [];

  if (id) {
    jobs.push((async()=>{
      try {
        const result = await fetchAuthorWorksOpenAlex({
          authorId:id,displayName:name,orcid,fetchImpl,signal,
          ...openAlexOptions,
          onPage:({works:found,total})=>{
            works=mergeAuthorArchives(works,found);
            openAlexTotal=total;
            emit("OpenAlex","loading");
          }
        });
        openAlexComplete=result.complete;
        openAlexTotal=result.total;
        sources.push("OpenAlex");
        if (!result.complete) errors.push("OpenAlex: consulta parcial; límite de resultados alcanzado.");
      } catch(error) {
        if(signal?.aborted) throw error;
        errors.push("OpenAlex: "+String(error.message||"No disponible"));
      }
      emit("OpenAlex","settled");
    })());
  }

  if (name) {
    jobs.push((async()=>{
      try {
        const federated=await federatedImpl(name,{
          signal,orcid,limit:150,...federatedOptions
        });
        if(federated.status==="resolved") {
          works=mergeAuthorArchives(works,federated.works);
          sources.push(...(federated.author?.catalogSources||["Crossref / Internet Archive"]));
        } else if(federated.status==="unavailable") {
          errors.push("Fuentes federadas temporalmente no disponibles.");
        }
      } catch(error) {
        if(signal?.aborted) throw error;
        errors.push("Fuentes federadas: "+String(error.message||"No disponibles"));
      }
      emit("Crossref / Internet Archive","settled");
    })());
  }

  const results=await Promise.allSettled(jobs);
  if(signal?.aborted||results.some(item=>item.status==="rejected"&&item.reason?.name==="AbortError"))
    throw new DOMException("Aborted","AbortError");
  return {works,sources:[...new Set(sources)],errors,openAlexComplete,openAlexTotal,
    complete:openAlexComplete && errors.length===0};
}
