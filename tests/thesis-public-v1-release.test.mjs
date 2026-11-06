import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../tesis.html", import.meta.url), "utf8");
const thesisJs = readFileSync(new URL("../js/thesis-demo.js", import.meta.url), "utf8");

test("public thesis page declares Version 1.0 in visible release surfaces", () => {
  assert.match(html, /<title>Tesis UdeG · Versión 1\.0 · Investigación Filosófica<\/title>/);
  assert.match(html, /VERSIÓN PÚBLICA 1\.0 · NOVIEMBRE 2026/);
  assert.match(html, /VERSIÓN PÚBLICA 1\.0<br>/);
  assert.match(html, /Esta primera versión pública consulta el/);
  assert.match(html, /Tesis UdeG · Versión pública 1\.0 · Noviembre de 2026/);
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


test("V1.0.1 cache-bust forces browsers to load the fixed thesis validator", () => {
  assert.match(html, /\.\/js\/thesis-demo\.js\?v=20261105-v101/);
  assert.match(thesisJs, /thesis-demo-search\.js\?v=20261105-v101/);
});
