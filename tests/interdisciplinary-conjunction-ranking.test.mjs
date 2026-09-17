import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { parseQuery } from "../src/core/parser.js";
import {
  interdisciplinaryConjunctionAdjustment
} from "../src/core/interdisciplinary-conjunction.js";
import { rankResult } from "../src/core/rank.js";

const philosophyMap = JSON.parse(
  fs.readFileSync(
    new URL(
      "../src/data/philosophy-map.json",
      import.meta.url
    ),
    "utf8"
  )
);

function parsed(query) {
  return parseQuery(query, philosophyMap);
}

function result(title, abstract = null) {
  return {
    title,
    abstract,
    authors: [],
    providers: [],
    topics: [],
    matchedQueries: [],
    citedBy: 0
  };
}

test("conjunción explícita premia evidencia de ambos lados", () => {
  const signal = interdisciplinaryConjunctionAdjustment(
    result("Logic in Linguistics"),
    parsed("lógica en lingüística")
  );

  assert.equal(signal.applies, true);
  assert.equal(signal.bucket, "both");
  assert.equal(signal.total, 2);
});

test("conjunción explícita penaliza area-only", () => {
  const signal = interdisciplinaryConjunctionAdjustment(
    result("Formal Logic and Argumentation"),
    parsed("lógica en lingüística")
  );

  assert.equal(signal.bucket, "area-only");
  assert.equal(signal.total, -2);
});

test("conjunción explícita deja domain-only neutral", () => {
  const signal = interdisciplinaryConjunctionAdjustment(
    result("Caminhos em Linguística Aplicada"),
    parsed("lógica en lingüística")
  );

  assert.equal(signal.bucket, "domain-only");
  assert.equal(signal.total, 0);
});

test("neither sólo se penaliza cuando hay abstract disponible", () => {
  const query = parsed("lógica en lingüística");

  const withAbstract = interdisciplinaryConjunctionAdjustment(
    result(
      "Reasoning in Formal Systems",
      "A study of inference and proof."
    ),
    query
  );

  const withoutAbstract = interdisciplinaryConjunctionAdjustment(
    result("Reasoning in Formal Systems"),
    query
  );

  assert.equal(withAbstract.bucket, "neither");
  assert.equal(withAbstract.total, -1);
  assert.equal(withoutAbstract.bucket, "neither");
  assert.equal(withoutAbstract.total, 0);
});

test("consultas no interdisciplinarias no reciben ajuste", () => {
  const signal = interdisciplinaryConjunctionAdjustment(
    result("Freedom in Kant"),
    parsed("libertad en Kant")
  );

  assert.equal(signal.applies, false);
  assert.equal(signal.bucket, "not-applicable");
  assert.equal(signal.total, 0);
});

test("rankResult expone y aplica el diagnóstico de conjunción", () => {
  const ranked = rankResult(
    {
      ...result("Logic in Linguistics"),
      matchedQueries: [
        {
          query: "logic in linguistics",
          weight: 0.9
        }
      ]
    },
    parsed("lógica en lingüística"),
    philosophyMap
  );

  assert.equal(ranked.ranking.conjunctionApplies, true);
  assert.equal(ranked.ranking.conjunctionBucket, "both");
  assert.equal(ranked.ranking.conjunctionAreaMatched, true);
  assert.equal(ranked.ranking.conjunctionDomainMatched, true);
  assert.equal(ranked.ranking.conjunctionAdjustment, 2);
});
