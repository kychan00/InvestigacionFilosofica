import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../filosofia-latinoamericana.html", import.meta.url),
  "utf8"
);

const script = fs.readFileSync(
  new URL("../js/latin-american-philosophy.js", import.meta.url),
  "utf8"
);

const styles = fs.readFileSync(
  new URL("../css/latin-american-philosophy.css", import.meta.url),
  "utf8"
);

test("Latin American philosopher cards open the local dossier instead of navigating to the homepage", () => {
  assert.match(script, /function bindDossierLink\(link, id\)/);
  assert.match(script, /link\.href = authorHash\(id\)/);
  assert.match(script, /event\.preventDefault\(\);\s*void openAuthorDialog\(id\)/);
  assert.match(script, /bindDossierLink\(content, author\.id\)/);
  assert.match(script, /bindDossierLink\(link, record\.author_id\)/);
  assert.doesNotMatch(script, /window\.location\.replace\(/);
  assert.doesNotMatch(script, /url\.searchParams\.set\("view", "author"\)/);
});

test("Dossier markup and interactive controls are present", () => {
  for (const id of [
    "author-dialog", "author-dialog-title", "author-dialog-body",
    "author-dialog-close", "author-dialog-prev", "author-dialog-next",
    "author-dialog-share", "author-dossier-index", "author-dossier-works"
  ]) {
    assert.match(page, new RegExp('id="' + id + '"'));
  }
  assert.match(script, /authorDialogClose\?\.addEventListener\("click"/);
  assert.match(script, /authorDialogPrev\?\.addEventListener\("click"/);
  assert.match(script, /authorDialogNext\?\.addEventListener\("click"/);
  assert.match(script, /authorDialogShare\?\.addEventListener\("click"/);
  assert.match(script, /authorDialog\?\.addEventListener\("cancel"/);
  assert.match(styles, /@media \(max-width: 720px\)\s*\{/);
  assert.match(styles, /\.author-dialog\s*\{\s*width: 100vw;\s*height: 100dvh/);
});

test("Shared and saved author URLs reopen the same dossier", () => {
  assert.match(script, /sourcePage: `filosofia-latinoamericana\.html\$\{authorHash\(numericId\)\}`/);
  assert.match(script, /location\.hash\.match\(\/\^#autor-/);
  assert.match(script, /openAuthorDialog\(deepLinkId, \{ updateHistory: false \}\)/);
  assert.match(script, /window\.addEventListener\("hashchange", syncAuthorDialogWithLocation\)/);
  assert.match(script, /window\.addEventListener\("popstate", syncAuthorDialogWithLocation\)/);
});
