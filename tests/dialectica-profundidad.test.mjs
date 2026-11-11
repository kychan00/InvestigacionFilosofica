import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../dialectica.html", import.meta.url), "utf8");
const css = await readFile(new URL("../css/dialectica-profundidad.css", import.meta.url), "utf8");
const js = await readFile(new URL("../js/dialectica-profundidad.js", import.meta.url), "utf8");

test("fase 4 integra la capa de profundización opcional", () => {
  assert.match(html, /data-depth-section/);
  assert.match(html, /id="ramas"/);
  assert.match(html, /dialectica-profundidad\.css\?v=20261111-fase4/);
  assert.match(html, /dialectica-profundidad\.js\?v=20261111-fase4/);
});

test("las cinco ramas históricas están presentes", () => {
  for (const key of ["estoicos", "medieval", "descartes", "lenguaje", "argumentacion"]) {
    assert.match(html, new RegExp(`data-depth-target="${key}"`));
    assert.match(html, new RegExp(`data-depth-scene="${key}"`));
  }
});

test("la interacción contempla teclado, navegación y plegado", () => {
  assert.match(js, /activateByKeyboard/);
  assert.match(js, /data-depth-prev/);
  assert.match(js, /data-depth-next/);
  assert.match(js, /aria-expanded/);
  assert.match(js, /render\(order\[0\]\)/);
});

test("la capa mantiene responsive y reducción de movimiento", () => {
  assert.match(css, /@media \(max-width: 1050px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
