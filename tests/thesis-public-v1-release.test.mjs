import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../tesis.html", import.meta.url), "utf8");
const thesisJs = readFileSync(new URL("../js/thesis-demo.js", import.meta.url), "utf8");

test("public thesis page keeps V1 release language while using the national Tesis identity", () => {
  assert.match(html, /<title>Tesis · Investigación Filosófica<\/title>/);
  assert.match(html, />Tesis<\/a>/);
  assert.doesNotMatch(html, />Tesis UdeG<\/a>/);
  assert.match(html, /VERSIÓN PÚBLICA 1\.0 · NOVIEMBRE 2026/);
  assert.match(html, /VERSIÓN PÚBLICA 1\.0<br>/);
  assert.match(html, /Esta primera versión pública consulta el/);
  assert.match(html, /Tesis · Archivo universitario en expansión · Noviembre de 2026/);
});

test("legacy demo language is absent from visible copy", () => {
  const banned = [
    "EDICIÓN DE DEMOSTRACIÓN",
    "Este primer demo",
    "Estadísticas del demo",
  ];
  for (const phrase of banned) {
    assert.equal(html.includes(phrase), false, phrase);
  }
});

test("internal legacy identifiers may remain without becoming visible release copy", () => {
  assert.match(html, /\.\/css\/thesis-demo\.css/);
  assert.match(html, /id="thesis-demo"/);
  assert.match(html, /\.\/js\/thesis-demo\.js/);
});

test("V1 release identity remains reference-only", () => {
  assert.match(html, /0 PDF/);
  assert.match(html, /0 PDF alojados/);
  assert.match(html, /El PDF nunca se aloja aquí/);
  assert.doesNotMatch(html, /<input[^>]+type="file"/i);
});


test("T2DH cache-bust loads the multi-institution thesis runtime", () => {
  assert.match(html, /\.\/js\/thesis-demo\.js\?v=20261109-aleph-links-v1/);
  assert.match(html, /\.\/css\/thesis-demo\.css\?v=20261107-t2dh/);
  assert.match(thesisJs, /thesis-demo-search\.js\?v=20261109-aleph-links-v1/);
  assert.match(thesisJs, /editorial-udg-search\.js\?v=20261107-t2dg/);
  assert.match(thesisJs, /ugto-philosophy-search\.js\?v=20261107-t2dh/);
});

test("public page exposes Editorial UdeG as a third bibliographic territory without calling it a thesis corpus", () => {
  assert.match(html, /data-thesis-scope="editorial"/);
  assert.match(html, /Editorial UdeG <strong id="thesis-scope-editorial-count">—<\/strong>/);
  assert.match(html, /Libros y publicaciones filosóficas de Editorial UdeG/);
  assert.match(html, /No son tesis/);
  assert.match(html, /24<\/strong><span>categoría oficial Filosofía/);
  assert.match(html, /9<\/strong><span>relación filosófica verificada/);
  assert.match(html, /id="thesis-method-editorial"/);
  assert.match(thesisJs, /isUdgEditorial\(\)/);
  assert.match(thesisJs, /validateEditorialUdgIndex/);
});

test("T2DH separates institution from collection and exposes Universidad de Guanajuato", () => {
  assert.match(html, /INSTITUCIÓN/);
  assert.match(html, /data-thesis-institution="udg"/);
  assert.match(html, /data-thesis-institution="ugto"/);
  assert.match(html, /Universidad de Guanajuato/);
  assert.match(html, /id="thesis-scope-ugto-philosophy-count"/);
  assert.match(html, /id="thesis-method-ugto"/);
  assert.match(thesisJs, /institution=ugto|params\.set\("institution", "ugto"\)/);
  assert.match(thesisJs, /validateUgtoPhilosophyIndex/);
});
