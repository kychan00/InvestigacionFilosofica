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
    assert.match(html, /data-atlas-action="pan-right"/);
    assert.match(html, /data-atlas-action="pan-down"/);
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
  const topics = await readFile("js/journal-article-topics.js", "utf8");
  assert.match(source, /CATEGORY_RULES/);
  assert.match(source, /articleTopicMetadata/);
  assert.match(source, /topicMeta\.label/);
  assert.match(source, /topicMeta\.note/);
  assert.match(source, /Categoría amplia derivada para navegación/);
  assert.match(source, /record\.subjects/);
  assert.match(topics, /Palabras clave editoriales/);
  assert.match(topics, /Temas bibliográficos/);
  assert.match(topics, /Temas del texto/);
  assert.match(topics, /no sustituyen palabras clave editoriales/);
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
  assert.match(source, /panBy/);
  assert.match(source, /touchPointers/);
  assert.match(source, /beginPinch/);
  assert.match(source, /updatePinch/);
  assert.match(source, /pointerType === "touch"/);
  assert.match(source, /atlasTouchMode = "pan-pinch"/);
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
  assert.match(source, /MENU_ICONS/);
  assert.match(source, /createMenuIcon/);
  assert.match(source, /site-menu-link-icon/);
  assert.match(source, /icon: "search"/);
  assert.match(source, /icon: "thesis"/);
  assert.match(source, /icon: "atlas"/);
  assert.match(source, /icon: "articles"/);
  assert.match(source, /icon: "university"/);
  assert.match(source, /icon: "journal"/);
  assert.match(source, /icon: "info"/);
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

  const doubleIssue = journalIssueInfo({
    doi: "10.32870/prot.i9-10.127",
    year: 2016
  });
  assert.equal(doubleIssue.key, "issue:9-10");
  assert.equal(doubleIssue.label, "Núm. 9–10");
  assert.deepEqual(doubleIssue.numbers, [9, 10]);
  assert.equal(doubleIssue.number, null);

  const metadataDouble = journalIssueInfo({
    issueLabel: "11–12",
    issueNumbers: [11, 12],
    year: 2017
  });
  assert.equal(metadataDouble.key, "issue:11-12");
  assert.equal(metadataDouble.label, "Núm. 11–12");
});


test("archivo editorial no recorta números históricos", async () => {
  const source = await readFile("js/journal-page.js", "utf8");
  const css = await readFile("css/journal-page.css", "utf8");
  assert.doesNotMatch(source, /journalIssueGroups\(state\.records\)\.slice\(0,\s*16\)/);
  assert.match(source, /for \(const group of journalIssueGroups\(state\.records\)\)/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*journal-issues-block \.journal-taxonomy-list[\s\S]*max-height: none/);
});

test("Atlas móvil oculta controles mecánicos y conserva Qwen", async () => {
  const css = await readFile("css/journal-page.css", "utf8");
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*journal-atlas-toolbar button\[data-atlas-action\][\s\S]*display: none !important/);
  assert.match(css, /journal-atlas-toolbar \.journal-qwen-toggle[\s\S]*width: 100%/);
  assert.match(css, /touch-action: none/);
});
