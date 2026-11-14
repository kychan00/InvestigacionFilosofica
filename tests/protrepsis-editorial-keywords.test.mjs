import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const overlay = JSON.parse(
  await readFile("src/data/protrepsis-editorial-keywords.json", "utf8")
);

const batch01 = new Map([
  ["10.32870/prot.i30.515", ["Velo","imagen","aparición","Petrarca","Simone Martini","Servio","fantasma"]],
  ["10.32870/prot.i30.514", ["Totalitarismo","México","exterminio","otredad","violencia"]],
  ["10.32870/prot.i30.511", ["Metáfora","mito","estigmatización","biopolítica","crisis sanitaria"]],
  ["10.32870/prot.i30.510", ["Estudiantes indígenas","violencia cultural","discriminación racial","epistemología crítica","educación intercultural","justicia epistémica"]],
  ["10.32870/prot.i30.495", ["Vitalismo","Dicotomía","Doble frenesí","Amor como caridad","Sociedad abierta"]],
  ["10.32870/prot.i29.509", ["Heidegger","tiempo","historia","hermenéutica","medida"]],
  ["10.32870/prot.i29.504", ["Negatividad","no-identidad","crítica inmanente","constelaciones"]],
  ["10.32870/prot.i29.499", ["Movimiento","continuidad","medición","numeración","alma"]],
  ["10.32870/prot.i29.477", ["redes sociales","transparencia","desinformación","Nayib Bukele","influencia digital","ciudadanía informada"]],
  ["10.32870/prot.i29.494", ["Duelo","violencia","nosotros","vulnerabilidad","proximidad"]]
]);

const batch02 = new Map([
  ["10.32870/prot.i29.503", ["Animalidad","muerte","tiempo","poesía"]],
  ["10.32870/prot.i29.497", ["Levinas","exclusión","violencia","género","ontología"]],
  ["10.32870/prot.i29.496", ["Hermenéutica","univocismo","equivocismo","analogía","cientificismo","posmodernidad"]],
  ["10.32870/prot.i29.488", ["Tiempo lineal","tiempo del oprimido","trauma","resistencia","memoria","anacronismo"]],
  ["10.32870/prot.i28.489", ["Foucault","cinismo","resistencia","arte"]],
  ["10.32870/prot.i28.483", ["Movimientos sociales","pacientes","derecho a la salud","ética"]],
  ["10.32870/prot.i27.474", ["Análisis","a priori","concepto","intuición","mundos posibles","síntesis"]],
  ["10.32870/prot.i27.469", ["Discernimiento reflexionante","juicio","pedagogía","crítica","finalidad de la naturaleza","ideas estéticas"]],
  ["10.32870/prot.i27.453", ["Capitalismo tardío","funcionalidad civilizatoria","mal del ímpetu","lo absurdo","desprendimiento","habitar este espacio"]],
  ["10.32870/prot.i27.457", ["Deber indirecto-directo","clemencia","libertad","justicia"]]
]);

const batch03 = new Map([
  ["10.32870/prot.i26.449", ["Marxismo crítico","emancipación","materialismo","cultura material"]],
  ["10.32870/prot.i26.447", ["Estética","espíritu","fealdad"]],
  ["10.32870/prot.i26.446", ["Idea","interpretación","obra de arte","fragmento","fenómeno originario"]],
  ["10.32870/prot.i26.442", ["Aura","cine","emancipación","fotografía","marxismo"]],
  ["10.32870/prot.i26.436", ["Escuela de Frankfurt","Instituto de Investigación Social","presente","fascismo","nueva derecha"]],
  ["10.32870/prot.i26.432", ["Concepto","cognición 4-E","habitar","filosofía del lenguaje","discurso"]],
  ["10.32870/prot.i26.425", ["Ibero Gutiérrez","Heidegger","recepción","filosofía en el Uruguay","actualidad"]],
  ["10.32870/prot.i25.422", ["Imagen","filosofía de la imagen","giro hacia la imagen","ciencia de la imagen","praxis negativa"]],
  ["10.32870/prot.i25.418", ["Historia","verdad","saber","máscara","olvido","creación","Chat GPT"]],
  ["10.32870/prot.i25.414", ["Ética","lenguaje","mística","mundo","lo inexpresable","el significado de la vida"]]
]);

const batch04 = new Map([
  ["10.32870/prot.i22.317", ["Cyborg feminismo","epistemología","ontología","logos","metáfora"]],
  ["10.32870/prot.i22.312", ["Epistemologías feministas","metáforas científicas","discurso científico"]],
  ["10.32870/prot.i22.336", ["Creencias generales","pseudoracionalidad","cierre epistémico","falacias narrativas"]],
  ["10.32870/prot.i22.328", ["Filosofía medieval","doctrinas filosóficas","bibliotecas novohispanas"]],
  ["10.32870/prot.i22.359", ["Amor","maldad","mecanicismo","libertad","deseo","egoísmo"]],
  ["10.32870/prot.i22.358", ["Platón","Sócrates","Eros","conocimiento","locura"]],
  ["10.32870/prot.i22.369", ["Platón","Alain Badiou","Slavoj Žižek","Agustín de Hipona","psicoanálisis","amor","verdad","melancolía"]],
  ["10.32870/prot.i22.354", ["Amor","afección","géneros de conocimiento","pasión"]],
  ["10.32870/prot.i22.348", ["Filosofía","sexualidad","seducción","producción","Baudrillard"]],
  ["10.32870/prot.i22.343", ["Bien","belleza","verdad","mujeres filósofas","justicia","equilibrio"]]
]);

test("capa curada de Protrepsis conserva el lote 01 verificado DOI por DOI", () => {
  assert.equal(overlay.schemaVersion, 1);
  assert.equal(overlay.journal, "Protrepsis");
  assert.match(overlay.policy, /No se infieren/i);

  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.ok(records.length >= 40);

  const seen = new Set();
  for (const record of records) {
    assert.match(record.doi, /^10\.32870\/prot\./);
    assert.ok(Array.isArray(record.keywords) && record.keywords.length > 0);
    assert.match(record.evidence, /^https?:\/\//);
    assert.match(record.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(seen.has(record.doi), false, "DOI duplicado: " + record.doi);
    seen.add(record.doi);
  }

  for (const [doi, expectedKeywords] of batch01) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 01: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
  }
});

test("capa curada de Protrepsis conserva el lote 02 verificado DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch02.size, 10);
  for (const [doi, expectedKeywords] of batch02) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 02: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva el lote 03 verificado DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch03.size, 10);
  for (const [doi, expectedKeywords] of batch03) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 03: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("el artículo de marketing usa exactamente las palabras clave publicadas", () => {
  const record = overlay.records.find(
    item => item.doi === "10.32870/prot.i29.477"
  );
  assert.deepEqual(record.keywords, [
    "redes sociales",
    "transparencia",
    "desinformación",
    "Nayib Bukele",
    "influencia digital",
    "ciudadanía informada"
  ]);
  for (const invented of ["Poder","Política","Ontología","Tecnología"]) {
    assert.equal(record.keywords.includes(invented), false);
  }
});

test("capa curada de Protrepsis conserva el lote 04 (número 22) DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch04.size, 10);
  assert.ok(records.length >= 40);
  for (const [doi, expectedKeywords] of batch04) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 04: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});
