import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SINCRONIA_RELATION_CATEGORY_LABELS,
  sincroniaKeywordMetadata,
  sincroniaKeywords,
  sincroniaRelationCategoryMetadata,
  sincroniaRelationCategories
} from "../js/sincronia-relation-categories.js";

const corpus = JSON.parse(await readFile("src/data/cucsh-filosofia.json", "utf8"));
const sincronia = corpus.records.filter(record => record.journal === "Sincronía");

test("los registros de Sincronía reciben de 1 a 4 categorías de relación y no pierden bibliografía", () => {
  assert.equal(sincronia.length, 1454);
  for (const record of sincronia) {
    const before = JSON.stringify(record);
    const categories = sincroniaRelationCategories(record);
    assert.ok(categories.length >= 1 && categories.length <= 4, record.id || record.title);
    assert.equal(new Set(categories).size, categories.length);
    for (const category of categories) {
      assert.ok(SINCRONIA_RELATION_CATEGORY_LABELS.includes(category), category);
    }
    assert.equal(JSON.stringify(record), before, "No se deben modificar datos originales");
  }
});

test("la taxonomía deja de reducir Sincronía a 10 áreas filosóficas genéricas", () => {
  assert.ok(SINCRONIA_RELATION_CATEGORY_LABELS.length >= 20);
  const digital = sincroniaRelationCategories({
    title: "Cultura digital y memoria",
    abstract: "Tecnología, digitalización y sociedad"
  });
  assert.ok(digital.includes("Tecnología y cultura digital"));
  assert.ok(digital.includes("Cultura e identidad"));
  const literary = sincroniaRelationCategories({
    title: "Crítica literaria de la novela contemporánea",
    subjects: ["Literatura", "Crítica literaria"]
  });
  assert.ok(literary.includes("Literatura y creación"));
  assert.ok(literary.includes("Crítica literaria y teoría narrativa"));
});

test("se priorizan las palabras clave sólo cuando su fuente editorial está verificada", () => {
  const record = {
    journal: "Sincronía",
    title: "Política y ciudadanía",
    editorialKeywordSource: "verified-publication",
    editorialKeywords: ["Pedagogía", "Enseñanza"],
    subjects: ["Política"]
  };
  assert.equal(sincroniaRelationCategoryMetadata(record).origin, "keyword-derived");
  assert.equal(sincroniaRelationCategories(record)[0], "Educación y pedagogía");
  assert.deepEqual(sincroniaKeywords(record), ["Pedagogía", "Enseñanza"]);
  assert.equal(sincroniaKeywordMetadata(record).label, "Palabras clave editoriales");
});

test("subjects son temas bibliográficos, nunca keywords editoriales inventadas", () => {
  const record = {
    journal: "Sincronía",
    title: "Comunicación, discurso e identidades",
    editorialKeywords: ["Palabra clave sin verificar"],
    subjects: ["Análisis del discurso", "Comunicación"]
  };
  const meta = sincroniaKeywordMetadata(record);
  assert.equal(meta.origin, "bibliographic");
  assert.equal(meta.label, "Temas bibliográficos registrados");
  assert.deepEqual(meta.allTopics, record.subjects);
  assert.match(meta.note, /no se presentan como palabras clave editoriales verificadas/);
  assert.equal(sincroniaRelationCategoryMetadata(record).origin, "metadata-derived");
  assert.ok(sincroniaRelationCategories(record).includes("Comunicación, medios y periodismo"));
});

test("ausencia de temas no genera etiquetas ficticias aunque haya categorías textuales", () => {
  const record = {
    journal: "Sincronía",
    title: "Una reseña de un libro de poesía",
    abstract: "Una lectura breve de poesía contemporánea",
    editorialKeywords: ["No verificada"]
  };
  assert.deepEqual(sincroniaKeywords(record), []);
  const meta = sincroniaKeywordMetadata(record);
  assert.equal(meta.origin, "none");
  assert.match(meta.emptyLabel, /Sin palabras clave verificadas/);
  assert.ok(sincroniaRelationCategories(record).includes("Reseñas, entrevistas y recepción"));
  assert.ok(sincroniaRelationCategories(record).includes("Literatura y creación"));
});

test("los temas registrados no se duplican por tildes o variantes de mayúsculas", () => {
  assert.deepEqual(sincroniaKeywords({
    subjects: ["Ética", "ética", " ETICA ", "Cultura digital"]
  }), ["Ética", "Cultura digital"]);
});

test("casos sin señales reciben fallback honesto, no palabras clave editoriales", () => {
  const record = { journal: "Sincronía", title: "Un documento histórico sin clasificación" };
  const meta = sincroniaRelationCategoryMetadata(record);
  assert.deepEqual(meta.categories, ["Humanidades y cultura"]);
  assert.equal(meta.origin, "text-derived");
  assert.deepEqual(sincroniaKeywords(record), []);
});

test("UI separa categorías y etiquetas y mantiene filtros accesibles", async () => {
  const html = await readFile("revistas/udg/sincronia.html", "utf8");
  const runtime = await readFile("js/journal-page.js", "utf8");
  const css = await readFile("css/sincronia-taxonomy.css", "utf8");
  assert.match(runtime, /sincroniaRelationCategoryMetadata/);
  assert.match(runtime, /sincroniaRelationCategories/);
  assert.match(runtime, /sincroniaKeywordMetadata/);
  assert.match(runtime, /sincroniaKeywords/);
  assert.match(runtime, /journalId === "protrepsis" \|\| journalId === "quadripartita"/);
  assert.match(html, /sincronia-taxonomy\.css\?v=20261115-relations-v1/);
  assert.match(html, /journal-page\.js\?v=20261115-sincronia-relations-v1/);
  assert.match(html, /id="journal-category-all"/);
  assert.match(html, /id="journal-issue-all"/);
  assert.match(html, /Categoría de relación/);
  assert.match(html, /ETIQUETAS BIBLIOGRÁFICAS/);
  assert.match(runtime, /data-taxonomy-value/);
  assert.match(css, /\.relation-category-chip/);
  assert.match(css, /\.keyword-filter-chip/);
  assert.match(css, /\.topic-category-filter/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  for (const file of ["protrepsis.html", "quadripartita-ratio.html"]) {
    const other = await readFile("revistas/udg/" + file, "utf8");
    assert.doesNotMatch(other, /sincronia-taxonomy\.css/);
  }
});
