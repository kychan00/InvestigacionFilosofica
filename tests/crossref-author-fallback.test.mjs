import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveFederatedAuthor,
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


test(
  "construye una página universal combinando catálogos y eliminando duplicados",
  async () => {
    const result = await resolveFederatedAuthor(
      "María Ejemplo Investigadora",
      {
        crossrefSearchImpl: async () => [
          {
            id: "crossref:1",
            doi: "10.1000/shared",
            title: "Ética y comunidad",
            year: 2024,
            authors: [
              {
                id: "https://orcid.org/0000-0001-2345-6789",
                name: "María Ejemplo Investigadora"
              }
            ],
            providers: ["Crossref"]
          }
        ],
        archiveSearchImpl: async () => [
          {
            id: "internetarchive:shared",
            doi: "10.1000/shared",
            title: "Ética y comunidad",
            year: 2024,
            authors: [
              {
                id: null,
                name: "Investigadora María Ejemplo"
              }
            ],
            providers: ["Internet Archive"]
          },
          {
            id: "internetarchive:book",
            title: "Filosofía pública",
            year: 2020,
            authors: [
              {
                id: null,
                name: "María Ejemplo Investigadora"
              }
            ],
            providers: ["Internet Archive"]
          },
          {
            id: "internetarchive:noise",
            title: "Texto ajeno",
            year: 2025,
            authors: [
              {
                id: null,
                name: "María Ejemplo"
              }
            ],
            providers: ["Internet Archive"]
          }
        ]
      }
    );

    assert.equal(result.status, "resolved");
    assert.equal(
      result.resolution,
      "federated-author"
    );
    assert.equal(result.works.length, 2);
    assert.deepEqual(
      result.author.catalogSources,
      ["Crossref", "Internet Archive"]
    );
    assert.equal(
      result.author.orcid,
      "https://orcid.org/0000-0001-2345-6789"
    );
    assert.deepEqual(
      result.works.map(work => work.retrievalMode),
      [
        "author-crossref",
        "author-internet-archive"
      ]
    );
  }
);


test(
  "funciona para nombres arbitrarios sin una lista manual de autores",
  async () => {
    const names = [
      "Ada Lovelace",
      "Kwame Anthony Appiah",
      "María Zambrano",
      "Byung Chul Han"
    ];

    for (const name of names) {
      const result = await resolveFederatedAuthor(
        name,
        {
          disableCrossref: true,
          archiveSearchImpl: async () => [
            {
              id: `archive:${name}`,
              title: `Obra de ${name}`,
              year: 2000,
              authors: [{ id: null, name }],
              providers: ["Internet Archive"]
            }
          ]
        }
      );

      assert.equal(result.status, "resolved");
      assert.equal(
        result.author.displayName,
        name
      );
      assert.equal(result.works.length, 1);
    }
  }
);
