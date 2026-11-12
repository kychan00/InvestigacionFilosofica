import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const paths = {
  protrepsis: "revistas/udg/protrepsis.html",
  sincronia: "revistas/udg/sincronia.html",
  quadripartita: "revistas/udg/quadripartita-ratio.html"
};

for (const [journal, path] of Object.entries(paths)) {
  test("página individual " + journal + " conserva el contrato académico", async () => {
    const html = await readFile(path, "utf8");
    assert.match(html, new RegExp('data-journal="' + journal + '"'));
    assert.match(html, /journal-page\.css/);
    assert.match(html, /journal-page\.js/);
    assert.match(html, /journal-atlas-canvas/);
    assert.match(html, /journal-qwen-toggle/);
    assert.match(html, /journal-category-chips/);
    assert.match(html, /journal-topic-chips/);
    assert.match(html, /journal-author-chips/);
    assert.match(html, /temas declarados/i);
    assert.match(html, /id="journal-category"/);
    assert.match(html, /Categor[ií]a de navegaci[oó]n/i);
  });
}

test("runtime de revistas separa metadatos editoriales de categorías derivadas", async () => {
  const source = await readFile("js/journal-page.js", "utf8");
  assert.match(source, /CATEGORY_RULES/);
  assert.match(source, /Temas declarados/);
  assert.match(source, /derivada para navegaci[oó]n/);
  assert.match(source, /record\.subjects/);
  assert.match(source, /journal-doi-only/);
  assert.match(source, /journal-abstract-only/);
});

test("Atlas de revista distingue Qwen verificado de respaldo textual", async () => {
  const source = await readFile("js/journal-atlas.js", "utf8");
  assert.match(source, /ResearchAtlasQwenVectorClient/);
  assert.match(source, /cosineInt8/);
  assert.match(source, /source: qwen \? "qwen" : "textual"/);
  assert.match(source, /Qwen verificado/);
  assert.match(source, /Respaldo textual/);
  assert.match(source, /MAX_ATLAS_RECORDS = 72/);
});

test("navegación lateral enlaza páginas individuales y funciona desde subdirectorios", async () => {
  const source = await readFile("js/mobile-site-menu.js", "utf8");
  assert.match(source, /SITE_ROOT = new URL\("\.\.\/", import\.meta\.url\)/);
  assert.match(source, /revistas\/udg\/protrepsis\.html/);
  assert.match(source, /revistas\/udg\/sincronia\.html/);
  assert.match(source, /revistas\/udg\/quadripartita-ratio\.html/);
});

test("índice de Artículos ofrece acceso directo a la página activa", async () => {
  const html = await readFile("articulos.html", "utf8");
  const js = await readFile("js/articles.js", "utf8");
  assert.match(html, /journal-page-link/);
  assert.match(js, /\.\/revistas\/udg\/protrepsis\.html/);
  assert.match(js, /\.\/revistas\/udg\/sincronia\.html/);
  assert.match(js, /\.\/revistas\/udg\/quadripartita-ratio\.html/);
});
