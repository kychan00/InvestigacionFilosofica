import test from "node:test";
import assert from "node:assert/strict";
import {
  articleCategories,
  articleCategoryMetadata,
  articleTopicMetadata,
  articleTopics,
  derivedArticleTopics
} from "../js/journal-article-topics.js";

const example = {
  journal: "Protrepsis",
  title: "Epistemología crítica de la violencia cultural y la discriminación racial en estudiantes de pueblos originarios",
  abstract: "El ensayo aborda la violencia cultural y la discriminación racial en estudiantes de pueblos originarios desde una perspectiva epistemológica crítica. Estas formas de exclusión están arraigadas en estructuras de poder. La violencia simbólica permite comprender la desigualdad. El texto propone una educación intercultural que promueva justicia epistémica y social. Los estudiantes indígenas resisten las estructuras de exclusión."
};

test("el artículo de Núm. 30 recibe una descripción temática rica cuando OAI no trae subjects", () => {
  const topics = derivedArticleTopics(example, 8);
  for (const expected of [
    "Epistemología crítica",
    "Violencia cultural",
    "Discriminación racial",
    "Estudiantes indígenas",
    "Educación intercultural",
    "Justicia epistémica",
    "Violencia simbólica",
    "Pueblos originarios"
  ]) assert.ok(topics.includes(expected), "Missing derived topic: " + expected);
  assert.equal(topics.length, 8);
});

test("palabras clave editoriales siempre tienen prioridad sobre inferencias", () => {
  const record = {
    ...example,
    editorialKeywords: [
      "Estudiantes indígenas",
      "violencia cultural",
      "discriminación racial",
      "epistemología crítica",
      "educación intercultural",
      "justicia epistémica"
    ]
  };
  const meta = articleTopicMetadata(record);
  assert.equal(meta.origin, "editorial");
  assert.equal(meta.label, "Palabras clave editoriales");
  assert.deepEqual(meta.allTopics, record.editorialKeywords);
  assert.match(meta.note, /Publicadas por la revista/);
});

test("temas OpenAlex se distinguen de palabras clave editoriales", () => {
  const meta = articleTopicMetadata({
    title: "Mente, computación e inteligencia",
    journal: "Protrepsis",
    historicalSource: "OpenAlex",
    subjects: ["mind", "artificial intelligence", "philosophy of mind"]
  });
  assert.equal(meta.origin, "bibliographic");
  assert.equal(meta.label, "Temas bibliográficos");
  assert.match(meta.note, /OpenAlex/);
  assert.deepEqual(meta.topics, ["mind","artificial intelligence","philosophy of mind"]);
});

test("si no se solicita inferencia, un registro sin etiquetas queda vacío", () => {
  assert.deepEqual(articleTopics(example,{derive:false}),[]);
});

test("las etiquetas duplicadas documentadas se normalizan sin alterar su escritura", () => {
  const meta=articleTopicMetadata({
    subjects:["Ética"," ética ","BIOÉTICA","bioética"]
  });
  assert.deepEqual(meta.allTopics,["Ética","BIOÉTICA"]);
});


test("las etiquetas ricas exponen un contrato explícito de categorías", () => {
  const record = {
    ...example,
    editorialKeywords: ["Violencia cultural", "Justicia epistémica"]
  };
  const meta = articleCategoryMetadata(record);
  assert.equal(meta.label, "Categorías editoriales");
  assert.equal(meta.origin, "editorial");
  assert.deepEqual(articleCategories(record), ["Violencia cultural", "Justicia epistémica"]);
});

test("las categorías derivadas conservan su procedencia cuando no hay metadata editorial", () => {
  const meta = articleCategoryMetadata(example, { derive: true, limit: 8 });
  assert.equal(meta.label, "Categorías derivadas");
  assert.equal(meta.origin, "derived");
  assert.ok(meta.allTopics.includes("Epistemología crítica"));
  assert.ok(meta.allTopics.includes("Pueblos originarios"));
});
