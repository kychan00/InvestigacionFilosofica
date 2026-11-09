import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("tesis.html incluye el diálogo accesible de perfiles de persona", async () => {
  const html = await readFile(new URL("../tesis.html", import.meta.url), "utf8");
  assert.match(html, /id="thesis-person-modal"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /id="thesis-person-content"/);
  assert.match(html, /thesis-people\.css\?v=20261109-people-v2/);
});

test("la vista de tesis enlaza autoría y dirección a fichas individuales", async () => {
  const source = await readFile(new URL("../js/thesis-demo.js", import.meta.url), "utf8");
  assert.match(source, /function appendPersonLinks\(/);
  assert.match(source, /dataset\.thesisPerson = name/);
  assert.match(source, /appendPersonLinks\(authorLine, record\.authors, "author"\)/);
  assert.match(source, /appendPersonLinks\(directionPeople, record\.directors, "director"\)/);
  assert.match(source, /buildThesisPeopleIndex\(\[/);
  assert.match(source, /resolveRemoteAuthor\(profile\.name/);
  assert.match(source, /"Tesis que ayudó a dirigir"/);
});

test("el perfil conserva una salida al archivo general de autor", async () => {
  const source = await readFile(new URL("../js/thesis-demo.js", import.meta.url), "utf8");
  assert.match(source, /function researchAuthorUrl\(/);
  assert.match(source, /"Abrir archivo completo de autor ↗"/);
  assert.match(source, /url\.searchParams\.set\("view", "author"\)/);
});


test("la ficha de persona es un modal flotante centrado y no un panel lateral", async () => {
  const css = await readFile(new URL("../css/thesis-people.css", import.meta.url), "utf8");
  assert.match(css, /place-items:\s*center/);
  assert.match(css, /width:\s*min\(880px,/);
  assert.match(css, /max-height:\s*min\(82dvh,\s*820px\)/);
  assert.match(css, /border-radius:\s*18px/);
  assert.doesNotMatch(css, /justify-self:\s*end/);
  assert.doesNotMatch(css, /height:\s*100%;[\s\S]{0,180}border-left:/);
});


test("los enlaces históricos CUCSH usan búsqueda del catálogo también dentro del perfil", async () => {
  const source = await readFile(new URL("../js/thesis-demo.js", import.meta.url), "utf8");
  assert.match(source, /const catalogSearch = cucshCatalogSearchUrl\(work\)/);
  assert.match(source, /const catalogSearchUrl = activeInstitution === "udg" \? cucshCatalogSearchUrl\(record\) : null/);
  assert.match(source, /"Buscar esta referencia en catálogo CUCSH ↗"/);
});


test("las obras ALEPH dentro del perfil usan el deep-link estable del Catálogo UdeG", async () => {
  const source = await readFile(new URL("../js/thesis-demo.js", import.meta.url), "utf8");
  const people = await readFile(new URL("../src/core/thesis-people.js", import.meta.url), "utf8");
  assert.match(source, /const alephSearch = udgAlephCatalogUrl\(work\)/);
  assert.match(source, /const alephSearchUrl = activeInstitution === "udg" \? udgAlephCatalogUrl\(record\) : null/);
  assert.match(people, /alephSystemNumber: record\?\.alephSystemNumber \|\| null/);
});
