import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeResults
} from "../src/core/merge-results.js";


test(
  "fusiona el ID local semántico con la URL OpenAlex",
  () => {
    const merged = mergeResults([
      {
        id: "openalex-W123",
        openalexId: "W123",
        title: "Semantic copy",
        authors: [],
        providers: ["OpenAlex Philosophy"],
        sourceRecords: [],
        matchedQueries: [],
        topics: [],
        isbn: [],
        institutionalLinks: [],
        urls: {
          canonical:
            "https://openalex.org/W123"
        }
      },
      {
        id: "https://openalex.org/W123",
        title: "Federated copy",
        authors: [
          { name: "Author One" }
        ],
        providers: ["OpenAlex Philosophy"],
        sourceRecords: [],
        matchedQueries: [],
        topics: [],
        isbn: [],
        institutionalLinks: [],
        urls: {
          canonical:
            "https://openalex.org/W123"
        }
      }
    ]);

    assert.equal(merged.length, 1);
    assert.equal(
      merged[0].authors[0].name,
      "Author One"
    );
  }
);


test(
  "fusiona OpenAlex y Crossref por DOI",
  () => {
    const results =
      mergeResults([
        {
          id:
            "https://openalex.org/W1",

          title:
            "Ejemplo filosófico",

          authors: [
            {
              name:
                "Autora Ejemplo"
            }
          ],

          year: 2020,

          type: "article",

          language: "es",

          doi:
            "10.1234/test",

          isbn: [],

          journal:
            "Revista Filosófica",

          publisher: null,

          abstract: null,

          citedBy: 12,

          openAccess: {
            isOpen: true,
            status: "gold",
            url:
              "https://example.org"
          },

          topics: [
            {
              name:
                "Philosophical Thought and Analysis"
            }
          ],

          philosophers: [],
          traditions: [],

          providers: [
            "OpenAlex"
          ],

          sourceRecords: [
            {
              provider:
                "OpenAlex",

              sourceId:
                "W1",

              query:
                "filosofía"
            }
          ],

          matchedQueries: [
            {
              query:
                "filosofía",

              weight: 1,

              type:
                "original"
            }
          ],

          urls: {},
          institutionalLinks: []
        },

        {
          id:
            "crossref:10.1234/test",

          title:
            "Ejemplo filosófico",

          authors: [
            {
              name:
                "Autora Ejemplo"
            }
          ],

          year: 2020,

          type:
            "journal-article",

          language: null,

          doi:
            "10.1234/test",

          isbn: [],

          journal:
            "Revista Filosófica",

          publisher:
            "Editorial Ejemplo",

          abstract:
            "Resumen bibliográfico.",

          citedBy: null,
          openAccess: null,
          topics: [],

          philosophers: [],
          traditions: [],

          providers: [
            "Crossref"
          ],

          sourceRecords: [
            {
              provider:
                "Crossref",

              sourceId:
                "10.1234/test",

              query:
                "filosofía"
            }
          ],

          matchedQueries: [
            {
              query:
                "filosofía",

              weight: 1,

              type:
                "original"
            }
          ],

          urls: {},
          institutionalLinks: []
        }
      ]);


    assert.equal(
      results.length,
      1
    );


    const item =
      results[0];


    assert.deepEqual(
      item.providers.sort(),
      [
        "Crossref",
        "OpenAlex"
      ]
    );


    assert.equal(
      item.publisher,
      "Editorial Ejemplo"
    );


    assert.equal(
      item.citedBy,
      12
    );


    assert.equal(
      item.openAccess.isOpen,
      true
    );


    assert.equal(
      item.sourceRecords.length,
      2
    );


    /*
     * Misma consulta encontrada en dos
     * proveedores no debe duplicarse.
     */
    assert.equal(
      item.matchedQueries.length,
      1
    );
  }
);


