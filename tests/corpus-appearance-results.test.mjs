import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("fase 2 agrega CSS solo a index, después de fase 1", async () => {
  const index = await read("index.html");
  const phase1 = 'css/corpus-appearance.css?v=20261122-corpus-appearance-phase1';
  const phase2 = 'css/corpus-appearance-results.css?v=20261122-corpus-appearance-phase2';
  assert.ok(index.includes(phase1));
  assert.ok(index.includes(phase2));
  assert.ok(index.indexOf(phase1) < index.indexOf(phase2));
  assert.match(index, /data-corpus-shell="default"/);
  for (const file of [
    "tesis.html", "atlas.html", "articulos.html",
    "filosofia-latinoamericana.html", "perfil.html", "research-atlas.html",
    "revistas/udg/protrepsis.html", "revistas/udg/sincronia.html",
    "revistas/udg/quadripartita.html"
  ]) {
    const html = await read(file);
    assert.doesNotMatch(html, /corpus-appearance-results\.css/, file);
  }
});

test("fase 2 hereda seis paletas por tema y respeta Predeterminado", async () => {
  const base = await read("css/corpus-appearance.css");
  const css = await read("css/corpus-appearance-results.css");
  for (const shell of ["territory", "marginalia", "observatory"]) {
    for (const mode of ["light", "dark"]) {
      assert.ok(base.includes('data-theme="' + mode + '"][data-corpus-shell="' + shell + '"]'),
        shell + "/" + mode);
    }
    assert.ok(css.includes('data-corpus-shell="' + shell + '"]'), shell);
  }
  assert.match(css, /html\[data-corpus-shell\]:not\(\[data-corpus-shell="default"\]\) body:not\(\.author-view\)/);
  assert.doesNotMatch(css, /(^|\n)html\[data-corpus-shell="default"\]\s*\{/);
  assert.match(css, /--corpus-record-surface:/);
  assert.match(css, /--corpus-record-accent:/);
});

test("la interfaz temática conserva ranking, modales, guardados y diseño responsivo", async () => {
  const css = await read("css/corpus-appearance-results.css");
  assert.match(css, /#results > \.result-card/);
  assert.match(css, /\.search-filter-grid/);
  assert.match(css, /\.research-workspace/);
  assert.match(css, /\.filter-grid/);
  assert.match(css, /\.result-visual/);
  assert.match(css, /\.relevance-pill/);
  assert.match(css, /\.result-links/);
  assert.match(css, /\.provider/);
  assert.match(css, /\.load-more-wrap/);
  assert.match(css, /\.fetch-more-wrap/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  // This new layer is presentation-only. It must not affect grid/scroll/rank dimensions.
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(noComments, /(?:^|[;{]\s*)(?:display|position|top|bottom|left|right|width|height|min-width|min-height|max-width|max-height|grid-template(?:-columns|-rows)?|grid-column|grid-row|overflow|transform|margin|padding|z-index|scroll-behavior|touch-action)\s*:/m);
  // The modal and author archive must not be targeted by any rules in this file.
  assert.doesNotMatch(noComments, /#record-modal|\.record-modal-panel|\.author-work-grid|body\.author-view/);
});

test("en móvil se preservan botones, orden y marcadores de las tarjetas", async () => {
  const legacy = await read("css/mobile-layout.css");
  const css = await read("css/corpus-appearance-results.css");
  assert.match(legacy, /\.result-card \.result-visual[\s\S]*?width:\s*40px/);
  assert.match(legacy, /\.result-card \.result-links[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(legacy, /\.result-card \.result-links \.record-open[\s\S]*?min-height:\s*48px/);
  assert.match(css, /#results \.result-card \.result-links \.record-open/);
  assert.match(css, /#results \.result-card \.result-rank/);
  assert.doesNotMatch(css, /#record-modal/);
});
