import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../dialectica.html", import.meta.url), "utf8");
const css = await readFile(new URL("../css/dialectica-exposicion.css", import.meta.url), "utf8");
const js = await readFile(new URL("../js/dialectica-exposicion.js", import.meta.url), "utf8");

test("la exposición carga únicamente sus recursos locales principales", () => {
  assert.match(html, /\.\/css\/dialectica-exposicion\.css/);
  assert.match(html, /\.\/js\/dialectica-exposicion\.js/);
  assert.match(html, /<link rel="icon"[^>]+\.\/assets\/favicon\.svg/);
});

test("el recorrido histórico conserva las cinco estaciones pedagógicas", () => {
  for (const id of ["socrates", "aristoteles", "kant", "hegel-marx", "actualidad"]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(html, new RegExp(`data-timeline-target="${id}"`));
  }
});

test("la página incluye escenas SVG accesibles y controles interactivos", () => {
  const svgCount = (html.match(/<svg\b/g) || []).length;
  assert.ok(svgCount >= 8, `se esperaban al menos 8 escenas SVG; se encontraron ${svgCount}`);
  assert.match(html, /role="img"/);
  assert.match(html, /data-engine-node="position"/);
  assert.match(html, /data-discussion-stage="confrontacion"/);
  assert.match(html, /data-presentation-toggle/);
});

test("la fuente académica queda declarada y la conclusión evita reducir dialéctica a una fórmula", () => {
  assert.match(html, /Luis Enrique Ortiz Gutiérrez/);
  assert.match(html, /NO REDUCIR A/);
  assert.match(html, /posición→crítica→examen→revisión/);
});

test("el diseño contempla tema oscuro, móvil, movimiento reducido e impresión", () => {
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media print/);
});

test("la interacción incluye teclado y modo de exposición", () => {
  assert.match(js, /event\.key !== "Enter"/);
  assert.match(js, /ArrowRight/);
  assert.match(js, /PageDown/);
  assert.match(js, /is-presenting/);
  assert.match(js, /IntersectionObserver/);
});
