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

test("Latin American philosopher cards use the canonical full author view", () => {
  assert.match(script, /function authorPageUrl\(author\)/);
  assert.match(script, /url\.searchParams\.set\("view", "author"\)/);
  assert.match(script, /url\.searchParams\.set\("author", name\)/);
  assert.match(script, /url\.hash = "results"/);

  assert.match(script, /content\.href = authorPageUrl\(author\)/);
  assert.match(script, /link\.href = authorPageUrl\(record\)/);
  assert.match(script, /Abrir archivo completo/);
});

test("Latin American philosopher page no longer renders the author modal", () => {
  assert.doesNotMatch(page, /id="author-dialog"/);
  assert.doesNotMatch(script, /openAuthorDialog\(id\)/);
});

test("legacy #autor links redirect to the canonical author page", () => {
  assert.match(script, /location\.hash\.match\(\/\^#autor-/);
  assert.match(script, /window\.location\.replace\(authorPageUrl\(legacyAuthor\)\)/);
});
