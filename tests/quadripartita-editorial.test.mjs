import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { journalIssueGroups, journalIssueInfo } from "../js/journal-issues.js";

const dataset = JSON.parse(await readFile(
  new URL("../src/data/cucsh-filosofia.json", import.meta.url),
  "utf8"
));
const q = dataset.records.filter(record => record.journal === "Quadripartita Ratio");
const years = new Map([
  [1, 2016], [2, 2016], [3, 2017], [4, 2017],
  [5, 2018], [6, 2018], [7, 2019], [8, 2019],
  [9, 2020], [10, 2020], [11, 2021], [12, 2021],
  [13, 2022], [14, 2022], [15, 2023], [16, 2023],
  [17, 2024], [18, 2024], [19, 2025], [20, 2025],
  [21, 2026]
]);

test("Quadripartita: 88 DOI únicos, 21 fascículos oficiales, Protrepsis intacta", () => {
  assert.equal(q.length, 88);
  assert.equal(dataset.records.filter(record => record.journal === "Protrepsis").length, 248);
  assert.equal(new Set(q.map(record => record.doi)).size, 88);
  assert.equal(new Set(q.map(record => record.urls.canonical)).size, 88);
  const groups = journalIssueGroups(q);
  assert.equal(groups.length, 21);
  assert.deepEqual(
    groups.map(group => group.number).sort((a, b) => a - b),
    [...years.keys()]
  );
  assert.equal(groups.find(group => group.number === 20).count, 2);
  assert.equal(groups.find(group => group.number === 21).count, 2);
});

test("Quadripartita: 88 fechas editoriales independientes de fecha OJS", () => {
  for (const record of q) {
    const info = journalIssueInfo(record);
    assert.equal(info.number, record.issueNumber, record.title);
    assert.equal(record.year, years.get(info.number), record.title);
    assert.equal(record.issueYear, record.year, record.title);
    assert.equal(record.issue, String(info.number), record.title);
    assert.deepEqual(record.issueNumbers, [info.number], record.title);
    assert.ok(record.editorialSource?.startsWith("https://quadripartitaratio.cucsh.udg.mx/"));
    assert.ok(record.publicationDate, record.title);
    assert.equal(record.publicationDate, record.date, record.title);
    assert.equal(record.publicationYear,
      Number(String(record.publicationDate).match(/\b(?:19|20)\d{2}\b)?.[0]),
      record.title
    );
  }
});

test("Quadripartita: excepción del DOI de Seoane respeta el fascículo 21", () => {
  const seoane = q.find(record => record.doi === "10.32870/qr.v10i20.185");
  assert.ok(seoane);
  assert.equal(seoane.year, 2026);
  assert.equal(seoane.issueNumber, 21);
  assert.equal(journalIssueInfo(seoane).label, "Núm. 21");
  assert.equal(seoane.editorialSource,
    "https://quadripartitaratio.cucsh.udg.mx/index.php/QR/article/view/185");
  assert.deepEqual(
    q.filter(record => record.issueNumber === 21).map(record => record.doi).sort(),
    ["10.32870/qr.v10i20.185", "10.32870/qr.v11i21.164"]
  );
});

test("Quadripartita: no confundir el año del número y la publicación real", () => {
  const issue5 = q.find(record => record.doi === "10.32870/qr.v3i5.71");
  assert.equal(issue5.issueYear, 2018);
  assert.equal(issue5.publicationYear, 2017);

  const issue19 = q.find(record => record.doi === "10.32870/qr.v10i19.186");
  assert.equal(issue19.issueYear, 2025);
  assert.equal(issue19.publicationYear, 2026);

  const issue20 = q.find(record => record.doi === "10.32870/qr.v10i20.189");
  assert.equal(issue20.issueYear, 2025);
  assert.equal(issue20.publicationYear, 2026);
});
