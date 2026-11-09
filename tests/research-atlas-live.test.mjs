import assert from "node:assert/strict";
import test from "node:test";

import {
  ResearchAtlasLiveSession
} from "../src/core/research-atlas-live.js";

import {
  OPENALEX_PHILOSOPHY_HF_REVISION
} from "../src/sources/openalex-philosophy.js";


function result({
  id,
  title,
  author = null
}) {
  return {
    id,
    title,
    authors:
      author
        ? [
            {
              name:
                author
            }
          ]
        : [],
    year: 2020,
    type: "article",
    language: "en",
    doi: null,
    isbn: [],
    topics: [],
    providers: [
      "OpenAlex Philosophy"
    ],
    sourceRecords: [
      {
        provider:
          "OpenAlex Philosophy",
        sourceId:
          id,
        query:
          "freedom and autonomy"
      }
    ],
    matchedQueries: [
      {
        query:
          "freedom and autonomy",
        weight: 1,
        type: "original"
      }
    ],
    urls: {},
    institutionalLinks: []
  };
}


function response(
  results,
  extra = {}
) {
  return {
    query:
      "freedom and autonomy",
    parsed: {},
    expansions: [],
    results,
    errors: [],
    stats: {
      appearances:
        results.length,
      unique:
        results.length,
      merged: 0,
      providers: {
        "OpenAlex Philosophy":
          results.length
      }
    },
    ...extra
  };
}


const philosophyMap = {
  philosophers: [],
  concepts: [],
  works: [],
  areas: []
};


test("RA7 federado emite parciales progresivos y final con la revisión HF", async () => {
  const updates = [];
  let observedOptions = null;

  const partial =
    response([
      result({
        id:
          "openalex-W100",
        title:
          "Freedom and autonomy in Kant"
      })
    ], {
      progress: {
        provider:
          "OpenAlex Philosophy",
        completedExpansions: 0,
        totalExpansions: 1
      }
    });

  const final =
    response([
      result({
        id:
          "openalex-W100",
        title:
          "Freedom and autonomy in Kant",
        author:
          "Author One"
      }),
      result({
        id:
          "openalex-W200",
        title:
          "Moral freedom and autonomy after Kant"
      })
    ]);

  const session =
    new ResearchAtlasLiveSession({
      philosophyMap,
      searchPhilosophyImpl:
        async (
          query,
          map,
          options
        ) => {
          observedOptions =
            options;

          options
            .onPartialResults
            ?.(partial);

          return final;
        },
      enrichAuthorsImpl:
        async value =>
          value,
      onUpdate:
        update =>
          updates.push(
            update
          )
    });

  const completed =
    await session.runFederated(
      "freedom and autonomy",
      {
        depth: 12
      }
    );

  assert.equal(
    updates.length,
    2
  );

  assert.equal(
    updates[0].phase,
    "partial"
  );

  assert.equal(
    updates[1].phase,
    "complete"
  );

  assert.equal(
    observedOptions
      .openAlex
      .enabled,
    false
  );

  assert.equal(
    observedOptions
      .openAlexPhilosophy
      .enabled,
    true
  );

  assert.equal(
    completed.snapshot
      .session
      .sourceRevisions
      .openAlexPhilosophy,
    OPENALEX_PHILOSOPHY_HF_REVISION
  );

  assert.equal(
    completed.snapshot
      .diagnostics
      .unresolvedMentions,
    1
  );

  assert.equal(
    completed.snapshot
      .edges
      .some(
        edge =>
          edge.type ===
          "lexical-neighbor"
      ),
    true
  );
});


test("RA7 conserva WorkNode IDs entre parcial y final", async () => {
  const updates = [];

  const first =
    result({
      id:
        "openalex-W100",
      title:
        "Freedom and autonomy in Kant"
    });

  const session =
    new ResearchAtlasLiveSession({
      philosophyMap,
      searchPhilosophyImpl:
        async (
          query,
          map,
          options
        ) => {
          options
            .onPartialResults
            ?.(response([
              first
            ], {
              progress: {
                provider:
                  "OpenAlex Philosophy"
              }
            }));

          return response([
            first,
            result({
              id:
                "openalex-W200",
              title:
                "Moral freedom and autonomy after Kant"
            })
          ]);
        },
      enrichAuthorsImpl:
        async value =>
          value,
      onUpdate:
        update =>
          updates.push(
            update
          )
    });

  await session.runFederated(
    "freedom and autonomy"
  );

  const partialWork =
    updates[0]
      .snapshot
      .nodes
      .find(
        node =>
          node.identity?.key ===
          "openalex:w100"
      );

  const finalWork =
    updates[1]
      .snapshot
      .nodes
      .find(
        node =>
          node.identity?.key ===
          "openalex:w100"
      );

  assert.equal(
    partialWork.id,
    finalWork.id
  );
});


