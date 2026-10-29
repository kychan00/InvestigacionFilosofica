import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveCrossrefAuthor
} from "../src/core/crossref-author-fallback.js";


test(
  "recupera sólo obras con nombre exacto y conserva ORCID",
  async () => {
    const result = await resolveCrossrefAuthor(
      "Alonso Nava Amezcua",
      {
        orcid:
          "https://orcid.org/0000-0001-5655-0106",
        searchImpl: async () => [
          {
            id: "crossref:1",
            title: "Tecnociencia",
            authors: [
              {
                id: null,
                name: "Alonso Nava Amezcua"
              }
            ],
            providers: ["Crossref"]
          },
          {
            id: "crossref:2",
            title: "Democratización de la ciencia",
            authors: [
              {
                id:
                  "https://orcid.org/0000-0001-5655-0106",
                name: "Alonso Nava Amezcua"
              }
            ],
            providers: ["Crossref"]
          },
          {
            id: "crossref:noise",
            title: "Ruido",
            authors: [
              {
                id: null,
                name: "Felipe Amezcua"
              }
            ],
            providers: ["Crossref"]
          }
        ]
      }
    );

    assert.equal(result.status, "resolved");
    assert.equal(
      result.resolution,
      "crossref-author"
    );
    assert.equal(result.works.length, 2);
    assert.equal(
      result.author.orcid,
      "https://orcid.org/0000-0001-5655-0106"
    );
    assert.ok(
      result.works.every(work =>
        work.retrievalMode ===
          "author-crossref"
      )
    );
  }
);


test(
  "no elige una coincidencia parcial de apellido",
  async () => {
    const result = await resolveCrossrefAuthor(
      "Alonso Nava Amezcua",
      {
        searchImpl: async () => [
          {
            id: "crossref:noise",
            title: "Otro trabajo",
            authors: [
              {
                id: null,
                name: "Manuel Amezcua"
              }
            ]
          }
        ]
      }
    );

    assert.equal(result.status, "none");
    assert.deepEqual(result.works, []);
  }
);
