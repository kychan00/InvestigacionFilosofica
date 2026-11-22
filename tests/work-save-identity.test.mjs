import test from "node:test";
import assert from "node:assert/strict";
import { workSaveKey, findSavedWork } from "../js/work-save-identity.js";

test("DOI identifies the same work across search, normalized records and source URL forms", () => {
  const candidate = {
    id: "W123456789",
    title: "Fenomenología del espíritu",
    doi: "https://doi.org/10.1234/Hegel.1807",
    authors: [{ name: "Georg Wilhelm Friedrich Hegel" }],
    year: 1807
  };
  const saved = {
    id: "work-phenomenologia-s8m9",
    sourceRecordId: "https://openalex.org/W123456789",
    doi: "10.1234/hegel.1807",
    title: candidate.title,
    authors: candidate.authors,
    year: candidate.year
  };
  assert.equal(workSaveKey(candidate), "doi:10.1234/hegel.1807");
  assert.equal(workSaveKey(saved), workSaveKey(candidate));
  assert.equal(findSavedWork(candidate, [saved]), saved);
});

test("OpenAlex IDs and titles match only compatible bibliographic records", () => {
  const source = { id: "https://openalex.org/W987654321", title: "Obra sin DOI" };
  const library = { id: "work-obra-x3", sourceRecordId: "W987654321", title: source.title };
  assert.equal(workSaveKey(source), "source:w987654321");
  assert.equal(workSaveKey(library), workSaveKey(source));
  assert.equal(findSavedWork(source, [library]), library);
  assert.notEqual(
    workSaveKey({ title: "Kant y la razón pura", year: 2023,
      authors: [{ name: "María García" }] }),
    workSaveKey({ title: "Kant y la razón pura", year: 2023,
      authors: [{ name: "Otra persona" }] }),
    "Same-title works by different authors must not be collapsed"
  );
  assert.equal(findSavedWork({ title: "No existe" }, [library]), null);
});

test("works lacking provider identifiers can be saved by normalized title and authors", () => {
  const work = { title: "Ética y política", authors: ["José Pérez"], year: 2019 };
  const saved = {
    id: "work-etica-y-politica-k32",
    title: "Etica y politica",
    authors: [{ name: "Jose Perez" }],
    year: 2019
  };
  assert.equal(workSaveKey(work), workSaveKey(saved));
  assert.equal(findSavedWork(work, [saved]), saved);
  assert.equal(workSaveKey({ title: "" }), "");
});
