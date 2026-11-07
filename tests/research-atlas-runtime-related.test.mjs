import assert from "node:assert/strict";
import test from "node:test";

import {
  ResearchAtlasAssembler
} from "../src/core/research-atlas-assembler.js";

import {
  expandResearchAtlasWithRelatedWorks
} from "../src/core/research-atlas-related.js";

import {
  buildResearchAtlasRuntimeAuthorityGraph
} from "../src/core/research-atlas-runtime-authority.js";

import {
  buildResearchAtlasAuthorityL1Responses
} from "../src/core/research-atlas-runtime-related.js";

import {
  fetchSnapshotAuthorWorksById
} from "../src/core/remote-author-resolution.js";


function result({
  workId,
  title,
  authors,
  doi = null,
  year = 2020
}) {
  return {
    id:
      "https://openalex.org/" +
      workId,
    openalexId:
      workId,
    title,
    authors,
    year,
    type:
      "article",
    language:
      "en",
    doi,
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
          "https://openalex.org/" +
          workId,
        query:
          "runtime related"
      }
    ],
    matchedQueries: [
      {
        query:
          "runtime related",
        weight:
          1,
        type:
          "original"
      }
    ],
    urls: {
      canonical:
        "https://openalex.org/" +
        workId
    },
    institutionalLinks: []
  };
}


function response(
  results
) {
  return {
    query:
      "runtime related",
    parsed: {},
    expansions: [],
    results,
    errors: [],
    stats: {
      appearances:
        results.length,
      unique:
        results.length,
      merged:
        0,
      providers: {
        "OpenAlex Philosophy":
          results.length
      }
    }
  };
}


const exactAuthor = {
  id:
    "https://openalex.org/A123",
  name:
    "Ada Example",
  orcid:
    "0000-0002-1825-0097"
};


test("RA10 L1 usa Author ID exacto y produce relaciones same-author válidas", async () => {
  const searchResponse =
    response([
      result({
        workId:
          "W100",
        title:
          "Seed work",
        authors: [
          exactAuthor
        ],
        year:
          2020
      }),
      result({
        workId:
          "W200",
        title:
          "Direct companion",
        authors: [
          exactAuthor
        ],
        doi:
          "10.5555/direct",
        year:
          2021
      })
    ]);

  const graph =
    buildResearchAtlasRuntimeAuthorityGraph(
      searchResponse
    );

  const calls = [];

  const related =
    await buildResearchAtlasAuthorityL1Responses(
      searchResponse,
      graph,
      {
        maxSeeds:
          1,
        maxNeighborsPerSeed:
          3,
        fetchAuthorWorksImpl:
          async author => {
            calls.push(
              author.id
            );

            return [
              result({
                workId:
                  "W100",
                title:
                  "Seed work",
                authors: [
                  exactAuthor
                ],
                year:
                  2020
              }),
              result({
                workId:
                  "W200",
                title:
                  "Direct companion",
                authors: [
                  exactAuthor
                ],
                year:
                  2021
              }),
              result({
                workId:
                  "W300",
                title:
                  "Expanded work",
                authors: [
                  exactAuthor
                ],
                year:
                  2024
              })
            ];
          }
      }
    );

  assert.deepEqual(
    calls,
    [
      "https://openalex.org/A123"
    ]
  );

  assert.equal(
    related.responses.length,
    1
  );

  const edges =
    related.responses[0]
      .edges;

  assert.equal(
    edges.length,
    2
  );

  assert.ok(
    edges.every(
      edge =>
        edge.relationTypes
          .includes(
            "same-author"
          )
    )
  );

  assert.ok(
    edges.every(
      edge =>
        !edge.relationTypes
          .includes(
            "semantic-affinity"
          )
    )
  );

  assert.ok(
    edges.some(
      edge =>
        edge.target
          .identity ===
        "doi:10.5555/direct"
    ),
    "direct target must reuse canonical DOI identity"
  );

  const directItem =
    related.responses[0]
      .items
      .find(
        item => {
          const edge =
            edges.find(
              edge =>
                edge.id ===
                item.edge.id
            );

          return edge
            ?.target
            ?.identity ===
            "doi:10.5555/direct";
        }
      );

  assert.equal(
    directItem.document,
    null
  );

  const base =
    new ResearchAtlasAssembler({
      authorityGraph:
        graph
    })
      .ingest(
        searchResponse
      );

  const expanded =
    expandResearchAtlasWithRelatedWorks(
      base,
      related.responses,
      {
        maxNeighborsPerSeed:
          3,
        maxExpandedWorks:
          6
      }
    );

  assert.equal(
    expanded.diagnostics
      .expandedWorks,
    1
  );

  assert.ok(
    expanded.edges.some(
      edge =>
        edge.type ===
        "related-work"
    )
  );

  assert.equal(
    expanded.edges.some(
      edge =>
        edge.type ===
        "semantic-neighbor"
    ),
    false
  );
});


test("autor sin AuthorityPerson confirmada no dispara expansión L1", async () => {
  const searchResponse =
    response([
      result({
        workId:
          "W100",
        title:
          "Name only seed",
        authors: [
          {
            name:
              "José Martínez"
          }
        ]
      })
    ]);

  const graph =
    buildResearchAtlasRuntimeAuthorityGraph(
      searchResponse
    );

  let calls = 0;

  const related =
    await buildResearchAtlasAuthorityL1Responses(
      searchResponse,
      graph,
      {
        fetchAuthorWorksImpl:
          async () => {
            calls += 1;
            return [];
          }
      }
    );

  assert.equal(
    calls,
    0
  );

  assert.equal(
    related.responses.length,
    0
  );
});


test("lookup exacto de obras no usa resolución nominal ni Wikidata", async () => {
  const requested = [];

  const works =
    await fetchSnapshotAuthorWorksById(
      {
        id:
          "https://openalex.org/A123",
        name:
          "Nombre deliberadamente irrelevante"
      },
      {
        limit:
          4,
        fetchImpl:
          async url => {
            requested.push(
              String(url)
            );

            return {
              ok:
                true,
              status:
                200,
              async text() {
                return [
                  JSON.stringify({
                    id:
                      "123",
                    wid:
                      "900",
                    t:
                      "Exact indexed work",
                    y:
                      2024,
                    l:
                      "en",
                    ty:
                      "article",
                    p:
                      "first",
                    co:
                      0
                  }),
                  JSON.stringify({
                    id:
                      "999",
                    wid:
                      "901",
                    t:
                      "Wrong author",
                    y:
                      2024
                  })
                ].join(
                  "\n"
                );
              }
            };
          }
      }
    );

  assert.equal(
    works.length,
    1
  );

  assert.match(
    requested[0],
    /\/works\/\d{4}\.jsonl/
  );

  assert.equal(
    requested.some(
      url =>
        /wikidata/i.test(
          url
        )
    ),
    false
  );

  assert.equal(
    works[0].id,
    "https://openalex.org/W900"
  );
});
