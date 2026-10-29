import assert from "node:assert/strict";
import {
  readFile
} from "node:fs/promises";
import test from "node:test";

import {
  authorBucket,
  authorNameSignature,
  augmentWithAuthorResolution,
  buildExclusiveAuthorResponse,
  enrichResultsWithRemoteAuthors,
  extractRemoteAuthorQueries,
  looksLikeAuthorQuery,
  normalizeAuthorName,
  resolveRemoteAuthor,
  resolveRemoteAuthors
} from "../src/core/remote-author-resolution.js";


function response(
  body,
  {
    status = 200,
    json = false
  } = {}
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => String(body),
    json: async () =>
      json ? body : JSON.parse(body)
  };
}


function bucketPath(kind, value) {
  return `/${kind}/${String(
    authorBucket(value)
  ).padStart(4, "0")}.jsonl`;
}


test(
  "enriquece resultados semánticos con autores por OpenAlex ID",
  async () => {
    const workId = "7075599623";
    const fetchImpl = async url => {
      const path = new URL(url).pathname;

      assert.ok(
        path.endsWith(
          bucketPath(
            "work-authors",
            workId
          )
        )
      );

      return response(
        JSON.stringify({
          wid: Number(workId),
          a: [
            {
              id: 5020923463,
              n: "Immanuel Kant",
              o: null,
              p: "first",
              r: true
            }
          ]
        }) + "\n"
      );
    };

    const enriched =
      await enrichResultsWithRemoteAuthors(
        {
          results: [
            {
              id:
                "openalex-W7075599623",
              openalexId:
                "W7075599623",
              authors: []
            }
          ]
        },
        {
          fetchImpl,
          indexBase:
            "https://example.test/data/"
        }
      );

    assert.equal(
      enriched.results[0].authors[0].name,
      "Immanuel Kant"
    );
    assert.equal(
      enriched.results[0]
        .authors[0].isCorresponding,
      true
    );
    assert.equal(
      enriched.results[0]
        .authorMetadataSource,
      "OpenAlex snapshot · Hugging Face"
    );
  }
);


test(
  "un shard transitorio se reintenta y otro fallido no descarta los autores disponibles",
  async () => {
    const availableWorkId = "101";
    const unavailableWorkId = "202";
    const calls = new Map();

    assert.notEqual(
      authorBucket(availableWorkId),
      authorBucket(unavailableWorkId)
    );

    const fetchImpl = async url => {
      const pathname = new URL(url).pathname;
      const count =
        (calls.get(pathname) || 0) + 1;

      calls.set(pathname, count);

      if (
        pathname.endsWith(
          bucketPath(
            "work-authors",
            availableWorkId
          )
        )
      ) {
        if (count === 1) {
          return response("busy", {
            status: 503
          });
        }

        return response(
          JSON.stringify({
            wid: Number(availableWorkId),
            a: [
              {
                id: 501,
                n: "Autora Disponible",
                o: null,
                p: "first",
                r: false
              }
            ]
          }) + "\n"
        );
      }

      return response("busy", {
        status: 503
      });
    };

    const enriched =
      await enrichResultsWithRemoteAuthors(
        {
          results: [
            {
              id:
                `openalex-W${availableWorkId}`,
              authors: []
            },
            {
              id:
                `openalex-W${unavailableWorkId}`,
              authors: []
            }
          ]
        },
        {
          fetchImpl,
          indexBase:
            "https://example.test/data/"
        }
      );

    assert.deepEqual(
      enriched.results[0].authors.map(
        author => author.name
      ),
      ["Autora Disponible"]
    );
    assert.deepEqual(
      enriched.results[1].authors,
      []
    );
    const callCountFor = workId =>
      [...calls.entries()]
        .find(([pathname]) =>
          pathname.endsWith(
            bucketPath(
              "work-authors",
              workId
            )
          )
        )?.[1];

    assert.equal(
      callCountFor(availableWorkId),
      2
    );
    assert.equal(
      callCountFor(unavailableWorkId),
      3
    );
  }
);


test(
  "normaliza orden, acentos y apellidos compuestos",
  () => {
    assert.equal(
      normalizeAuthorName(
        "Amezcua, Alonso-Náva"
      ),
      "amezcua alonso nava"
    );

    assert.equal(
      authorNameSignature(
        "Alonso Nava Amezcua"
      ),
      authorNameSignature(
        "Amezcua, Alonso Nava"
      )
    );

    assert.equal(
      normalizeAuthorName(
        "René Straße"
      ),
      "rene strasse"
    );
  }
);


