import fs from "node:fs";
import { normalizeText } from "../../src/core/parser.js";

const RUN = "benchmark/runs/human-v1.0-1064fdb.jsonl";
const SILVER = "benchmark/ai-silver-v1.jsonl";
const QUERIES = "benchmark/queries.json";
const HUMAN = "benchmark/human-audit-v1.judgments.jsonl";
const MANIFEST = "benchmark/human-audit-v1.manifest.json";
const OUT_JSON = "benchmark/ranking-v22-development.json";
const OUT_MD = "benchmark/ranking-v22-development.md";

const STOPWORDS = new Set([
  "a", "al", "de", "del", "el", "la", "las", "los", "en", "y", "o", "por", "para", "con", "sobre",
  "an", "and", "of", "the", "in", "on", "for", "to", "with", "about",
  "am", "an", "auf", "bei", "das", "dem", "den", "der", "des", "die", "ein", "eine", "einer", "im", "mit", "und", "von", "zu", "zur", "zum",
  "au", "aux", "dans", "des", "du", "et", "le", "les", "sur", "avec", "pour",
  "as", "com", "da", "das", "do", "dos", "em", "na", "nas", "no", "nos", "os",
]);

function readJsonl(path) {
  return fs.readFileSync(path, "utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}
function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : null;
}
function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : null;
}
function keyOf(queryId, recordId) {
  return `${queryId}\u0000${recordId}`;
}
function tokens(text = "") {
  return normalizeText(text).split(" ").filter(Boolean);
}
function rawCoverage(query, title) {
  const q = [...new Set(tokens(query))];
  const t = new Set(tokens(title));
  if (!q.length) return 0;
  return q.filter(token => t.has(token)).length / q.length;
}
function meaningfulTokens(text = "") {
  return [...new Set(tokens(text).filter(token => !STOPWORDS.has(token)))];
}
function meaningfulMatch(query, title) {
  const q = meaningfulTokens(query);
  const t = new Set(meaningfulTokens(title));
  const matchedTokens = q.filter(token => t.has(token));
  const matched = matchedTokens.length;
  const required = Math.min(2, q.length);
  return {
    queryTokens: q,
    matchedTokens,
    matched,
    required,
    coverage: q.length ? matched / q.length : 0,
    conjunctive: required > 0 && matched >= required,
  };
}
function hasProvider(row, name) {
  return (row.providers || []).includes(name);
}
function curatedPrior(row) {
  let prior = 0;
  if (hasProvider(row, "CUCSH Filosofía")) prior += 5;
  if (hasProvider(row, "Internet Archive")) prior += 3;
  return prior;
}

const profiles = [
  {
    id: "baseline",
    description: "Frozen production order.",
  },
  {
    id: "v2_current",
    description: "Current Ranking v2 formula reconstructed on the frozen baseline pool.",
    mode: "v2-current",
  },
  {
    id: "v21_soft_zero_crossref",
    description: "Previous v2.1 candidate: meaningful-token coverage; soft source prior; Crossref -2 only at zero meaningful matches.",
    mode: "v21-soft",
  },
  {
    id: "v22_conjunctive_none",
    description: "Title boost and curated prior require at least two meaningful query-token matches (or all tokens for one-token queries); no Crossref provider penalty.",
    mode: "v22",
    crossrefZeroPenalty: 0,
    sourceSoftOneMatch: false,
  },
  {
    id: "v22_conjunctive_softzero",
    description: "Same conjunctive gate; Crossref receives only -1 when zero meaningful query tokens match.",
    mode: "v22",
    crossrefZeroPenalty: -1,
    sourceSoftOneMatch: false,
  },
  {
    id: "v22_conjunctive_zero",
    description: "Same conjunctive gate; Crossref receives -2 when zero meaningful query tokens match.",
    mode: "v22",
    crossrefZeroPenalty: -2,
    sourceSoftOneMatch: false,
  },
  {
    id: "v22_conjunctive_softsource_none",
    description: "Conjunctive title boost; curated sources receive 25% prior at one meaningful match and full prior at two; no Crossref penalty.",
    mode: "v22",
    crossrefZeroPenalty: 0,
    sourceSoftOneMatch: true,
  },
];

const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const run = readJsonl(RUN);
const silverRows = readJsonl(SILVER);
const humanRows = readJsonl(HUMAN);

const queryMeta = new Map(benchmark.queries.map(query => [query.id, query]));
const silver = new Map(silverRows.map(row => [keyOf(row.query_id, row.record_id), Number(row.relevance)]));
const humanByAudit = new Map(humanRows.map(row => [row.audit_id, row]));

// Tuning still uses only the deliberately targeted half of the human audit.
// The random-stratified half remains excluded from development labels.
const targetedHuman = new Map();
for (const item of manifest.items || []) {
  if (item.sample_group !== "targeted") continue;
  const judgment = humanByAudit.get(item.audit_id);
  if (!judgment) continue;
  targetedHuman.set(keyOf(item.query_id, item.record_id), Number(judgment.human_relevance));
}

