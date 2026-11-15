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
const resolvedWithoutKeywords = queue.resolvedWithoutEditorialKeywords || [];
const resolvedWithoutKeywordDois = new Set(resolvedWithoutKeywords.map(row => row.doi.toLowerCase()));
const historicalDois = new Set(historical.records.map(row => row.doi.toLowerCase()));
const pending = protrepsis.filter(row => !curatedDois.has(row.doi.toLowerCase()) && !resolvedWithoutKeywordDois.has(row.doi.toLowerCase()));
const sort = values => [...values].sort();
const expectedGenre = /\b(reseña|recensión|entrevista|noticia bibliográfica)\b/i;

test("la cola cubre todos y solo los DOI de Protrepsis sin keywords editoriales verificadas", () => {
  assert.equal(queue.schemaVersion, 2);
  assert.equal(protrepsis.length, 247);
  assert.equal(curated.records.length, 175);
  assert.equal(pending.length, 71);
  assert.equal(queue.records.length, 71);
  assert.equal(new Set(queue.records.map(x => x.doi)).size, 71);
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
  assert.equal(noAbstract, 23);
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


test("i21.314 sale de la cola al documentarse sus palabras clave literales", () => {
  const doi = "10.32870/prot.i21.314";
  assert.ok(curatedDois.has(doi));
  assert.equal(queue.records.some(record => record.doi === doi), false);
  assert.equal(queue.nextTenCandidatesWithoutEditorialEvidence.includes(doi), false);
});


test("i22.366 sale de la cola al documentarse sus palabras clave literales", () => {
  const doi = "10.32870/prot.i22.366";
  assert.ok(curatedDois.has(doi));
  assert.equal(queue.records.some(record => record.doi === doi), false);
  assert.equal(queue.nextTenCandidatesWithoutEditorialEvidence.includes(doi), false);
});


test("i18.262 e i20.276 salen de la cola con evidencia literal", () => {
  for (const doi of ["10.32870/prot.i18.262", "10.32870/prot.i20.276"]) {
    assert.ok(curatedDois.has(doi));
    assert.equal(queue.records.some(record => record.doi === doi), false);
    assert.equal(queue.nextTenCandidatesWithoutEditorialEvidence.includes(doi), false);
  }
});


test("número 28 sale completo de la cola tras verificar el fascículo oficial", () => {
  const dois = [
    "10.32870/prot.i28.480","10.32870/prot.i28.481","10.32870/prot.i28.483",
    "10.32870/prot.i28.484","10.32870/prot.i28.485","10.32870/prot.i28.486",
    "10.32870/prot.i28.487","10.32870/prot.i28.489","10.32870/prot.i28.490",
    "10.32870/prot.i28.491"
  ];
  for (const doi of dois) {
    assert.ok(curatedDois.has(doi.toLowerCase()));
    assert.equal(queue.records.some(record => record.doi === doi), false);
    assert.equal(queue.nextTenCandidatesWithoutEditorialEvidence.includes(doi), false);
  }
});


test("número 29 sale completo de la cola tras verificar el fascículo oficial", () => {
  const dois = ["10.32870/prot.i29.499","10.32870/prot.i29.509","10.32870/prot.i29.501","10.32870/prot.i29.477","10.32870/prot.i29.497","10.32870/prot.i29.496","10.32870/prot.i29.504","10.32870/prot.i29.488","10.32870/prot.i29.503","10.32870/prot.i29.494"];
  for (const doi of dois) {
    assert.ok(curatedDois.has(doi.toLowerCase()));
    assert.equal(queue.records.some(record => record.doi === doi), false);
    assert.equal(queue.nextTenCandidatesWithoutEditorialEvidence.includes(doi), false);
  }
});


test("i27.452 sale de la cola con evidencia literal del PDF oficial", () => {
  const doi = "10.32870/prot.i27.452";
  assert.ok(curatedDois.has(doi));
  assert.equal(queue.records.some(record => record.doi === doi), false);
  assert.equal(queue.nextTenCandidatesWithoutEditorialEvidence.includes(doi), false);
});


test("i27.461 sale de la cola con evidencia literal de la página oficial", () => {
  const doi = "10.32870/prot.i27.461";
  assert.ok(curatedDois.has(doi));
  assert.equal(queue.records.some(record => record.doi === doi), false);
  assert.equal(queue.nextTenCandidatesWithoutEditorialEvidence.includes(doi), false);
});


test("número 27 sale completo de la cola tras verificar sus diez artículos", () => {
  const dois = [
    "10.32870/prot.i27.474","10.32870/prot.i27.469","10.32870/prot.i27.453",
    "10.32870/prot.i27.457","10.32870/prot.i27.460","10.32870/prot.i27.435",
    "10.32870/prot.i27.452","10.32870/prot.i27.461","10.32870/prot.i27.463",
    "10.32870/prot.i27.468"
  ];
  for (const doi of dois) {
    assert.ok(curatedDois.has(doi.toLowerCase()));
    assert.equal(queue.records.some(record => record.doi === doi), false);
    assert.equal(queue.nextTenCandidatesWithoutEditorialEvidence.includes(doi), false);
  }
});


test("i24.420 sale de la cola con evidencia literal de la página oficial", () => {
  const doi = "10.32870/prot.i24.420";
  assert.ok(curatedDois.has(doi));
  assert.equal(queue.records.some(record => record.doi === doi), false);
  assert.equal(queue.nextTenCandidatesWithoutEditorialEvidence.includes(doi), false);
});


test("i24.376 queda confirmada sin palabras clave editoriales y no se inventan etiquetas", () => {
  const doi = "10.32870/prot.i24.376";
  const resolved = resolvedWithoutKeywords.find(record => record.doi === doi);
  assert.ok(resolved);
  assert.equal(resolved.documentKind, "translation");
  assert.equal(resolved.editorialKeywordStatus, "verified-absent");
  assert.equal(Object.hasOwn(resolved, "keywords"), false);
  assert.equal(Object.hasOwn(resolved, "editorialKeywords"), false);
  assert.equal(queue.records.some(record => record.doi === doi), false);
  assert.equal(curatedDois.has(doi), false);
  assert.equal(queue.counts.confirmedWithoutEditorialKeywords, 1);
  assert.equal(queue.counts.awaitingPublicationEvidence, 71);
});

test("número 24 queda resuelto sin fingir keywords para su traducción", () => {
  const curatedIssueDois = [
    "10.32870/prot.i24.420","10.32870/prot.i24.413","10.32870/prot.i24.408",
    "10.32870/prot.i24.353","10.32870/prot.i24.375"
  ];
  for (const doi of curatedIssueDois) assert.ok(curatedDois.has(doi));
  assert.ok(resolvedWithoutKeywordDois.has("10.32870/prot.i24.376"));
  assert.equal(queue.records.some(record => record.doi.includes("prot.i24.")), false);
});
