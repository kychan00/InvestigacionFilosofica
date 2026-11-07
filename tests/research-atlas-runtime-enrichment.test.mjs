import assert from "node:assert/strict";
import test from "node:test";

import {
  enrichResearchAtlasRuntime
} from "../src/core/research-atlas-runtime-enrichment.js";


const response = {
  query:
    "runtime enrichment",
  results: [],
  errors: [],
  stats: {
    appearances: 0,
    unique: 0,
    merged: 0,
    providers: {}
  }
};


test("RA10 runtime ejecuta enrichment → authority → related en ese orden", async () => {
  const calls = [];

  const runtime =
    await enrichResearchAtlasRuntime(
      response,
      {
        enrichResultsImpl:
          async value => {
            calls.push(
              "authors"
            );

            return {
              ...value,
              enriched:
                true
            };
          },
        buildAuthorityGraphImpl:
          value => {
            calls.push(
              "authority"
            );

            assert.equal(
              value.enriched,
              true
            );

            return {
              buildRevision:
                "fixture-authority",
              runtimeDiagnostics: {
                confirmedAuthorities:
                  1
              }
            };
          },
        buildRelatedResponsesImpl:
          async (
            value,
            graph
          ) => {
            calls.push(
              "related"
            );

            assert.equal(
              value.enriched,
              true
            );

            assert.equal(
              graph.buildRevision,
              "fixture-authority"
            );

            return {
              responses: [
                {
                  seed: {
                    identity:
                      "openalex:w1"
                  }
                }
              ],
              diagnostics: {
                relatedEdges:
                  1
              }
            };
          }
      }
    );

  assert.deepEqual(
    calls,
    [
      "authors",
      "authority",
      "related"
    ]
  );

  assert.equal(
    runtime.authorityGraph
      .buildRevision,
    "fixture-authority"
  );

  assert.equal(
    runtime.relatedResponses
      .length,
    1
  );
});


test("RA10 runtime respeta AbortSignal antes de promover autoridad", async () => {
  const controller =
    new AbortController();

  controller.abort();

  await assert.rejects(
    enrichResearchAtlasRuntime(
      response,
      {
        signal:
          controller.signal,
        enrichResultsImpl:
          async value =>
            value,
        buildAuthorityGraphImpl:
          () => {
            throw new Error(
              "authority should not run"
            );
          }
      }
    ),
    error =>
      error?.name ===
      "AbortError"
  );
});
