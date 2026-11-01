import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("el folio bibliográfico enlaza autores al archivo de autor", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");

  assert.match(source, /function renderRecordAuthorLinks\(/);
  assert.match(source, /function renderRecordAuthorLink\(/);
  assert.match(source, /authorWorksUrl\(\s*author\.name,\s*author\s*\)/s);
  assert.match(source, /class="record-author-link \$\{escapeHtml\(extraClass\)\}"/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);

  const detailsStart = source.indexOf("function renderRecordDetails");
  const detailsEnd = source.indexOf("\n\nfunction openRecord", detailsStart);
  assert.ok(detailsStart >= 0 && detailsEnd > detailsStart);

  const details = source.slice(detailsStart, detailsEnd);
  assert.match(details, /renderRecordAuthorLinks\(/);
  assert.match(details, /renderRecordAuthorLink\(/);
  assert.match(details, /record-author-link-byline/);
  assert.match(details, /record-author-link-card/);
});

test("la ficha bibliográfica usa enlaces de autor también en metadatos", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  const start = source.indexOf("function recordMetadataCards");
  const end = source.indexOf("\n\nfunction renderRecordDetails", start);
  assert.ok(start >= 0 && end > start);

  const metadata = source.slice(start, end);
  assert.match(metadata, /renderRecordAuthorLinks\(/);
  assert.match(metadata, /record-author-link-metadata/);
  assert.match(metadata, /addHtml\(\s*"Autores"/s);
});
