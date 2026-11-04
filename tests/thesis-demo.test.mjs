import test from "node:test";
import assert from "node:assert/strict";
import {
  approvedInstitutionalUrl,
  approvedReferenceUrl,
  filterOptions,
  normalized,
  pageSlice,
  searchTheses,
  validateIndex,
  validatePhilosophyIndex,
} from "../src/core/thesis-demo-search.js";

const records = [
  {
    id: "thesis:work:1",
    title: "La fenomenología y el lenguaje",
    authors: ["María Hernández"],
    directors: ["Ángel Núñez"],
    program: "Licenciatura en Filosofía",
    degree: "licenciatura",
    unit: "CUCSH",
    year: 2021,
    abstractExcerpt: "Interpretación del mundo de la vida.",
    keywords: ["fenomenología", "interpretación"],
    sourceUrl: "https://hdl.handle.net/20.500.12104/84204",
  },
  {
    id: "thesis:work:2",
    title: "Historia de México y cultura",
    authors: ["Juan López"],
    directors: [],
    program: "Maestría en Historia",
    degree: "maestria",
    unit: "CUCSH",
    year: 2018,
    abstractExcerpt: "",
    keywords: ["historia"],
    sourceUrl: "https://riudg.udg.mx/handle/20.500.12104/84205",
  },
  {
    id: "thesis:work:3",
    title: "Ética e investigación",
    authors: ["Elena Torres"],
    directors: [],
    program: "Licenciatura en Filosofía",
    degree: "licenciatura",
    unit: "CUCSH",
    year: null,
    abstractExcerpt: "",
    keywords: [],
    sourceUrl: null,
  },
];

test("search is accent-insensitive and matches across supported metadata", () => {
  assert.equal(normalized("  FilosofÍA   AnalÍTICA  "), "filosofia analitica");
  assert.deepEqual(searchTheses(records, { query: "fenomenologia" }).map(x => x.id), [
    "thesis:work:1",
  ]);
  assert.deepEqual(searchTheses(records, { query: "maria lenguaje" }).map(x => x.id), [
    "thesis:work:1",
  ]);
  assert.deepEqual(searchTheses(records, { query: "Ángel" }).map(x => x.id), [
    "thesis:work:1",
  ]);
});

test("filters exclude unknown dates for constrained year ranges", () => {
  assert.deepEqual(searchTheses(records, { fromYear: "2020" }).map(x => x.id), [
    "thesis:work:1",
  ]);
  assert.deepEqual(searchTheses(records, {
    program: "Licenciatura en Filosofía",
    toYear: "2020",
  }).map(x => x.id), []);
  assert.deepEqual(searchTheses(records, { degree: "maestria", unit: "CUCSH" }).map(x => x.id), [
    "thesis:work:2",
  ]);
});

test("pagination handles pages and empty results", () => {
  assert.deepEqual(pageSlice(records, 2, 2).records.map(x => x.id), ["thesis:work:3"]);
  assert.equal(pageSlice(records, -10, 2).page, 1);
  assert.equal(pageSlice([], 20, 2).pages, 1);
  assert.deepEqual(filterOptions(records, "degree"), ["licenciatura", "maestria"]);
});

test("source links never target PDF downloads or external hosts", () => {
  assert.equal(
    approvedInstitutionalUrl("https://hdl.handle.net/20.500.12104/84204"),
    "https://hdl.handle.net/20.500.12104/84204",
  );
  assert.equal(
    approvedInstitutionalUrl("https://www.cucsh.udg.mx/node/official-reference"),
    "https://www.cucsh.udg.mx/node/official-reference",
  );
  assert.equal(
    approvedInstitutionalUrl("https://editorial.udg.mx/gpd-author/guillermo-castillo-ramirez.html"),
    "https://editorial.udg.mx/gpd-author/guillermo-castillo-ramirez.html",
  );
  assert.equal(
    approvedInstitutionalUrl("https://www.biblioteca.cucsh.udg.mx/?q=node%2F8243"),
    "https://www.biblioteca.cucsh.udg.mx/?q=node%2F8243",
  );
  assert.equal(approvedInstitutionalUrl("https://www.biblioteca.cucsh.udg.mx/?session=secret"), null);
  assert.equal(approvedInstitutionalUrl("https://www.biblioteca.cucsh.udg.mx/?q=node%2F8243&x=1"), null);
  assert.equal(approvedInstitutionalUrl("https://riudg.udg.mx/bitstreams/123"), null);
  assert.equal(approvedInstitutionalUrl("https://riudg.udg.mx/file.pdf"), null);
  assert.equal(approvedInstitutionalUrl("https://not-udg.example/handle/1"), null);
  assert.equal(approvedInstitutionalUrl("javascript:alert(1)"), null);
});

