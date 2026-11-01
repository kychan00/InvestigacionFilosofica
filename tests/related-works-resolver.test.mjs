import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";

import {
  RelatedWorkIndexClient,
  RelatedWorksResolver,
  binarySearchSeed,
  parseJsonLines
} from "../src/core/related-works-resolver.js";
import {
  relationShardPath
} from "../src/core/related-work-index-format.js";


function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    async json() {
      return structuredClone(payload);
    }
  };
}


function textResponse(text) {
  return {
    ok: true,
    status: 200,
    text
  };
}


function fixtureData() {
  const seedIdentity = "doi:10.1000/seed";
  const shardCount = 8;

  const shardRows = [
    {
      s: seedIdentity,
      v: 0,
      n: [
        {
          t: "openalex:W1002",
          v: 1,
          s: 0.92,
          r: [
            "semantic-affinity",
            "shared-topic"
          ],
          e: {
            semanticScore: 0.92,
            topicIds: [
              "openalex:T100"
            ]
          }
        },
        {
          t: "openalex:W1006",
          v: 5,
          s: 0.85,
          r: [
            "semantic-affinity",
            "shared-topic"
          ],
          e: {
            semanticScore: 0.85,
            topicIds: [
              "openalex:T100"
            ]
          }
        }
      ]
    },
    {
      s: "openalex:W9999",
      v: 9,
      n: []
    }
  ].sort((a, b) => a.s.localeCompare(b.s));

  return {
    seedIdentity,
    shardCount,
    relationManifest: {
      schema_version: "related-work-index-v1",
      generator_version: "related-work-index-builder-v1a",
      document_count: 6,
      unique_seed_count: 5,
      partition: {
        shard_count: shardCount
      },
      source: {
        mode: "fixture"
      },
      shards: Array.from(
        {length: shardCount},
        (_, shard) => ({
          shard,
          path: "shards/shard-" +
            shard.toString(16).padStart(2, "0") +
            ".jsonl.gz",
          seed_count: 0,
          edge_count: 0
        })
      )
    },
    shardRows,
    metadataManifest: {
      schema_version: "qwen3-browser-semantic-static-artifacts-v4",
      metadata: {
        page_size: 512,
        pages: [
          {
            path: "metadata/page-0000.jsonl.gz"
          }
        ]
      }
    },
    metadataRows: [
      {
        vector_id: 1,
        id: "openalex-W1002",
        title: "Related One",
        authors: ["Author One"],
        year: 2021
      },
      {
        vector_id: 5,
        id: "openalex-W1006",
        title: "Related Two",
        authors: ["Author Two"],
        year: 2022
      }
    ]
  };
}


async function makeClient() {
  const fixture = fixtureData();
  const shardPath = await relationShardPath(
    fixture.seedIdentity,
    {
      shardCount: fixture.shardCount,
      cryptoImpl: webcrypto
    }
  );

  const shardRecord = fixture.relationManifest.shards.find(
    item => item.path === shardPath
  );
  shardRecord.seed_count = fixture.shardRows.length;
  shardRecord.edge_count = fixture.shardRows.reduce(
    (total, row) => total + row.n.length,
    0
  );

  const relationBase = "https://relations.test/v1";
  const metadataBase = "https://metadata.test/v4";
  const calls = [];

  const fetchImpl = async url => {
    calls.push(url);

    if (url === relationBase + "/manifest.json") {
      return jsonResponse(fixture.relationManifest);
    }

    if (url === relationBase + "/" + shardPath) {
      return textResponse(
        fixture.shardRows
          .map(row => JSON.stringify(row))
          .join("\n") + "\n"
      );
    }

    if (url === metadataBase + "/manifest.json") {
      return jsonResponse(fixture.metadataManifest);
    }

    if (url === metadataBase + "/metadata/page-0000.jsonl.gz") {
      return textResponse(
        fixture.metadataRows
          .map(row => JSON.stringify(row))
          .join("\n") + "\n"
      );
    }

    return {
      ok: false,
      status: 404
    };
  };

  const client = new RelatedWorkIndexClient({
    baseUrl: relationBase,
    metadataBaseUrl: metadataBase,
    fetchImpl,
    decodeGzipText: async response => response.text,
    cryptoImpl: webcrypto
  });

  return {
    client,
    fixture,
    calls,
    relationBase,
    metadataBase,
    shardPath
  };
}


test("binary search encuentra seeds en shards ordenados", () => {
  const rows = [
    {s: "a"},
    {s: "c"},
    {s: "z"}
  ];

  assert.equal(
    binarySearchSeed(rows, "c"),
    rows[1]
  );

  assert.equal(
    binarySearchSeed(rows, "b"),
    null
  );
});


