import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../dialectica.html", import.meta.url), "utf8");
const css = await readFile(new URL("../css/dialectica-lentes.css", import.meta.url), "utf8");
const js = await readFile(new URL("../js/dialectica-lentes.js", import.meta.url), "utf8");

test("fase 5 integra los dos problemas transversales", () => {
  assert.match(html, /data-lens="semantic"/);
  assert.match(html, /data-lens="inferential"/);
  assert.match(html, /id="lentes"/);
  assert.match(js, /Problema semántico/);
  assert.match(js, /Problema inferencial/);
});

test("las síntesis pedagógicas se distinguen de citas textuales", () => {
  assert.match(html, /PARÁFRASIS · NO CITA TEXTUAL/);
  assert.match(html, /No son citas textuales/);
  assert.match(js, /Síntesis operativa/);
});

test("la capa es opcional y accesible por teclado", () => {
  assert.match(html, /data-lenses-toggle/);
  assert.match(js, /event\.key\.toLowerCase\(\) !== 'l'/);
  assert.match(js, /aria-expanded/);
  assert.match(js, /aria-pressed/);
});

test("fase 5 conserva responsive, impresión y movimiento reducido", () => {
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media print/);
});

test("los recursos de fase 5 están versionados", () => {
  assert.match(html, /dialectica-lentes\.css\?v=20261111-fase5/);
  assert.match(html, /dialectica-lentes\.js\?v=20261111-fase5/);
});
