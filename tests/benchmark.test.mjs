import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const benchmark =
  JSON.parse(
    fs.readFileSync(
      "benchmark/queries.json",
      "utf8"
    )
  );

test(
  "benchmark humano contiene 50 consultas balanceadas por idioma",
  () => {
    assert.equal(
      benchmark.queries.length,
      50
    );

    const counts =
      {};

    for (const query of benchmark.queries) {
      counts[query.language] =
        (counts[query.language] || 0) + 1;
    }

    assert.deepEqual(
      counts,
      {
        es: 10,
        en: 10,
        de: 10,
        fr: 10,
        pt: 10
      }
    );
  }
);

test(
  "cada familia del benchmark tiene cinco variantes lingüísticas",
  () => {
    const families =
      new Map();

    for (const query of benchmark.queries) {
      if (!families.has(query.family)) {
        families.set(
          query.family,
          new Set()
        );
      }

      families
        .get(query.family)
        .add(query.language);
    }

    assert.equal(
      families.size,
      10
    );

    for (const languages of families.values()) {
      assert.equal(
        languages.size,
        5
      );
    }
  }
);

test(
  "benchmark separa profundidad de ranking y pool humano",
  () => {
    assert.deepEqual(
      benchmark.evaluation,
      {
        rankingDepth: 10,
        poolDepth: 20,
        relevantThreshold: 2
      }
    );
  }
);
