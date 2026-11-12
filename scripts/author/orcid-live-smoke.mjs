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