test(
  "descarta consultas que claramente no son nombres",
  () => {
    assert.equal(
      looksLikeAuthorQuery(
        "¿Qué relación hay entre lógica y ontología?"
      ),
      false
    );

    assert.equal(
      looksLikeAuthorQuery(
        "Alonso Nava Amezcua"
      ),
      true
    );
  }
);


test(
  "separa consultas de varios autores sin romper un nombre individual",
  () => {
    assert.deepEqual(
      extractRemoteAuthorQueries(
        "Kant y Hegel",
        [
          "Immanuel Kant",
          "Georg Wilhelm Friedrich Hegel"
        ]
      ),
      [
        {
          input: "Kant",
          canonicalName: "Immanuel Kant"
        },
        {
          input: "Hegel",
          canonicalName:
            "Georg Wilhelm Friedrich Hegel"
        }
      ]
    );

    assert.deepEqual(
      extractRemoteAuthorQueries(
        "Jose Fuerte, Nava Amezcua, Dinora"
      ).map(item => item.input),
      [
        "Jose Fuerte",
        "Nava Amezcua",
        "Dinora"
      ]
    );

    assert.deepEqual(
      extractRemoteAuthorQueries(
        "Alonso Nava Amezcua"
      ),
      []
    );

    assert.deepEqual(
      extractRemoteAuthorQueries(
        "Kant y Hegel sobre la libertad",
        [
          "Immanuel Kant",
          "Georg Wilhelm Friedrich Hegel"
        ]
      ).map(item => item.input),
      ["Kant", "Hegel"]
    );
  }
);


