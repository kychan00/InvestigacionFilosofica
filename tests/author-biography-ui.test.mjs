import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const css = readFileSync(
  new URL("../css/author-visibility-repair.css", import.meta.url), "utf8"
);

test("ORCID biography is not copied into the author hero", () => {
  assert.doesNotMatch(
    app,
    /biography:\s*profile\.biography\s*\|\|\s*author\?\.biography/
  );
  assert.match(
    app,
    /orcidProfileSummary\s*=\s*authorOrcidProfileSummary\(orcidProfile\)/
  );
  assert.match(
    app,
    /heroBiography\s*=\s*compactAuthorText\([\s\S]*?orcidProfileSummary/
  );
});

test("identical narrative biographies are explicitly de-duplicated", () => {
  assert.match(app, /function normalizedAuthorNarrative\(/);
  assert.match(
    app,
    /normalizedAuthorNarrative\(sourceBiography\)[\s\S]*?normalizedAuthorNarrative\(orcidBiography\)/
  );
});

test("long academic biographies are collapsed behind a native details control", () => {
  assert.match(app, /biography\.length\s*<=\s*720/);
  assert.match(app, /<details class="author-biography-details">/);
  assert.match(app, /Leer biografía completa ↓/);
  assert.match(app, /Ocultar biografía ↑/);
  assert.match(css, /\.author-biography-details\[open\]/);
  assert.match(css, /\.author-biography-preview/);
});

test("the author hero has a hard narrative length budget", () => {
  assert.match(app, /function compactAuthorText\(value, maxLength = 430\)/);
  assert.match(app, /heroBiography\s*=\s*compactAuthorText\([\s\S]*?430\s*\)/);
});
