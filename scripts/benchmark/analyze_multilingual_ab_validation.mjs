import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const QUERIES_PATH = path.join(ROOT, "benchmark/validation-multilingual-ab-v1.queries.json");
const RUN_DIR = path.join(ROOT, "benchmark/runs");
const OUT_JSON = path.join(ROOT, "benchmark/multilingual-ab-validation-structural.json");
const OUT_MD = path.join(ROOT, "benchmark/multilingual-ab-validation-structural.md");

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { throw new Error(`${filePath}:${index + 1}: ${error.message}`); }
    });
}

function findRun() {
  if (process.env.MULTILINGUAL_AB_RUN) {
    const absolute = path.resolve(ROOT, process.env.MULTILINGUAL_AB_RUN);
    if (!fs.existsSync(absolute)) throw new Error(`Run not found: ${absolute}`);
    return absolute;
  }

  const candidates = fs.readdirSync(RUN_DIR)
    .filter(name => /^heldout-multilingual-ab-v1-[^.]+\.jsonl$/.test(name))
    .map(name => path.join(RUN_DIR, name));

  if (candidates.length !== 1) {
    throw new Error(`Expected exactly one held-out A/B run, found ${candidates.length}. Set MULTILINGUAL_AB_RUN if needed.`);
  }
  return candidates[0];
}

function rowsFor(run, queryId, condition, depth) {
  return run
    .filter(row => row.query_id === queryId && row.condition === condition && Number(row.rank) <= depth)
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}

function hasTranslation(row) {
  return (row.matchedQueries || []).some(item => item.type === "translation");
}

function translationMode(row) {
  const original = (row.matchedQueries || []).some(item => item.type === "original");
  const translation = hasTranslation(row);
  if (original && translation) return "original+translation";
  if (translation) return "translation-only";
  if (original) return "original-only";
  return "other";
}

