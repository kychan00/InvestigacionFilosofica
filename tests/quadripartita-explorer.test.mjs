import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile("revistas/udg/quadripartita-ratio.html", "utf8");
const style = await readFile("css/quadripartita-explorer.css", "utf8");
const explorer = await readFile("js/quadripartita-explorer.js", "utf8");
const postal = await readFile("css/quadripartita-postal-taxonomy.css", "utf8");

test("Quadripartita presenta un explorador de tres pestañas vinculadas a sus paneles", () => {
  assert.match(html, /class="journal-sidebar qr-explorer"/);
  assert.match(html, /class="qr-explorer-tabs" role="tablist"/);
  for (const [name, label] of [["topics", "Categorías"], ["issues", "Números"], ["filters", "Filtros"]]) {
    const tab = "qr-explorer-tab-" + name;
    const panel = "qr-explorer-" + name;
    assert.match(html, new RegExp('id="' + tab + '" role="tab"'));
    assert.match(html, new RegExp('data-qr-explorer-tab="' + name + '"'));
    assert.match(html, new RegExp('aria-controls="' + panel + '"'));
    assert.match(html, new RegExp('id="' + panel + '" role="tabpanel" aria-labelledby="' + tab + '"'));
    assert.match(html, new RegExp('data-qr-explorer-panel="' + name + '"'));
    assert.ok(html.includes(label));
  }
  assert.match(html, /data-qr-explorer-tab="topics"[^>]*aria-selected="true"/);
  assert.match(html, /data-qr-explorer-panel="issues" hidden/);
  assert.match(html, /data-qr-explorer-panel="filters" hidden/);
});

test("Los controles editoriales y las categorías existentes se mantienen intactos", () => {
  for (const id of [
    "journal-query", "journal-decade", "journal-language", "journal-issue",
    "journal-category", "journal-sort", "journal-doi-only", "journal-abstract-only",
    "journal-filter-toggle", "journal-reset", "journal-category-all",
    "journal-category-chips", "journal-issue-all", "journal-issue-chips",
    "journal-card-grid", "journal-atlas-canvas"
  ]) {
    assert.equal((html.match(new RegExp('id="' + id + '"', "g")) || []).length, 1, id);
  }
  assert.match(html, /Categoría de relación/);
  assert.match(html, /Las categorías de relación agrupan artículos conectados/);
  assert.match(postal, /qr-postal-stamp/);
  assert.match(postal, /\.qr-postal-taxonomy \.taxonomy-chip/);
});

test("La navegación responde a flechas, Inicio y Fin; móvil abre Filtros de una sola vez", () => {
  for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
    assert.ok(explorer.includes('event.key === "' + key + '"'));
  }
  assert.match(explorer, /aria-selected/);
  assert.match(explorer, /tab\.tabIndex = active \? 0 : -1/);
  assert.match(explorer, /panel\.hidden = panel\.dataset\.qrExplorerPanel !== name/);
  assert.match(explorer, /filterToggle\.click\(\)/);
  assert.match(explorer, /scrollArea\.scrollTop = 0/);
  assert.match(style, /\.qr-explorer-panels\s*\{/);
  assert.match(style, /overflow-y: auto/);
  assert.match(style, /overscroll-behavior: contain/);
  assert.match(style, /\.qr-explorer \[data-qr-explorer-panel\]\[hidden\]/);
  assert.match(style, /max-height: calc\(100dvh - 98px\)/);
  assert.match(style, /@media \(max-width: 900px\)/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
});

test("La solución sólo modifica el tema propio de Quadripartita", async () => {
  const protrepsis = await readFile("revistas/udg/protrepsis.html", "utf8");
  const sincronia = await readFile("revistas/udg/sincronia.html", "utf8");
  assert.match(html, /quadripartita-explorer\.css\?v=20261115-compact-v1/);
  assert.match(html, /quadripartita-explorer\.js\?v=20261115-compact-v1/);
  assert.doesNotMatch(protrepsis, /quadripartita-explorer/);
  assert.doesNotMatch(sincronia, /quadripartita-explorer/);
  assert.match(html, /id="journal-atlas-detail"/);
});