test("JSONL parser ignora líneas vacías", () => {
  assert.deepEqual(
    parseJsonLines(
      '{"a":1}\n\n{"b":2}\n'
    ),
    [
      {a: 1},
      {b: 2}
    ]
  );
});


test("resolver carga sólo manifest y un shard cuando hydrate=false", async () => {
  const {
    client,
    fixture,
    calls,
    relationBase,
    shardPath
  } = await makeClient();

  const resolver =
    new RelatedWorksResolver({
      client
    });

  const result =
    await resolver.resolve(
      fixture.seedIdentity,
      {
        limit: 2,
        hydrate: false
      }
    );

  assert.equal(
    result.coverage.indexed,
    true
  );

  assert.equal(
    result.edges.length,
    2
  );

  assert.equal(
    result.items.length,
    2
  );

  assert.deepEqual(
    calls,
    [
      relationBase + "/manifest.json",
      relationBase + "/" + shardPath
    ]
  );

  assert.ok(
    result.edges.every(
      edge =>
        edge.schemaVersion ===
        "related-work-v1"
    )
  );

  assert.equal(
    calls.some(
      url =>
        /qwen|semantic|openalex\.org/i.test(url)
    ),
    false
  );
});


test("resolver hidrata sólo la página de metadata necesaria", async () => {
  const {
    client,
    fixture,
    calls,
    metadataBase
  } = await makeClient();

  const resolver =
    new RelatedWorksResolver({
      client
    });

  const result =
    await resolver.resolve(
      fixture.seedIdentity,
      {
        limit: 2,
        hydrate: true
      }
    );

  assert.equal(
    result.items[0].document.title,
    "Related One"
  );

  assert.equal(
    result.items[1].document.title,
    "Related Two"
  );

  assert.equal(
    calls.filter(
      url =>
        url ===
        metadataBase +
        "/metadata/page-0000.jsonl.gz"
    ).length,
    1
  );

  assert.equal(
    calls.filter(
      url =>
        url ===
        metadataBase +
        "/manifest.json"
    ).length,
    1
  );
});


test("caché evita nuevas descargas al reabrir la misma seed", async () => {
  const {
    client,
    fixture,
    calls
  } = await makeClient();

  const resolver =
    new RelatedWorksResolver({
      client
    });

  const first =
    await resolver.resolve(
      fixture.seedIdentity,
      {
        limit: 2,
        hydrate: true
      }
    );

  const callCount =
    calls.length;

  const second =
    await resolver.resolve(
      fixture.seedIdentity,
      {
        limit: 2,
        hydrate: true
      }
    );

  assert.equal(
    second,
    first
  );

  assert.equal(
    calls.length,
    callCount
  );
});


test("seed ausente degrada a estado parcial sin consultar metadata", async () => {
  const {
    client,
    calls
  } = await makeClient();

  const resolver =
    new RelatedWorksResolver({
      client
    });

  const result =
    await resolver.resolve(
      "openalex:W404",
      {
        hydrate: true
      }
    );

  assert.equal(
    result.coverage.indexed,
    false
  );

  assert.equal(
    result.coverage.partial,
    true
  );

  assert.deepEqual(
    result.edges,
    []
  );

  assert.equal(
    calls.some(
      url =>
        url.includes(
          "metadata.test"
        )
    ),
    false
  );
});


test("un fallo de shard no se guarda permanentemente en caché", async () => {
  const fixture = fixtureData();
  const relationBase = "https://relations.test/v1";
  const shardPath = await relationShardPath(
    fixture.seedIdentity,
    {
      shardCount: fixture.shardCount,
      cryptoImpl: webcrypto
    }
  );

  const record = fixture.relationManifest.shards.find(
    item => item.path === shardPath
  );
  record.seed_count = fixture.shardRows.length;

  let shardAttempts = 0;

  const client =
    new RelatedWorkIndexClient({
      baseUrl: relationBase,
      fetchImpl: async url => {
        if (url === relationBase + "/manifest.json") {
          return jsonResponse(
            fixture.relationManifest
          );
        }

        if (url === relationBase + "/" + shardPath) {
          shardAttempts += 1;

          if (shardAttempts === 1) {
            return {
              ok: false,
              status: 503
            };
          }

          return textResponse(
            fixture.shardRows
              .map(row => JSON.stringify(row))
              .join("\n") + "\n"
          );
        }

        return {
          ok: false,
          status: 404
        };
      },
      decodeGzipText: async response => response.text,
      cryptoImpl: webcrypto
    });

  await assert.rejects(
    client.findSeed(
      fixture.seedIdentity
    ),
    /503/
  );

  const seed =
    await client.findSeed(
      fixture.seedIdentity
    );

  assert.equal(
    seed.s,
    fixture.seedIdentity
  );

  assert.equal(
    shardAttempts,
    2
  );
});