const byQuery = new Map();
for (const row of run) {
  if (!byQuery.has(row.query_id)) byQuery.set(row.query_id, []);
  byQuery.get(row.query_id).push(row);
}
for (const rows of byQuery.values()) rows.sort((a, b) => Number(a.rank) - Number(b.rank));

function adjustmentFor(row, query, profile) {
  if (profile.id === "baseline") return { total: 0, match: meaningfulMatch(query.query, row.title || "") };

  if (profile.mode === "v2-current") {
    const coverage = rawCoverage(query.query, row.title || "");
    let source = curatedPrior(row);
    if (hasProvider(row, "Crossref") && coverage < 0.50) source -= 2;
    return { total: coverage * 4 + source, match: meaningfulMatch(query.query, row.title || "") };
  }

  const match = meaningfulMatch(query.query, row.title || "");

  if (profile.mode === "v21-soft") {
    let sourceFactor = 0;
    if (match.conjunctive) sourceFactor = 1;
    else if (match.matched === 1) sourceFactor = 0.25;
    let total = match.coverage * 4 + curatedPrior(row) * sourceFactor;
    if (hasProvider(row, "Crossref") && match.matched === 0) total -= 2;
    return { total, match };
  }

  let sourceFactor = match.conjunctive ? 1 : 0;
  if (!match.conjunctive && profile.sourceSoftOneMatch && match.matched === 1) {
    sourceFactor = 0.25;
  }

  // Core v2.2 hypothesis: partial title evidence must not earn a positive
  // lexical boost on multi-term queries. It may keep its base semantic score.
  const titleBoost = match.conjunctive ? match.coverage * 4 : 0;
  let total = titleBoost + curatedPrior(row) * sourceFactor;

  if (hasProvider(row, "Crossref") && match.matched === 0) {
    total += profile.crossrefZeroPenalty || 0;
  }

  return { total, match };
}

function scoreRow(row, query, profile) {
  if (profile.id === "baseline") return -Number(row.rank);
  const base = Number(row.score || 0);
  const adjustment = adjustmentFor(row, query, profile).total;
  return base + adjustment - Number(row.rank) * 1e-6;
}

function dcg(grades) {
  return grades.reduce((sum, grade, index) => sum + ((2 ** grade) - 1) / Math.log2(index + 2), 0);
}
function metricsForRows(rows, queryId, gradeFn) {
  const top10 = rows.slice(0, 10);
  const top5 = rows.slice(0, 5);
  const grade = row => gradeFn(row, queryId);
  const relevant = row => grade(row) >= 2;
  const allRelevant = rows.filter(relevant).length;
  const relevant10 = top10.filter(relevant).length;
  const firstRelevant = top10.findIndex(relevant);
  const actualGrades = top10.map(grade);
  const idealGrades = rows.map(grade).sort((a, b) => b - a).slice(0, 10);
  const idealDcg = dcg(idealGrades);
  return {
    precision5: top5.length ? top5.filter(relevant).length / top5.length : null,
    precision10: top10.length ? relevant10 / top10.length : null,
    recall10: allRelevant ? relevant10 / allRelevant : null,
    ndcg10: idealDcg ? dcg(actualGrades) / idealDcg : null,
    mrr10: firstRelevant >= 0 ? 1 / (firstRelevant + 1) : 0,
  };
}
function silverGrade(row, queryId) {
  return Number(silver.get(keyOf(queryId, row.record_id)) ?? 0);
}
function targetedGrade(row, queryId) {
  const key = keyOf(queryId, row.record_id);
  if (targetedHuman.has(key)) return Number(targetedHuman.get(key));
  return Number(silver.get(key) ?? 0);
}
function summarize(rows) {
  const keys = ["precision5", "precision10", "recall10", "ndcg10", "mrr10"];
  const out = { queries: rows.length };
  for (const key of keys) out[key] = round(mean(rows.map(row => row[key])));
  return out;
}
function grouped(rows, field) {
  const buckets = new Map();
  for (const row of rows) {
    if (!buckets.has(row[field])) buckets.set(row[field], []);
    buckets.get(row[field]).push(row);
  }
  return Object.fromEntries([...buckets.entries()].map(([key, values]) => [key, summarize(values)]));
}
function direction(rows, baselineById) {
  let improved = 0;
  let worsened = 0;
  let tied = 0;
  for (const row of rows) {
    const base = baselineById.get(row.id);
    if (row.precision10 > base.precision10) improved++;
    else if (row.precision10 < base.precision10) worsened++;
    else tied++;
  }
  return { improved, worsened, tied };
}

