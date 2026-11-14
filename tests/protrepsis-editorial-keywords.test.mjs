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

const batch05 = new Map([
  [
    "10.32870/prot.i23.374",
    [
      "mundo común",
      "pareja",
      "fraternidad",
      "compasión",
      "amistad"
    ]
  ],
  [
    "10.32870/prot.i23.404",
    [
      "Cuerpo",
      "labor",
      "acción",
      "pluralidad",
      "política"
    ]
  ],
  [
    "10.32870/prot.i21.316",
    [
      "Subjetivación",
      "género",
      "ideología",
      "tecnologías sociales"
    ]
  ],
  [
    "10.32870/prot.i21.278",
    [
      "Aborto",
      "moralidad",
      "conservadores",
      "liberales",
      "persona"
    ]
  ],
  [
    "10.32870/prot.i20.279",
    [
      "Filosofía para Niños y Jóvenes",
      "pensamiento crítico",
      "confinamiento",
      "pandemia",
      "comunidad de indagación"
    ]
  ],
  [
    "10.32870/prot.i20.290",
    [
      "Pragmatismo",
      "comunidad de indagación filosófica",
      "Filosofía para Niños",
      "asombro",
      "experiencia",
      "significado",
      "Lipman"
    ]
  ],
  [
    "10.32870/prot.i19.242",
    [
      "Verdad",
      "opinión",
      "Badiou",
      "doxa",
      "ética",
      "filosofía clásica"
    ]
  ],
  [
    "10.32870/prot.i19.256",
    [
      "San Agustín",
      "sabiduría",
      "academia",
      "Contra los académicos",
      "crítica filosófica",
      "filosofía medieval"
    ]
  ],
  [
    "10.32870/prot.i18.267",
    [
      "Habermas",
      "Kant",
      "ética discursiva",
      "humanidad",
      "intersubjetividad"
    ]
  ],
  [
    "10.32870/prot.i17.212",
    [
      "Muerte",
      "infinitud",
      "ser occidental",
      "Mismo y Otro",
      "ciencia y tecnología"
    ]
  ]
]);

const batch06 = new Map([
  [
    "10.32870/prot.i14.161",
    [
      "ética",
      "escritura",
      "literatura",
      "filosofía"
    ]
  ],
  [
    "10.32870/prot.i14.164",
    [
      "lectura filosófica",
      "método",
      "signos",
      "filosofía de la novela"
    ]
  ],
  [
    "10.32870/prot.i14.167",
    [
      "Fernando González",
      "Friedrich Nietzsche",
      "literatura",
      "estética"
    ]
  ],
  [
    "10.32870/prot.i14.174",
    [
      "estadio del espejo",
      "Yo-Tú",
      "encuentro",
      "dualismo",
      "introspección"
    ]
  ],
  [
    "10.32870/prot.i14.175",
    [
      "lenguaje",
      "nombre",
      "mito",
      "cosmogonía",
      "origen del lenguaje"
    ]
  ],
  [
    "10.32870/prot.i14.177",
    [
      "Esquemas",
      "nodos",
      "realidades",
      "sistema",
      "relaciones",
      "matemática"
    ]
  ],
  [
    "10.32870/prot.i21.318",
    [
      "Feminidad",
      "complicidad",
      "opresión",
      "formación",
      "internalización"
    ]
  ],
  [
    "10.32870/prot.i21.323",
    [
      "Feminismos",
      "filosofía",
      "crítica",
      "ontología",
      "cuerpo"
    ]
  ],
  [
    "10.32870/prot.i23.398",
    [
      "Tradición",
      "acción",
      "natalidad",
      "narración",
      "historia"
    ]
  ],
  [
    "10.32870/prot.i23.384",
    [
      "Kant",
      "Schopenhauer",
      "Übertragung",
      "teoría del conocimiento"
    ]
  ]
]);

