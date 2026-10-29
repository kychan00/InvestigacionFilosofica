import assert from "node:assert/strict";
import test from "node:test";

import {
  combineSemanticWithFederated
} from "../src/core/semantic-federation.js";


function baseResult(overrides = {}) {
  return {
    id: "openalex-W1",
    openalexId: "W1",
    title: "A work",
    authors: [],
    providers: ["OpenAlex Philosophy"],
    sourceRecords: [],
    matchedQueries: [],
    topics: [],
    isbn: [],
    institutionalLinks: [],
    urls: {
      canonical: "https://openalex.org/W1"
    },
    retrievalMode: "semantic",
    semanticScore: 0.8,
    ...overrides
  };
}


test(
  "conserva primero el núcleo semántico y añade fuentes externas",
  () => {
    const response =
      combineSemanticWithFederated(
        {
          results: [baseResult()],
          errors: [],
          semantic: {}
        },
        {
          parsed: {
            philosophers: [],
            concepts: []
          },
          results: [
            baseResult({
              id: "crossref-2",
              openalexId: null,
              title: "External work",
              providers: ["Crossref"],
              urls: {},
              retrievalMode: null,
              semanticScore: null
            })
          ],
          errors: []
        }
      );

    assert.equal(response.results.length, 2);
    assert.equal(
      response.results[0].retrievalMode,
      "semantic"
    );
    assert.equal(
      response.results[1].semanticCompanion,
      true
    );
    assert.equal(
      response.semantic.federation
        .openAlexApiEnabled,
      false
    );
    assert.equal(
      response.semantic.federation
        .rerankerEnabled,
      false
    );
  }
);


test(
  "fusiona metadata federada sobre el mismo OpenAlex ID",
  () => {
    const response =
      combineSemanticWithFederated(
        {
          results: [baseResult()],
          errors: [],
          semantic: {}
        },
        {
          results: [
            baseResult({
              id:
                "https://openalex.org/W1",
              authors: [
                { name: "Author One" }
              ],
              retrievalMode: null
            })
          ],
          errors: []
        }
      );

    assert.equal(response.results.length, 1);
    assert.equal(
      response.results[0].authors[0].name,
      "Author One"
    );
    assert.equal(
      response.stats.merged,
      1
    );
  }
);