test(
  "fusiona una misma obra aunque cambien proveedor, ID y año de edición",
  () => {
    const merged =
      mergeResults([
        {
          id: "internetarchive:edition-a",
          title: "El pensamiento alemán Tomo III",
          authors: [
            { name: "Eusebi Colomer" }
          ],
          year: 1978,
          doi: null,
          isbn: [],
          providers: ["Internet Archive"],
          sourceRecords: [
            {
              provider: "Internet Archive",
              sourceId: "edition-a",
              query: "eusebi colomer"
            }
          ],
          matchedQueries: [],
          topics: [],
          institutionalLinks: [],
          urls: {
            canonical:
              "https://archive.org/details/edition-a"
          }
        },
        {
          id: "catalog:edition-b",
          title: "El pensamiento alemán Tomo III",
          authors: [
            { name: "Colomer Eusebi" }
          ],
          year: 1991,
          doi: null,
          isbn: [],
          providers: ["Catálogo B"],
          sourceRecords: [
            {
              provider: "Catálogo B",
              sourceId: "edition-b",
              query: "eusebi colomer"
            }
          ],
          matchedQueries: [],
          topics: [],
          institutionalLinks: [],
          urls: {
            canonical:
              "https://example.org/edition-b"
          }
        }
      ]);

    assert.equal(
      merged.length,
      1
    );

    assert.deepEqual(
      merged[0].years,
      [1978, 1991]
    );

    assert.equal(
      merged[0].workAppearanceCount,
      2
    );

    assert.deepEqual(
      merged[0].providers.sort(),
      [
        "Catálogo B",
        "Internet Archive"
      ]
    );

    assert.equal(
      merged[0].sourceLinks.length,
      2
    );
  }
);


test(
  "fusiona una variante bibliográfica que antepone el nombre del autor",
  () => {
    const merged =
      mergeResults([
        {
          id: "internetarchive:a",
          title:
            "Colomer Eusebi El Pensamiento Aleman Tomo III",
          authors: [
            { name: "Eusebi Colomer" }
          ],
          year: 1978,
          providers: ["Internet Archive"],
          sourceRecords: [],
          matchedQueries: [],
          topics: [],
          isbn: [],
          institutionalLinks: [],
          urls: {
            canonical:
              "https://archive.org/details/a"
          }
        },
        {
          id: "catalog:b",
          title:
            "El pensamiento alemán, tomo III",
          authors: [
            { name: "Eusebi Colomer" }
          ],
          year: 1991,
          providers: ["Catálogo B"],
          sourceRecords: [],
          matchedQueries: [],
          topics: [],
          isbn: [],
          institutionalLinks: [],
          urls: {
            canonical:
              "https://example.org/b"
          }
        }
      ]);

    assert.equal(
      merged.length,
      1
    );

    assert.equal(
      merged[0].titleVariants.length,
      2
    );
  }
);


test(
  "no fusiona volúmenes distintos de una misma serie",
  () => {
    const merged =
      mergeResults([
        {
          id: "archive:tomo-i",
          title:
            "El pensamiento alemán Tomo I",
          authors: [
            { name: "Eusebi Colomer" }
          ],
          year: 1986,
          providers: ["Internet Archive"],
          sourceRecords: [],
          matchedQueries: [],
          topics: [],
          isbn: [],
          institutionalLinks: [],
          urls: {}
        },
        {
          id: "archive:tomo-iii",
          title:
            "El pensamiento alemán Tomo III",
          authors: [
            { name: "Eusebi Colomer" }
          ],
          year: 1990,
          providers: ["Internet Archive"],
          sourceRecords: [],
          matchedQueries: [],
          topics: [],
          isbn: [],
          institutionalLinks: [],
          urls: {}
        }
      ]);

    assert.equal(
      merged.length,
      2
    );
  }
);


test(
  "no fusiona títulos iguales cuando la autoría es incompatible",
  () => {
    const merged =
      mergeResults([
        {
          id: "provider:a",
          title:
            "Introducción a la metafísica",
          authors: [
            { name: "Autor Uno" }
          ],
          year: 2000,
          providers: ["Proveedor A"],
          sourceRecords: [],
          matchedQueries: [],
          topics: [],
          isbn: [],
          institutionalLinks: [],
          urls: {}
        },
        {
          id: "provider:b",
          title:
            "Introducción a la metafísica",
          authors: [
            { name: "Autora Dos" }
          ],
          year: 2000,
          providers: ["Proveedor B"],
          sourceRecords: [],
          matchedQueries: [],
          topics: [],
          isbn: [],
          institutionalLinks: [],
          urls: {}
        }
      ]);

    assert.equal(
      merged.length,
      2
    );
  }
);
