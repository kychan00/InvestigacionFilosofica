import fs from "node:fs";

const BASELINE = "benchmark/ai-silver-v1.report.json";
const V2 = "benchmark/ai-silver-ranking-v2.report.json";
const OUT_JSON = "benchmark/ranking-v2-comparison.json";
const OUT_MD = "benchmark/ranking-v2-comparison.md";

function readJson(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : null;
}

function delta(next, base) {
  return Number.isFinite(next) && Number.isFinite(base)
    ? round(next - base)
    : null;
}

const baseline = readJson(BASELINE);
const v2 = readJson(V2);

const metricKeys = [
  "precision5",
  "precision10",
  "recall10",
  "ndcg10",
  "mrr10",
  "philosophyPrecision10"
];

const overall = {};
for (const key of metricKeys) {
  overall[key] = {
    baseline: baseline.overall[key],
    v2: v2.overall[key],
    delta: delta(v2.overall[key], baseline.overall[key])
  };
}

const byLanguage = {};
for (const language of Object.keys(baseline.byLanguage || {})) {
  byLanguage[language] = {
    baseline: baseline.byLanguage[language]?.precision10 ?? null,
    v2: v2.byLanguage?.[language]?.precision10 ?? null,
    delta: delta(
      v2.byLanguage?.[language]?.precision10,
      baseline.byLanguage?.[language]?.precision10
    )
  };
}

const byIntent = {};
for (const intent of Object.keys(baseline.byIntent || {})) {
  byIntent[intent] = {
    baseline: baseline.byIntent[intent]?.precision10 ?? null,
    v2: v2.byIntent?.[intent]?.precision10 ?? null,
    delta: delta(
      v2.byIntent?.[intent]?.precision10,
      baseline.byIntent?.[intent]?.precision10
    )
  };
}

const basePerQuery = new Map(
  (baseline.perQuery || []).map(row => [row.id, row])
);

let improved = 0;
let worsened = 0;
let tied = 0;
const changed = [];

for (const row of v2.perQuery || []) {
  const base = basePerQuery.get(row.id);
  if (!base) continue;
  const d = delta(row.precision10, base.precision10);
  if (d > 0) improved++;
  else if (d < 0) worsened++;
  else tied++;
  if (d !== 0) {
    changed.push({
      id: row.id,
      language: row.language,
      intent: row.intent,
      family: row.family,
      baselinePrecision10: base.precision10,
      v2Precision10: row.precision10,
      deltaPrecision10: d
    });
  }
}

changed.sort((a, b) => a.deltaPrecision10 - b.deltaPrecision10);

const report = {
  schemaVersion: 1,
  note: "AI-silver comparison. Both pools are judged with the same AI policy/models, but this is not human-gold validation.",
  baseline: BASELINE,
  v2: V2,
  overall,
  byLanguage,
  byIntent,
  perQueryPrecision10: {
    improved,
    worsened,
    tied,
    changed
  }
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n");

const md = [];
md.push("# Ranking v2 comparison", "", report.note, "");
md.push("| Metric | Baseline | Ranking v2 | Delta |", "|---|---:|---:|---:|");
for (const key of metricKeys) {
  const row = overall[key];
  md.push(`| ${key} | ${row.baseline} | ${row.v2} | ${row.delta} |`);
}

md.push("", "## P@10 by language", "", "| Language | Baseline | Ranking v2 | Delta |", "|---|---:|---:|---:|");
for (const [language, row] of Object.entries(byLanguage)) {
  md.push(`| ${language} | ${row.baseline} | ${row.v2} | ${row.delta} |`);
}

md.push("", "## P@10 by intent", "", "| Intent | Baseline | Ranking v2 | Delta |", "|---|---:|---:|---:|");
for (const [intent, row] of Object.entries(byIntent)) {
  md.push(`| ${intent} | ${row.baseline} | ${row.v2} | ${row.delta} |`);
}

md.push(
  "",
  "## Per-query P@10",
  "",
  `- Improved: ${improved}`,
  `- Worsened: ${worsened}`,
  `- Tied: ${tied}`,
  ""
);

if (changed.length) {
  md.push("| Query | Lang | Intent | Baseline | Ranking v2 | Delta |", "|---|---|---|---:|---:|---:|");
  for (const row of changed) {
    md.push(`| ${row.id} | ${row.language} | ${row.intent} | ${row.baselinePrecision10} | ${row.v2Precision10} | ${row.deltaPrecision10} |`);
  }
  md.push("");
}

fs.writeFileSync(OUT_MD, md.join("\n"));

console.log("RANKING V2 COMPARISON: PASS");
console.log(`baseline_p10=${baseline.overall.precision10}`);
console.log(`v2_p10=${v2.overall.precision10}`);
console.log(`delta_p10=${overall.precision10.delta}`);
console.log(`improved=${improved}`);
console.log(`worsened=${worsened}`);
console.log(`tied=${tied}`);
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);
