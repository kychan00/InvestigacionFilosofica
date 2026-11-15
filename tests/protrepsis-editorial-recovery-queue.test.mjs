import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const [corpusText, curatedText, historicalText, queueText] = await Promise.all([
  readFile("src/data/cucsh-filosofia.json", "utf8"),
  readFile("src/data/protrepsis-editorial-keywords.json", "utf8"),
  readFile("src/data/protrepsis-historical.json", "utf8"),
  readFile("src/data/protrepsis-editorial-recovery-queue.json", "utf8")
]);

const corpus = JSON.parse(corpusText);
const curated = JSON.parse(curatedText);
const historical = JSON.parse(historicalText);
const queue = JSON.parse(queueText);
const protrepsis = corpus.records.filter(row => row.journal === "Protrepsis" && row.doi);
const curatedDois = new Set(curated.records.map(row => row.doi.toLowerCase()));
const historicalDois = new Set(historical.records.map(row => row.doi.toLowerCase()));
const pending = protrepsis.filter(row => !curatedDois.has(row.doi.toLowerCase()));
const sort = values => [...values].sort();
const expectedGenre = /\b(reseña|recensión|entrevista|noticia bibliográfica)\b/i;

test("la cola cubre todos y solo los DOI de Protrepsis sin keywords editoriales verificadas", () => {
  assert.equal(queue.schemaVersion, 1);
  assert.equal(protrepsis.length, 247);
  assert.equal(curated.records.length, 157);
  assert.equal(pending.length, 90);
  assert.equal(queue.records.length, 90);
  assert.equal(new Set(queue.records.map(x => x.doi)).size, 90);
  assert.deepEqual(sort(queue.records.map(x => x.doi)), sort(pending.map(x => x.doi)));
  assert.equal(queue.counts.protrepsisWithDOI, protrepsis.length);
  assert.equal(queue.counts.curatedWithLiteralEditorialKeywords, curated.records.length);
  assert.equal(queue.counts.awaitingPublicationEvidence, pending.length);
});

test("corpus congelado: la auditoría no puede aplicarse silenciosamente a otro origen", () => {
  const payload = Buffer.from(corpusText, "utf8");
  const gitBlobSha = createHash("sha1")
    .update(Buffer.from("blob " + payload.length + "\0", "utf8"))
    .update(payload)
    .digest("hex");
  assert.equal(gitBlobSha, queue.frozenCorpusBlobSha);
});

test("géneros sugeridos exclusivamente por títulos literales y sin fingir ausencia editorial", () => {
  let explicitlyNamed = 0;
  let noAbstract = 0;
  for (const item of queue.records) {
    const source = pending.find(x => x.doi === item.doi);
    assert.ok(source);
    assert.equal(item.title, source.title);
    assert.equal(item.year, source.year);
    assert.deepEqual(item.authors, (source.authors || []).map(x => x.name || x.sourceName).filter(Boolean));
    assert.equal(item.journalPage, source.urls?.canonical || null);
    assert.deepEqual(item.publisherRelatedLinks, source.urls?.relations || []);
    assert.equal(item.hasPublisherAbstract, Boolean(source.abstract));
    assert.equal(item.editorialKeywordStatus, "not-verified");
    assert.equal(item.genreTitleSignal === "review-interview-or-bibliographic-title", expectedGenre.test(item.title));
    assert.equal(Object.hasOwn(item, "keywords"), false);
    assert.equal(Object.hasOwn(item, "editorialKeywords"), false);
    if (expectedGenre.test(item.title)) explicitlyNamed++;
    if (!source.abstract) noAbstract++;
  }
  assert.equal(explicitlyNamed, 21);
  assert.equal(noAbstract, 24);
  assert.equal(queue.counts.explicitReviewInterviewOrBibliographicTitle, explicitlyNamed);
  assert.equal(queue.counts.lackingPublisherAbstract, noAbstract);
});

test("distingue 22 pendientes históricos: 6 artículos de investigación y 16 registros de otros géneros", () => {
  const historicalPending = queue.records.filter(x => x.inHistoricalSupplement);
  assert.equal(historicalPending.length, 22);
  assert.deepEqual(sort(historicalPending.map(x => x.doi)),sort(pending.filter(x => historicalDois.has(x.doi.toLowerCase())).map(x => x.doi)));
  assert.equal(historicalPending.filter(x => x.recoveryLane === "historical-first-page-needed").length,6);
  assert.equal(historicalPending.filter(x => x.genreTitleSignal === "review-interview-or-bibliographic-title").length,16);
  assert.equal(queue.counts.historicalSupplementPending,22);
  assert.equal(queue.counts.historicalOriginalResearchToVerify,6);
  assert.deepEqual(sort(queue.historicalResearchToVerify),sort(historicalPending.filter(x => x.recoveryLane === "historical-first-page-needed").map(x=>x.doi)));
});

test("siguiente lote de diez no finge evidencia ni incluye registros ya curados", () => {
  assert.equal(queue.nextTenCandidatesWithoutEditorialEvidence.length, 10);
  assert.equal(new Set(queue.nextTenCandidatesWithoutEditorialEvidence).size, 10);
  const pendingDois = new Set(pending.map(x => x.doi));
  for (const doi of queue.nextTenCandidatesWithoutEditorialEvidence) {
    assert.ok(pendingDois.has(doi));
    assert.equal(curatedDois.has(doi.toLowerCase()), false);
  }
});


test("un DOI deja de estar pendiente cuando aparece evidencia literal verificable", () => {
  const doi = "10.32870/prot.i15.200";
  assert.ok(curatedDois.has(doi));
  assert.equal(queue.records.some(record => record.doi === doi), false);
  assert.equal(queue.nextTenCandidatesWithoutEditorialEvidence.includes(doi), false);
});

test("i27.435 sale de la cola al documentarse sus palabras clave literales", () => {
  const doi = "10.32870/prot.i27.435";
  assert.ok(curatedDois.has(doi));
  assert.equal(queue.records.some(record => record.doi === doi), false);
  assert.equal(queue.nextTenCandidatesWithoutEditorialEvidence.includes(doi), false);
});
