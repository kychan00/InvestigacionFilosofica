import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeResults
} from "../src/core/merge-results.js";


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
