import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("fase 3 carga únicamente en index y después del folio existente", async () => {
  const index = await read("index.html");
  const paths = [
    "css/record-detail.css",
    "css/record-folio-polish.css",
    "css/corpus-appearance.css",
    "css/corpus-appearance-results.css",
    "css/corpus-appearance-records.css"
  ];
  let position = -1;
  for (const path of paths) {
    const found = index.indexOf(path);
    assert.ok(found > position, path + " debe cargarse después del anterior");
    position = found;
  }
  assert.equal(index.split("css/corpus-appearance-records.css").length, 2);
  for (const path of [
    "tesis.html", "atlas.html", "articulos.html", "perfil.html",
    "filosofia-latinoamericana.html", "research-atlas.html",
    "revistas/udg/protrepsis.html",
    "revistas/udg/sincronia.html",
    "revistas/udg/quadripartita-ratio.html"
  ]) {
    assert.doesNotMatch(await read(path), /corpus-appearance-records\.css/, path);
  }
});

test("seis paletas bibliográficas y Predeterminado sin sobrescrituras", async () => {
  const css = await read("css/corpus-appearance-records.css");
  const base = await read("css/record-folio-polish.css");
  const tokens = [
    "--rf-overlay", "--rf-panel", "--rf-surface", "--rf-surface-raised",
    "--rf-surface-inset", "--rf-hover", "--rf-border", "--rf-border-strong",
    "--rf-text", "--rf-text-soft", "--rf-text-muted", "--rf-link",
    "--rf-link-hover", "--rf-accent", "--rf-accent-hover", "--rf-focus",
    "--rf-button", "--rf-button-hover", "--rf-button-text", "--rf-on-accent",
    "--rf-hero-map"
  ];
  assert.match(base, /--rf-panel/);
  assert.match(base, /--rf-accent/);
  for (const shell of ["territory", "marginalia", "observatory"]) {
    for (const mode of ["light", "dark"]) {
      const selector = 'html[data-theme="' + mode + '"][data-corpus-shell="' + shell + '"] #record-modal';
      const start = css.indexOf(selector + " {");
      assert.ok(start >= 0, selector);
      const end = css.indexOf("\n}", start);
      assert.ok(end > start, selector + ": faltan llaves");
      const block = css.slice(start, end);
      for (const token of tokens) assert.ok(block.includes(token + ":"), selector + " missing " + token);
    }
  }
  assert.match(css, /html\[data-corpus-shell\]:not\(\[data-corpus-shell="default"\]\) #record-modal/);
  assert.doesNotMatch(css, /(^|\n)html\[data-corpus-shell="default"\]/);
});

test("no se altera geometría táctil ni funcionamiento del modal bibliográfico", async () => {
  const css = await read("css/corpus-appearance-records.css");
  const previous = await read("css/record-detail.css");
  const app = await read("js/app.js");
  assert.match(previous, /max-height: calc\(100dvh - 48px\) !important/);
  assert.match(previous, /overflow-y: auto !important/);
  assert.match(previous, /width: 48px !important/);
  assert.match(css, /\.cinematic-abstract/);
  assert.match(css, /\.cinematic-action\.primary/);
  assert.match(css, /\.record-author-link/);
  assert.match(css, /\.cinematic-score-track/);
  assert.match(css, /\.record-modal-close/);
  assert.match(css, /@media \(forced-colors: active\)/);
  // None of the phase-three presentation rules can move the close button,
  // resize the dialog or alter document / touch scroll.
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(declarations,
    /(?:^|[;{]\s*)(?:display|position|inset|top|left|right|bottom|width|height|min-width|min-height|max-width|max-height|grid-template(?:-columns|-rows)?|grid-column|grid-row|overflow(?:-x|-y)?|transform|margin|padding|z-index|scroll-behavior|touch-action|pointer-events)\s*:/m);
  assert.doesNotMatch(declarations, /#udeg-modal|#research-atlas|\.author-work-grid/);
  assert.match(app, /id="record-modal-title"/);
  assert.match(app, /class="cinematic-abstract"/);
  assert.match(app, /https:\/\/doi\.org\//);
  assert.match(app, /class="cinematic-action primary"/);
});

test("la ficha conserva el contenido y foco del diálogo semántico", async () => {
  const index = await read("index.html");
  const app = await read("js/app.js");
  const css = await read("css/corpus-appearance-records.css");
  assert.match(index, /id="record-modal"[\s\S]*?aria-modal="true"/);
  assert.match(index, /aria-labelledby="record-modal-title"/);
  assert.match(index, /class="record-modal-close"/);
  assert.match(index, /data-close-record/);
  assert.match(app, /class="record-author-link"/);
  assert.match(app, /class="cinematic-meta-card/);
  assert.match(app, /class="cinematic-provenance"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /--rf-on-accent/);
});
