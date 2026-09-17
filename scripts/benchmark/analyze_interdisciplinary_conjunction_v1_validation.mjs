import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RUN_STEM = "interdisciplinary-conjunction-v1-holdout-105f196";
const RUN = path.join(ROOT, `benchmark/runs/${RUN_STEM}.jsonl`);
const META = path.join(ROOT, `benchmark/runs/${RUN_STEM}.meta.json`);
const QUERIES = path.join(ROOT, "benchmark/validation-interdisciplinary-conjunction-v1.queries.json");
const OUT_JSON = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-structural.json");
const OUT_MD = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-structural.md");

function readJsonl(file) {
  return fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { throw new Error(`${file}:${index + 1}: ${error.message}`); }
    });
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function increment(object, key, amount = 1) {
  object[key] = (object[key] || 0) + amount;
}

for (const file of [RUN, META, QUERIES]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${path.relative(ROOT, file)}`);
  }
}

const rows = readJsonl(RUN);
const meta = JSON.parse(fs.readFileSync(META, "utf8"));
const validation = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const topK = Number(meta.topK || validation.evaluation?.topK || 10);
const queryMap = new Map(validation.queries.map(query => [query.id, query]));

if (meta.runName !== RUN_STEM) {
  throw new Error(`Unexpected runName ${meta.runName}`);
}
if (!String(meta.runtimeCommit || "").startsWith("105f196")) {
  throw new Error(`Unexpected runtimeCommit ${meta.runtimeCommit}`);
}
if (validation.queries.length !== 20) {
  throw new Error(`Expected 20 preregistered queries, found ${validation.queries.length}`);
}

const byQueryCondition = new Map();
for (const row of rows) {
  if (!queryMap.has(row.query_id)) throw new Error(`Unknown query_id ${row.query_id}`);
  if (!['A', 'B'].includes(row.condition)) throw new Error(`Unknown condition ${row.condition}`);
  const key = `${row.query_id}\u0000${row.condition}`;
  if (!byQueryCondition.has(key)) byQueryCondition.set(key, []);
  byQueryCondition.get(key).push(row);
}

for (const subset of byQueryCondition.values()) {
  subset.sort((a, b) => Number(a.rank) - Number(b.rank));
  subset.forEach((row, index) => {
    if (Number(row.rank) !== index + 1) throw new Error(`${row.query_id}/${row.condition}: non-contiguous rank`);
  });
}

const scoreChecks = {
  sharedRowsChecked: 0,
  mismatches: 0,
  maxAbsoluteError: 0,
};

const perQuery = [];
const byFamily = {};
const byLanguage = {};
const aOnlyBuckets = {};
const bOnlyBuckets = {};
const changedAdjustmentCounts = {};
let queriesChanged = 0;
let changedPairsTotal = 0;
let aOnlyTotal = 0;
let bOnlyTotal = 0;

for (const query of validation.queries) {
  const aRows = byQueryCondition.get(`${query.id}\u0000A`) || [];
  const bRows = byQueryCondition.get(`${query.id}\u0000B`) || [];
  if (!aRows.length || !bRows.length) throw new Error(`${query.id}: missing A or B rows`);

  const aById = new Map(aRows.map(row => [row.record_id, row]));
  const bById = new Map(bRows.map(row => [row.record_id, row]));
  const sharedIds = [...aById.keys()].filter(id => bById.has(id));

  for (const id of sharedIds) {
    const a = aById.get(id);
    const b = bById.get(id);
    const adjustment = Number(b.ranking?.conjunctionAdjustment ?? a.ranking?.conjunctionAdjustment ?? 0);
    const expected = clamp(Number(a.score) + adjustment);
    const error = Math.abs(expected - Number(b.score));
    scoreChecks.sharedRowsChecked++;
    scoreChecks.maxAbsoluteError = Math.max(scoreChecks.maxAbsoluteError, error);
    if (error > 1e-9) scoreChecks.mismatches++;
  }

  const aTop = aRows.slice(0, topK);
  const bTop = bRows.slice(0, topK);
  const aTopIds = new Set(aTop.map(row => row.record_id));
  const bTopIds = new Set(bTop.map(row => row.record_id));
  const aOnly = aTop.filter(row => !bTopIds.has(row.record_id));
  const bOnly = bTop.filter(row => !aTopIds.has(row.record_id));

  if (aOnly.length !== bOnly.length) {
    throw new Error(`${query.id}: Top-${topK} replacement counts are asymmetric (${aOnly.length} vs ${bOnly.length})`);
  }

  const changedPairs = aOnly.length + bOnly.length;
  const changedMemberships = aOnly.length;
  if (changedPairs) queriesChanged++;
  changedPairsTotal += changedPairs;
  aOnlyTotal += aOnly.length;
  bOnlyTotal += bOnly.length;

  for (const row of aOnly) {
    const bucket = row.ranking?.conjunctionBucket || "unknown";
    increment(aOnlyBuckets, bucket);
    increment(changedAdjustmentCounts, String(row.ranking?.conjunctionAdjustment ?? "unknown"));
  }
  for (const row of bOnly) {
    const bucket = row.ranking?.conjunctionBucket || "unknown";
    increment(bOnlyBuckets, bucket);
    increment(changedAdjustmentCounts, String(row.ranking?.conjunctionAdjustment ?? "unknown"));
  }

  const record = {
    query_id: query.id,
    query: query.query,
    family: query.family,
    language: query.language,
    rowsA: aRows.length,
    rowsB: bRows.length,
    sharedRows: sharedIds.length,
    changedTop10Pairs: changedPairs,
    top10MembershipReplacements: changedMemberships,
  };
  perQuery.push(record);

  if (!byFamily[query.family]) byFamily[query.family] = { queries: 0, queriesChanged: 0, changedTop10Pairs: 0 };
  byFamily[query.family].queries++;
  byFamily[query.family].changedTop10Pairs += changedPairs;
  if (changedPairs) byFamily[query.family].queriesChanged++;

  if (!byLanguage[query.language]) byLanguage[query.language] = { queries: 0, queriesChanged: 0, changedTop10Pairs: 0 };
  byLanguage[query.language].queries++;
  byLanguage[query.language].changedTop10Pairs += changedPairs;
  if (changedPairs) byLanguage[query.language].queriesChanged++;
}

if (scoreChecks.mismatches) {
  throw new Error(`A/B score reconstruction mismatch on ${scoreChecks.mismatches}/${scoreChecks.sharedRowsChecked} shared rows; max error=${scoreChecks.maxAbsoluteError}`);
}

const metaChangedPairs = Object.values(meta.perQuery || {}).reduce((sum, item) => sum + Number(item.changedTop10Pairs || 0), 0);
if (metaChangedPairs !== changedPairsTotal) {
  throw new Error(`Run/meta changed-pair mismatch: rows=${changedPairsTotal}, meta=${metaChangedPairs}`);
}

const report = {
  schemaVersion: 1,
  name: "Interdisciplinary conjunction v1 fresh holdout structural analysis",
  methodology: "Structural analysis only. No human relevance labels are used. Conditions A and B came from one live retrieval per query and reranked the same candidate pool during collection; this report verifies the frozen A/B rows, exact score reconstruction for shared rows, and Top-10 membership changes.",
  limitation: "The finalized run preserves A/B Top-20 rows and collection metadata, but not the full candidatePoolIds array that the server validated before saving each query. Same-pool provenance therefore rests on the frozen runner/server contract plus the saved run, not a post-hoc full-pool snapshot.",
  run: path.relative(ROOT, RUN),
  metadata: path.relative(ROOT, META),
  runtimeCommit: meta.runtimeCommit,
  preregistrationBaseCommit: validation.baseCommit,
  queryCount: validation.queries.length,
  topK,
  rows: rows.length,
  queriesChanged,
  changedTop10Pairs: changedPairsTotal,
  top10MembershipReplacements: aOnlyTotal,
  aOnlyTotal,
  bOnlyTotal,
  scoreChecks: {
    ...scoreChecks,
    maxAbsoluteError: round(scoreChecks.maxAbsoluteError, 12),
  },
  aOnlyBuckets,
  bOnlyBuckets,
  changedAdjustmentCounts,
  byFamily,
  byLanguage,
  perQuery,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const lines = [];
lines.push("# Interdisciplinary conjunction v1 · fresh holdout structural analysis", "");
lines.push(report.methodology, "");
lines.push(`> ${report.limitation}`, "");
lines.push("## Summary", "");
lines.push(`- run: ${report.run}`);
lines.push(`- runtime commit: ${report.runtimeCommit}`);
lines.push(`- preregistration base commit: ${report.preregistrationBaseCommit}`);
lines.push(`- queries: ${report.queryCount}`);
lines.push(`- frozen rows: ${report.rows}`);
lines.push(`- queries with Top-${topK} membership change: ${queriesChanged}/${report.queryCount}`);
lines.push(`- changed Top-${topK} query-document pairs: ${changedPairsTotal}`);
lines.push(`- membership replacements: ${aOnlyTotal}`);
lines.push(`- A-only / B-only: ${aOnlyTotal}/${bOnlyTotal}`);
lines.push(`- shared-row score checks: ${scoreChecks.sharedRowsChecked}`);
lines.push(`- score reconstruction mismatches: ${scoreChecks.mismatches}`);
lines.push(`- max score reconstruction error: ${report.scoreChecks.maxAbsoluteError}`, "");

lines.push("## By family", "");
lines.push("| family | queries changed | changed Top-10 pairs |");
lines.push("|---|---:|---:|");
for (const family of validation.families) {
  const item = byFamily[family.id] || { queries: 0, queriesChanged: 0, changedTop10Pairs: 0 };
  lines.push(`| ${family.id} | ${item.queriesChanged}/${item.queries} | ${item.changedTop10Pairs} |`);
}

lines.push("", "## By language", "");
lines.push("| language | queries changed | changed Top-10 pairs |");
lines.push("|---|---:|---:|");
for (const language of validation.evaluation.languages) {
  const item = byLanguage[language] || { queries: 0, queriesChanged: 0, changedTop10Pairs: 0 };
  lines.push(`| ${language} | ${item.queriesChanged}/${item.queries} | ${item.changedTop10Pairs} |`);
}

lines.push("", "## Per query", "");
lines.push("| query | language | family | rows A/B | changed Top-10 pairs | replacements |");
lines.push("|---|---|---|---:|---:|---:|");
for (const item of perQuery) {
  lines.push(`| ${item.query_id} · ${item.query} | ${item.language} | ${item.family} | ${item.rowsA}/${item.rowsB} | ${item.changedTop10Pairs} | ${item.top10MembershipReplacements} |`);
}

lines.push("", "## Aggregate conjunction buckets among changed pairs", "");
lines.push(`- A-only buckets: ${JSON.stringify(aOnlyBuckets)}`);
lines.push(`- B-only buckets: ${JSON.stringify(bOnlyBuckets)}`);
lines.push(`- conjunction adjustments across all changed pairs: ${JSON.stringify(changedAdjustmentCounts)}`, "");
lines.push("No document titles or side-specific audit items are emitted here, so the next human relevance audit can remain blind to which condition promoted or removed each document.");

fs.writeFileSync(OUT_MD, lines.join("\n") + "\n", "utf8");

console.log("INTERDISCIPLINARY CONJUNCTION V1 HOLDOUT STRUCTURAL ANALYSIS: PASS");
console.log(`run=${path.relative(ROOT, RUN)}`);
console.log(`queries=${report.queryCount}`);
console.log(`rows=${report.rows}`);
console.log(`queries_changed=${queriesChanged}`);
console.log(`changed_top10_pairs=${changedPairsTotal}`);
console.log(`membership_replacements=${aOnlyTotal}`);
console.log(`score_checks=${scoreChecks.sharedRowsChecked}`);
console.log(`score_mismatches=${scoreChecks.mismatches}`);
console.log(`json=${path.relative(ROOT, OUT_JSON)}`);
console.log(`markdown=${path.relative(ROOT, OUT_MD)}`);
