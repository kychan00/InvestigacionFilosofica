/**
 * SIVA · Public author portrait policy. No name search or inferred identity.
 * Wikidata is an identity bridge, Commons is the media/license authority.
 * The application code is MIT; media retains its original license.
 */
const WD = "https://www.wikidata.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
export const PORTRAIT_MAX_BYTES = 256 * 1024;
export const PORTRAIT_MAX_SIDE = 480;
export const PORTRAIT_TIMEOUT_MS = 7000;

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
// Reviewed historical exceptions require BOTH the existing authority QID
// and an exact canonical full name from the corpus (never a name lookup).
// They are deliberately small until stable source identifiers are audited.
const HISTORICAL = Object.freeze({
  Q9312: ["immanuel kant", "kant immanuel", "emmanuel kant"],
  Q9235: ["georg wilhelm friedrich hegel", "hegel georg wilhelm friedrich"],
  Q913: ["socrates", "sokrates", "σωκρατης"]
});
export function portraitIdentity(author = {}) {
  if (!author || typeof author !== "object") return null;
  const o = orcid(author.orcid || author.orcidId);
  const a = oa(author.openalexId || author.sourceId) || (author.catalog !== "federated" ? oa(author.id, true) : null);
  const q = qid(author.wikidataId);
  const name = fold(author.sourceDisplayName || author.displayName);
  const historical = Boolean(q && !o && HISTORICAL[q]?.includes(name));
  if (!o && !a && !historical) return null;
  return { orcid: o, openalex: a, qid: q, historical,
    key: [o || "", a || "", q || "", historical ? name : ""].join("|") };
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
async function entityFor(identity, fetcher, signal) {
  const get = async ids => {
    const data = await json(fetcher, apiURL(WD, {action:"wbgetentities", ids:ids.join("|"), props:"claims"}), signal);
    return Object.values(data.entities || {}).filter(x => matchesPortraitIdentity(x, identity));
  };
  if (identity.qid) {
    const found = await get([identity.qid]);
    return found.length === 1 ? found[0] : null;
  }
  const prop = identity.orcid ? "P496" : "P10283";
  const id = identity.orcid || identity.openalex.toLowerCase();
  const query = await json(fetcher, apiURL(WD, {action:"query", list:"search", srnamespace:"0",
    srsearch:"haswbstatement:" + prop + "=" + id, srlimit:"5", srprop:""}), signal);
  // A truncated or ambiguous result is never resolved by ranking/name.
  const hits = query.query?.search || [];
  if (query.continue || hits.length !== 1 || !qid(hits[0].title)) return null;
  const found = await get([hits[0].title]);
  return found.length === 1 ? found[0] : null;
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
  let url;
  try { url = new URL(info.thumburl || info.url); } catch { return null; }
  if (url.protocol !== "https:" || url.hostname !== "upload.wikimedia.org" || url.username || url.password || url.port ||
      !url.pathname.startsWith("/wikipedia/commons/")) return null;
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
  // Avoid choosing among conflicting preferred portraits automatically.
  if (files.length !== 1) return null;
  const payload = await json(fetcher, apiURL(COMMONS,{action:"query", titles:"File:"+files[0], prop:"imageinfo",
    iiprop:"url|size|mime|extmetadata|thumbmime", iiurlwidth:"320", iiurlheight:"480", iiextmetadatalanguage:"en",
    iiextmetadatafilter:"LicenseShortName|Artist|Credit|Attribution|Restrictions|Copyrighted"}), signal);
  const pages = Object.values(payload.query?.pages || {});
  return pages.length === 1 ? commonsPortrait(pages[0],entity.id) : null;
}
export async function downloadPortrait(meta, {fetcher=fetch,signal}={}) {
  const res = await fetcher(meta.url, {signal,cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",redirect:"error"});
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
