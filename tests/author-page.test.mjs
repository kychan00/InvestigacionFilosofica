import assert from "node:assert/strict";
import test from "node:test";

import {
  summarizeAuthorCorpus
} from "../src/core/author-page.js";


test(
  "resume corpus, periodo, idiomas y décadas del autor",
  () => {
    const summary = summarizeAuthorCorpus(
      {
        displayName: "Immanuel Kant",
        corpusWorks: 81
      },
      [
        {
          title: "Kant and transcendental idealism",
          year: 1781,
          language: "de",
          type: "book"
        },
        {
          title: "Transcendental philosophy and freedom",
          year: 1788,
          language: "de",
          type: "book"
        },
        {
          title: "Freedom and practical philosophy",
          year: 1797,
          language: "en",
          type: "article"
        }
      ]
    );

    assert.equal(summary.corpusWorks, 81);
    assert.equal(summary.loadedWorks, 3);
    assert.equal(summary.yearFrom, 1781);
    assert.equal(summary.yearTo, 1797);
    assert.deepEqual(summary.languages, [
      { value: "de", count: 2 },
      { value: "en", count: 1 }
    ]);
    assert.deepEqual(summary.decades, [
      { decade: 1780, label: "1780s", count: 2 },
      { decade: 1790, label: "1790s", count: 1 }
    ]);
    assert.deepEqual(
      summary.focuses.slice(0, 3),
      [
        { term: "freedom", count: 2 },
        { term: "philosophy", count: 2 },
        { term: "transcendental", count: 2 }
      ]
    );
  }
);


test(
  "no inventa conteos ni periodos cuando faltan obras",
  () => {
    assert.deepEqual(
      summarizeAuthorCorpus(
        {
          displayName: "Autora sin obras",
          corpusWorks: 0
        },
        []
      ),
      {
        corpusWorks: 0,
        loadedWorks: 0,
        yearFrom: null,
        yearTo: null,
        languages: [],
        types: [],
        focuses: [],
        decades: []
      }
    );
  }
);
