import test from "node:test";
import assert from "node:assert/strict";
import {
  approvedInstitutionalUrl,
  filterOptions,
  normalized,
  pageSlice,
  searchTheses,
  validateIndex,
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
