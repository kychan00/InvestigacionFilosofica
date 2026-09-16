import fs from "node:fs";

const BASE_RUN = "benchmark/runs/human-v1.0-1064fdb.jsonl";
const V2_RUN = "benchmark/runs/human-v1.0-ranking-v2-e6ad110.jsonl";
const BASE_JUDGMENTS = "benchmark/ai-silver-v1.jsonl";
const V2_JUDGMENTS = "benchmark/ai-silver-ranking-v2.jsonl";
const QUERIES = "benchmark/queries.json";
const COMPARISON = "benchmark/ranking-v2-comparison.json";
const OUT_SAMPLE = "benchmark/human-audit-v1.sample.jsonl";
const OUT_MANIFEST = "benchmark/human-audit-v1.manifest.json";

const RANDOM_COUNT = 50;
const TARGETED_COUNT = 50;
const SEED = 20260916;

function readJsonl(path) {
  return fs.readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
}

function writeJsonl(path, rows) {
  fs.writeFileSync(
    path,
    rows.map(row => JSON.stringify(row)).join("\n") + "\n",
    "utf8"
  );
}

function keyOf(queryId, recordId) {
  return `${queryId}\u0000${recordId}`;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(rows, rng) {
  const out = [...rows];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function byKey(rows) {
  return new Map(rows.map(row => [keyOf(row.query_id, row.record_id), row]));
}

const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const comparison = JSON.parse(fs.readFileSync(COMPARISON, "utf8"));
const queries = new Map(benchmark.queries.map(query => [query.id, query]));
const baseRun = readJsonl(BASE_RUN);
const v2Run = readJsonl(V2_RUN);
const baseJudgments = byKey(readJsonl(BASE_JUDGMENTS));
const v2Judgments = byKey(readJsonl(V2_JUDGMENTS));
const baseRows = byKey(baseRun);
const v2Rows = byKey(v2Run);
const rng = mulberry32(SEED);

const allKeys = new Set([...baseRows.keys(), ...v2Rows.keys()]);
const items = [];
for (const key of allKeys) {
  const base = baseRows.get(key) || null;
  const v2 = v2Rows.get(key) || null;
  const row = v2 || base;
  const query = queries.get(row.query_id);
  const baseJudgment = baseJudgments.get(key) || null;
  const v2Judgment = v2Judgments.get(key) || null;

  items.push({
    key,
    query_id: row.query_id,
    query: row.query,
    language: query.language,
    intent: query.intent,
    family: query.family,
    record_id: row.record_id,
    title: row.title || "",
    authors: row.authors || [],
    year: row.year ?? null,
    type: row.type || null,
    document_language: row.language || null,
    journal: row.journal || null,
    publisher: row.publisher || null,
    abstract: row.abstract || null,
    baseline_rank: base?.rank ?? null,
    v2_rank: v2?.rank ?? null,
    baseline_silver: baseJudgment?.relevance ?? null,
    v2_silver: v2Judgment?.relevance ?? null,
    baseline_needs_review: Boolean(baseJudgment?.needs_human_review),
    v2_needs_review: Boolean(v2Judgment?.needs_human_review),
    baseline_audit_priority: Number(baseJudgment?.audit_priority || 0),
    v2_audit_priority: Number(v2Judgment?.audit_priority || 0),
  });
}

const selected = new Map();
function add(item, group, reason) {
  if (!item || selected.has(item.key)) return false;
  selected.set(item.key, { item, group, reason });
  return true;
}

// Representative half: 10 per language, preserving the benchmark intent mix
// inside each language (6 philosopher-concept, 2 work, 2 interdisciplinary).
const intentQuota = {
  "philosopher-concept": 6,
  "work": 2,
  "interdisciplinary-challenge": 2,
};

for (const language of benchmark.languages) {
  for (const [intent, quota] of Object.entries(intentQuota)) {
    const candidates = items.filter(item =>
      item.language === language &&
      item.intent === intent &&
      ((item.baseline_rank ?? 99) <= 10 || (item.v2_rank ?? 99) <= 10)
    );
    const pool = shuffled(candidates, rng);
    let taken = 0;
    for (const item of pool) {
      if (add(item, "random_stratified", `${language}/${intent}`)) taken++;
      if (taken === quota) break;
    }
    if (taken !== quota) {
      throw new Error(`Could not fill random stratum ${language}/${intent}: ${taken}/${quota}`);
    }
  }
}

if (selected.size !== RANDOM_COUNT) {
  throw new Error(`Expected ${RANDOM_COUNT} random audit items, got ${selected.size}`);
}

const regressedQueryIds = new Set(
  (comparison.perQuery || [])
    .filter(row => Number(row.delta) < 0)
    .map(row => row.id)
);

function crossedTop10(item) {
  const baseTop = (item.baseline_rank ?? 99) <= 10;
  const v2Top = (item.v2_rank ?? 99) <= 10;
  return baseTop !== v2Top;
}

function targetedScore(item) {
  let score = 0;
  const baseRank = item.baseline_rank ?? 99;
  const v2Rank = item.v2_rank ?? 99;

  if (regressedQueryIds.has(item.query_id)) score += 100;
  if (crossedTop10(item)) score += 45;
  if (item.baseline_needs_review || item.v2_needs_review) score += 30;
  if (item.baseline_rank == null || item.v2_rank == null) score += 18;
  if ((baseRank >= 9 && baseRank <= 12) || (v2Rank >= 9 && v2Rank <= 12)) score += 12;
  if (item.intent === "interdisciplinary-challenge") score += 10;
  score += Math.min(10, Math.max(item.baseline_audit_priority, item.v2_audit_priority));
  return score;
}

// First force all Top-10 boundary changes from the five observed regressions.
const mandatory = shuffled(
  items.filter(item => regressedQueryIds.has(item.query_id) && crossedTop10(item)),
  rng
).sort((a, b) => targetedScore(b) - targetedScore(a));

for (const item of mandatory) {
  if (selected.size >= RANDOM_COUNT + TARGETED_COUNT) break;
  add(item, "targeted", "regression_top10_boundary");
}

// Fill the remaining targeted half by uncertainty/change priority.
const remaining = shuffled(
  items.filter(item => !selected.has(item.key)),
  rng
).sort((a, b) => targetedScore(b) - targetedScore(a));

for (const item of remaining) {
  if (selected.size >= RANDOM_COUNT + TARGETED_COUNT) break;
  add(item, "targeted", "uncertainty_or_ranking_change");
}

if (selected.size !== RANDOM_COUNT + TARGETED_COUNT) {
  throw new Error(`Expected 100 audit items, got ${selected.size}`);
}

const chosen = [...selected.values()];
const sample = chosen.map(({ item }, index) => ({
  audit_id: `H${String(index + 1).padStart(3, "0")}`,
  query_id: item.query_id,
  query: item.query,
  query_language: item.language,
  intent: item.intent,
  family: item.family,
  record_id: item.record_id,
  title: item.title,
  authors: item.authors,
  year: item.year,
  type: item.type,
  document_language: item.document_language,
  journal: item.journal,
  publisher: item.publisher,
  abstract: item.abstract,
  human_relevance: null,
  human_note: "",
}));

const manifestItems = chosen.map(({ item, group, reason }, index) => ({
  audit_id: `H${String(index + 1).padStart(3, "0")}`,
  query_id: item.query_id,
  record_id: item.record_id,
  sample_group: group,
  selection_reason: reason,
  baseline_rank: item.baseline_rank,
  v2_rank: item.v2_rank,
  baseline_silver: item.baseline_silver,
  v2_silver: item.v2_silver,
  baseline_needs_review: item.baseline_needs_review,
  v2_needs_review: item.v2_needs_review,
  baseline_audit_priority: item.baseline_audit_priority,
  v2_audit_priority: item.v2_audit_priority,
  targeted_score: targetedScore(item),
}));

const counts = sample.reduce((acc, row) => {
  acc.languages[row.query_language] = (acc.languages[row.query_language] || 0) + 1;
  acc.intents[row.intent] = (acc.intents[row.intent] || 0) + 1;
  return acc;
}, { languages: {}, intents: {} });

writeJsonl(OUT_SAMPLE, sample);
fs.writeFileSync(
  OUT_MANIFEST,
  JSON.stringify({
    schemaVersion: 1,
    seed: SEED,
    sampleSize: sample.length,
    design: {
      randomStratified: RANDOM_COUNT,
      targeted: TARGETED_COUNT,
      randomStrata: "Per language: 6 philosopher-concept, 2 work, 2 interdisciplinary-challenge from the union of baseline/v2 Top 10.",
      targetedPolicy: "Prioritize the five regressed queries, Top-10 boundary changes, AI review flags, pool-exclusive documents, ranks 9-12, and interdisciplinary challenges.",
      blinding: "The sample file omits AI labels, ranks, providers, and selection group to reduce anchoring. Those fields remain only in this manifest.",
    },
    sources: {
      baselineRun: BASE_RUN,
      rankingV2Run: V2_RUN,
      baselineJudgments: BASE_JUDGMENTS,
      rankingV2Judgments: V2_JUDGMENTS,
      comparison: COMPARISON,
    },
    counts,
    items: manifestItems,
  }, null, 2) + "\n",
  "utf8"
);

console.log("HUMAN AUDIT SAMPLE: PASS");
console.log(`rows=${sample.length}`);
console.log(`random_stratified=${chosen.filter(x => x.group === "random_stratified").length}`);
console.log(`targeted=${chosen.filter(x => x.group === "targeted").length}`);
console.log(`languages=${JSON.stringify(counts.languages)}`);
console.log(`intents=${JSON.stringify(counts.intents)}`);
console.log(`sample=${OUT_SAMPLE}`);
console.log(`manifest=${OUT_MANIFEST}`);
