import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../dialectica.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/dialectica-mobile.css', import.meta.url), 'utf8');
const polish = await readFile(new URL('../css/dialectica-polish.css', import.meta.url), 'utf8');
const base = await readFile(new URL('../js/dialectica-exposicion.js', import.meta.url), 'utf8');
const cinematic = await readFile(new URL('../js/dialectica-presentacion.js', import.meta.url), 'utf8');

test('dialectica carga la capa móvil al final de los estilos de la exposición', () => {
  assert.match(html, /dialectica-mobile\.css\?v=20261111-mobile1/);
  assert.ok(html.indexOf('dialectica-mobile.css') > html.indexOf('dialectica-ensayo.css'));
});

test('hero y escenas tienen composición móvil propia', () => {
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(css, /font-size: clamp\(3\.6rem, 17vw, 3\.8rem\)/);
  assert.match(css, /\.dx-svg-ground \{[\s\S]*?fill:/);
  assert.match(css, /\.dx-era-scene svg/);
});

test('controles móviles respetan touch targets y safe area', () => {
  assert.match(css, /min-height: 44px/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /100dvh/);
});

test('modo Exponer móvil elimina la doble navegación cinematográfica', () => {
  assert.match(css, /\.dxp-chapter-rail,[\s\S]*?\.dxp-chapter-card,[\s\S]*?display: none !important/);
  assert.match(css, /\.dx-page\.is-presenting \.dx-present-controls/);
  assert.match(css, /\.dxp-out-of-focus,[\s\S]*?opacity: 1 !important/);
});

test('los dos controladores de presentación sincronizan el mismo capítulo', () => {
  assert.match(base, /dialectica:presentation-chapter/);
  assert.match(base, /dialectica:presentation-cinematic-chapter/);
  assert.match(base, /presentationNavigationLockUntil/);
  assert.match(cinematic, /dialectica:presentation-chapter/);
  assert.match(cinematic, /dialectica:presentation-cinematic-chapter/);
  assert.match(cinematic, /presentationSyncLockUntil/);
});


test('QA visual carga el polish después de mobile y separa paneles de escenas', () => {
  assert.match(html, /dialectica-polish\.css\?v=20261111-layout1/);
  assert.ok(html.indexOf('dialectica-polish.css') > html.indexOf('dialectica-mobile.css'));
  assert.match(polish, /\.dx-scene-hud \{[\s\S]*?margin: 14px auto 0/);
  assert.match(polish, /\.dx-era-scene figcaption,[\s\S]*?margin-top: 14px/);
});

test('QA visual fija Sócrates Kant Hegel y la profundización histórica', () => {
  assert.match(polish, /\.dx-socratic-bubble \{[\s\S]*?translateY\(-46px\)/);
  assert.match(polish, /data-kant-state="limit"[\s\S]*?translateY\(-74px\)/);
  assert.match(polish, /data-transformation-step="determination"[\s\S]*?translate\(248px, 338px\)/);
  assert.match(polish, /\.dx-depth-rail::after,[\s\S]*?display: none/);
  assert.match(polish, /button\.is-active small[\s\S]*?color: #3a403c/);
});
