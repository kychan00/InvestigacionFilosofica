import test from "node:test";
import assert from "node:assert/strict";

import {
  compactNeighborToRelatedWorkEdge,
  relationShardNumber,
  relationShardPath,
  validateCompactRelatedWorkSeed
} from "../src/core/related-work-index-format.js";


const seed = {
  s: "doi:10.1000/seed",
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
    }
  ]
};


test("el formato compacto expande a un RelatedWorkEdge V1 válido", () => {
  const edge =
    compactNeighborToRelatedWorkEdge(
      seed,
      seed.n[0]
    );

  assert.equal(
    edge.id,
    "rw:0:1"
  );

  assert.deepEqual(
    edge.relationTypes,
    [
      "semantic-affinity",
      "shared-topic"
    ]
  );

  assert.equal(
    edge.signals.semantic,
    0.92
  );

  assert.equal(
    edge.evidence[0].semanticScore,
    0.92
  );

  assert.deepEqual(
    edge.evidence[1].topicIds,
    [
      "openalex:T100"
    ]
  );
});


test("un seed compacto válido no contiene autoría ni citación inventadas", () => {
  const result =
    validateCompactRelatedWorkSeed(
      seed
    );

  assert.equal(
    result.ok,
    true,
    result.errors.join("\n")
  );

  const edge =
    compactNeighborToRelatedWorkEdge(
      seed,
      seed.n[0]
    );

  assert.equal(
    edge.relationTypes.includes(
      "same-author"
    ),
    false
  );

  assert.equal(
    edge.relationTypes.includes(
      "cites-seed"
    ),
    false
  );
});


test("el formato compacto rechaza self-relations y targets duplicados", () => {
  const invalid = {
    s: "doi:10.1000/seed",
    v: 0,
    n: [
      {
        t: "doi:10.1000/seed",
        v: 2,
        s: 0.99,
        r: [
          "semantic-affinity"
        ],
        e: {
          semanticScore: 0.99
        }
      },
      {
        t: "openalex:W1002",
        v: 1,
        s: 0.9,
        r: [
          "semantic-affinity"
        ],
        e: {
          semanticScore: 0.9
        }
      },
      {
        t: "openalex:W1002",
        v: 3,
        s: 0.8,
        r: [
          "semantic-affinity"
        ],
        e: {
          semanticScore: 0.8
        }
      }
    ]
  };

  const result =
    validateCompactRelatedWorkSeed(
      invalid
    );

  assert.equal(
    result.ok,
    false
  );

  assert.ok(
    result.errors.includes(
      "neighbor:self-forbidden"
    )
  );

  assert.ok(
    result.errors.includes(
      "neighbor:duplicate:openalex:W1002"
    )
  );
});


test("JavaScript usa el mismo routing SHA-256 que el builder offline", async () => {
  assert.equal(
    await relationShardNumber(
      "doi:10.1000/seed",
      {
        shardCount: 8
      }
    ),
    1
  );

  assert.equal(
    await relationShardPath(
      "doi:10.1000/seed",
      {
        shardCount: 8
      }
    ),
    "shards/shard-01.jsonl.gz"
  );
});