test("demo data is fail-closed to the known immutable V2", () => {
  const base = {
    schemaVersion: "thesis-demo-index-v1",
    sourceRelease: "thesis-effective-corpus-v2",
    referenceOnly: true,
    totalIncluded: 566,
    records: [
      ...records,
      ...Array.from({ length: 563 }, (_, index) => ({
        ...records[0], id: `thesis:work:demo-${index}`,
      })),
    ],
  };
  assert.equal(validateIndex(base).records.length, 566);
  assert.throws(() => validateIndex({ ...base, totalIncluded: 567 }), /índice bibliográfico/);
  assert.throws(() => validateIndex({
    ...base, records: [...base.records.slice(0, -1), records[0]],
  }), /duplicada/);
  assert.throws(() => validateIndex({
    ...base, records: [{ ...records[0], sourceUrl: "https://evil.example/x" }, ...base.records.slice(1)],
  }), /no institucional/);
});


test("philosophy reference links remain reference-only and allow curated sources", () => {
  assert.equal(approvedReferenceUrl("https://philarchive.org/rec/GALFDL-5"), "https://philarchive.org/rec/GALFDL-5");
  assert.equal(approvedReferenceUrl("https://wdg.biblio.udg.mx/"), "https://wdg.biblio.udg.mx/");
  assert.equal(approvedReferenceUrl("https://philarchive.org/file.pdf"), null);
  assert.equal(approvedReferenceUrl("https://evil.example/rec/1"), null);
});

test("philosophy search filters core, crossings and review without mutating programs", () => {
  const philosophy = [
    { ...records[0], philosophyStatus: "include", philosophyRole: "program-core", philosophyEvidence: "programa exacto" },
    { ...records[1], philosophyStatus: "include", philosophyRole: "philosophical-content", philosophyEvidence: "marco de Ricoeur" },
    { ...records[2], philosophyStatus: "review", philosophyRole: "program-core-candidate", philosophyEvidence: "pendiente" },
  ];
  assert.equal(searchTheses(philosophy, { philosophyRole: "program-core" }).length, 1);
  assert.equal(searchTheses(philosophy, { philosophyRole: "philosophical-content" }).length, 1);
  assert.equal(searchTheses(philosophy, { philosophyRole: "review" }).length, 1);
  assert.deepEqual(searchTheses(philosophy, { query: "ricoeur" }).map(x => x.id), ["thesis:work:2"]);
  assert.equal(philosophy[1].program, "Maestría en Historia");
});

test("philosophy public index is fail-closed to the T2CI contract", () => {
  const philosophyRecords = Array.from({ length: 18 }, (_, index) => ({
    id: index < 7 ? `thesis:work:ph-${index}` : `philosophy:reference:${index}`,
    title: `Referencia filosófica ${index}`,
    authors: [`Autora ${index}`],
    directors: [],
    program: index % 2 ? "Licenciatura en Filosofía" : "Maestría en Estudios Filosóficos",
    degree: index % 2 ? "licenciatura" : "maestria",
    unit: "CUCSH",
    year: 2020,
    abstractExcerpt: "",
    keywords: [],
    sourceUrl: `https://hdl.handle.net/20.500.12104/${90000 + index}`,
    philosophyStatus: index >= 16 ? "review" : "include",
    philosophyRole: index >= 16 ? "program-core-candidate" : "program-core",
    philosophyEvidence: "evidencia",
    validationTier: "fixture",
  }));
  const payload = {
    schemaVersion: "thesis-philosophy-public-index-v1",
    revision: "2026-11-04.t2ci-v1",
    sourceRelease: "thesis-effective-corpus-v2",
    referenceOnly: true,
    canonicalAdmissionMutation: false,
    preserveActualProgram: true,
    doctoralPolicy: { exactDoctorateProgramPresent: false },
    documentedPhilosophyPrograms: [
      { programRef: "program:udg:lic-filosofia", name: "Licenciatura en Filosofía", records: 6, include: 5, review: 1 },
      { programRef: "program:udg:mae-estudios-filosoficos", name: "Maestría en Estudios Filosóficos", records: 3, include: 2, review: 1 },
      { programRef: "program:udg:mae-filosofia-historica", name: "Maestría en Filosofía", records: 2, include: 2, review: 0 },
    ],
    metrics: { records: 18, byStatus: { include: 16, review: 2 }, actualProgramsRepresented: 10 },
    records: philosophyRecords,
  };
  assert.equal(validatePhilosophyIndex(payload).records.length, 18);
  assert.throws(() => validatePhilosophyIndex({ ...payload, revision: "other" }), /T2CI/);
  assert.throws(() => validatePhilosophyIndex({
    ...payload,
    records: [{ ...philosophyRecords[0], sourceUrl: "https://evil.example/x" }, ...philosophyRecords.slice(1)],
  }), /fuente no aprobada/);
});
