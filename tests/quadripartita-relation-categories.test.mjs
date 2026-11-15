import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  QUADRIPARTITA_RELATION_CATEGORY_LABELS,
  quadripartitaRelationCategories,
  quadripartitaRelationCategoryMetadata
} from "../js/quadripartita-relation-categories.js";

const [corpus, overlay, recovery] = await Promise.all([
  readFile("src/data/cucsh-filosofia.json", "utf8").then(JSON.parse),
  readFile("src/data/quadripartita-editorial-keywords.json", "utf8").then(JSON.parse),
  readFile("src/data/quadripartita-editorial-recovery-queue.json", "utf8").then(JSON.parse)
]);

const byKeyword = new Map(overlay.records.map(row => [row.doi.toLowerCase(), row]));
const byAbsent = new Map((recovery.resolvedWithoutEditorialKeywords || []).map(row => [row.doi.toLowerCase(), row]));
const quadripartita = corpus.records.filter(row => row.journal === "Quadripartita Ratio" && row.doi).map(row => {
  const doi = row.doi.toLowerCase();
  const curated = byKeyword.get(doi);
  const absent = byAbsent.get(doi);
  return {
    ...row,
    editorialKeywords: curated?.keywords || [],
    editorialKeywordStatus: curated ? "verified" : absent?.editorialKeywordStatus,
    editorialDocumentKind: absent?.documentKind || null
  };
});

test("los 88 DOI de Quadripartita reciben entre una y cuatro categorías de relación", () => {
  assert.equal(quadripartita.length, 88);
  for (const record of quadripartita) {
    const categories = quadripartitaRelationCategories(record);
    assert.ok(categories.length >= 1 && categories.length <= 4, record.doi);
    for (const category of categories) {
      assert.ok(QUADRIPARTITA_RELATION_CATEGORY_LABELS.includes(category), category);
    }
  }
});

test("las categorías priorizan keywords editoriales sin reemplazarlas", () => {
  const record = quadripartita.find(row => row.doi === "10.32870/qr.v2i3.46");
  const meta = quadripartitaRelationCategoryMetadata(record);
  assert.equal(meta.origin, "keyword-derived");
  assert.ok(meta.categories.includes("Falacias y evaluación"));
  assert.ok(meta.categories.includes("Lógica"));
  assert.deepEqual(record.editorialKeywords, ["composición", "división", "falacias", "Aristóteles", "lógica"]);
});

test("un artículo puede relacionarse con varias áreas", () => {
  const record = quadripartita.find(row => row.doi === "10.32870/qr.v1i1.67");
  const categories = quadripartitaRelationCategories(record);
  assert.ok(categories.includes("Ética y bioética"));
  assert.ok(categories.includes("Política y deliberación") || categories.includes("Teoría de la argumentación"));
});

test("reseñas verificadas sin keywords reciben una categoría derivada separada", () => {
  const record = quadripartita.find(row => row.doi === "10.32870/qr.v9i18.163");
  const meta = quadripartitaRelationCategoryMetadata(record);
  assert.equal(meta.origin, "text-derived-no-keywords");
  assert.ok(meta.categories.includes("Recepción y reseñas"));
  assert.deepEqual(record.editorialKeywords, []);
});

test("keywords editoriales y categorías de relación siguen siendo conceptos distintos", () => {
  const record = quadripartita.find(row => row.doi === "10.32870/qr.v8i16.149");
  const categories = quadripartitaRelationCategories(record);
  assert.ok(record.editorialKeywords.includes("ponderación"));
  assert.equal(categories.includes("ponderación"), false);
  assert.ok(categories.includes("Teoría de la argumentación") || categories.includes("Lógica"));
});
