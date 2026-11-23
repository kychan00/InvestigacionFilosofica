import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const load = path => readFile(new URL(path, root), "utf8");
const sheet = "css/corpus-appearance-polish-marginalia.css";

function tokens(css, mode) {
  const selector = 'html[data-theme="' + mode + '"][data-corpus-shell="marginalia"]';
  const start = css.indexOf(selector + " {");
  assert.notEqual(start, -1, "Marginalia: falta paleta " + mode);
  const block = css.slice(start + selector.length + 2, css.indexOf("\n}", start));
  return Object.fromEntries([...block.matchAll(/^\s*(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gim)]
    .map(([, key, value]) => [key, value]));
}
function luminance(hex) {
  const channels = hex.match(/[a-f0-9]{2}/gi).map(s => parseInt(s, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}
function contrast(a,b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x,y) + .05) / (Math.min(x,y) + .05);
}

test("Marginalia: texto, referencias y botones satisfacen WCAG AA en ambos modos", async () => {
  const css = await load(sheet);
  for (const mode of ["light", "dark"]) {
    const p = tokens(css,mode);
    for (const [foreground, background] of [
      ["--corpus-ink", "--corpus-page"],
      ["--corpus-muted", "--corpus-page"],
      ["--corpus-ink", "--marginalia-surface"],
      ["--corpus-muted", "--marginalia-surface"],
      ["--marginalia-caption", "--corpus-page"],
      ["--marginalia-caption", "--marginalia-surface"],
      ["--corpus-record-muted", "--corpus-record-surface"],
      ["--corpus-on-accent", "--corpus-accent"],
      ["--marginalia-action-ink", "--marginalia-action"],
      ["--marginalia-action-ink", "--marginalia-action-hover"],
      ["--marginalia-art-ink", "--marginalia-art-bg"]
    ]) {
      assert.ok(p[foreground] && p[background], mode + " missing " + foreground + "/" + background);
      assert.ok(contrast(p[foreground],p[background]) >= 4.5,
        mode + ": " + foreground + " insufficient contrast against " + background);
    }
  }
});

test("Marginalia: única hoja posterior a Territorio, sin filtrarse a rutas ni otros temas", async () => {
  const [css,html] = await Promise.all([load(sheet),load("index.html")]);
  const linked = "css/corpus-appearance-polish-marginalia.css?v=20261123-marginalia-editorial-v1";
  assert.equal(html.split(linked).length - 1,1);
  assert.ok(html.indexOf(linked) > html.indexOf("css/corpus-appearance-polish-territory.css"));
  assert.doesNotMatch(css,/data-corpus-shell="(?:territory|observatory|default)"/);
  for (const selector of ["#search-depth","#record-modal","body.author-view","#author-timeline-root",
    "#research-atlas-panel","#results",".site-mobile-toolbar",".site-menu-drawer",
    ".site-desktop-rail",".account-dock"]) {
    assert.ok(css.includes(selector), "Missing Marginalia component: " + selector);
  }
  for (const page of ["tesis.html","articulos.html","filosofia-latinoamericana.html",
    "perfil.html","research-atlas.html","revistas/udg/protrepsis.html",
    "revistas/udg/sincronia.html","revistas/udg/quadripartita-ratio.html"]) {
    assert.ok(!(await load(page)).includes("corpus-appearance-polish-marginalia.css"),
      "Theme must not leak into " + page);
  }
});

test("Marginalia: preserva estructura, scroll, gestos y no agrega listeners", async () => {
  const css = (await load(sheet)).replace(/\/\*[\s\S]*?\*\//g,"");
  assert.doesNotMatch(css,/(?:^|[;{]\s*)(?:position|display|inset|top|right|bottom|left|width|height|min-width|min-height|max-width|max-height|grid-template(?:-columns|-rows)?|grid-column|grid-row|overflow(?:-x|-y)?|transform|margin|z-index|scroll-behavior|touch-action|pointer-events)\s*:/m);
  assert.doesNotMatch(css,/@keyframes|@import|url\(/);
  assert.match(css,/@media \(forced-colors: active\)/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/:focus-visible/);
  const atlas = await load("css/research-atlas-embed.css");
  assert.match(atlas,/touch-action: none/);
  const timeline = await load("css/author-timeline.css");
  assert.match(timeline,/overflow-x: auto/);
  const margin = css.match(/padding-inline-end:/g) || [];
  assert.equal(margin.length,2,"Only safe rank/bookmark title reservation is permitted");
});

test("Marginalia: protege selector dark y elimina marcas azules heredadas", async () => {
  const css = await load(sheet);
  assert.match(css,/\.hero-shell #search-depth\s*\{[^}]*background: var\(--marginalia-subtle\) !important;/);
  assert.match(css,/\.search-mode-option\.is-active::after\s*\{[^}]*background: var\(--corpus-accent\)/);
  assert.match(css,/\.site-menu-theme button\[aria-pressed="true"\]\s*\{/);
  assert.match(css,/#results \.result-card \.result-links\s*\{[^}]*background: transparent !important;/);
  assert.match(css,/body\.author-view \.author-work-search-field input::placeholder/);
});