test(
  "resuelve varios autores y conserva sus perfiles biográficos",
  async () => {
    const authors = {
      Kant: {
        qid: "Q9312",
        canonical: "Immanuel Kant",
        id: 9312,
        title: "Crítica de la razón pura"
      },
      Hegel: {
        qid: "Q9235",
        canonical:
          "Georg Wilhelm Friedrich Hegel",
        id: 9235,
        title: "Fenomenología del espíritu"
      }
    };
    const byCanonical = new Map(
      Object.values(authors).map(item => [
        authorNameSignature(item.canonical),
        item
      ])
    );

    const fetchImpl = async url => {
      const parsed = new URL(url);
      const action =
        parsed.searchParams.get("action");

      if (action === "wbsearchentities") {
        const query =
          parsed.searchParams.get("search");
        const item =
          authors[query] ||
          Object.values(authors)
            .find(value =>
              value.canonical === query
            );

        return response(
          {
            search: item
              ? [
                  {
                    id: item.qid,
                    label: item.canonical,
                    description:
                      "filósofo alemán"
                  }
                ]
              : []
          },
          { json: true }
        );
      }

      if (action === "wbgetentities") {
        const qid =
          parsed.searchParams.get("ids");
        const item = Object.values(authors)
          .find(value => value.qid === qid);

        return response(
          {
            entities: {
              [qid]: {
                labels: {
                  es: {
                    value: item.canonical
                  }
                },
                descriptions: {
                  es: {
                    value: "filósofo alemán"
                  }
                },
                sitelinks: {
                  eswiki: {
                    title: item.canonical
                  }
                },
                claims: {
                  P31: [
                    {
                      mainsnak: {
                        datavalue: {
                          value: { id: "Q5" }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          { json: true }
        );
      }

      for (const [signature, item] of byCanonical) {
        if (
          parsed.pathname.endsWith(
            bucketPath(
              "aliases",
              signature
            )
          )
        ) {
          return response(
            JSON.stringify({
              s: signature,
              id: item.id,
              n: item.canonical,
              o: null,
              cw: 40,
              c: 100,
              k: "full"
            }) + "\n"
          );
        }

        if (
          parsed.pathname.endsWith(
            bucketPath(
              "works",
              String(item.id)
            )
          )
        ) {
          return response(
            JSON.stringify({
              id: item.id,
              wid: item.id,
              t: item.title,
              y: 1800,
              l: "de",
              ty: "book"
            }) + "\n"
          );
        }
      }

      return response("");
    };

    const result = await resolveRemoteAuthors(
      "Kant y Hegel",
      {
        canonicalNames: [
          authors.Kant.canonical,
          authors.Hegel.canonical
        ],
        fetchImpl,
        indexBase:
          "https://example.test/data/"
      }
    );

    assert.equal(result.status, "multiple");
    assert.equal(result.authors.length, 2);
    assert.deepEqual(
      result.authors.map(author =>
        author.displayName
      ),
      [
        authors.Kant.canonical,
        authors.Hegel.canonical
      ]
    );
    assert.equal(
      result.authors[0].biography,
      "filósofo alemán"
    );
    assert.match(
      result.authors[1].wikipediaUrl,
      /wikipedia\.org/u
    );
  }
);


test(
  "resuelve un nombre completo sin consultar Wikidata",
  async () => {
    const signature =
      authorNameSignature(
        "Amezcua Alonso Nava"
      );

    const calls = [];
    const fetchImpl = async url => {
      const path = new URL(url).pathname;
      calls.push(String(url));

      if (
        path.endsWith(
          bucketPath("aliases", signature)
        )
      ) {
        return response(
          JSON.stringify({
            s: signature,
            id: 42,
            n: "Alonso Nava Amezcua",
            o: "https://orcid.org/0000-0001",
            cw: 3,
            c: 5,
            k: "full"
          }) + "\n"
        );
      }

      if (
        path.endsWith(
          bucketPath("works", "42")
        )
      ) {
        return response(
          JSON.stringify({
            id: 42,
            wid: 99,
            p: "first",
            r: true,
            t: "Tecnociencia",
            y: 2026,
            l: "es",
            ty: "article"
          }) + "\n"
        );
      }

      throw new Error(`Unexpected URL ${url}`);
    };

    const result = await resolveRemoteAuthor(
      "Amezcua Alonso Nava",
      {
        fetchImpl,
        indexBase:
          "https://example.test/data/"
      }
    );

    assert.equal(result.status, "resolved");
    assert.equal(
      result.author.displayName,
      "Alonso Nava Amezcua"
    );
    assert.equal(result.works.length, 1);
    assert.equal(
      calls.some(url =>
        url.includes("wikidata")
      ),
      false
    );
  }
);


test(
  "Emmanuel Kant se contrasta en Wikidata y recupera Immanuel Kant",
  async () => {
    const querySignature =
      authorNameSignature(
        "Emmanuel Kant"
      );
    const canonicalSignature =
      authorNameSignature(
        "Immanuel Kant"
      );

    const fetchImpl = async url => {
      const parsed = new URL(url);
      const action =
        parsed.searchParams.get("action");

      if (action === "wbsearchentities") {
        return response(
          {
            search: [
              {
                id: "Q9312",
                label: "Immanuel Kant",
                aliases: ["Emmanuel Kant"]
              }
            ]
          },
          { json: true }
        );
      }

      if (action === "wbgetentities") {
        return response(
          {
            entities: {
              Q9312: {
                labels: {
                  es: {
                    value: "Immanuel Kant"
                  }
                },
                aliases: {
                  es: [
                    {
                      value: "Emmanuel Kant"
                    }
                  ]
                },
                claims: {
                  P31: [
                    {
                      mainsnak: {
                        datavalue: {
                          value: { id: "Q5" }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          { json: true }
        );
      }

      if (
        parsed.pathname.endsWith(
          bucketPath(
            "aliases",
            querySignature
          )
        )
      ) {
        return response("");
      }

      if (
        parsed.pathname.endsWith(
          bucketPath(
            "aliases",
            canonicalSignature
          )
        )
      ) {
        return response(
          JSON.stringify({
            s: canonicalSignature,
            id: 9312,
            n: "Kant, Immanuel",
            o: null,
            cw: 80,
            c: 1000,
            k: "full"
          }) + "\n"
        );
      }

      if (
        parsed.pathname.endsWith(
          bucketPath("works", "9312")
        )
      ) {
        return response(
          JSON.stringify({
            id: 9312,
            wid: 100,
            p: "first",
            r: false,
            t: "Kritik der reinen Vernunft",
            y: 1781,
            l: "de",
            ty: "book"
          }) + "\n"
        );
      }

      return response("");
    };

    const result = await resolveRemoteAuthor(
      "Emmanuel Kant",
      {
        fetchImpl,
        indexBase:
          "https://example.test/data/"
      }
    );

    assert.equal(result.status, "resolved");
    assert.equal(
      result.author.displayName,
      "Immanuel Kant"
    );
    assert.equal(
      result.author.wikidataId,
      "Q9312"
    );
    assert.equal(
      result.works[0].authors[0].name,
      "Immanuel Kant"
    );
  }
);


test(
  "una caída de Wikidata no descarta una identidad exacta del corpus",
  async () => {
    const signature =
      authorNameSignature("Immanuel Kant");

    const fetchImpl = async url => {
      const parsed = new URL(url);

      if (
        parsed.pathname.endsWith(
          bucketPath("aliases", signature)
        )
      ) {
        return response(
          JSON.stringify({
            s: signature,
            id: 9312,
            n: "Immanuel Kant",
            o: null,
            cw: 80,
            c: 1000,
            k: "full"
          }) + "\n"
        );
      }

      if (
        parsed.searchParams.get("action") ===
        "wbsearchentities"
      ) {
        return response("", {
          status: 503
        });
      }

      if (
        parsed.pathname.endsWith(
          bucketPath("works", "9312")
        )
      ) {
        return response(
          JSON.stringify({
            id: 9312,
            wid: 100,
            p: "first",
            r: false,
            t: "Kritik der reinen Vernunft",
            y: 1781,
            l: "de",
            ty: "book"
          }) + "\n"
        );
      }

      return response("");
    };

    const result = await resolveRemoteAuthor(
      "Immanuel Kant",
      {
        fetchImpl,
        indexBase:
          "https://example.test/data/"
      }
    );

    assert.equal(result.status, "resolved");
    assert.equal(result.resolution, "corpus");
    assert.equal(result.works.length, 1);
  }
);


test(
  "un apellido aislado no elige un homónimo cuando Wikidata falla",
  async () => {
    const signature =
      authorNameSignature("Kant");

    const fetchImpl = async url => {
      const parsed = new URL(url);

      if (
        parsed.pathname.endsWith(
          bucketPath("aliases", signature)
        )
      ) {
        return response(
          [
            {
              s: signature,
              id: 1,
              n: "Immanuel Kant",
              cw: 142,
              c: 1000,
              k: "surname"
            },
            {
              s: signature,
              id: 2,
              n: "Kant",
              cw: 4,
              c: 10,
              k: "full"
            }
          ].map(JSON.stringify).join("\n") + "\n"
        );
      }

      if (
        parsed.searchParams.get("action") ===
        "wbsearchentities"
      ) {
        return response("", {
          status: 503
        });
      }

      return response("");
    };

    const result = await resolveRemoteAuthor(
      "Kant",
      {
        fetchImpl,
        indexBase:
          "https://example.test/data/"
      }
    );

    assert.equal(result.status, "ambiguous");
    assert.equal(
      result.candidates[0].n,
      "Immanuel Kant"
    );
  }
);


test(
  "no confunde Kantor con Kant",
  async () => {
    const fetchImpl = async url => {
      const parsed = new URL(url);

      if (
        parsed.searchParams.get("action") ===
        "wbsearchentities"
      ) {
        return response(
          { search: [] },
          { json: true }
        );
      }

      return response("");
    };

    const result = await resolveRemoteAuthor(
      "Kantor",
      {
        fetchImpl,
        indexBase:
          "https://example.test/data/"
      }
    );

    assert.equal(result.status, "none");
  }
);


test(
  "ante varios homónimos devuelve candidatos y no elige en silencio",
  async () => {
    const signature =
      authorNameSignature("María García");

    const fetchImpl = async url => {
      const parsed = new URL(url);

      if (
        parsed.pathname.endsWith(
          bucketPath("aliases", signature)
        )
      ) {
        return response(
          [1, 2].map(id =>
            JSON.stringify({
              s: signature,
              id,
              n: "María García",
              o: null,
              cw: 2,
              c: 0,
              k: "full"
            })
          ).join("\n") + "\n"
        );
      }

      if (
        parsed.searchParams.get("action") ===
        "wbsearchentities"
      ) {
        return response(
          { search: [] },
          { json: true }
        );
      }

      return response("");
    };

    const result = await resolveRemoteAuthor(
      "María García",
      {
        fetchImpl,
        indexBase:
          "https://example.test/data/"
      }
    );

    assert.equal(result.status, "ambiguous");
    assert.equal(result.candidates.length, 2);
  }
);


test(
  "las obras del autor quedan antes y no duplican el mismo OpenAlex ID",
  () => {
    const authorWork = {
      id: "https://openalex.org/W1",
      title: "Obra primaria"
    };

    const augmented =
      augmentWithAuthorResolution(
        {
          results: [
            {
              id: "openalex-W1",
              openalexId: "W1",
              title: "Obra duplicada"
            },
            {
              id: "crossref:2",
              title: "Comentario"
            }
          ],
          stats: {
            unique: 2,
            appearances: 2,
            providers: {}
          }
        },
        {
          status: "resolved",
          works: [authorWork]
        }
      );

    assert.equal(augmented.results.length, 2);
    assert.equal(
      augmented.results[0].title,
      "Obra primaria"
    );

    const repeated =
      augmentWithAuthorResolution(
        augmented,
        {
          status: "resolved",
          works: [authorWork]
        }
      );

    assert.equal(
      repeated.stats.appearances,
      augmented.stats.appearances
    );
  }
);


test(
  "una consulta multiautor prioriza artículos que relacionan a todos sin anteponer un autor",
  () => {
    const results = [
      {
        id: "kant-only",
        title: "La epistemología de Kant",
        abstract: "Estudio monográfico"
      },
      {
        id: "relation",
        title: "Kant y Hegel ante la dialéctica",
        abstract:
          "Una comparación entre ambos filósofos"
      },
      {
        id: "hegel-only",
        title: "La lógica de Hegel",
        abstract: "Estudio monográfico"
      }
    ];
    const resolution = {
      status: "multiple",
      identities: [
        {
          input: "Kant",
          status: "resolved",
          author: {
            displayName: "Immanuel Kant"
          },
          works: [
            {
              id: "direct-kant",
              title: "Obra de Kant"
            }
          ]
        },
        {
          input: "Hegel",
          status: "resolved",
          author: {
            displayName:
              "Georg Wilhelm Friedrich Hegel"
          },
          works: [
            {
              id: "direct-hegel",
              title: "Obra de Hegel"
            }
          ]
        }
      ]
    };

    const augmented =
      augmentWithAuthorResolution(
        { results },
        resolution
      );

    assert.deepEqual(
      augmented.results.map(item => item.id),
      [
        "relation",
        "kant-only",
        "hegel-only"
      ]
    );
    assert.equal(
      augmented.results.some(item =>
        item.id === "direct-kant"
      ),
      false
    );
  }
);


test(
  "la vista exclusiva conserva únicamente obras de autoría directa",
  () => {
    const authorWork = {
      id: "https://openalex.org/W1",
      title: "Obra del autor",
      providers: [
        "OpenAlex Philosophy"
      ]
    };
    const exclusive =
      buildExclusiveAuthorResponse(
        {
          results: [
            {
              id: "comentario",
              title:
                "Comentario sobre el autor"
            }
          ],
          errors: [
            { provider: "Ejemplo" }
          ]
        },
        {
          status: "resolved",
          author: {
            displayName:
              "Immanuel Kant"
          },
          works: [
            authorWork,
            authorWork
          ]
        }
      );

    assert.equal(
      exclusive.authorOnly,
      true
    );
    assert.equal(
      exclusive.searchMode,
      "author-only"
    );
    assert.deepEqual(
      exclusive.results,
      [authorWork]
    );
    assert.equal(
      exclusive.stats.unique,
      1
    );
    assert.deepEqual(
      exclusive.errors,
      []
    );
  }
);


test(
  "la interfaz integra identidad remota, evidencia y ambigüedad explícita",
  async () => {
    const [app, css] = await Promise.all([
      readFile(
        new URL(
          "../js/app.js",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "../css/redesign.css",
          import.meta.url
        ),
        "utf8"
      )
    ]);

    assert.match(
      app,
      /augmentWithAuthorResolution/u
    );
    assert.match(
      app,
      /resolveAuthorForQuery/u
    );
    assert.match(
      app,
      /No elegí una identidad automáticamente/u
    );
    assert.match(
      app,
      /Wikidata/u
    );
    assert.match(
      app,
      /ORCID/u
    );
    assert.match(
      app,
      /Relación entre autores/u
    );
    assert.match(
      app,
      /Biografía en Wikipedia/u
    );
    assert.match(
      app,
      /author-work-link/u
    );
    assert.match(
      app,
      /openExclusiveAuthorByName/u
    );
    assert.match(
      css,
      /\.author-resolution/u
    );
    assert.match(
      css,
      /\.author-profile-grid/u
    );
  }
);
