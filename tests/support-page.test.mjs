import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const page = read("apoyar.html");
const about = read("acerca.html");
const menu = read("js/mobile-site-menu.js");
const css = read("css/support.css");
const destination = "https://link.mercadopago.com.mx/cristianpelayo";
test("support is voluntary, public, and has a direct owner-provided payment link", () => {
  assert.ok(page.includes(destination));
  assert.ok(about.includes(destination));
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /No se emiten comprobantes de donativos deducibles/);
  assert.match(page, /no condicionan el acceso/);
  assert.match(page, /no representa oficialmente/);
  assert.match(page, /no un desglose de gastos ya realizados/);
  assert.doesNotMatch(page, /<form|<iframe|<input/i);
});
test("shared navigation and About link to the dedicated page", () => {
  assert.ok(menu.includes('label: "Apoyar el proyecto"'));
  assert.ok(menu.includes('href: siteHref("apoyar.html")'));
  assert.ok(menu.includes('"?origen=menu"'));
  assert.ok(about.includes('href="./apoyar.html?origen=acerca"'));
  assert.ok(page.includes('href="./apoyar.html" class="is-active" aria-current="page"'));
});
test("support presentation is isolated and responsive", () => {
  assert.match(css, /\.support-page \.support-hero/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.equal((css.match(/\{/g)||[]).length, (css.match(/\}/g)||[]).length);
});
