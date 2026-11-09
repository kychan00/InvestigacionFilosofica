import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { searchTheses } from "../src/core/thesis-demo-search.js";
import {
  approvedUgtoRepositoryUrl,
  validateUgtoPhilosophyIndex,
} from "../src/core/ugto-philosophy-search.js";

const payload = JSON.parse(readFileSync(
  new URL("../data/theses/ugto-philosophy-v1/index.json", import.meta.url),
  "utf8",
));

test("UG Filosofía is fail-closed to 59 public theses and keeps research works separate", () => {
  const data = validateUgtoPhilosophyIndex(payload);
  assert.equal(data.records.length, 59);
  assert.deepEqual(
    {
      licenciatura: data.counts.licenciatura,
      maestria: data.counts.maestria,
      doctorado: data.counts.doctorado,
    },
    { licenciatura: 14, maestria: 35, doctorado: 10 },
  );
  assert.equal(data.separateResearchWorks.records, 3);
  assert.equal(data.separateResearchWorks.countedAsTheses, false);
  assert.equal(data.referenceOnly, true);
  assert.equal(data.pdfCopies, 0);
});

test("UG Filosofía references only stable institutional handle pages", () => {
  for (const row of payload.records) {
    assert.equal(approvedUgtoRepositoryUrl(row.sourceUrl), row.sourceUrl);
    assert.doesNotMatch(row.sourceUrl, /\.pdf$|\/bitstreams?\/|\/download\/?$/i);
  }
  assert.equal(approvedUgtoRepositoryUrl("https://evil.example/handle/20.500.12059/1"), null);
  assert.equal(approvedUgtoRepositoryUrl("https://www.repositorio.ugto.mx/bitstream/1.pdf"), null);
});

test("UG Filosofía can be searched with the shared thesis search contract", () => {
  assert.ok(searchTheses(payload.records, { query: "Kierkegaard" }).length >= 2);
  assert.equal(searchTheses(payload.records, { degree: "Doctorado" }).length, 10);
  assert.equal(searchTheses(payload.records, { program: "Maestría en Filosofía" }).length, 35);
});


test("T2DH cache-bust loads the current multi-institution thesis runtime", () => {
  const html = readFileSync(new URL("../tesis.html", import.meta.url), "utf8");
  assert.match(html, /\.\/js\/thesis-demo\.js\?v=20261109-aleph-links-v1/);
});
