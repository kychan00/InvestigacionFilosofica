import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const shells = ["territory", "marginalia", "observatory"];
const modes = ["light", "dark"];

test("fase 4 se activa solo en el corpus y se carga después de fases 1–3", async () => {
  const index = await read("index.html");
  const links = [
    "css/corpus-appearance.css",
    "css/corpus-appearance-results.css",
    "css/corpus-appearance-records.css",
    "css/corpus-appearance-author-atlas.css"
  ];
  let last = -1;
  for (const link of links) {
    const pos = index.indexOf(link);
    assert.ok(pos > last, link + " se debe cargar en orden");
    last = pos;
  }
  assert.equal(index.split("css/corpus-appearance-author-atlas.css").length, 2);
  assert.match(index, /src="\.\/js\/research-atlas-embed\.js\?v=20261122-corpus-appearance-phase4"/);
  for (const path of [
    "tesis.html", "atlas.html", "articulos.html",
    "filosofia-latinoamericana.html", "perfil.html", "research-atlas.html",
    "revistas/udg/protrepsis.html", "revistas/udg/sincronia.html",
    "revistas/udg/quadripartita-ratio.html"
  ]) {
    assert.doesNotMatch(await read(path), /corpus-appearance-author-atlas\.css/, path);
  }
});

test("las seis variantes proporcionan tokens para autores y canvas", async () => {
  const css = await read("css/corpus-appearance-author-atlas.css");
  const tokens = [
    "--corpus-author-card", "--corpus-author-muted", "--corpus-author-action",
    "--corpus-author-action-hover", "--corpus-author-label", "--corpus-author-tint",
    "--corpus-atlas-ink", "--corpus-atlas-work-fill", "--corpus-atlas-edge",
    "--corpus-atlas-blue", "--corpus-atlas-cyan", "--corpus-atlas-green",
    "--corpus-atlas-purple", "--corpus-atlas-yellow", "--corpus-atlas-red",
    "--corpus-atlas-author", "--corpus-atlas-muted"
  ];
  for (const shell of shells) for (const mode of modes) {
    const signature = 'html[data-theme="' + mode + '"][data-corpus-shell="' + shell + '"] {';
    const at = css.indexOf(signature);
    assert.ok(at !== -1, signature);
    const finish = css.indexOf("\n}", at);
    assert.ok(finish !== -1, signature + ": falta llave de cierre");
    const block = css.slice(at, finish);
    for (const token of tokens) assert.ok(block.includes(token + ":"), signature + " missing " + token);
  }
  assert.doesNotMatch(css, /(^|\n)html\[data-corpus-shell="default"\]\s*\{/);
  assert.match(css, /html\[data-corpus-shell\]:not\(\[data-corpus-shell="default"\]\) body\.author-view/);
  assert.match(css, /html\[data-corpus-shell\]:not\(\[data-corpus-shell="default"\]\) body:not\(\.author-view\) #research-atlas-panel/);
});

test("la ficha de autor conserva bibliografía, cronología y navegación móvil", async () => {
  const css = await read("css/corpus-appearance-author-atlas.css");
  const oldAuthor = await read("css/author-visibility-repair.css");
  const oldTimeline = await read("css/author-timeline.css");
  assert.match(css, /--profile-panel:/);
  assert.match(css, /--profile-blue-label:/);
  assert.match(css, /--tl-blue-soft:/);
  assert.match(css, /\.author-page-hero/);
  assert.match(css, /\.author-work-browser/);
  assert.match(css, /\.author-work-grid \.result-card h2/);
  assert.match(css, /\.author-page #author-timeline-root/);
  assert.match(css, /\.author-timeline-period\.is-active/);
  assert.match(oldAuthor, /@media \(max-width: 820px\)[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(oldTimeline, /overflow-x: auto/);
  assert.match(oldTimeline, /scroll-snap-type: x proximity/);
  assert.match(oldTimeline, /touch-action: manipulation/);
});

test("el Atlas conserva sus herramientas y solo modifica colores y redibujado", async () => {
  const css = await read("css/corpus-appearance-author-atlas.css");
  const script = await read("js/research-atlas-embed.js");
  const old = await read("css/research-atlas-embed.css");
  for (const selector of [
    ".research-atlas-stage", ".research-atlas-tooltip",
    ".research-atlas-detail-meta", ".research-atlas-list",
    ".research-atlas-node-action.primary", ".research-atlas-author-key i",
    ".research-atlas-zoom-controls button"
  ]) assert.ok(css.includes(selector), selector);
  for (const token of [
    "--corpus-atlas-ink", "--corpus-atlas-work-fill", "--corpus-atlas-edge",
    "--corpus-atlas-blue", "--corpus-atlas-cyan", "--corpus-atlas-green",
    "--corpus-atlas-purple", "--corpus-atlas-yellow", "--corpus-atlas-red",
    "--corpus-atlas-author", "--corpus-atlas-muted"
  ]) assert.ok(script.includes('cssColor("' + token + '"'), token);
  assert.match(script, /attributeFilter: \["data-theme", "data-corpus-shell"\]/);
  assert.match(script, /canvas\.addEventListener\("pointerdown"/);
  assert.match(script, /function worldToScreen\(/);
  assert.match(script, /function edgeStyle\(/);
  assert.match(old, /touch-action: none/);
  assert.match(old, /body\.author-view \.research-atlas-embed/);
});

test("fase 4 no cambia geometría ni interacciones y preserva modal y Atlas autónomos", async () => {
  const css = await read("css/corpus-appearance-author-atlas.css");
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Color, surface and focus styles only; no size/layout/touch/pointer changes.
  assert.doesNotMatch(clean,
    /(?:^|[;{]\s*)(?:display|position|inset|top|left|right|bottom|width|height|min-width|min-height|max-width|max-height|grid-template(?:-columns|-rows)?|grid-column|grid-row|overflow(?:-x|-y)?|transform|margin|padding|z-index|scroll-behavior|touch-action|pointer-events)\s*:/m);
  assert.doesNotMatch(clean, /#record-modal|#udeg-modal/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(clean, /body\.author-view/);
  assert.match(clean, /body:not\(\.author-view\)/);
  const app = await read("js/research-atlas-embed.js");
  assert.match(app, /RESEARCH_ATLAS_OPEN_RECORD_EVENT/);
  assert.match(app, /RESEARCH_ATLAS_FILTER_EVENT/);
  assert.match(app, /function draw\(/);
});
