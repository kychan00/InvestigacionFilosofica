/*
 * Real, opt-in PR regression: inspect the reported Mauricio Méndez Huerta
 * ORCID record, and whether a cross-origin static page can read its data.
 * Does not store personal data or require credentials.
 */
import assert from "node:assert/strict";
import { normalizeOrcidPublicWorks } from "../../src/sources/orcid.js";
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
const activities = record["activities-summary"] || {};
const person = record.person || {};
const summaries = (section, key) =>
  Array.isArray(activities?.[section]?.[key]) ? activities[section][key] : [];
const affiliation = item => ({
  organization: item?.organization?.name || null,
  department: item?.["department-name"] || null,
  role: item?.["role-title"] || null,
  start: item?.["start-date"]?.year?.value || null,
  end: item?.["end-date"]?.year?.value || null
});
console.log("ORCID public profile:", JSON.stringify({
  name: {
    given: person?.name?.["given-names"]?.value || null,
    family: person?.name?.["family-name"]?.value || null,
    credit: person?.name?.["credit-name"]?.value || null
  },
  biography: person?.biography?.content || null,
  keywords: (person?.keywords?.keyword || []).map(x => x.content).filter(Boolean),
  websites: (person?.["researcher-urls"]?.["researcher-url"] || [])
    .map(x => ({name:x["url-name"], url:x.url?.value})),
  employments: summaries("employments","employment-summary").map(affiliation),
  educations: summaries("educations","education-summary").map(affiliation),
  distinctions: summaries("distinctions","distinction-summary").map(affiliation),
  qualifications: summaries("qualifications","qualification-summary").map(affiliation),
  memberships: summaries("memberships","membership-summary").map(affiliation),
  services: summaries("services","service-summary").map(affiliation),
  invitedPositions: summaries("invited-positions","invited-position-summary").map(affiliation),
  fundingCount: Array.isArray(activities?.fundings?.group)
    ? activities.fundings.group.length : 0
}));
