import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { journalIssueInfo } from "../js/journal-issues.js";

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
    assert.match(html, /journal-atlas-controls/);
    assert.match(html, /data-atlas-action="zoom-in"/);
    assert.match(html, /data-atlas-action="fit"/);
    assert.match(html, /journal-category-chips/);
    assert.match(html, /journal-topic-chips/);
    assert.match(html, /journal-author-chips/);
    assert.match(html, /temas declarados/i);
    assert.match(html, /id="journal-category"/);
    assert.match(html, /id="journal-issue"/);
    assert.match(html, /journal-filter-toggle/);
    assert.match(html, /journal-atlas-stagebar/);
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
  assert.match(source, /journalIssueGroups/);
  assert.match(source, /journalIssueInfo/);
  assert.match(source, /authorSearchUrl/);
  assert.match(source, /view", "author"/);
  assert.match(source, /journal-author-link/);
});

test("Atlas de revista distingue Qwen verificado de respaldo textual", async () => {
  const source = await readFile("js/journal-atlas.js", "utf8");
  assert.match(source, /ResearchAtlasQwenVectorClient/);
  assert.match(source, /cosineInt8/);
  assert.match(source, /source: qwen \? "qwen" : "textual"/);
  assert.match(source, /Qwen verificado/);
  assert.match(source, /Proximidad textual/);
  assert.match(source, /MAX_ATLAS_RECORDS = 72/);
  assert.match(source, /TOP_K = 3/);
  assert.match(source, /buildTextVectors/);
  assert.match(source, /issueGroups/);
  assert.match(source, /aproximaciones débiles/);
  assert.match(source, /onWheel/);
  assert.match(source, /onPointerDown/);
  assert.match(source, /fitView/);
  assert.match(source, /resetLayout/);
  assert.match(source, /relatedEdgesFor/);
  assert.match(source, /relationExplanation/);
  assert.match(source, /RELACIONES SEMÁNTICAS/);
  assert.match(source, /data-related-node/);
  assert.match(source, /coseno TF-IDF/);
  assert.match(source, /coseno Qwen/);
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


test("números editoriales se recuperan de DOI y citas OJS", () => {
  assert.equal(
    journalIssueInfo({ doi: "10.32870/prot.i20.279", year: 2021 }).number,
    20
  );
  assert.equal(
    journalIssueInfo({ doi: "10.32870/qr.v9i17.185", year: 2024 }).number,
    17
  );
  assert.equal(
    journalIssueInfo({ bibliographicSources: ["Sincronía, 30(89)"], year: 2026 }).number,
    89
  );
  assert.equal(
    journalIssueInfo({ bibliographicSources: ["Año 11, Número 22"], year: 2022 }).number,
    22
  );
});
