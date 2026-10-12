import assert from "node:assert/strict";
import test from "node:test";

import {
  matchesFilters,
  normalize,
  stableTopK
} from "../src/ai/qwen3-browser-static-v4-search.js";


test("normalizes query vectors", () => {
  const vector = normalize([3, 4]);
  assert.deepEqual(Array.from(vector), [0.6000000238418579, 0.800000011920929]);
});


test("stableTopK resolves equal scores by vector id", () => {
  const output = stableTopK(
    Float32Array.from([0.5, 0.9, 0.9, 0.2]),
    Uint32Array.from([7, 9, 3, 1]),
    3
  );
  assert.deepEqual(output.map(item => item.id), [3, 9, 7]);
});


test("metadata filters are independent of a language model", () => {
  const document = {
    year: 2021,
    language: "es",
    source: "OpenAlex",
    publication_type: "article",
    authors: ["María Zambrano"],
    topics: ["Ontología"],
    journal: "Isegoría"
  };
  assert.equal(matchesFilters(document, {
    year_from: 2000,
    languages: ["es", "en"],
    author: "zambrano",
    topic: "ontología"
  }), true);
  assert.equal(matchesFilters(document, { year_from: 2022 }), false);
});
