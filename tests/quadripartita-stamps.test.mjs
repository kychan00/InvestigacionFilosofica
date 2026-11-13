import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(path, "utf8");
const page = await read("revistas/udg/quadripartita-ratio.html");
const institutional = await read("revistas/udg/quadripartita-ratio-institucional.html");
const css = await read("css/quadripartita-cobalt.css");
const script = await read("js/quadripartita-stamps.js");
const engraved = await read("assets/quadripartita-engraving.svg");
const data = JSON.parse(await read("src/data/cucsh-filosofia.json"));

test("la revista entera viste el diseño cobalto, no solamente su sección editorial", () => {
  assert.match(page, /class="journal-page qr-cobalt"/);
  assert.match(page, /<h1>Quadripartita <em>Ratio\.<\/em><\/h1>/);
  assert.match(page, /quadripartita-cobalt\.css\?v=/);
  assert.match(page, /quadripartita-stamps\.js\?v=/);
  assert.match(page, /assets\/quadripartita-engraving\.svg/);
  assert.match(page, /class="qr-issue-note"/);
  assert.match(page, /Historia, equipo y contacto/);
  assert.match(page, /quadripartita-ratio-institucional\.html/);
  assert.match(institutional, /quadripartita-cobalt\.css\?v=/);
  assert.match(institutional, /class="qr-profile-return"/);
  assert.match(institutional, /quadripartita-ratio\.html#journal-views/);
});

test("SVG original, estética estampilla y perforaciones sin imagen de tercero", () => {
  assert.match(engraved, /^<svg/);
  assert.match(engraved, /viewBox="0 0 1280 635"/);
  assert.match(engraved, /Grabado original/);
  assert.doesNotMatch(engraved, /<image\s|https?:\/\//);
  assert.match(script, /MutationObserver\(decorateAll\)/);
  assert.match(script, /makeEngraving\(seed, variant\)/);
  assert.match(script, /qr-stamp-paper/);
  assert.match(script, /qr-stamp-plate/);
  assert.match(script, /replaceChildren\(paper\)/);
  assert.match(script, /numberSeed\(title \+ issue\)/);
  assert.match(css, /\.qr-stamp-card/);
  assert.match(css, /\.qr-stamp-paper/);
  assert.match(css, /radial-gradient\(circle 7px at left center/);
  assert.match(css, /mask-composite:intersect/);
  assert.match(css, /mask-composite:source-in/);
});

test("no se pierden las funciones de catálogo, Atlas ni los controles históricos", () => {
  for (const id of [
    "journal-total", "journal-year-span", "journal-author-total", "journal-doi-rate",
    "journal-abstract-rate", "journal-archive-panel", "journal-atlas-panel",
    "journal-insights-panel", "journal-query", "journal-decade", "journal-language",
    "journal-issue", "journal-category", "journal-sort", "journal-doi-only",
    "journal-abstract-only", "journal-category-chips", "journal-issue-chips",
    "journal-card-grid", "journal-load-more", "journal-results-status",
    "journal-atlas-canvas", "journal-atlas-controls", "journal-qwen-toggle",
    "journal-atlas-legend", "journal-atlas-detail", "journal-author-chips"
  ]) assert.ok(page.includes('id="' + id + '"'), "preserve #" + id);
  for (const view of ["archive", "atlas", "insights"])
    assert.ok(page.includes('data-journal-view="' + view + '"'));
  assert.match(page, /js\/journal-page\.js\?v=/);
});

test("la cobertura institucional y bibliográfica permanece idéntica", () => {
  assert.equal(data.records.length, 336);
  const quad = data.records.filter(x => x.journal === "Quadripartita Ratio");
  assert.equal(quad.length, 88);
  assert.equal(new Set(quad.map(x => x.issueNumber)).size, 21);
  assert.equal(new Set(quad.map(x => x.doi)).size, 88);
  assert.equal(data.records.filter(x => x.journal === "Protrepsis").length, 248);
  assert.match(institutional, /Fabián Bernache Maldonado/);
  assert.match(institutional, /Joaquín Galindo/);
  assert.match(institutional, /QR\/comiteeditorial/);
  assert.match(institutional, /QR\/comitecientifico/);
});

test("diseño limitado a Quadripartita, móvil, oscuro y motion reducido", async () => {
  assert.match(css, /body\[data-journal="quadripartita"\]/);
  assert.match(css, /\.ji\.ji--quadripartita/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /@media\(max-width:410px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  for (const other of ["protrepsis.html","sincronia.html","protrepsis-institucional.html","sincronia-institucional.html"]) {
    const html = await read("revistas/udg/" + other);
    assert.doesNotMatch(html, /quadripartita-cobalt\.css/);
    assert.doesNotMatch(html, /quadripartita-stamps\.js/);
  }
});