const results = [];
for (const profile of profiles) {
  const silverPerQuery = [];
  const devPerQuery = [];

  for (const [queryId, rows] of byQuery.entries()) {
    const query = queryMeta.get(queryId);
    const reranked = [...rows].sort((a, b) => scoreRow(b, query, profile) - scoreRow(a, query, profile));
    const meta = { id: queryId, language: query.language, intent: query.intent, family: query.family };
    silverPerQuery.push({ ...meta, ...metricsForRows(reranked, queryId, silverGrade) });
    devPerQuery.push({ ...meta, ...metricsForRows(reranked, queryId, targetedGrade) });
  }

  results.push({
    profile,
    silver: { overall: summarize(silverPerQuery), byIntent: grouped(silverPerQuery, "intent"), perQuery: silverPerQuery },
    targetedDevelopment: { overall: summarize(devPerQuery), byIntent: grouped(devPerQuery, "intent"), perQuery: devPerQuery },
  });
}

const baseSilver = results[0].silver.overall.precision10;
const baseDev = results[0].targetedDevelopment.overall.precision10;
const baseSilverById = new Map(results[0].silver.perQuery.map(row => [row.id, row]));
const baseDevById = new Map(results[0].targetedDevelopment.perQuery.map(row => [row.id, row]));

for (const result of results) {
  result.silver.deltaP10 = round(result.silver.overall.precision10 - baseSilver);
  result.targetedDevelopment.deltaP10 = round(result.targetedDevelopment.overall.precision10 - baseDev);
  result.silver.directionVsBaseline = direction(result.silver.perQuery, baseSilverById);
  result.targetedDevelopment.directionVsBaseline = direction(result.targetedDevelopment.perQuery, baseDevById);
}

const report = {
  schemaVersion: 1,
  note: "Ranking v2.2 development-only simulation over the frozen baseline Top-20 pool.",
  hypothesis: "Require conjunctive lexical evidence before adding positive title/source adjustments; preserve the base semantic rank when only one term of a multi-term query appears.",
  tuningPolicy: "Only the 50 targeted human-audit cases override silver labels. Random-stratified human labels are not used in the tuning grade map.",
  caveats: [
    "This is not an independent validation run.",
    "The candidate pool is frozen and cannot measure newly retrieved documents.",
    "Unaudited documents still use AI-silver labels.",
    "The previously viewed random audit is not treated as a fresh holdout; final validation needs new unseen queries.",
  ],
  targetedHumanOverrides: targetedHuman.size,
  profiles: results,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const md = [];
md.push("# Ranking v2.2 development simulation", "", report.note, "", `> ${report.hypothesis}`, "", `> ${report.tuningPolicy}`, "");
md.push("## Overall", "");
md.push("| Profile | Silver P@10 | Δ | Targeted-human dev P@10 | Δ | Dev improved/worsened/tied | Dev interdisciplinary P@10 |");
md.push("|---|---:|---:|---:|---:|---:|---:|");
for (const result of results) {
  const d = result.targetedDevelopment.directionVsBaseline;
  const inter = result.targetedDevelopment.byIntent["interdisciplinary-challenge"]?.precision10 ?? null;
  md.push(`| ${result.profile.id} | ${result.silver.overall.precision10} | ${result.silver.deltaP10} | ${result.targetedDevelopment.overall.precision10} | ${result.targetedDevelopment.deltaP10} | ${d.improved}/${d.worsened}/${d.tied} | ${inter} |`);
}
md.push("", "## Profiles", "");
for (const result of results) md.push(`- **${result.profile.id}**: ${result.profile.description}`);
md.push("", "## Targeted-human development P@10 by intent", "");
md.push("| Profile | philosopher-concept | work | interdisciplinary-challenge |");
md.push("|---|---:|---:|---:|");
for (const result of results) {
  const byIntent = result.targetedDevelopment.byIntent;
  md.push(`| ${result.profile.id} | ${byIntent["philosopher-concept"]?.precision10 ?? "-"} | ${byIntent.work?.precision10 ?? "-"} | ${byIntent["interdisciplinary-challenge"]?.precision10 ?? "-"} |`);
}

const criticalIds = ["de-10", "es-10", "en-10", "fr-10", "pt-10", "de-02", "en-03", "en-04", "de-07"];
md.push("", "## Critical-query targeted-human development P@10", "");
md.push(`| Profile | ${criticalIds.join(" | ")} |`);
md.push(`|---|${criticalIds.map(() => "---:").join("|")}|`);
for (const result of results) {
  const map = new Map(result.targetedDevelopment.perQuery.map(row => [row.id, row.precision10]));
  md.push(`| ${result.profile.id} | ${criticalIds.map(id => map.get(id) ?? "-").join(" | ")} |`);
}
md.push("", "## Caveats", "");
for (const caveat of report.caveats) md.push(`- ${caveat}`);
md.push("");
fs.writeFileSync(OUT_MD, md.join("\n"), "utf8");

console.log("RANKING V2.2 DEVELOPMENT SIMULATION: PASS");
console.log(`targeted_human_overrides=${targetedHuman.size}`);
for (const result of results) {
  const d = result.targetedDevelopment.directionVsBaseline;
  console.log(`${result.profile.id}: silver_p10=${result.silver.overall.precision10} dev_p10=${result.targetedDevelopment.overall.precision10} dev_delta=${result.targetedDevelopment.deltaP10} dev_queries=${d.improved}/${d.worsened}/${d.tied}`);
}
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);
