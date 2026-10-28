import assert from "node:assert/strict";
import {
  readFile
} from "node:fs/promises";
import test from "node:test";

import {
  authorBucket,
  authorNameSignature,
  augmentWithAuthorResolution,
  looksLikeAuthorQuery,
  normalizeAuthorName,
  resolveRemoteAuthor
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
              id: "https://api.openalex.org/W1",
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
      css,
      /\.author-resolution/u
    );
  }
);