function md(value = "") {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function summarize(items) {
  if (!items.length) return { queries: 0, meanTop10Overlap: 0, changedPairs: 0, bOnlyTranslationAny: 0 };
  return {
    queries: items.length,
    meanTop10Overlap: Number((items.reduce((sum, x) => sum + x.overlapTop10, 0) / items.length).toFixed(2)),
    changedPairs: items.reduce((sum, x) => sum + x.changedTop10Pairs, 0),
    bOnlyTranslationAny: items.reduce((sum, x) => sum + x.bOnlyTranslationAny, 0),
  };
}

const validation = JSON.parse(fs.readFileSync(QUERIES_PATH, "utf8"));
const runPath = findRun();
const run = readJsonl(runPath);
const metaPath = runPath.replace(/\.jsonl$/, ".meta.json");
const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : null;

if (run.length !== validation.queries.length * 2 * validation.evaluation.poolDepth) {
  throw new Error(`Unexpected row count: ${run.length}`);
}

const executionByQuery = new Map();
for (const item of meta?.executionOrder || []) {
  if (!executionByQuery.has(item.query_id)) executionByQuery.set(item.query_id, {});
  executionByQuery.get(item.query_id)[item.condition] = item;
}

const perQuery = [];
let shared10 = 0;
let union10 = 0;
let changed10 = 0;
let shared20 = 0;
let union20 = 0;
let bTop10TranslationAny = 0;
let bTop10TranslationOnly = 0;
let bOnlyTranslationAny = 0;
const gaps = [];

for (const query of validation.queries) {
  const a10 = rowsFor(run, query.id, "A", 10);
  const b10 = rowsFor(run, query.id, "B", 10);
  const a20 = rowsFor(run, query.id, "A", 20);
  const b20 = rowsFor(run, query.id, "B", 20);
  if (a10.length !== 10 || b10.length !== 10 || a20.length !== 20 || b20.length !== 20) {
    throw new Error(`${query.id}: incomplete A/B depth`);
  }

  const a10Map = new Map(a10.map(row => [row.record_id, row]));
  const b10Map = new Map(b10.map(row => [row.record_id, row]));
  const a20Ids = new Set(a20.map(row => row.record_id));
  const b20Ids = new Set(b20.map(row => row.record_id));

  const shared10Ids = [...a10Map.keys()].filter(id => b10Map.has(id));
  const union10Ids = [...new Set([...a10Map.keys(), ...b10Map.keys()])];
  const aOnly = a10.filter(row => !b10Map.has(row.record_id));
  const bOnly = b10.filter(row => !a10Map.has(row.record_id));
  if (aOnly.length !== bOnly.length) throw new Error(`${query.id}: asymmetric Top-10 delta`);

  const shared20Count = [...a20Ids].filter(id => b20Ids.has(id)).length;
  const union20Count = new Set([...a20Ids, ...b20Ids]).size;
  const bTranslationAny = b10.filter(hasTranslation).length;
  const bTranslationOnly = b10.filter(row => translationMode(row) === "translation-only").length;
  const bOnlyTranslation = bOnly.filter(hasTranslation).length;

  const execution = executionByQuery.get(query.id) || {};
  const aTime = execution.A?.savedAt ? new Date(execution.A.savedAt).getTime() : null;
  const bTime = execution.B?.savedAt ? new Date(execution.B.savedAt).getTime() : null;
  const pairGapSeconds = aTime != null && bTime != null ? Math.abs(bTime - aTime) / 1000 : null;
  if (pairGapSeconds != null) gaps.push(pairGapSeconds);

  const item = {
    id: query.id,
    query: query.query,
    language: query.language,
    family: query.family,
    englishControl: query.language === "en",
    overlapTop10: shared10Ids.length,
    unionTop10: union10Ids.length,
    changedTop10Pairs: aOnly.length + bOnly.length,
    changedPerSide: aOnly.length,
    overlapTop20: shared20Count,
    unionTop20: union20Count,
    bTop10TranslationAny: bTranslationAny,
    bTop10TranslationOnly: bTranslationOnly,
    bOnlyTranslationAny: bOnlyTranslation,
    aFirst: Number(a10[0]?.order_position) < Number(b10[0]?.order_position),
    pairGapSeconds,
    aOnly: aOnly.map(row => ({ rank: row.rank, record_id: row.record_id, title: row.title || "" })),
    bOnly: bOnly.map(row => ({
      rank: row.rank,
      record_id: row.record_id,
      title: row.title || "",
      translation_mode: translationMode(row),
      matchedQueries: row.matchedQueries || [],
    })),
  };
  perQuery.push(item);

  shared10 += shared10Ids.length;
  union10 += union10Ids.length;
  changed10 += item.changedTop10Pairs;
  shared20 += shared20Count;
  union20 += union20Count;
  bTop10TranslationAny += bTranslationAny;
  bTop10TranslationOnly += bTranslationOnly;
  bOnlyTranslationAny += bOnlyTranslation;
}

gaps.sort((a, b) => a - b);
const medianGap = gaps.length ? (gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2) : null;
const controls = perQuery.filter(x => x.englishControl);
const targets = perQuery.filter(x => !x.englishControl);

const report = {
  schemaVersion: 1,
  name: "Held-out multilingual A/B structural analysis v1",
  note: "Structural only. No relevance labels are inferred. A=original-only; B=original plus safe multilingual expansion.",
  sources: {
    queries: path.relative(ROOT, QUERIES_PATH),
    run: path.relative(ROOT, runPath),
    metadata: fs.existsSync(metaPath) ? path.relative(ROOT, metaPath) : null,
  },
  summary: {
    queries: validation.queries.length,
    rows: run.length,
    top10SharedPairs: shared10,
    top10UnionPairs: union10,
    meanTop10Overlap: Number((shared10 / validation.queries.length).toFixed(2)),
    changedTop10Pairs: changed10,
    changedPerSide: changed10 / 2,
    top20SharedPairs: shared20,
    top20UnionPairs: union20,
    meanTop20Overlap: Number((shared20 / validation.queries.length).toFixed(2)),
    bTop10TranslationAny,
    bTop10TranslationOnly,
    bOnlyTranslationAny,
    medianPairGapSeconds: medianGap == null ? null : Number(medianGap.toFixed(2)),
    maxPairGapSeconds: gaps.length ? Number(Math.max(...gaps).toFixed(2)) : null,
    englishControls: summarize(controls),
    nonEnglishTargets: summarize(targets),
  },
  perQuery,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const lines = [];
lines.push("# Held-out multilingual A/B structural analysis", "");
lines.push(report.note, "");
lines.push("## Summary", "");
for (const [label, value] of [
  ["queries", report.summary.queries],
  ["rows", report.summary.rows],
  ["Top-10 shared query-document pairs", report.summary.top10SharedPairs],
  ["Top-10 union query-document pairs", report.summary.top10UnionPairs],
  ["mean Top-10 overlap per query", `${report.summary.meanTop10Overlap}/10`],
  ["changed Top-10 query-document pairs", report.summary.changedTop10Pairs],
  ["changed positions per side", report.summary.changedPerSide],
  ["mean Top-20 overlap per query", `${report.summary.meanTop20Overlap}/20`],
  ["B Top-10 positions with translation provenance", `${report.summary.bTop10TranslationAny}/200`],
  ["B Top-10 translation-only positions", `${report.summary.bTop10TranslationOnly}/200`],
  ["B-only Top-10 positions with translation provenance", report.summary.bOnlyTranslationAny],
  ["median A/B save-time gap", `${report.summary.medianPairGapSeconds}s`],
  ["max A/B save-time gap", `${report.summary.maxPairGapSeconds}s`],
]) lines.push(`- ${label}: ${value}`);
lines.push("");
lines.push(`- English controls: mean overlap ${report.summary.englishControls.meanTop10Overlap}/10; changed pairs=${report.summary.englishControls.changedPairs}`);
lines.push(`- Non-English targets: mean overlap ${report.summary.nonEnglishTargets.meanTop10Overlap}/10; changed pairs=${report.summary.nonEnglishTargets.changedPairs}; B-only via translation=${report.summary.nonEnglishTargets.bOnlyTranslationAny}`, "");

lines.push("## Per query", "");
lines.push("| query | lang | control | A/B order | gap s | overlap@10 | changed | B translation@10 | B-only via translation |");
lines.push("|---|---|---|---|---:|---:|---:|---:|---:|");
for (const item of perQuery) {
  lines.push(`| ${item.id} · ${md(item.query)} | ${item.language} | ${item.englishControl ? "yes" : "no"} | ${item.aFirst ? "A→B" : "B→A"} | ${item.pairGapSeconds == null ? "—" : item.pairGapSeconds.toFixed(2)} | ${item.overlapTop10}/10 | ${item.changedTop10Pairs} | ${item.bTop10TranslationAny}/10 | ${item.bOnlyTranslationAny} |`);
}
lines.push("", "## Audit requirement", "");
lines.push(`Exact paired human ΔP@10 requires relevance labels only for the **${report.summary.changedTop10Pairs}** changed query-document pairs. Shared Top-10 rows cancel exactly.`, "");

fs.writeFileSync(OUT_MD, lines.join("\n") + "\n", "utf8");

console.log("HELD-OUT MULTILINGUAL A/B STRUCTURAL ANALYSIS: PASS");
console.log(`queries=${report.summary.queries}`);
console.log(`rows=${report.summary.rows}`);
console.log(`top10_overlap_mean=${report.summary.meanTop10Overlap}/10`);
console.log(`changed_top10_pairs=${report.summary.changedTop10Pairs}`);
console.log(`audit_rows_needed=${report.summary.changedTop10Pairs}`);
console.log(`english_control_overlap_mean=${report.summary.englishControls.meanTop10Overlap}/10`);
console.log(`english_control_changed_pairs=${report.summary.englishControls.changedPairs}`);
console.log(`nonenglish_overlap_mean=${report.summary.nonEnglishTargets.meanTop10Overlap}/10`);
console.log(`b_only_translation_any=${report.summary.bOnlyTranslationAny}`);
console.log(`median_pair_gap_seconds=${report.summary.medianPairGapSeconds}`);
console.log(`max_pair_gap_seconds=${report.summary.maxPairGapSeconds}`);
for (const item of perQuery) {
  console.log(`${item.id}: overlap=${item.overlapTop10}/10 changed=${item.changedTop10Pairs} b_translation=${item.bTop10TranslationAny}/10 b_only_translation=${item.bOnlyTranslationAny}`);
}
console.log(`json=${path.relative(ROOT, OUT_JSON)}`);
console.log(`markdown=${path.relative(ROOT, OUT_MD)}`);