test("cancelar aborta la búsqueda actual sin publicar un snapshot tardío", async () => {
  const updates = [];

  const session =
    new ResearchAtlasLiveSession({
      philosophyMap,
      searchPhilosophyImpl:
        async (
          query,
          map,
          options
        ) =>
          await new Promise(
            (
              resolve,
              reject
            ) => {
              options.signal
                .addEventListener(
                  "abort",
                  () =>
                    reject(
                      new DOMException(
                        "aborted",
                        "AbortError"
                      )
                    ),
                  {
                    once:
                      true
                  }
                );
            }
          ),
      enrichAuthorsImpl:
        async value =>
          value,
      onUpdate:
        update =>
          updates.push(
            update
          )
    });

  const pending =
    session.runFederated(
      "freedom and autonomy"
    );

  queueMicrotask(
    () =>
      session.cancel()
  );

  await assert.rejects(
    pending,
    error =>
      error?.name ===
      "AbortError"
  );

  assert.equal(
    updates.length,
    0
  );
});


test("modo semántico conserva searchMode semantic-service cuando el servicio responde", async () => {
  const final =
    response([
      result({
        id:
          "openalex-W100",
        title:
          "Freedom and autonomy in Kant"
      })
    ], {
      searchMode:
        "semantic",
      semantic: {
        revision:
          "semantic-fixture-v1"
      }
    });

  const session =
    new ResearchAtlasLiveSession({
      philosophyMap,
      searchPublicSemanticImpl:
        async () => ({
          query:
            "freedom and autonomy",
          results: []
        }),
      searchPhilosophyImpl:
        async () =>
          response([]),
      combineSemanticImpl:
        () =>
          final,
      enrichAuthorsImpl:
        async value =>
          value
    });

  const completed =
    await session.runSemantic(
      "freedom and autonomy"
    );

  assert.equal(
    completed.mode,
    "semantic-service"
  );

  assert.equal(
    completed.snapshot
      .session
      .searchMode,
    "semantic-service"
  );

  assert.equal(
    completed.snapshot
      .session
      .sourceRevisions
      .semanticService,
    "semantic-fixture-v1"
  );
});


test("caída semántica degrada a federado y queda explícita como fallback", async () => {
  const session =
    new ResearchAtlasLiveSession({
      philosophyMap,
      searchPublicSemanticImpl:
        async () => {
          throw new Error(
            "service down"
          );
        },
      searchPhilosophyImpl:
        async () =>
          response([
            result({
              id:
                "openalex-W100",
              title:
                "Freedom and autonomy in Kant"
            })
          ]),
      enrichAuthorsImpl:
        async value =>
          value
    });

  const completed =
    await session.runSemantic(
      "freedom and autonomy"
    );

  assert.equal(
    completed.fallback,
    true
  );

  assert.equal(
    completed.mode,
    "traditional"
  );

  assert.equal(
    completed.snapshot
      .session
      .searchMode,
    "traditional"
  );

  assert.match(
    completed.response
      .errors[0]
      .message,
    /respaldo|federad/i
  );
});


test("RA12-D3 live final snapshot activates Qwen topology only when explicitly enabled", async () => {
  const final = response([
    result({
      id: "openalex-W100",
      title: "Freedom and autonomy in Kant"
    }),
    result({
      id: "openalex-W200",
      title: "Moral freedom and autonomy after Kant"
    })
  ]);

  const vector = multiplier => {
    const bytes = new Int8Array(1024);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = ((index * multiplier) % 101) - 50;
    }
    return bytes;
  };

  const qwenVectorClient = {
    async resolveAndFetch(item) {
      const multiplier =
        item.id.includes("W100")
          ? 3
          : 5;

      return {
        resolution: {
          state: "base-direct",
          location: {
            source: "v4",
            cluster: multiplier,
            ordinal: multiplier
          }
        },
        vector: {
          state: "verified",
          source: "v4",
          bytes: vector(multiplier),
          vectorSha256:
            String(multiplier)
              .repeat(64)
              .slice(0, 64),
          proof: "fixture-proof",
          cluster: multiplier,
          ordinal: multiplier
        }
      };
    }
  };

  const updates = [];

  const session =
    new ResearchAtlasLiveSession({
      philosophyMap,
      enableQwenTopology: true,
      qwenVectorClient,
      searchPhilosophyImpl:
        async () => final,
      enrichAuthorsImpl:
        async value => value,
      onUpdate:
        update => updates.push(update)
    });

  const completed =
    await session.runFederated(
      "freedom and autonomy"
    );

  assert.equal(
    completed.snapshot.edges
      .filter(edge =>
        edge.type === "semantic-neighbor"
      ).length,
    1
  );

  assert.equal(
    completed.snapshot.edges
      .filter(edge =>
        edge.type === "lexical-neighbor"
      ).length,
    0
  );

  assert.equal(
    completed.snapshot.session
      .sourceRevisions
      .qwenTopology,
    "2026-11-09.ra12-d3-v1"
  );

  assert.equal(
    completed.snapshot.diagnostics
      .qwenSemantic
      .vectorsVerified,
    2
  );

  assert.equal(
    completed.snapshot.diagnostics
      .documentSimilarity
      .pairFilterApplied,
    true
  );

  assert.equal(updates.length, 1);
});
