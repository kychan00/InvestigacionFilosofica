import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  averageRanks,
  compareRankings,
  pearson,
  rankQuery,
  spearman,
} from "../scripts/benchmark/qwen3/analyze_ranking_1024_development.mjs";

test("averageRanks assigns average ranks to ties", () => {
  assert.deepEqual(
    averageRanks([10, 20, 20, 40]),
    [1, 2.5, 2.5, 4],
  );
});

test("Pearson and Spearman are one for identical vectors", () => {
  const values = [0.1, 0.2, 0.2, 0.9];

  assert.equal(
    pearson(values, values),
    1,
  );

  assert.equal(
    spearman(values, values),
    1,
  );
});

test("rankQuery uses original production rank only for exact score ties", () => {
  const rows = [
    {
      query_id: "q",
      record_id: "b",
      raw_score: 0.8,
    },
    {
      query_id: "q",
      record_id: "a",
      raw_score: 0.8,
    },
    {
      query_id: "q",
      record_id: "c",
      raw_score: 0.7,
    },
  ];

  const ranks = new Map([
    ["q\u0000a", 1],
    ["q\u0000b", 2],
    ["q\u0000c", 3],
  ]);

  assert.deepEqual(
    rankQuery(rows, ranks)
      .map((row) => row.record_id),
    ["a", "b", "c"],
  );
});

test("comparison passes when all 50 Top-10 memberships are identical", () => {
  const candidate = [];
  const reference = [];
  const pool = [];

  for (let q = 1; q <= 50; q += 1) {
    const queryId = `q${q}`;

    for (let rank = 1; rank <= 20; rank += 1) {
      const recordId =
        `${queryId}-r${rank}`;

      pool.push({
        query_id: queryId,
        record_id: recordId,
        rank,
      });

      const row = {
        query_id: queryId,
        record_id: recordId,
        raw_score: 1 - rank / 100,
      };

      candidate.push({ ...row });
      reference.push({ ...row });
    }
  }

  const result =
    compareRankings({
      candidateRows: candidate,
      referenceRows: reference,
      poolRows: pool,
    });

  assert.equal(
    result.primary_gate.passed,
    true,
  );

  assert.equal(
    result.primary_gate.queries_equal,
    50,
  );

  assert.equal(
    result.secondary_metrics
      .top10_symmetric_difference_memberships,
    0,
  );

  assert.equal(
    result.secondary_metrics
      .same_rank_count,
    1000,
  );
});

test("analyzer pins frozen 1024, 4096 and pool artifacts and never uses human labels", async () => {
  const source = await readFile(
    "scripts/benchmark/qwen3/analyze_ranking_1024_development.mjs",
    "utf8",
  );

  assert.match(
    source,
    /93618268d803c7221a116f07c5b65886f7d0e7881e7c9085eba65eb20d6d49b7/,
  );

  assert.match(
    source,
    /09483050c0c327c3fb9115c245a0584ac9f38107133e0363fa255d23a0b4b29c/,
  );

  assert.match(
    source,
    /596dcb74f786a4e4ff40a705ec9f440accdfebca1ffcdadcdad2548ef7003b4c/,
  );

  assert.match(
    source,
    /required_queries_equal:\s*50/,
  );

  assert.match(
    source,
    /human_labels_used:\s*false/,
  );

  assert.match(
    source,
    /ranking_holdout_accessed:\s*false/,
  );
});
