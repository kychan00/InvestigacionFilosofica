import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const load = path => readFile(new URL(path, root), "utf8");
const sheet = "css/corpus-appearance-polish-territory.css";

function tokens(css, mode) {
  const selector = 'html[data-theme="' + mode + '"][data-corpus-shell="territory"]';
  const start = css.indexOf(selector + " {");
  assert.notEqual(start, -1, "Falta paleta " + mode);
  const block = css.slice(start + selector.length + 2, css.indexOf("\n}", start));
  return Object.fromEntries([...block.matchAll(/^\s*(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gim)]
    .map(([, key, value]) => [key, value]));
}
function brightness(value) {
  const channels = value.match(/[a-f0-9]{2}/gi).map(s => parseInt(s, 16) / 255);
  const [r, g, b] = channels.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrast(a, b) {
  const l1 = brightness(a), l2 = brightness(b);
  return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
}

test("Territorio editorial: claro y oscuro cumplen contraste AA en texto y CTA", async () => {
  const css = await load(sheet);
  for (const mode of ["light", "dark"]) {
    const p = tokens(css, mode);
    for (const [foreground, background] of [
      ["--corpus-ink", "--corpus-page"],
      ["--corpus-muted", "--corpus-page"],
      ["--corpus-record-title", "--corpus-record-surface"],
      ["--corpus-record-muted", "--corpus-record-surface"],
      ["--territory-action-ink", "--territory-action"],
      ["--corpus-on-accent", "--corpus-accent"]
    ]) {
      assert.ok(p[foreground] && p[background], mode + " carece de " + foreground + " o " + background);
      assert.ok(contrast(p[foreground], p[background]) >= 4.5,
        mode + " " + foreground + "/" + background + " no alcanza WCAG AA");
    }
    assert.ok(contrast(p["--territory-art-ink"], mode === "light" ? "#213a2e" : "#1c3026") >= 4.5);
    for (const [foreground, background] of [
      ["--territory-caption", "--territory-surface"],
      ["--territory-caption", "--corpus-page"],
      ["--corpus-muted", "--territory-surface"],
      ["--territory-action-ink", "--territory-action-hover"]
    ]) {
      assert.ok(contrast(p[foreground], p[background]) >= 4.5,
        mode + " insuficiente contraste de navegación: " + foreground + " / " + background);
    }
  }
});

test("Territorio editorial no se filtra a otro tema ni a páginas fuera de index", async () => {
  const [css, html] = await Promise.all([load(sheet), load("index.html")]);
  const linked = "css/corpus-appearance-polish-territory.css?v=20261122-territory-editorial-v1";
  assert.equal(html.split(linked).length - 1, 1);
  assert.ok(html.indexOf(linked) > html.indexOf("css/corpus-appearance-author-atlas.css"));
  assert.doesNotMatch(css, /data-corpus-shell="(?:marginalia|observatory|default)"/);
  assert.match(css, /#record-modal/);
  assert.match(css, /#research-atlas-panel/);
  assert.match(css, /body\.author-view/);
  assert.match(css, /body:not\(\.author-view\)/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /focus-visible/);
  for (const file of [
    "tesis.html", "articulos.html", "filosofia-latinoamericana.html",
    "perfil.html", "research-atlas.html", "revistas/udg/protrepsis.html",
    "revistas/udg/sincronia.html"
  ]) {
    const page = await load(file);
    assert.ok(!page.includes("corpus-appearance-polish-territory.css"), file);
  }
});

test("Territorio editorial respeta geometría, scroll y gestos del Atlas", async () => {
  const css = await load(sheet);
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(clean, /(?:^|[;{]\s*)(?:position|display|inset|top|right|bottom|left|width|height|min-width|min-height|max-width|max-height|grid-template(?:-columns|-rows)?|grid-column|grid-row|overflow(?:-x|-y)?|transform|margin|padding|z-index|scroll-behavior|touch-action|pointer-events)\s*:/m);
  assert.doesNotMatch(clean, /@keyframes/);
  const atlas = await load("css/research-atlas-embed.css");
  assert.match(atlas, /touch-action: none/);
  const base = await load("css/author-timeline.css");
  assert.match(base, /overflow-x: auto/);
});

test("Territorio editorial aplica la misma navegación al autor y elimina los acentos azules", async () => {
  const css = await load(sheet);
  assert.match(css, /html\[data-corpus-shell="territory"\] \.site-mobile-toolbar,/);
  assert.match(css, /html\[data-corpus-shell="territory"\] \.philo-nav/);
  assert.match(css, /html\[data-corpus-shell="territory"\] \.site-menu-drawer/);
  assert.match(css, /html\[data-corpus-shell="territory"\] \.site-desktop-rail/);
  assert.match(css, /\.philo-nav-links a::before/);
  assert.match(css, /\.site-menu-theme button\[aria-pressed="true"\]/);
  assert.match(css, /\.site-menu-drawer :is\(/);
  assert.doesNotMatch(css, /\.site-mobile-toolbar,\s*\nhtml\[data-corpus-shell="territory"\] body:not\(\.author-view\)/);
});
