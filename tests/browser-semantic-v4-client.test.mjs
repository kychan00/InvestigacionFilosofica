import assert from "node:assert/strict";
import test from "node:test";

import {
  BROWSER_STATIC_V4_BASE_URL,
  isBrowserSemanticV4OptIn,
  searchBrowserSemanticV4
} from "../src/core/browser-semantic-v4.js";


test("browser semantic v4 stays disabled without the exact opt-in", () => {
  assert.equal(isBrowserSemanticV4OptIn(""), false);
  assert.equal(isBrowserSemanticV4OptIn("?semantic=browser"), false);
  assert.equal(isBrowserSemanticV4OptIn("?semantic=browser-v4"), true);
  assert.match(BROWSER_STATIC_V4_BASE_URL, /resolve\/5a4a1950/u);
});


test("browser semantic v4 normalizes static results for the existing UI", async () => {
  const stages = [];
  const response = await searchBrowserSemanticV4(
    "ontología en Quine",
    {
      limit: 12,
      embedImpl: async () => [1, 0],
      searchImpl: {
        async search(embedding, options) {
          assert.deepEqual(embedding, [1, 0]);
          assert.equal(options.limit, 12);
          options.onProgress({ stage: "shards", loaded: 32, total: 32 });
          return {
            candidate_count: 64000,
            results: [
              {
                id: "openalex-W1",
                title: "Quine y la ontología",
                authors: ["Autora Uno"],
                topics: ["Ontology"],
                source: "OpenAlex",
                semantic_score: 0.75
              }
            ]
          };
        }
      },
      onProgress: item => stages.push(item.stage)
    }
  );
  assert.equal(response.searchMode, "semantic");
  assert.equal(response.semantic.mode, "browser-static-v4");
  assert.equal(response.semantic.candidateCount, 64000);
  assert.equal(response.results[0].relevanceScore, 75);
  assert.deepEqual(stages, ["embedding", "shards"]);
});


test("browser semantic v4 honors cancellation before inference", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    searchBrowserSemanticV4("consulta", { signal: controller.signal }),
    error => error.name === "AbortError"
  );
});
