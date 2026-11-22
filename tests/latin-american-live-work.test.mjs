import test from "node:test";
import assert from "node:assert/strict";
import { liveResultBookmarkPayload } from "../js/latin-american-live-work.js";
import { workSaveKey, findSavedWork } from "../js/work-save-identity.js";

test("Internet Archive live results retain authorship and source for project bookmarks", () => {
  const source = {
    id: "archive-mariategui-anthology",
    title: "José Carlos Mariátegui: An Anthology",
    authors: [{ name: "José Carlos Mariátegui" }],
    year: 2011,
    type: "archive-text",
    providers: ["Internet Archive"],
    urls: { canonical: "https://archive.org/details/mariategui-anthology" }
  };
  const bookmark = liveResultBookmarkPayload(source, source.urls.canonical);
  assert.equal(bookmark.referenceUrl, source.urls.canonical);
  assert.equal(bookmark.authors[0].name, "José Carlos Mariátegui");
  assert.equal(bookmark.id, source.id);
  assert.equal(workSaveKey(bookmark), workSaveKey(source));
  assert.equal(findSavedWork(source, [bookmark]), bookmark);
  assert.equal(source.referenceUrl, undefined, "The federated response must stay immutable");
});

test("Live-result DOI links normalize to the same saved-work identity", () => {
  const source = {
    title: "Obra latinoamericana",
    authors: [{ name: "Autora de ejemplo" }],
    urls: { doi: "https://doi.org/10.1234/Example.01" }
  };
  const bookmark = liveResultBookmarkPayload(source, source.urls.doi);
  assert.equal(bookmark.doi, "10.1234/Example.01");
  assert.equal(workSaveKey(bookmark), "doi:10.1234/example.01");
  assert.equal(bookmark.referenceUrl, source.urls.doi);
});
