import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInternetArchiveSearchUrl,
  normalizeInternetArchiveItem,
  searchInternetArchive
} from "../src/sources/internet-archive.js";


test(
  "normaliza un texto de Internet Archive",
  () => {
    const item =
      normalizeInternetArchiveItem(
        {
          identifier:
            "kantcritiqueofp00kant",

          title:
            "Critique of Pure Reason",

          creator: [
            "Kant, Immanuel"
          ],

          date:
            "1900-01-01",

          language:
            "eng",

          subject: [
            "Philosophy",
            "Knowledge, Theory of"
          ],

          description:
            "<p>A classic work &amp; study.</p>",

          publisher:
            "Macmillan",

          isbn: [
            "978-1-2345-6789-0"
          ],

          downloads:
            1200
        },
        {
          query:
            "Kant pure reason",

          queryWeight:
            1,

          queryType:
            "original",

          rank:
            3
        }
      );


    assert.equal(
      item.id,
      "internetarchive:kantcritiqueofp00kant"
    );


    assert.equal(
      item.title,
      "Critique of Pure Reason"
    );


    assert.equal(
      item.authors[0].name,
      "Kant, Immanuel"
    );


    assert.equal(
      item.year,
      1900
    );


    assert.equal(
      item.language,
      "en"
    );


    assert.equal(
      item.abstract,
      "A classic work & study."
    );


    assert.deepEqual(
      item.isbn,
      [
        "9781234567890"
      ]
    );


    assert.equal(
      item.providers[0],
      "Internet Archive"
    );


    assert.equal(
      item.sourceRecords[0]
        .downloads,
      1200
    );


    assert.equal(
      item.urls.canonical,
      "https://archive.org/details/kantcritiqueofp00kant"
    );
  }
);


test(
  "construye búsqueda limitada a textos",
  () => {
    const url =
      buildInternetArchiveSearchUrl(
        "libertad en Kant",
        {
          rows:
            12,

          page:
            2
        }
      );


    assert.equal(
      url.origin,
      "https://archive.org"
    );


    assert.match(
      url.searchParams.get(
        "q"
      ),
      /mediatype:texts/
    );


    assert.match(
      url.searchParams.get(
        "q"
      ),
      /libertad en Kant/
    );


    assert.equal(
      url.searchParams.get(
        "rows"
      ),
      "12"
    );


    assert.equal(
      url.searchParams.get(
        "page"
      ),
      "2"
    );


    assert.equal(
      url.searchParams.get(
        "output"
      ),
      "json"
    );


    assert.ok(
      url.searchParams
        .getAll(
          "fl[]"
        )
        .includes(
          "identifier"
        )
    );
  }
);


test(
  "searchInternetArchive normaliza respuesta API",
  async () => {
    const originalFetch =
      globalThis.fetch;


    let requestedUrl =
      null;


    globalThis.fetch =
      async url => {
        requestedUrl =
          String(url);

        return {
          ok:
            true,

          status:
            200,

          headers: {
            get() {
              return null;
            }
          },

          async json() {
            return {
              response: {
                docs: [
                  {
                    identifier:
                      "beingandtime",

                    title:
                      "Being and Time",

                    creator:
                      "Heidegger, Martin",

                    year:
                      1962,

                    language:
                      "eng",

                    subject:
                      "Philosophy"
                  }
                ]
              }
            };
          }
        };
      };


    try {
      const results =
        await searchInternetArchive(
          {
            query:
              "Being and Time Heidegger",

            weight:
              1,

            type:
              "original"
          },
          {
            rows:
              5,

            page:
              1
          }
        );


      assert.equal(
        results.length,
        1
      );


      assert.equal(
        results[0].title,
        "Being and Time"
      );


      assert.equal(
        results[0].providers[0],
        "Internet Archive"
      );


      assert.match(
        requestedUrl,
        /advancedsearch\.php/
      );


      assert.match(
        decodeURIComponent(
          requestedUrl
        ),
        /mediatype:texts/
      );

    } finally {
      globalThis.fetch =
        originalFetch;
    }
  }
);


test(
  "preranking de Archive prioriza coincidencia bibliográfica",
  async () => {
    const originalFetch =
      globalThis.fetch;

    globalThis.fetch =
      async () => ({
        ok: true,
        status: 200,

        headers: {
          get() {
            return null;
          }
        },

        async json() {
          return {
            response: {
              docs: [
                {
                  identifier:
                    "generic-literature",

                  title:
                    "World's Great Classics",

                  creator:
                    "Various",

                  description:
                    "A collection including Kant and many writers.",

                  subject:
                    "Literature"
                },

                {
                  identifier:
                    "kant-pure-reason",

                  title:
                    "Critique of Pure Reason",

                  creator:
                    "Immanuel Kant",

                  subject:
                    "Philosophy"
                }
              ]
            }
          };
        }
      });

    try {
      const results =
        await searchInternetArchive(
          "Critique of Pure Reason Kant",
          {
            rows: 1,
            retries: 0
          }
        );

      assert.equal(
        results.length,
        1
      );

      assert.equal(
        results[0].id,
        "internetarchive:kant-pure-reason"
      );

      assert.equal(
        results[0]
          .sourceRecords[0]
          .rank,
        1
      );

      assert.ok(
        results[0]
          .sourceRecords[0]
          .retrievalScore >
        0
      );

    } finally {
      globalThis.fetch =
        originalFetch;
    }
  }
);


test(
  "obra primaria de Kant supera comentario",
  async () => {
    const originalFetch =
      globalThis.fetch;


    globalThis.fetch =
      async () => ({
        ok: true,
        status: 200,

        headers: {
          get() {
            return null;
          }
        },

        async json() {
          return {
            response: {
              docs: [
                {
                  identifier:
                    "kant-commentary",

                  title:
                    "A Commentary to Kant's Critique of Pure Reason",

                  creator:
                    "Norman Kemp Smith",

                  subject:
                    "Kant, Immanuel"
                },

                {
                  identifier:
                    "kant-primary",

                  title:
                    "Critique of Pure Reason",

                  creator:
                    "Immanuel Kant",

                  subject:
                    "Philosophy"
                }
              ]
            }
          };
        }
      });


    try {
      const results =
        await searchInternetArchive(
          "Critique of Pure Reason Kant",
          {
            rows: 2,
            retries: 0
          }
        );


      assert.equal(
        results[0].id,
        "internetarchive:kant-primary"
      );

    } finally {
      globalThis.fetch =
        originalFetch;
    }
  }
);


test(
  "obra primaria supera introducción cuando no fue solicitada",
  async () => {
    const originalFetch =
      globalThis.fetch;


    globalThis.fetch =
      async () => ({
        ok: true,
        status: 200,

        headers: {
          get() {
            return null;
          }
        },

        async json() {
          return {
            response: {
              docs: [
                {
                  identifier:
                    "plato-introduction",

                  title:
                    "Plato's Republic: An Introduction",

                  creator:
                    "Another Author"
                },

                {
                  identifier:
                    "plato-republic",

                  title:
                    "The Republic of Plato",

                  creator:
                    "Plato"
                }
              ]
            }
          };
        }
      });


    try {
      const results =
        await searchInternetArchive(
          "Republic Plato",
          {
            rows: 2,
            retries: 0
          }
        );


      assert.equal(
        results[0].id,
        "internetarchive:plato-republic"
      );

    } finally {
      globalThis.fetch =
        originalFetch;
    }
  }
);