const batch07 = new Map([
  [
    "10.32870/prot.i14.144",
    [
      "historia de la filosofía posmoderna",
      "filosofía de la historia",
      "hermenéutica analógica",
      "condición posmoderna",
      "construcción",
      "deconstrucción"
    ]
  ],
  [
    "10.32870/prot.i14.146",
    [
      "nihilismo",
      "décadence",
      "transparencia",
      "rendimiento",
      "positividad"
    ]
  ],
  [
    "10.32870/prot.i13.145",
    [
      "Epistemología",
      "psicología",
      "existencialismo",
      "metodología",
      "investigación"
    ]
  ],
  [
    "10.32870/prot.i13.148",
    [
      "Educación musical",
      "Fenomenología",
      "Herramientas técnicas de mediación",
      "Lebenswelt",
      "Schütz",
      "Vygotsky"
    ]
  ],
  [
    "10.32870/prot.i13.153",
    [
      "Humanidades",
      "construcción de una tesis",
      "investigación",
      "metodología"
    ]
  ],
  [
    "10.32870/prot.i13.154",
    [
      "Filosofía",
      "pregunta",
      "aprendizaje",
      "educación",
      "docente",
      "alumno"
    ]
  ],
  [
    "10.32870/prot.i9-10.127",
    [
      "Abuso",
      "Analogía",
      "Definición analítica",
      "Discurso científico",
      "Reconocimiento"
    ]
  ],
  [
    "10.32870/prot.i9-10.128",
    [
      "Foucault",
      "Deleuze",
      "Poder",
      "Infancia",
      "Saber pedagógico"
    ]
  ],
  [
    "10.32870/prot.i9-10.130",
    [
      "epistemología",
      "relatividad",
      "física",
      "espacio",
      "tiempo"
    ]
  ],
  [
    "10.32870/prot.i9-10.132",
    [
      "Kant",
      "espacio",
      "tiempo",
      "física newtoniana",
      "relatividad general",
      "“ontología de la experiencia”"
    ]
  ]
]);

const batch08 = new Map([
  [
    "10.32870/prot.i1.7",
    [
      "Paradigma",
      "Continuidad",
      "Discontinuidad",
      "Externalismo",
      "Internalismo",
      "Ciencia",
      "Alquimia",
      "Química"
    ]
  ],
  [
    "10.32870/prot.i4.50",
    [
      "Racionalismo",
      "substancias",
      "comunicación",
      "Descartes",
      "Spinoza",
      "modos",
      "atributos",
      "Leibniz",
      "armonía preestablecida",
      "Malebranche",
      "ocasionalismo",
      "Deus ex machina"
    ]
  ],
  [
    "10.32870/prot.i5.76",
    [
      "utopía",
      "homogeneidad",
      "distopía",
      "pluralismo"
    ]
  ],
  [
    "10.32870/prot.i5.77",
    [
      "Principio de actuación",
      "escuela de Frankfurt",
      "pensamiento crítico",
      "utopía"
    ]
  ],
  [
    "10.32870/prot.i6.92",
    [
      "Ciencia Cognitiva",
      "psicología cognitiva",
      "paradigma del procesamiento de información",
      "Inteligencia artificial",
      "PDP"
    ]
  ],
  [
    "10.32870/prot.i6.94",
    [
      "libre albedrío",
      "determinismo",
      "mente",
      "dualismo",
      "materialismo",
      "Mario Bunge",
      "Martin Mahner"
    ]
  ],
  [
    "10.32870/prot.i7-8.108",
    [
      "Siglo XVII",
      "anatomía",
      "cuerpo",
      "medicina",
      "fisiología",
      "filosofía natural"
    ]
  ],
  [
    "10.32870/prot.i7-8.109",
    [
      "Cyborg",
      "Biocapitalismo",
      "Ubjetos",
      "Hipersubsunción",
      "Feminismo",
      "Naturaleza Humana",
      "Naturaleza vs. Crianza",
      "Estudios Culturales"
    ]
  ],
  [
    "10.32870/prot.i7-8.111",
    [
      "Contrastación",
      "Poder heurístico",
      "Ciencia planetaria",
      "Sistema",
      "Atmósfera",
      "Equilibrio",
      "Gaia",
      "Teoría sintética"
    ]
  ],
  [
    "10.32870/prot.i9-10.129",
    [
      "Acción comunicativa",
      "Razón instrumental",
      "Modernidad",
      "Ilustración",
      "Racionalidad dramatúrgica",
      "Consenso"
    ]
  ]
]);

test("capa curada de Protrepsis conserva el lote 01 verificado DOI por DOI", () => {
  assert.equal(overlay.schemaVersion, 1);
  assert.equal(overlay.journal, "Protrepsis");
  assert.match(overlay.policy, /No se infieren/i);

  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.ok(records.length >= 80);

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
  assert.ok(records.length >= 80);
  for (const [doi, expectedKeywords] of batch04) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 04: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva el lote 05 DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch05.size, 10);
  assert.ok(records.length >= 80);
  for (const [doi, expectedKeywords] of batch05) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 05: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva el lote 06 DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch06.size, 10);
  assert.ok(records.length >= 80);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  for (const [doi, expectedKeywords] of batch06) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 06: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva el lote 07 DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch07.size, 10);
  assert.ok(records.length >= 80);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  for (const [doi, expectedKeywords] of batch07) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 07: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva el lote 08 histórico DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch08.size, 10);
  assert.ok(records.length >= 80);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  for (const [doi, expectedKeywords] of batch08) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 08: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});
