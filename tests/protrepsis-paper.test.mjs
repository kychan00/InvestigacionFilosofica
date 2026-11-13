import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = "revistas/udg/";
const page = await readFile(root + "protrepsis.html", "utf8");
const profile = await readFile(root + "protrepsis-institucional.html", "utf8");
const css = await readFile("css/protrepsis-paper.css", "utf8");
const menu = await readFile("js/mobile-site-menu.js", "utf8");

test("portada de Protrepsis tiene identidad editorial real, no solo página de equipo", () => {
  assert.match(page, /class="journal-page protrepsis-paper"/);
  assert.match(page, /<h1 id="pro-hero-title">Protrepsis/);
  assert.match(page, /class="pro-book-cover"/);
  assert.match(page, /class="pro-editorial-feature"/);
  assert.match(page, /Conocer Protrepsis/);
  assert.match(page, /Historia y equipo editorial/);
  assert.match(page, /protrepsis-institucional\.html/);
  assert.match(page, /href="#journal-views"/);
  assert.match(profile, /href="protrepsis\.html#journal-views"/);
  assert.match(profile, /pro-profile-companion/);
});

test("el rediseño preserva controles de la revista y su Atlas", () => {
  for (const id of [
    "journal-total", "journal-year-span", "journal-author-total",
    "journal-doi-rate", "journal-abstract-rate", "journal-query",
    "journal-decade", "journal-issue", "journal-category",
    "journal-filter-toggle", "journal-card-grid", "journal-results-status",
    "journal-load-more", "journal-issue-chips", "journal-topic-chips",
    "journal-author-chips", "journal-qwen-toggle", "journal-atlas-canvas",
    "journal-atlas-detail", "journal-archive-panel", "journal-atlas-panel",
    "journal-insights-panel"
  ]) assert.ok(page.includes('id="' + id + '"'), "preserved runtime ID: " + id);
  for (const view of ["archive", "atlas", "insights"]) {
    assert.ok(page.includes('data-journal-view="' + view + '"'));
  }
  assert.match(page, /src="\.\.\/\.\.\/js\/journal-page\.js\?v=/);
});

test("la identidad editorial se limita a Protrepsis y contempla accesibilidad", async () => {
  assert.match(page, /protrepsis-paper\.css\?v=/);
  assert.match(profile, /protrepsis-paper\.css\?v=/);
  assert.match(css, /body\[data-journal="protrepsis"\]/);
  assert.match(css, /\.ji\.ji--protrepsis/);
  assert.match(css, /Cormorant Garamond/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /@media\(max-width:620px\)/);
  for (const other of ["sincronia.html", "quadripartita-ratio.html"]) {
    const html = await readFile(root + other, "utf8");
    assert.doesNotMatch(html, /protrepsis-paper\.css/);
  }
});

test("los accesos editoriales desaparecen del menú general", () => {
  for (const slug of ["protrepsis", "sincronia", "quadripartita-ratio"]) {
    assert.ok(menu.includes('revistas/udg/' + slug + '.html'));
    assert.ok(!menu.includes('revistas/udg/' + slug + '-institucional.html'));
  }
  assert.ok(!menu.includes("quadripartita-ratio-institucional.html"));
  assert.match(page, /class="pro-editorial-feature-link" href="protrepsis-institucional\.html"/);
});
