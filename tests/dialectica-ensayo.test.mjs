import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../dialectica.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../js/dialectica-ensayo.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/dialectica-ensayo.css', import.meta.url), 'utf8');

test('fase 6 cubre los siete capítulos principales', () => {
  for (const id of ['nucleo','socrates','aristoteles','kant','hegel-marx','actualidad','cierre']) {
    assert.match(js, new RegExp(`id: '${id}'`));
  }
});

test('cada capítulo tiene tiempo, idea, acción, puente y foco', () => {
  assert.equal((js.match(/seconds:/g) || []).length, 7);
  assert.equal((js.match(/takeaway:/g) || []).length, 7);
  assert.equal((js.match(/action:/g) || []).length, 7);
  assert.equal((js.match(/bridge:/g) || []).length, 7);
  assert.equal((js.match(/focus:/g) || []).length, 7);
});

test('los atajos de ensayo están implementados', () => {
  assert.match(js, /event\.key\.toLowerCase\(\) === 'r'/);
  assert.match(js, /event\.key\.toLowerCase\(\) === 'f'/);
  assert.match(js, /event\.code === 'Space'/);
  assert.match(js, /advanceInternal/);
});

test('Kant exige la secuencia libertad determinismo límite', () => {
  assert.ok(js.includes('[data-kant-control="libertad"]'));
  assert.ok(js.includes('[data-kant-control="determinismo"]'));
  assert.ok(js.includes('[data-kant-control="limit"]'));
});

test('el observador evita reentrada por cambios de clase propios', () => {
  assert.match(js, /let wasPresenting = isPresenting\(\)/);
  assert.match(js, /if \(nowPresenting === wasPresenting\) return/);
});

test('la UI contempla móvil, impresión y reduced motion', () => {
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media print/);
});

test('dialectica.html carga los recursos versionados de fase 6', () => {
  assert.match(html, /dialectica-ensayo\.css\?v=20261111-fase6/);
  assert.match(html, /dialectica-ensayo\.js\?v=20261111-fase6/);
});
