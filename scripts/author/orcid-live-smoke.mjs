/*
 * Real, opt-in PR regression: inspect the reported Mauricio Méndez Huerta
 * ORCID record, and whether a cross-origin static page can read its data.
 * Does not store personal data or require credentials.
 */
import assert from "node:assert/strict";
import {
  normalizeOrcidPublicWorks,
  normalizeOrcidPublicProfile,
  normalizeOrcidSearchCsv,
  searchOrcid
} from "../../src/sources/orcid.js?v=20261112-federated-search-v1";
import { mergeAuthorArchives } from "../../src/core/author-deep-discovery.js";
const id = "0000-0002-7283-8051";
const origin = "https://kychan00.github.io";
const url = "https://pub.orcid.org/v3.0/" + id + "/works";
const response = await fetch(url, {
  headers: {
    Accept: "application/vnd.orcid+json",
    Origin: origin
  },
  signal: AbortSignal.timeout(18000)
});
const cors = response.headers.get("access-control-allow-origin");
const body = await response.text();
console.log(JSON.stringify({
  url, status: response.status, contentType: response.headers.get("content-type"),
  cors, bytes: body.length, preview: body.slice(0, 120)
}));
assert.equal(response.status, 200,
  "La API pública de ORCID debe responder HTTP 200");
assert.ok(cors === "*" || cors === origin,
  "ORCID debe permitir CORS desde GitHub Pages para funcionar en el navegador");
const payload = JSON.parse(body);
assert.ok(Array.isArray(payload.group), "Se requiere una lista de grupos ORCID");
console.log("ORCID public work groups:", payload.group.length);
console.log("sample titles:", payload.group.slice(0, 6).map(x =>
  x["work-summary"]?.[0]?.title?.title?.value).filter(Boolean));
assert.ok(payload.group.length >= 4,
  "El perfil de Mauricio Méndez Huerta debe ofrecer más de tres obras públicas");
const parsed = normalizeOrcidPublicWorks(payload, {
  orcid: id,
  displayName: "Mauricio Méndez Huerta"
});
const deduped = mergeAuthorArchives([], parsed.works);
console.log(JSON.stringify({
  sourceGroups: parsed.totalGroups,
  normalizedWorks: parsed.works.length,
  deduplicatedWorks: deduped.length,
  types: [...new Set(parsed.works.map(work => work.type))],
  sample: parsed.works.slice(0, 6).map(work => ({
    title: work.title, year: work.year, doi: work.doi
  }))
}));
assert.ok(parsed.works.length >= 4,
  "El normalizador debe conservar las publicaciones reales del perfil");
assert.ok(deduped.length >= 4,
  "La unificación no debe reducir falsamente la bibliografía a tres obras");
assert.ok(deduped.every(work => work.providers.includes("ORCID")),
  "La procedencia ORCID debe conservarse en todas las obras");


const recordUrl = "https://pub.orcid.org/v3.0/" + id + "/record";
const recordResponse = await fetch(recordUrl, {
  headers: {
    Accept: "application/vnd.orcid+json",
    Origin: origin
  },
  signal: AbortSignal.timeout(18000)
});
const recordText = await recordResponse.text();
assert.equal(recordResponse.status, 200,
  "El registro público completo de ORCID debe responder HTTP 200");
assert.ok(recordResponse.headers.get("access-control-allow-origin") === "*" ||
  recordResponse.headers.get("access-control-allow-origin") === origin,
  "El registro completo ORCID debe permitir CORS desde GitHub Pages");
const record = JSON.parse(recordText);
const profileData = normalizeOrcidPublicProfile(record,{orcid:id});
console.log("ORCID public profile:", JSON.stringify({
  displayName: profileData.displayName,
  biography: profileData.biography,
  hasPublicProfileData: profileData.hasPublicProfileData,
  employments: profileData.employments,
  educations: profileData.educations,
  distinctions: profileData.distinctions,
  qualifications: profileData.qualifications,
  memberships: profileData.memberships,
  services: profileData.services,
  invitedPositions: profileData.invitedPositions,
  fundingCount: profileData.fundings.length,
  keywords: profileData.keywords,
  websites: profileData.websites,
  countries: profileData.countries
}));
assert.equal(profileData.displayName,"Mauricio Méndez");
assert.equal(profileData.orcid,id);
console.log("Mauricio profile has public career data:", profileData.hasPublicProfileData);


const romuloId = "0000-0001-7280-3812";
const romuloName = "Rómulo Ramírez Daza y García";
const searchUrl = new URL("https://pub.orcid.org/v3.0/csv-search/");
searchUrl.searchParams.set("q", romuloName);
searchUrl.searchParams.set(
  "fl",
  "orcid,given-names,family-name,credit-name,current-institution-affiliation-name,past-institution-affiliation-name"
);
searchUrl.searchParams.set("start", "0");
searchUrl.searchParams.set("rows", "4");

const searchResponse = await fetch(searchUrl, {
  headers: {
    Accept: "text/csv",
    Origin: origin
  },
  signal: AbortSignal.timeout(18000)
});
const searchText = await searchResponse.text();
const searchCors = searchResponse.headers.get("access-control-allow-origin");
console.log("ORCID anonymous CSV search:", JSON.stringify({
  status: searchResponse.status,
  cors: searchCors,
  contentType: searchResponse.headers.get("content-type"),
  bytes: searchText.length,
  preview: searchText.slice(0, 220)
}));
assert.equal(searchResponse.status, 200,
  "La búsqueda pública CSV de ORCID debe funcionar sin token en navegador");
assert.ok(searchCors === "*" || searchCors === origin,
  "La búsqueda ORCID debe permitir CORS desde GitHub Pages");
const profiles = normalizeOrcidSearchCsv(searchText);
assert.ok(profiles.some(item => item.orcid === romuloId),
  "La búsqueda pública debe localizar el ORCID conocido de Rómulo");

const mauricioName = "Mauricio Méndez Huerta";
const federatedOrcid = await searchOrcid(
  { query: mauricioName, weight: 1, type: "original" },
  {
    rows: 4,
    profilesPerPage: 4,
    preferredAuthorResolution: {
      status: "resolved",
      author: {
        displayName: mauricioName,
        orcid: id
      }
    }
  }
);
console.log("ORCID federated search sample:", federatedOrcid.map(item => ({
  title: item.title,
  year: item.year,
  doi: item.doi,
  providers: item.providers,
  author: item.authors?.[0]?.name
})));
assert.ok(federatedOrcid.length > 0,
  "ORCID debe aportar obras al motor federado para un autor con bibliografía pública");
assert.ok(federatedOrcid.every(item => item.providers.includes("ORCID")),
  "Las obras del buscador ORCID deben conservar su procedencia");
assert.ok(federatedOrcid.some(item =>
  item.authors?.some(author => String(author.orcid || "").includes(id))),
  "Las obras ORCID deben conservar el identificador del investigador");
