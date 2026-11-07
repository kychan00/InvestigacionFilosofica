import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  approvedEditorialUdgUrl,
  editorialFilterOptions,
  searchEditorialUdg,
  validateEditorialUdgIndex,
} from "../src/core/editorial-udg-search.js";

const payload = JSON.parse(readFileSync(
  new URL("../data/editorial/udg-philosophy-v1/index.json", import.meta.url),
  "utf8",
));

test("Editorial UdeG public corpus is fail-closed to 33 philosophical publications", () => {
  const data = validateEditorialUdgIndex(payload);
  assert.equal(data.records.length, 33);
  assert.equal(data.counts.officialPhilosophyCategory, 24);
  assert.equal(data.counts.verifiedPhilosophicalRelation, 9);
  assert.equal(data.referenceOnly, true);
  assert.equal(data.pdfCopies, 0);
});

test("Editorial UdeG search is accent-insensitive and searches authors, titles and criteria", () => {
  assert.deepEqual(
    searchEditorialUdg(payload.records, { query: "analisis filosofico" }).map(row => row.title),
    ["Análisis filosófico"],
  );
  assert.deepEqual(
    searchEditorialUdg(payload.records, { query: "berkeley" }).map(row => row.title),
    ["Principios del conocimiento humano"],
  );
  assert.ok(searchEditorialUdg(payload.records, { query: "epistemologica" }).length >= 2);
});

test("Editorial UdeG filters distinguish official category from verified philosophical relations", () => {
  assert.equal(
    searchEditorialUdg(payload.records, { origin: "official-philosophy-category" }).length,
    24,
  );
  assert.equal(
    searchEditorialUdg(payload.records, { origin: "verified-philosophical-relation" }).length,
    9,
  );
  assert.ok(editorialFilterOptions(payload.records, "formats").includes("eBook"));
  assert.ok(editorialFilterOptions(payload.records, "formats").includes("Impreso"));
});

test("Editorial UdeG links remain on the official publisher and never target document downloads", () => {
  for (const row of payload.records) {
    assert.equal(approvedEditorialUdgUrl(row.sourceUrl), row.sourceUrl);
    assert.doesNotMatch(row.sourceUrl, /\.pdf$|\/download\/?$/i);
  }
  assert.equal(approvedEditorialUdgUrl("https://evil.example/book"), null);
  assert.equal(approvedEditorialUdgUrl("https://editorial.udg.mx/file.pdf"), null);
});

test("known philosophy outside the official category remains included without importing religion by default", () => {
  const titles = new Set(payload.records.map(row => row.title));
  assert.ok(titles.has("Problemas éticos contemporáneos"));
  assert.ok(titles.has("Análisis filosófico"));
  assert.ok(titles.has("Conocimiento y ciencia"));
  assert.ok(titles.has("Introducción a la teoría de la argumentación"));
  assert.equal(titles.has("Espiritualidad sin religión"), false);
  assert.equal(titles.has("La idea de Dios en Guadalajara"), false);
});
