import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PROTREPSIS_HISTORICAL_REVIEW_INTERVIEW_DOIS,
  PROTREPSIS_ADDITIONAL_REVIEW_BIBLIOGRAPHIC_DOIS,
  isProtrepsisHistoricalReviewOrInterview,
  isProtrepsisExplicitReviewOrBibliographic,
  protrepsisMissingKeywordStatus
} from "../js/protrepsis-editorial-status.js";

const REVIEW_INTERVIEW_DOIS = [
  "10.32870/prot.i1.1","10.32870/prot.i1.2","10.32870/prot.i1.20","10.32870/prot.i1.21",
  "10.32870/prot.i2.22","10.32870/prot.i2.33","10.32870/prot.i2.34","10.32870/prot.i3.42",
  "10.32870/prot.i4.60","10.32870/prot.i5.81","10.32870/prot.i6.97","10.32870/prot.i6.98",
  "10.32870/prot.i7-8.112","10.32870/prot.i9-10.134","10.32870/prot.i13.155","10.32870/prot.i14.178"
];
const RESEARCH_DOIS = [
  "10.32870/prot.i7-8.107","10.32870/prot.i11-12.138","10.32870/prot.i13.151",
  "10.32870/prot.i14.165","10.32870/prot.i14.166","10.32870/prot.i14.176"
];
const ADDITIONAL = [
  "10.32870/prot.i15.203","10.32870/prot.i16.222","10.32870/prot.i17.233",
  "10.32870/prot.i18.269","10.32870/prot.i18.270"
];
const sort = values => [...values].sort();

const [overlay, queue] = await Promise.all([
  readFile("src/data/protrepsis-editorial-keywords.json", "utf8").then(JSON.parse),
  readFile("src/data/protrepsis-editorial-recovery-queue.json", "utf8").then(JSON.parse)
]);
const curatedDois = new Set(overlay.records.map(row => row.doi.toLowerCase()));
const absentByDoi = new Map((queue.resolvedWithoutEditorialKeywords || []).map(row => [row.doi.toLowerCase(), row]));

test("las listas históricas se conservan solo como reconocimiento de género", () => {
  assert.deepEqual(sort(PROTREPSIS_HISTORICAL_REVIEW_INTERVIEW_DOIS), sort(REVIEW_INTERVIEW_DOIS));
  assert.deepEqual(sort(PROTREPSIS_ADDITIONAL_REVIEW_BIBLIOGRAPHIC_DOIS), sort(ADDITIONAL));
  assert.equal(new Set(PROTREPSIS_HISTORICAL_REVIEW_INTERVIEW_DOIS).size, 16);
  for (const doi of REVIEW_INTERVIEW_DOIS) {
    assert.equal(isProtrepsisHistoricalReviewOrInterview({ journal: "Protrepsis", doi }), true);
  }
  for (const doi of ADDITIONAL) {
    assert.equal(isProtrepsisExplicitReviewOrBibliographic({ journal: "Protrepsis", doi }), true);
  }
});

test("la auditoría cerrada distingue 211 con keywords y 36 sin keywords", () => {
  assert.equal(overlay.records.length, 211);
  assert.equal(queue.records.length, 0);
  assert.equal(queue.resolvedWithoutEditorialKeywords.length, 36);
  assert.equal(queue.counts.awaitingPublicationEvidence, 0);
  assert.equal(queue.counts.confirmedWithoutEditorialKeywords, 36);
  assert.equal(queue.counts.fullyResolved, 247);
});

test("los registros sin keywords se anuncian como ausencia editorial verificada", () => {
  for (const [doi, entry] of absentByDoi) {
    const status = protrepsisMissingKeywordStatus({
      journal: "Protrepsis",
      doi,
      title: entry.title,
      editorialKeywordStatus: entry.editorialKeywordStatus
    });
    assert.equal(status.className, "is-keywords-absent");
    assert.match(status.label, /Sin palabras clave editoriales/);
    assert.match(status.note, /Ausencia editorial verificada/);
  }
});

test("los seis artículos históricos de investigación ya están curados", () => {
  for (const doi of RESEARCH_DOIS) {
    assert.ok(curatedDois.has(doi));
    assert.equal(absentByDoi.has(doi), false);
  }
});

test("DOI normalizado no colisiona con otras revistas", () => {
  assert.equal(isProtrepsisHistoricalReviewOrInterview({
    journal: "Protrepsis",
    doi: "https://doi.org/10.32870/prot.i14.178."
  }), true);
  assert.equal(isProtrepsisHistoricalReviewOrInterview({
    journal: "Sincronía",
    doi: "10.32870/prot.i14.178"
  }), false);
});

test("la página carga la resolución editorial y mantiene categorías derivadas separadas", async () => {
  const source = await readFile("js/journal-page.js", "utf8");
  assert.match(source, /PROTREPSIS_RECOVERY_URL/);
  assert.match(source, /applyProtrepsisEditorialResolution/);
  assert.match(source, /editorialKeywordStatus: entry\.editorialKeywordStatus/);
  assert.match(source, /keywordMeta\.emptyLabel/);
  assert.match(source, /protrepsisRelationCategoryMetadata/);
});
