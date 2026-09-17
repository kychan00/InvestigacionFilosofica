import fs from "node:fs";
import path from "node:path";

import { parseQuery } from "../../src/core/parser.js";
import {
  INTERDISCIPLINARY_CONJUNCTION_PROFILE,
  interdisciplinaryConjunctionAdjustment
} from "../../src/core/interdisciplinary-conjunction.js";

const ROOT = process.cwd();
const RUN_PATH = path.join(
  ROOT,
  "benchmark/runs/heldout-multilingual-ab-v1-1f2232d.jsonl"
);
const QUERIES_PATH = path.join(
  ROOT,
  "benchmark/validation-multilingual-ab-v1.queries.json"
);
const MAP_PATH = path.join(
  ROOT,
  "src/data/philosophy-map.json"
);
const PROFILES_PATH = path.join(
  ROOT,
  "benchmark/interdisciplinary-conjunction-profiles-v1.json"
);

function readJsonl(file) {
  return fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${file}:${index + 1}: ${error.message}`);
      }
    });
}

for (const file of [
  RUN_PATH,
  QUERIES_PATH,
  MAP_PATH,
  PROFILES_PATH
]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, file)}`);
  }
}

const run = readJsonl(RUN_PATH);
const validation = JSON.parse(fs.readFileSync(QUERIES_PATH, "utf8"));
const philosophyMap = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
const profilesReport = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));

const expected = profilesReport.profiles.find(
  item => item.profile?.id === "moderate"
);

if (!expected) {
  throw new Error("Frozen moderate profile not found");
}

const expectedProfile = {
  both: expected.profile.both,
  areaOnly: expected.profile.areaOnly,
  domainOnly: expected.profile.domainOnly,
  neitherWithAbstract: expected.profile.neitherWithAbstract,
  neitherWithoutAbstract: expected.profile.neitherWithoutAbstract
};

const actualProfile = {
  both: INTERDISCIPLINARY_CONJUNCTION_PROFILE.both,
  areaOnly: INTERDISCIPLINARY_CONJUNCTION_PROFILE.areaOnly,
  domainOnly: INTERDISCIPLINARY_CONJUNCTION_PROFILE.domainOnly,
  neitherWithAbstract:
    INTERDISCIPLINARY_CONJUNCTION_PROFILE.neitherWithAbstract,
  neitherWithoutAbstract:
    INTERDISCIPLINARY_CONJUNCTION_PROFILE.neitherWithoutAbstract
};

if (JSON.stringify(actualProfile) !== JSON.stringify(expectedProfile)) {
  throw new Error(
    `Production profile differs from frozen moderate profile:\n` +
    `actual=${JSON.stringify(actualProfile)}\n` +
    `expected=${JSON.stringify(expectedProfile)}`
  );
}

const expectedByQuery = new Map(
  expected.structuralB.perQuery.map(item => [item.query_id, item])
);

let queriesChanged = 0;
let changedTop10Pairs = 0;
const mismatches = [];

for (const query of validation.queries) {
  const parsed = parseQuery(query.query, philosophyMap);
  const pool = run
    .filter(row => row.query_id === query.id && row.condition === "B")
    .sort((a, b) => Number(a.rank) - Number(b.rank));

  if (pool.length !== 20) {
    throw new Error(`${query.id}: expected 20 B rows, found ${pool.length}`);
  }

  const baselineTop = new Set(
    pool.filter(row => Number(row.rank) <= 10)
      .map(row => row.record_id)
  );

  const rescored = pool.map(row => {
    const conjunction = interdisciplinaryConjunctionAdjustment(row, parsed);
    return {
      row,
      conjunction,
      adjustedScore: Number(row.score ?? row.ranking?.baseScore ?? 0) +
        conjunction.total
    };
  }).sort(
    (a, b) =>
      b.adjustedScore - a.adjustedScore ||
      Number(a.row.rank) - Number(b.row.rank)
  );

  const newTopRows = rescored.slice(0, 10);
  const newTop = new Set(newTopRows.map(item => item.row.record_id));
  const oldOnly = [...baselineTop].filter(id => !newTop.has(id));
  const newOnly = newTopRows.filter(item => !baselineTop.has(item.row.record_id));
  const changedPairs = oldOnly.length + newOnly.length;

  if (changedPairs > 0) {
    queriesChanged++;
  }
  changedTop10Pairs += changedPairs;

  const expectedQuery = expectedByQuery.get(query.id);
  if (!expectedQuery) {
    mismatches.push(`${query.id}: missing expected structural row`);
    continue;
  }

  const actualNewOnlyIds = newOnly.map(item => item.row.record_id).sort();
  const expectedNewOnlyIds = (expectedQuery.newOnly || [])
    .map(item => item.record_id)
    .sort();

  if (changedPairs !== Number(expectedQuery.changedPairs)) {
    mismatches.push(
      `${query.id}: changedPairs actual=${changedPairs} ` +
      `expected=${expectedQuery.changedPairs}`
    );
  }

  if (JSON.stringify(actualNewOnlyIds) !== JSON.stringify(expectedNewOnlyIds)) {
    mismatches.push(
      `${query.id}: newOnly membership differs\n` +
      `actual=${JSON.stringify(actualNewOnlyIds)}\n` +
      `expected=${JSON.stringify(expectedNewOnlyIds)}`
    );
  }
}

if (
  queriesChanged !== Number(expected.structuralB.queriesChanged) ||
  changedTop10Pairs !== Number(expected.structuralB.changedTop10Pairs)
) {
  mismatches.push(
    `aggregate structural mismatch: ` +
    `queriesChanged=${queriesChanged}/${expected.structuralB.queriesChanged}, ` +
    `changedTop10Pairs=${changedTop10Pairs}/${expected.structuralB.changedTop10Pairs}`
  );
}

if (mismatches.length) {
  throw new Error(
    `INTERDISCIPLINARY CONJUNCTION V1 VERIFICATION: FAIL\n` +
    mismatches.join("\n")
  );
}

console.log("INTERDISCIPLINARY CONJUNCTION V1 VERIFICATION: PASS");
console.log(`profile=${JSON.stringify(actualProfile)}`);
console.log(`queries=${validation.queries.length}`);
console.log(`queries_changed=${queriesChanged}`);
console.log(`changed_top10_pairs=${changedTop10Pairs}`);
console.log("expected_profile=moderate");
console.log("structural_membership_match=true");
