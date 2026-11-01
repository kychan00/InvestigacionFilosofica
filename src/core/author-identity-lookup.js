import {
  authorNameSignature,
  normalizeAuthorName
} from "./remote-author-resolution.js";

/*
 * The compact philosophy index is not an identity directory for every
 * researcher. Search OpenAlex authors first when the shared URL has only a
 * name, and never merge different people merely because names are similar.
 */

const BASE = "https://api.openalex.org/";
const PAGE_SIZE = 50;
const TIMEOUT = 9000;

function normalizedOrcid(value) {
  return String(value || "")
    .replace(/^https?:\/\/orcid\.org\//i, "")
    .trim().toUpperCase();
}

function authorId(value) {
  return String(value || "")
    .match(/(?:^|openalex\.org\/)A?(\d+)$/i)?.[1] || null;
}

export function matchAuthorName(query, candidate) {
  const request = normalizeAuthorName(query);
  if (!request) return "none";
  const names = [candidate?.display_name,
    ...(candidate?.display_name_alternatives || [])];
  const exact = names.some(name =>
    authorNameSignature(name) === authorNameSignature(request));
  if (exact) return "exact";

  // "Dinora Hernández" can refer to "Dinora Hernández López".
  // Treat a longer compatible name as a *possible* identity only;
  // auto-select it only if no other matching candidate exists.
  const tokens = request.split(" ").filter(Boolean);
  if (tokens.length < 2) return "none";
  return names.some(name => {
    const words = normalizeAuthorName(name).split(" ").filter(Boolean);
    return tokens.every(token => words.includes(token));
  }) ? "partial" : "none";
}

function candidateFromAuthor(author, confidence) {
  return {
    id: authorId(author.id),
    n: String(author.display_name || "").trim(),
    o: author.orcid || null,
    cw: Math.max(0, Number(author.works_count || 0)),
    k: confidence,
    affiliation: (author.last_known_institutions || [])
      .map(place => String(place?.display_name || "").trim())
      .filter(Boolean).slice(0, 2).join(" · "),
    source: "openalex-live"
  };
}

export function chooseLiveAuthorIdentity(query, authors = [], options = {}) {
  const expectedOrcid = normalizedOrcid(options.orcid);
  const matches = [];
  const ids = new Set();

  for (const author of authors) {
    const id = authorId(author.id);
    if (!id || ids.has(id)) continue;
    const observedOrcids = [
      author.orcid, ...(author.observed_orcids || [])
    ].map(normalizedOrcid).filter(Boolean);
    if (expectedOrcid && !observedOrcids.includes(expectedOrcid))
      continue;
    const confidence = expectedOrcid ? "orcid" : matchAuthorName(query, author);
    if (confidence === "none") continue;
    ids.add(id);
    matches.push(candidateFromAuthor(author, confidence));
  }
  const priority = {orcid: 0, exact: 1, partial: 2};
  matches.sort((a,b) =>
    priority[a.k] - priority[b.k] ||
    b.cw - a.cw ||
    a.n.localeCompare(b.n, "es"));

  const strongest = matches.filter(m => m.k === matches[0]?.k);
  const totalReported = Number(options.totalReported || 0);
  const mayBeTruncated = totalReported > authors.length;

  if (strongest.length === 1 && !mayBeTruncated) {
    return {status:"resolved",candidate:strongest[0],candidates:matches};
  }
  if (matches.length) {
    return {
      status:"ambiguous",
      candidates:matches.slice(0,20),
      explanation:mayBeTruncated
        ? "La lista de identidades podría ser parcial."
        : "Hay varias identidades posibles."
    };
  }
  return {status:"none",candidates:[]};
}

async function getJson(url,{fetchImpl,signal,timeoutMs}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if(signal?.aborted) throw new DOMException("Aborted","AbortError");
  signal?.addEventListener("abort",abort,{once:true});
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetchImpl(url,{
      signal:controller.signal,headers:{Accept:"application/json"}
    });
    if(!response.ok) throw new Error("OpenAlex HTTP "+response.status);
    return await response.json();
  } catch(error) {
    if(signal?.aborted) throw new DOMException("Aborted","AbortError");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort",abort);
  }
}

export async function findOpenAlexAuthorIdentity(name,{
  orcid=null,signal,fetchImpl=globalThis.fetch,
  apiBase=BASE,timeoutMs=TIMEOUT
}={}) {
  const query=String(name||"").trim();
  if(!query) return {status:"none",candidates:[]};
  const url=new URL("authors",apiBase);
  const expectedOrcid=normalizedOrcid(orcid);
  if(expectedOrcid) url.searchParams.set("filter","orcid:"+expectedOrcid);
  else url.searchParams.set("search",query);
  url.searchParams.set("per_page",String(PAGE_SIZE));
  url.searchParams.set("select",[
    "id","display_name","display_name_alternatives","orcid",
    "observed_orcids","works_count","last_known_institutions"
  ].join(","));
  try {
    const data=await getJson(url,{fetchImpl,signal,timeoutMs});
    const result=chooseLiveAuthorIdentity(query,data?.results||[],{
      orcid,totalReported:data?.meta?.count||0
    });
    return {...result,provider:"OpenAlex",searchUrl:url.toString()};
  } catch(error) {
    if(signal?.aborted) throw error;
    return {status:"unavailable",candidates:[],
      provider:"OpenAlex",error:String(error?.message||error)};
  }
}
