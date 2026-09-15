import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  parseQuery
} from "../src/core/parser.js";

import {
  rankResult,
  rankResults
} from "../src/core/rank.js";


const philosophyMap =
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../src/data/philosophy-map.json",
        import.meta.url
      ),
      "utf8"
    )
  );


const parsed =
  parseQuery(
    "libertad en Kant",
    philosophyMap
  );


function baseResult(
  overrides = {}
) {
  return {
    id: null,
    title: "",
    authors: [],
    year: 2020,
    type: "article",
    language: "es",
    doi: null,
    isbn: [],
    journal: null,
    publisher: null,
    abstract: null,
    citedBy: 0,
    openAccess: null,
    topics: [],
    philosophers: [],
    traditions: [],
    providers: [
      "OpenAlex"
    ],
    sourceRecords: [],
    matchedQueries: [
      {
        query:
          "libertad en Kant",

        weight: 1,

        type:
          "original"
      }
    ],
    urls: {},
    institutionalLinks: [],
    ...overrides
  };
}


test(
  "resultado kantiano supera ruido no filosófico",
  () => {
    const relevant =
      baseResult({
        title:
          "Sobre el problema de la libertad en Kant",

        doi:
          "10.1234/kant",

        authors: [
          {
            name:
              "Autor Filosófico"
          }
        ],

        journal:
          "Revista de Filosofía",

        topics: [
          {
            name:
              "Philosophical Ethics and Theory"
          }
        ]
      });


    const noise =
      baseResult({
        title:
          "Climate Policy Summary",

        doi:
          "10.1234/noise",

        citedBy:
          25000,

        journal:
          "Climate Science",

        topics: [
          {
            name:
              "Climate Change Policy"
          }
        ]
      });


    const ranked =
      rankResults(
        [
          relevant,
          noise
        ],
        parsed,
        philosophyMap
      );


    assert.equal(
      ranked[0].doi,
      "10.1234/kant"
    );
  }
);


test(
  "Crossref sólo recibe penalización con baja cobertura del título",
  () => {
    const strong =
      rankResult(
        baseResult({
          title:
            "Libertad en Kant",
          providers: [
            "Crossref"
          ]
        }),
        parsed,
        philosophyMap
      );

    const weak =
      rankResult(
        baseResult({
          title:
            "Kant y la estética",
          providers: [
            "Crossref"
          ]
        }),
        parsed,
        philosophyMap
      );

    assert.equal(
      strong.ranking.sourcePrior,
      0
    );

    assert.equal(
      weak.ranking.sourcePrior,
      -2
    );

    assert.ok(
      strong.ranking.titleCoverage >= 50
    );

    assert.ok(
      weak.ranking.titleCoverage < 50
    );
  }
);


test(
  "Ranking v2 aplica priors pequeños a CUCSH e Internet Archive",
  () => {
    const cucsh =
      rankResult(
        baseResult({
          title:
            "Libertad en Kant",
          providers: [
            "CUCSH Filosofía"
          ]
        }),
        parsed,
        philosophyMap
      );

    const archive =
      rankResult(
        baseResult({
          title:
            "Libertad en Kant",
          providers: [
            "Internet Archive"
          ]
        }),
        parsed,
        philosophyMap
      );

    assert.equal(
      cucsh.ranking.sourcePrior,
      5
    );

    assert.equal(
      archive.ranking.sourcePrior,
      3
    );
  }
);