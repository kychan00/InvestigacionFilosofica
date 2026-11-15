import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dataset = JSON.parse(await readFile(
  new URL("../src/data/cucsh-filosofia.json", import.meta.url), "utf8"
));
const keywords = JSON.parse(await readFile(
  new URL("../src/data/quadripartita-editorial-keywords.json", import.meta.url), "utf8"
));
const queue = JSON.parse(await readFile(
  new URL("../src/data/quadripartita-editorial-recovery-queue.json", import.meta.url), "utf8"
));

const corpus = dataset.records.filter(record => record.journal === "Quadripartita Ratio");
const corpusDois = new Set(corpus.map(record => record.doi));
const keywordDois = keywords.records.map(record => record.doi);
const pendingDois = queue.records.map(record => record.doi);
const absentDois = queue.resolvedWithoutEditorialKeywords.map(record => record.doi);
const resolvedDois = [...keywordDois, ...pendingDois, ...absentDois];

test("Quadripartita editorial: DOI-first audit covers the complete 88-item corpus", () => {
  assert.equal(corpus.length, 88);
  assert.equal(corpusDois.size, 88);
  assert.equal(new Set(resolvedDois).size, 88);
  assert.deepEqual(new Set(resolvedDois), corpusDois);
});

test("Quadripartita editorial: literal keywords, pending and verified-absent stay disjoint", () => {
  assert.equal(new Set(keywordDois).size, keywordDois.length);
  assert.equal(new Set(pendingDois).size, pendingDois.length);
  assert.equal(new Set(absentDois).size, absentDois.length);
  for (const doi of keywordDois) assert.ok(!pendingDois.includes(doi) && !absentDois.includes(doi), doi);
  for (const doi of pendingDois) assert.ok(!absentDois.includes(doi), doi);
});

test("Quadripartita editorial: curated records only contain explicit non-empty keyword arrays", () => {
  for (const record of keywords.records) {
    assert.ok(corpusDois.has(record.doi), record.doi);
    assert.ok(Array.isArray(record.keywords) && record.keywords.length > 0, record.doi);
    assert.ok(record.evidence, record.doi);
    assert.ok(record.verifiedAt, record.doi);
  }
});

test("Quadripartita editorial: pending records point to the official OJS article page", () => {
  for (const record of queue.records) {
    assert.equal(record.editorialKeywordStatus, "pending-verification", record.doi);
    assert.match(record.canonical || "", /^https:\/\/quadripartitaratio\.cucsh\.udg\.mx\/index\.php\/QR\/article\/view\/\d+$/, record.doi);
  }
});
