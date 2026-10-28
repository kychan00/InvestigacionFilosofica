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


test(
  "nombre completo de autor exacto precede coincidencias parciales en títulos y autores",
  () => {
    const authorQuery =
      parseQuery(
        "Alonso Nava Amezcua",
        philosophyMap
      );

    const ranked =
      rankResults(
        [
          baseResult({
            title:
              "Felipe Amezcua",
            authors: [
              {
                name:
                  "Felipe Amezcua"
              }
            ],
            citedBy:
              1000
          }),
          baseResult({
            title:
              "Alonso en la historia de la ciencia",
            authors: [
              {
                name:
                  "Manuel Amezcua"
              }
            ]
          }),
          baseResult({
            title:
              "Tecnociencia, entorno y sujeto tecnocientífico",
            authors: [
              {
                name:
                  "Alonso Nava Amezcua"
              }
            ],
            doi:
              "10.1234/alonso-nava"
          })
        ],
        authorQuery,
        philosophyMap
      );

    assert.equal(
      ranked[0].doi,
      "10.1234/alonso-nava"
    );

    assert.equal(
      ranked[0].ranking.author,
      3
    );

    assert.equal(
      ranked[0].ranking
        .authorPriorityApplies,
      true
    );

    assert.equal(
      ranked[0].relevanceScore,
      95
    );
  }
);


test(
  "apellido de filósofo reconocido prioriza sus obras sobre textos acerca de él",
  () => {
    const kantQuery =
      parseQuery(
        "Kant",
        philosophyMap
      );

    const ranked =
      rankResults(
        [
          baseResult({
            title:
              "La recepción contemporánea de Kant",
            authors: [
              {
                name:
                  "Investigadora Contemporánea"
              }
            ],
            citedBy:
              5000
          }),
          baseResult({
            title:
              "Kritik der reinen Vernunft",
            authors: [
              {
                name:
                  "Kant, Immanuel"
              }
            ],
            isbn: [
              "9780000000000"
            ]
          })
        ],
        kantQuery,
        philosophyMap
      );

    assert.equal(
      ranked[0].title,
      "Kritik der reinen Vernunft"
    );

    assert.equal(
      ranked[0].ranking.author,
      2
    );

    assert.equal(
      ranked[0].relevanceScore,
      90
    );
  }
);


test(
  "un término temático aislado no activa prioridad por coincidencia parcial de autor",
  () => {
    const thematicQuery =
      parseQuery(
        "social",
        philosophyMap
      );

    const ranked =
      rankResults(
        [
          baseResult({
            title:
              "Ruido sin relación temática",
            authors: [
              {
                name:
                  "Justicia Social Pérez"
              }
            ]
          }),
          baseResult({
            title:
              "Teorías contemporáneas de la justicia social",
            doi:
              "10.1234/justicia"
          })
        ],
        thematicQuery,
        philosophyMap
      );

    assert.equal(
      ranked[1].ranking
        .authorPriorityApplies,
      false
    );

    assert.equal(
      ranked[0].doi,
      "10.1234/justicia"
    );
  }
);
