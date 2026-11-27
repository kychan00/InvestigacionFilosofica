/**
 * SIVA · Public author portrait policy. Names discover candidates, never establish identity.
 * Wikidata is an identity bridge, Commons is the media/license authority.
 * The application code is MIT; media retains its original license.
 */
const WD = "https://www.wikidata.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
export const PORTRAIT_MAX_BYTES = 256 * 1024;
export const PORTRAIT_MAX_SIDE = 480;
export const PORTRAIT_TIMEOUT_MS = 12000;

function orcid(value) {
  const id = String(value || "").trim().replace(/^https:\/\/(?:www\.)?orcid\.org\//i, "").replace(/\/$/, "").toUpperCase();
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id)) return null;
  const digits = id.replace(/-/g, "");
  let total = 0;
  for (const digit of digits.slice(0, 15)) total = (total + Number(digit)) * 2;
  const check = (12 - total % 11) % 11;
  return digits[15] === (check === 10 ? "X" : String(check)) ? id : null;
}
function oa(value, allowNumeric = false) {
  const raw = String(value || "").trim().replace(/^https:\/\/(?:api\.)?openalex\.org\/(?:authors\/)?/i, "").replace(/\/$/, "");
  const m = /^(?:A)(\d{1,15})$/i.exec(raw) || (allowNumeric ? /^(\d{1,15})$/.exec(raw) : null);
  return m ? "A" + m[1] : null;
}
function qid(value) {
  const id = String(value || "").trim();
  return /^Q[1-9]\d{0,14}$/.test(id) ? id : null;
}
function fold(value) {
  return String(value || "").normalize("NFKD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
// Reviewed historical authorities. A missing QID may be recovered only
// for exact, distinctive full names of existing non-federated corpus authors.
// Short names still need an independently resolved authority ID. General
// discovery below requires independent bibliographic evidence.
const HISTORICAL = Object.freeze({
  Q9312: ["immanuel kant", "kant immanuel", "emmanuel kant"],
  Q9235: ["georg wilhelm friedrich hegel", "hegel georg wilhelm friedrich"],
  Q913: ["socrates", "sokrates", "σωκρατης"],
  Q152388: ["theodor w adorno", "theodor adorno", "theodor wiesengrund adorno", "theodor ludwig wiesengrund adorno", "adorno theodor w", "adorno theodor"],
  Q76826: ["max horkheimer", "horkheimer max"],
  Q61078: ["walter benjamin", "benjamin walter", "walter benedix schonflies benjamin"],
  Q60030: ["herbert marcuse", "marcuse herbert"],
  Q76357: ["jurgen habermas", "habermas jurgen"],
  Q48301: ["martin heidegger", "heidegger martin"],
  Q9358: ["friedrich nietzsche", "friedrich wilhelm nietzsche", "nietzsche friedrich"],
  Q58586: ["edmund husserl", "husserl edmund"],
  Q9391: ["ludwig wittgenstein", "ludwig josef johann wittgenstein", "wittgenstein ludwig"],
  Q9191: ["rene descartes", "descartes rene"],
  Q37160: ["david hume", "hume david"],
  Q172544: ["john rawls", "john bordley rawls", "rawls john"],
  Q81244: ["karl popper", "karl raimund popper", "popper karl"],
  Q7197: ["simone de beauvoir", "beauvoir simone de"],
  Q44272: ["michel foucault", "paul michel foucault", "foucault michel"],
  Q9364: ["jean paul sartre", "sartre jean paul"],
  Q130631: ["jacques derrida", "derrida jacques"],
  Q34670: ["albert camus", "camus albert"],
  Q9061: ["karl marx", "marx karl"]
});
function bibliographicEvidence(works, names, openalex) {
  const titles = new Set();
  const dois = new Set();
  for (const work of (Array.isArray(works) ? works : []).slice(0, 300)) {
    if (!Array.isArray(work?.authors) || !work.authors.some(person => {
      const id = oa(person?.openalexId || person?.sourceId || person?.id, true);
      return id && openalex ? id === openalex : names.includes(fold(person?.name || person?.displayName || person));
    })) continue;
    const title = fold(work.title);
    if (title.length >= 12) titles.add(title);
    const doi = normalizeDOI(work.doi);
    if (doi) dois.add(doi);
  }
  return {titles:[...titles].slice(0, 100), dois:[...dois].slice(0, 100)};
}
function normalizeDOI(value) {
  const doi = String(value || "").trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,"").replace(/^doi:\s*/i,"").toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : "";
}
export function portraitIdentity(author = {}, works = []) {
  if (!author || typeof author !== "object") return null;
  const o = orcid(author.orcid || author.orcidId);
  const a = oa(author.openalexId || author.sourceId) || (author.catalog !== "federated" ? oa(author.id, true) : null);
  const explicitQ = qid(author.wikidataId);
  const name = fold(author.sourceDisplayName || author.displayName);
  const display = fold(author.displayName || author.sourceDisplayName);
  const hasOrcid = Boolean(author.orcid || author.orcidId);
  const curated = !explicitQ && !author.wikidataId && !hasOrcid && a &&
    author.catalog !== "federated" && name.split(" ").length >= 2
      ? Object.entries(HISTORICAL).find(([, names]) =>
          names.includes(name) && names.includes(display))?.[0] || null
      : null;
  const q = explicitQ || curated;
  const historical = Boolean(q && !hasOrcid && HISTORICAL[q]?.includes(name));
  if (!o && !a && !historical) return null;
  const names = [...new Set([name, display].filter(n=>n.split(" ").length>=2))];
  const evidence = a && !hasOrcid && author.catalog !== "federated"
    ? bibliographicEvidence(works,names,a) : {titles:[],dois:[]};
  const canDiscover = names.length > 0 && (evidence.titles.length >= 2 || evidence.dois.length > 0);
  return { orcid: o, openalex: a, qid: q, historical, names, evidence, canDiscover,
    queryName: String(author.displayName || author.sourceDisplayName || "").slice(0,150),
    key: [o || "", a || "", q || "", historical ? name : "", canDiscover ? "bibliography" : ""].join("|") };
}
function values(entity, property) {
  const claims = entity?.claims?.[property] || [];
  const usable = claims.filter(c => c.rank !== "deprecated" && c.mainsnak?.snaktype === "value");
  const preferred = usable.filter(c => c.rank === "preferred");
  return (preferred.length ? preferred : usable).map(c => c.mainsnak.datavalue?.value);
}
function allValues(entity, property) {
  return (entity?.claims?.[property] || []).filter(c => c.rank !== "deprecated" && c.mainsnak?.snaktype === "value")
    .map(c => c.mainsnak.datavalue?.value);
}
export function matchesPortraitIdentity(entity, identity) {
  if (!entity || !identity || entity.missing || !qid(entity.id)) return false;
  if (identity.qid && entity.id !== identity.qid) return false;
  if (!allValues(entity, "P31").some(value => value?.id === "Q5")) return false;
  const o = allValues(entity, "P496").map(orcid).filter(Boolean);
  const a = allValues(entity, "P10283").map(v => oa(v)).filter(Boolean);
  if (identity.orcid && o.some(id => id !== identity.orcid)) return false;
  if (identity.openalex && a.length && !a.includes(identity.openalex)) return false;
  if (identity.orcid && o.includes(identity.orcid)) return true;
  if (identity.openalex && a.includes(identity.openalex)) return !identity.orcid || o.includes(identity.orcid);
  return identity.historical && !o.length && !a.length;
}
function apiURL(base, params) {
  const url = new URL(base);
  url.search = new URLSearchParams({ format: "json", origin: "*", ...params });
  return url.href;
}
async function json(fetcher, url, signal) {
  const res = await fetcher(url, { signal, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", redirect: "error" });
  if (!res.ok) throw new Error("Portrait source unavailable");
  const value = await res.json();
  if (value.error) throw new Error("Portrait source error");
  return value;
}
function entityNames(entity) {
  return [...Object.values(entity.labels || {}).map(x=>x.value),
    ...Object.values(entity.aliases || {}).flat().map(x=>x.value)].map(fold);
}
function compatibleCandidate(entity, identity) {
  if (!qid(entity?.id) || entity.missing || (identity.qid && entity.id!==identity.qid)) return false;
  if (!allValues(entity,"P31").some(v=>v?.id==="Q5")) return false;
  if (!identity.names?.some(n=>entityNames(entity).includes(n))) return false;
  const ids=allValues(entity,"P10283").map(v=>oa(v)).filter(Boolean);
  const orcids=allValues(entity,"P496").map(orcid).filter(Boolean);
  return (!ids.length || ids.includes(identity.openalex)) && !orcids.length;
}
async function bibliographicEntity(identity, candidates, fetcher, signal) {
  if (!identity.canDiscover) return null;
  const humans=candidates.filter(e=>compatibleCandidate(e,identity));
  const workIds=[...new Set(humans.flatMap(e=>allValues(e,"P800").map(x=>qid(x?.id)).filter(Boolean).slice(0,12)))].slice(0,48);
  if (!workIds.length) return null;
  const data=await json(fetcher,apiURL(WD,{action:"wbgetentities",ids:workIds.join("|"),props:"claims|labels|aliases",languages:"en|es|de|fr|pt|it"}),signal);
  const accepted=humans.filter(person=>{
    const titles=new Set();
    for (const ref of allValues(person,"P800")) {
      const work=data.entities?.[ref?.id];
      if (!work || !allValues(work,"P50").some(a=>a?.id===person.id)) continue;
      if (allValues(work,"P356").map(normalizeDOI).some(d=>d && identity.evidence.dois.includes(d))) return true;
      // Count distinct work entities, not translations/aliases of one work.
      const title=entityNames(work).find(n=>identity.evidence.titles.includes(n));
      if (title) titles.add(title);
    }
    return titles.size>=2;
  });
  return accepted.length===1 ? accepted[0] : null;
}
async function entityFor(identity, fetcher, signal) {
  const get = async ids => {
    const data = await json(fetcher, apiURL(WD, {action:"wbgetentities", ids:ids.join("|"), props:identity.canDiscover?"claims|labels|aliases":"claims", ...(identity.canDiscover?{languages:"en|es|de|fr|pt|it"}:{})}), signal);
    return Object.values(data.entities || {});
  };
  const verify = async candidates => {
    const exact=candidates.filter(x=>matchesPortraitIdentity(x,identity));
    if(exact.length===1)return exact[0];
    if(exact.length>1)return null;
    return bibliographicEntity(identity,candidates,fetcher,signal);
  };
  if (identity.qid) {
    return verify(await get([identity.qid]));
  }
  const prop = identity.orcid ? "P496" : "P10283";
  const id = identity.orcid || identity.openalex.toLowerCase();
  const query = await json(fetcher, apiURL(WD, {action:"query", list:"search", srnamespace:"0",
    srsearch:"haswbstatement:" + prop + "=" + id, srlimit:"5", srprop:""}), signal);
  // A truncated or ambiguous result is never resolved by ranking/name.
  const hits = query.query?.search || [];
  if (!query.continue && hits.length === 1 && qid(hits[0].title)) {
    const found=await verify(await get([hits[0].title]));
    if(found)return found;
  }
  if (query.continue || hits.length > 1 || !identity.canDiscover || !identity.queryName) return null;
  // Name search only proposes candidates; two authored works or an exact
  // authored DOI must independently corroborate identity.
  const discovered=await json(fetcher,apiURL(WD,{action:"wbsearchentities",search:identity.queryName,language:"en",uselang:"en",type:"item",limit:"5"}),signal);
  if(discovered["search-continue"] || discovered.continue)return null;
  const ids=[...new Set((discovered.search||[]).map(x=>qid(x.id)).filter(Boolean))];
  return ids.length ? verify(await get(ids)) : null;
}
const MIME = new Set(["image/jpeg","image/png","image/webp"]);
function plain(value) {
  // External metadata is untrusted; never insert its markup into the DOM.
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,240);
}
function licenseFor(value) {
  const s = plain(value).toLowerCase();
  if (s === "public domain" || s === "public domain mark" || s === "pdm" || s === "pd")
    return { label:"Dominio público", url:"https://creativecommons.org/publicdomain/mark/1.0/", creditRequired:false };
  if (/^cc0(?: 1\.0)?$/.test(s)) return {label:"CC0 1.0",url:"https://creativecommons.org/publicdomain/zero/1.0/",creditRequired:false};
  const m = /^cc by(-sa)? (1\.0|2\.0|2\.5|3\.0|4\.0)$/.exec(s);
  if (!m) return null;
  return {label:"CC BY"+(m[1]?"-SA":"")+" "+m[2],url:"https://creativecommons.org/licenses/by"+(m[1]?"-sa":"")+"/"+m[2]+"/",creditRequired:true};
}
// Commons currently returns both the original upload host and its official
// thumbnail host. Never accept arbitrary subdomains, redirects or other wikis.
function allowedMediaURL(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (url.hostname === "upload.wikimedia.org" && url.pathname.startsWith("/wikipedia/commons/")) return url;
  if (url.hostname === "thumb.wikimedia.org" && url.pathname.startsWith("/wikipedia/commons/thumb/")) return url;
  return null;
}
export function commonsPortrait(page, entityId) {
  const info = page?.imageinfo?.[0];
  if (!info || !qid(entityId) || !/^File:.{1,300}$/i.test(page.title || "")) return null;
  const m = info.extmetadata || {};
  const license = licenseFor(m.LicenseShortName?.value);
  const credit = plain(m.Attribution?.value || m.Artist?.value || m.Credit?.value);
  if (!license || (license.creditRequired && !credit) || plain(m.Restrictions?.value)) return null;
  if (plain(m.Copyrighted?.value).toLowerCase() === "true" && !license.creditRequired && license.label === "Dominio público") return null;
  const thumbnail = Boolean(info.thumburl);
  const width = Number(thumbnail ? info.thumbwidth : info.width);
  const height = Number(thumbnail ? info.thumbheight : info.height);
  if (!(width > 0 && height > 0 && width <= PORTRAIT_MAX_SIDE && height <= PORTRAIT_MAX_SIDE)) return null;
  if (!MIME.has(info.thumbmime || info.mime)) return null;
  const url = allowedMediaURL(info.thumburl || info.url);
  if (!url) return null;
  if (!thumbnail && !(Number(info.size)>0 && Number(info.size)<=PORTRAIT_MAX_BYTES)) return null;
  return { url:url.href, width, height, license, credit:credit || "Autoría no indicada en la fuente",
    title:plain(page.title.replace(/^File:/i,"")), source:"https://commons.wikimedia.org/wiki/"+encodeURIComponent(page.title.replace(/ /g,"_")),
    identity:"https://www.wikidata.org/wiki/"+entityId };
}
export async function resolveAuthorPortrait(identity, {fetcher = fetch, signal} = {}) {
  if (!identity) return null;
  const entity = await entityFor(identity, fetcher, signal);
  if (!entity) return null;
  const files = [...new Set(values(entity,"P18").filter(v => typeof v==="string" && v.length>0 && v.length<=300))];
  // All non-deprecated P18 claims refer to the same verified person. Try
  // up to four, in Wikidata preferred/statement order, validating each file.
  if (!files.length) return null;
  const ordered=files.slice(0,4);
  const payload = await json(fetcher, apiURL(COMMONS,{action:"query", titles:ordered.map(x=>"File:"+x).join("|"), prop:"imageinfo",
    iiprop:"url|size|mime|extmetadata|thumbmime", iiurlwidth:"220", iiurlheight:"320", iiextmetadatalanguage:"en",
    iiextmetadatafilter:"LicenseShortName|Artist|Credit|Attribution|Restrictions|Copyrighted"}), signal);
  const pages = Object.values(payload.query?.pages || {});
  for(const name of ordered) {
    const page=pages.find(p=>fold(p.title)===fold("File:"+name));
    const portrait=commonsPortrait(page,entity.id);
    if(portrait)return portrait;
  }
  return null;
}
export async function downloadPortrait(meta, {fetcher=fetch,signal}={}) {
  const url = allowedMediaURL(meta?.url);
  if (!url) throw new Error("Portrait host outside media policy");
  const res = await fetcher(url.href, {signal,cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",redirect:"error"});
  if (!res.ok) throw new Error("Portrait download failed");
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!MIME.has(type) || Number(res.headers.get("content-length")) > PORTRAIT_MAX_BYTES || !res.body?.getReader)
    throw new Error("Portrait exceeds media policy");
  const reader = res.body.getReader();
  const chunks=[]; let size=0;
  try {
    for (;;) {
      if(signal?.aborted) throw new DOMException("Aborted","AbortError");
      const {done,value}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>PORTRAIT_MAX_BYTES) throw new Error("Portrait exceeds byte budget");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
  if(!size) throw new Error("Empty portrait");
  return new Blob(chunks,{type});
}
