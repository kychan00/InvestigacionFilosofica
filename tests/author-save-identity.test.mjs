import test from "node:test";
import assert from "node:assert/strict";
import { authorSaveKey, authorSaveKeys, findSavedAuthor } from "../js/author-save-identity.js";

test("ORCID identifies the same author across public and saved records", () => {
  const publicAuthor = {
    id: "A123456789",
    displayName: "Investigadora de prueba",
    orcid: "https://orcid.org/0000-0002-1825-0097"
  };
  const stored = {
    id: "author-investigadora-123",
    name: "Investigadora de prueba",
    sourceId: "https://openalex.org/A123456789",
    orcid: "0000-0002-1825-0097"
  };
  assert.equal(authorSaveKey(publicAuthor), "orcid:0000-0002-1825-0097");
  assert.equal(findSavedAuthor(publicAuthor, [stored]), stored);
  assert.ok(authorSaveKeys(stored).includes("source:a123456789"));
});

test("OpenAlex identities survive normalization and rerendering", () => {
  const publicAuthor = { id: "https://openalex.org/A123456789", name: "Autora A" };
  const stored = { id: "author-autora-id", sourceId: "A123456789", name: "Autora A" };
  assert.equal(authorSaveKey(publicAuthor), authorSaveKey(stored));
  assert.equal(findSavedAuthor(publicAuthor, [stored]), stored);
});

test("Latin American catalog author ID stays stable across cards and saved records", () => {
  const catalog = {
    id: "latin-american-philosopher-0088",
    name: "Filósofa Latinoamericana",
    sourceType: "latin-american-philosophy"
  };
  const stored = {
    id: "author-filosofa-hash",
    sourceId: "latin-american-philosopher-0088",
    name: catalog.name
  };
  assert.equal(findSavedAuthor(catalog, [stored]), stored);
});

test("distinct named authors are not merged without shared verified identifiers", () => {
  const left = { id: "A111111111", name: "Juan Pérez" };
  const right = { id: "A222222222", name: "Juan Pérez" };
  assert.equal(findSavedAuthor(left, [right]), null);
  assert.notEqual(authorSaveKey(left), authorSaveKey(right));
  assert.equal(authorSaveKey({ name: "José Antonio García" }),
    authorSaveKey({ displayName: "Jose Antonio Garcia" }));
  assert.equal(authorSaveKey({ name: "" }), "");
});
