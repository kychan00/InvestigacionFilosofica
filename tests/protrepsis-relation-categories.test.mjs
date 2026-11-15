import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PROTREPSIS_RELATION_CATEGORY_LABELS,
  protrepsisRelationCategories,
  protrepsisRelationCategoryMetadata
} from "../js/protrepsis-relation-categories.js";

const [corpus, overlay, recovery] = await Promise.all([
  readFile("src/data/cucsh-filosofia.json", "utf8").then(JSON.parse),
  readFile("src/data/protrepsis-editorial-keywords.json", "utf8").then(JSON.parse),
  readFile("src/data/protrepsis-editorial-recovery-queue.json", "utf8").then(JSON.parse)
]);

const byKeyword = new Map(overlay.records.map(row => [row.doi.toLowerCase(), row]));
const byAbsent = new Map((recovery.resolvedWithoutEditorialKeywords || []).map(row => [row.doi.toLowerCase(), row]));
const protrepsis = corpus.records.filter(row => row.journal === "Protrepsis" && row.doi).map(row => {
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

test("los 247 DOI de Protrepsis reciben al menos una categoría de relación", () => {
  assert.equal(protrepsis.length, 247);
  for (const record of protrepsis) {
    const categories = protrepsisRelationCategories(record);
    assert.ok(categories.length >= 1 && categories.length <= 4, record.doi);
    for (const category of categories) {
      assert.ok(PROTREPSIS_RELATION_CATEGORY_LABELS.includes(category), category);
    }
  }
});

test("la taxonomía usa primero palabras clave editoriales y no las reemplaza", () => {
  const record = protrepsis.find(row => row.doi === "10.32870/prot.i25.430");
  const meta = protrepsisRelationCategoryMetadata(record);
  assert.equal(meta.origin, "keyword-derived");
  assert.ok(meta.categories.includes("Epistemología"));
  assert.deepEqual(record.editorialKeywords, ["Epistemología", "Hechos", "Interpretación", "Sujeto", "Verdad"]);
  assert.match(meta.note, /palabras clave editoriales verificadas/);
});

test("un artículo puede relacionarse con varias áreas filosóficas", () => {
  const record = protrepsis.find(row => row.doi === "10.32870/prot.i23.345");
  const categories = protrepsisRelationCategories(record);
  assert.ok(categories.includes("Lenguaje y hermenéutica"));
  assert.ok(categories.includes("Ontología"));
});

test("los registros verificados sin keywords reciben categorías derivadas claramente separadas", () => {
  const translation = protrepsis.find(row => row.doi === "10.32870/prot.i24.376");
  const translationMeta = protrepsisRelationCategoryMetadata(translation);
  assert.equal(translationMeta.origin, "text-derived-no-keywords");
  assert.ok(translationMeta.categories.includes("Historia de la filosofía"));

  const creative = protrepsis.find(row => row.doi === "10.32870/prot.i16.224");
  const creativeMeta = protrepsisRelationCategoryMetadata(creative);
  assert.equal(creativeMeta.origin, "text-derived-no-keywords");
  assert.ok(creativeMeta.categories.includes("Literatura y creación"));

  const review = protrepsis.find(row => row.doi === "10.32870/prot.i16.222");
  const reviewMeta = protrepsisRelationCategoryMetadata(review);
  assert.equal(reviewMeta.origin, "text-derived-no-keywords");
  assert.ok(reviewMeta.categories.includes("Recepción filosófica"));
});

test("categorías y keywords permanecen conceptos distintos", () => {
  const record = protrepsis.find(row => row.doi === "10.32870/prot.i25.409");
  const categories = protrepsisRelationCategories(record);
  assert.ok(record.editorialKeywords.includes("Knausgård"));
  assert.equal(categories.includes("Knausgård"), false);
  assert.ok(categories.includes("Fenomenología y existencia") || categories.includes("Ontología"));
});
