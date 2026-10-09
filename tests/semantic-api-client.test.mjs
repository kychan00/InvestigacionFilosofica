import assert from "node:assert/strict";
import test from "node:test";

import {
  SEMANTIC_API_ORIGIN,
  SemanticApiError,
  checkPublicSemanticHealth,
  normalizeSemanticResponse,
  searchPublicSemantic
} from "../src/core/semantic-api.js";


const payload = {
  query:
    "ontología y lógica en Quine",
  mode:
    "semantic",
  candidate_count:
    50,
  reranker_enabled:
    false,
  results: [
    {
      id:
        "openalex-W1",
      title:
        "Quine y la ontología",
      abstract:
        "Resumen",
      authors: [
        "Autora Uno"
      ],
      year:
        2020,
      topics: [
        "Ontology"
      ],
      keywords: [],
      journal:
        "Revista",
      language:
        "es",
      doi:
        "10.1/example",
      source:
        "OpenAlex Philosophy",
      publication_type:
        "article",
      openalex_id:
        "W1",
      crossref_id:
        null,
      url:
        "https://openalex.org/W1",
      semantic_score:
        0.734,
      lexical_score:
        null,
      rerank_score:
        null
    }
  ]
};


test(
  "comprueba disponibilidad con health sin ejecutar una búsqueda",
  async () => {
    let request;

    const health =
      await checkPublicSemanticHealth({
        fetchImpl:
          async (
            url,
            options
          ) => {
            request = {
              url,
              options
            };

            return new Response(
              JSON.stringify({
                status:
                  "ready",
                documents:
                  451823,
                index_build_id:
                  "build-v1",
                reranker_available:
                  false
              }),
              {
                status:
                  200,
                headers: {
                  "Content-Type":
                    "application/json"
                }
              }
            );
          }
      });

    assert.equal(
      request.url,
      `${SEMANTIC_API_ORIGIN}/health`
    );

    assert.equal(
      request.options.method,
      "GET"
    );

    assert.equal(
      health.documents,
      451823
    );
  }
);


test(
  "rechaza un health que aún no está listo",
  async () => {
    await assert.rejects(
      checkPublicSemanticHealth({
        fetchImpl:
          async () =>
            new Response(
              JSON.stringify({
                status:
                  "loading",
                documents:
                  451823
              }),
              {
                status:
                  200,
                headers: {
                  "Content-Type":
                    "application/json"
                }
              }
            )
      }),
      error => {
        assert.ok(
          error instanceof
          SemanticApiError
        );

        assert.equal(
          error.status,
          503
        );

        return true;
      }
    );
  }
);


test(
  "normaliza el contrato semántico para la UI sin inventar reranking",
  () => {
    const response =
      normalizeSemanticResponse(
        payload
      );

    assert.equal(
      response.searchMode,
      "semantic"
    );

    assert.equal(
      response.results[0]
        .authors[0].name,
      "Autora Uno"
    );

    assert.equal(
      response.results[0]
        .relevanceScore,
      73
    );

    assert.equal(
      response.results[0]
        .rerankScore,
      null
    );

    assert.deepEqual(
      response.results[0]
        .providers,
      [
        "OpenAlex Philosophy"
      ]
    );
  }
);


test(
  "el cliente fija endpoint, límite y reranker apagado",
  async () => {
    let request;

    const result =
      await searchPublicSemantic(
        payload.query,
        {
          limit:
            99,
          fetchImpl:
            async (
              url,
              options
            ) => {
              request = {
                url,
                options
              };

              return new Response(
                JSON.stringify(
                  payload
                ),
                {
                  status:
                    200,
                  headers: {
                    "Content-Type":
                      "application/json"
                  }
                }
              );
            }
        }
      );

    assert.equal(
      request.url,
      `${SEMANTIC_API_ORIGIN}/api/search/semantic`
    );

    assert.deepEqual(
      JSON.parse(
        request.options.body
      ),
      {
        query:
          payload.query,
        limit:
          20,
        filters: {},
        enable_reranker:
          false
      }
    );

    assert.equal(
      result.results.length,
      1
    );
  }
);


test(
  "un 429 conserva el tiempo de reintento para activar el fallback",
  async () => {
    await assert.rejects(
      searchPublicSemantic(
        payload.query,
        {
          fetchImpl:
            async () =>
              new Response(
                JSON.stringify({
                  detail:
                    "A semantic search is already running"
                }),
                {
                  status:
                    429,
                  headers: {
                    "Content-Type":
                      "application/json",
                    "Retry-After":
                      "5"
                  }
                }
              )
        }
      ),
      error => {
        assert.ok(
          error instanceof
          SemanticApiError
        );

        assert.equal(
          error.status,
          429
        );

        assert.equal(
          error.retryAfter,
          "5"
        );

        return true;
      }
    );
  }
);
