import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PROTREPSIS_HISTORICAL_REVIEW_INTERVIEW_DOIS,
  isProtrepsisHistoricalReviewOrInterview,
  protrepsisMissingKeywordStatus
} from "../js/protrepsis-editorial-status.js";

const REVIEW_INTERVIEW_DOIS = [
  "10.32870/prot.i1.1",
  "10.32870/prot.i1.2",
  "10.32870/prot.i1.20",
  "10.32870/prot.i1.21",
  "10.32870/prot.i2.22",
  "10.32870/prot.i2.33",
  "10.32870/prot.i2.34",
  "10.32870/prot.i3.42",
  "10.32870/prot.i4.60",
  "10.32870/prot.i5.81",
  "10.32870/prot.i6.97",
  "10.32870/prot.i6.98",
  "10.32870/prot.i7-8.112",
  "10.32870/prot.i9-10.134",
  "10.32870/prot.i13.155",
  "10.32870/prot.i14.178",
];
const RESEARCH_DOIS = [
  "10.32870/prot.i7-8.107",
  "10.32870/prot.i11-12.138",
  "10.32870/prot.i13.151",
  "10.32870/prot.i14.165",
  "10.32870/prot.i14.166",
  "10.32870/prot.i14.176",
];

const sort = values => [...values].sort();

test("el registro de 16 reseñas y entrevistas coincide con la auditoría histórica", async () => {
  assert.deepEqual(
    sort(PROTREPSIS_HISTORICAL_REVIEW_INTERVIEW_DOIS),
    sort(REVIEW_INTERVIEW_DOIS)
  );
  assert.equal(new Set(PROTREPSIS_HISTORICAL_REVIEW_INTERVIEW_DOIS).size, 16);

  const history = JSON.parse(await readFile("src/data/protrepsis-historical.json", "utf8"));
  const overlay = JSON.parse(await readFile("src/data/protrepsis-editorial-keywords.json", "utf8"));
  const historicalRecords = Array.isArray(history) ? history : history.records;
  const curatedDois = new Set(overlay.records.map(row => row.doi.toLowerCase()));
  const remaining = historicalRecords.filter(row =>
    row.doi && !curatedDois.has(row.doi.toLowerCase())
  );

  assert.equal(remaining.length, 22);
  assert.deepEqual(
    sort(remaining.filter(isProtrepsisHistoricalReviewOrInterview).map(row => row.doi)),
    sort(REVIEW_INTERVIEW_DOIS)
  );
  assert.deepEqual(
    sort(remaining.filter(row => !isProtrepsisHistoricalReviewOrInterview(row)).map(row => row.doi)),
    sort(RESEARCH_DOIS)
  );
  for (const record of remaining.filter(isProtrepsisHistoricalReviewOrInterview)) {
    assert.match(record.title, /reseña|entrevista/i);
  }
});

test("reseñas y entrevistas no reciben etiquetas inferidas ni se anuncian como investigación pendiente", () => {
  for (const doi of REVIEW_INTERVIEW_DOIS) {
    const record = { journal: "Protrepsis", doi };
    const status = protrepsisMissingKeywordStatus(record);
    assert.equal(isProtrepsisHistoricalReviewOrInterview(record), true);
    assert.match(status.label, /Sin palabras clave verificadas/);
    assert.match(status.note, /No se han verificado/);
    assert.equal(status.className, "is-keywords-unverified");
  }
});

test("los seis artículos sí quedan señalados para recuperación editorial", () => {
  for (const doi of RESEARCH_DOIS) {
    const record = { journal: "Protrepsis", doi };
    const status = protrepsisMissingKeywordStatus(record);
    assert.equal(isProtrepsisHistoricalReviewOrInterview(record), false);
    assert.equal(status.label, "Pendientes de recuperación");
    assert.equal(status.className, "is-keywords-pending");
  }
});

test("DOI normalizado sin colisiones con otras revistas", () => {
  assert.equal(isProtrepsisHistoricalReviewOrInterview({
    journal: "Protrepsis",
    doi: "https://doi.org/10.32870/prot.i14.178."
  }), true);
  assert.equal(isProtrepsisHistoricalReviewOrInterview({
    journal: "Sincronía", doi: "10.32870/prot.i14.178"
  }), false);
  assert.equal(isProtrepsisHistoricalReviewOrInterview({journal:"Protrepsis",doi:""}),false);
});

test("la página de revista muestra el estado editorial según el registro", async () => {
  const source = await readFile("js/journal-page.js", "utf8");
  assert.match(source, /import \{ protrepsisMissingKeywordStatus \} from/);
  assert.match(source, /const missingStatus = protrepsisMissingKeywordStatus\(record\)/);
  assert.match(source, /pending\.textContent = categoryMeta\.emptyLabel/);
  assert.match(source, /categoryMeta\.emptyClass/);
});
