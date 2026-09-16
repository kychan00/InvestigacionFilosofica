import fs from "node:fs";
import { normalizeText, parseQuery } from "../../src/core/parser.js";

const RUN = "benchmark/runs/human-v1.0-1064fdb.jsonl";
const SILVER = "benchmark/ai-silver-v1.jsonl";
const QUERIES = "benchmark/queries.json";
const HUMAN = "benchmark/human-audit-v1.judgments.jsonl";
const MANIFEST = "benchmark/human-audit-v1.manifest.json";
const PHILOSOPHY_MAP = "src/data/philosophy-map.json";
const OUT_JSON = "benchmark/ranking-v23-development.json";
const OUT_MD = "benchmark/ranking-v23-development.md";

const STOPWORDS = new Set([
  "a", "al", "de", "del", "el", "la", "las", "los", "en", "y", "o", "por", "para", "con", "sobre",
  "an", "and", "of", "the", "in", "on", "for", "to", "with", "about",
  "am", "an", "auf", "bei", "das", "dem", "den", "der", "des", "die", "ein", "eine", "einer", "im", "in", "mit", "und", "von", "zu", "zur", "zum",
  "au", "aux", "dans", "des", "du", "et", "le", "les", "sur", "avec", "pour", "chez",
  "as", "com", "da", "das", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "para", "por", "sobre",
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

function uniqueMeaningful(text = "") {
  return [...new Set(tokens(text).filter(token => !STOPWORDS.has(token)))];
}

function rawCoverage(query, title) {
  const q = [...new Set(tokens(query))];
  const t = new Set(tokens(title));
  if (!q.length) return 0;
  return q.filter(token => t.has(token)).length / q.length;
}

function meaningfulCoverage(query, title) {
  const q = uniqueMeaningful(query);
  const t = new Set(uniqueMeaningful(title));
  if (!q.length) return 0;
  return q.filter(token => t.has(token)).length / q.length;
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

const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const philosophyMap = JSON.parse(fs.readFileSync(PHILOSOPHY_MAP, "utf8"));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const run = readJsonl(RUN);
const silverRows = readJsonl(SILVER);
const humanRows = readJsonl(HUMAN);

const queryMeta = new Map(benchmark.queries.map(query => [query.id, query]));
const silver = new Map(silverRows.map(row => [keyOf(row.query_id, row.record_id), Number(row.relevance)]));
const humanByAudit = new Map(humanRows.map(row => [row.audit_id, row]));

const targetedHuman = new Map();
for (const item of manifest.items || []) {
  if (item.sample_group !== "targeted") continue;
  const judgment = humanByAudit.get(item.audit_id);
  if (!judgment) continue;
  targetedHuman.set(keyOf(item.query_id, item.record_id), Number(judgment.human_relevance));
}

const parsedByQuery = new Map();
for (const query of benchmark.queries) {
  parsedByQuery.set(query.id, parseQuery(query.query, philosophyMap));
}

function recognizedMatchedTokens(parsed) {
  const values = [];
  for (const item of parsed.philosophers || []) values.push(item.matched || "");
  for (const item of parsed.concepts || []) values.push(item.matched || "");
  for (const item of parsed.works || []) values.push(item.matched || "");
  for (const item of parsed.explicitAreas || []) values.push(item.matched || "");
  return new Set(values.flatMap(uniqueMeaningful));
}

function constraintInfo(queryId, title = "") {
  const query = queryMeta.get(queryId);
  const parsed = parsedByQuery.get(queryId);
  const qTokens = uniqueMeaningful(query.query);
  const recognized = recognizedMatchedTokens(parsed);
  const residual = qTokens.filter(token => !recognized.has(token));
  const titleTokens = new Set(uniqueMeaningful(title));
  const core = qTokens.filter(token => recognized.has(token));
  const coreMatched = core.filter(token => titleTokens.has(token)).length;
  const residualMatched = residual.filter(token => titleTokens.has(token)).length;
  const residualCoverage = residual.length ? residualMatched / residual.length : 0;

  const constrained =
    (parsed.explicitAreas || []).length > 0 &&
    (parsed.philosophers || []).length === 0 &&
    (parsed.works || []).length === 0 &&
    (parsed.concepts || []).length === 0 &&
    residual.length > 0;

  const gate = constrained
    ? coreMatched > 0 && residualCoverage >= 0.5
    : true;

  return {
    constrained,
    qTokens,
    core,
    residual,
    coreMatched,
    residualMatched,
    residualCoverage,
    gate,
  };
}

const profiles = [
  { id: "baseline", description: "Frozen production order." },
  { id: "v2_current", description: "Current Ranking v2 reconstructed on the frozen baseline pool." },
  { id: "v21_soft_zero_crossref", description: "Previous v2.1 candidate." },
  {
    id: "v23_residual_gate_nosource",
    description: "Use Ranking v2 for ordinary queries; for area+external-domain queries require both philosophical-area and residual-domain evidence before any positive title adjustment, with no provider prior/penalty in that constrained path.",
  },
  {
    id: "v23_residual_gate_source",
    description: "Same residual-domain gate, but allow the normal curated-source prior only when the conjunctive gate is satisfied; no provider penalty in the constrained path.",
  },
];

function v2Adjustment(row, query) {
  const coverage = rawCoverage(query.query, row.title || "");
  let adjustment = coverage * 4 + curatedPrior(row);
  if (hasProvider(row, "Crossref") && coverage < 0.50) adjustment -= 2;
  return adjustment;
}

function v21Adjustment(row, query) {
  const q = uniqueMeaningful(query.query);
  const t = new Set(uniqueMeaningful(row.title || ""));
  const matched = q.filter(token => t.has(token)).length;
  const required = Math.min(2, q.length);
  const coverage = q.length ? matched / q.length : 0;
  const full = required > 0 && matched >= required;
  let sourceFactor = 0;
  if (full) sourceFactor = 1;
  else if (matched === 1) sourceFactor = 0.25;
  let adjustment = coverage * 4 + curatedPrior(row) * sourceFactor;
  if (hasProvider(row, "Crossref") && matched === 0) adjustment -= 2;
  return adjustment;
}

function scoreRow(row, queryId, profile) {
  if (profile.id === "baseline") return -Number(row.rank);
  const query = queryMeta.get(queryId);
  const base = Number(row.score || 0);

  if (profile.id === "v2_current") {
    return base + v2Adjustment(row, query) - Number(row.rank) * 1e-6;
  }

  if (profile.id === "v21_soft_zero_crossref") {
    return base + v21Adjustment(row, query) - Number(row.rank) * 1e-6;
  }

  const info = constraintInfo(queryId, row.title || "");
  if (!info.constrained) {
    return base + v2Adjustment(row, query) - Number(row.rank) * 1e-6;
  }

  const coverage = meaningfulCoverage(query.query, row.title || "");
  let adjustment = info.gate ? coverage * 4 : 0;
  if (profile.id === "v23_residual_gate_source" && info.gate) {
    adjustment += curatedPrior(row);
  }

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

function devGrade(row, queryId) {
  const key = keyOf(queryId, row.record_id);
  return targetedHuman.has(key) ? Number(targetedHuman.get(key)) : silverGrade(row, queryId);
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

const byQuery = new Map();
for (const row of run) {
  if (!byQuery.has(row.query_id)) byQuery.set(row.query_id, []);
  byQuery.get(row.query_id).push(row);
}
for (const rows of byQuery.values()) rows.sort((a, b) => Number(a.rank) - Number(b.rank));

const results = [];
for (const profile of profiles) {
  const silverPerQuery = [];
  const devPerQuery = [];
  for (const [queryId, rows] of byQuery.entries()) {
    const query = queryMeta.get(queryId);
    const reranked = [...rows].sort((a, b) => scoreRow(b, queryId, profile) - scoreRow(a, queryId, profile));
    const common = { id: queryId, language: query.language, intent: query.intent, family: query.family };
    silverPerQuery.push({ ...common, ...metricsForRows(reranked, queryId, silverGrade) });
    devPerQuery.push({ ...common, ...metricsForRows(reranked, queryId, devGrade) });
  }
  results.push({
    profile,
    silver: { overall: summarize(silverPerQuery), byIntent: grouped(silverPerQuery, "intent"), perQuery: silverPerQuery },
    dev: { overall: summarize(devPerQuery), byIntent: grouped(devPerQuery, "intent"), perQuery: devPerQuery },
  });
}

const baseSilver = new Map(results[0].silver.perQuery.map(row => [row.id, row]));
const baseDev = new Map(results[0].dev.perQuery.map(row => [row.id, row]));
for (const result of results) {
  result.silver.deltaP10 = round(result.silver.overall.precision10 - results[0].silver.overall.precision10);
  result.dev.deltaP10 = round(result.dev.overall.precision10 - results[0].dev.overall.precision10);
  result.silver.direction = direction(result.silver.perQuery, baseSilver);
  result.dev.direction = direction(result.dev.perQuery, baseDev);
}

const constrainedQueries = benchmark.queries
  .map(query => ({ query, info: constraintInfo(query.id, "") }))
  .filter(item => item.info.constrained)
  .map(item => ({
    id: item.query.id,
    query: item.query.query,
    core: item.info.core,
    residual: item.info.residual,
  }));

const report = {
  schemaVersion: 1,
  note: "Ranking v2.3 development-only simulation over the frozen baseline Top-20 pool.",
  tuningPolicy: "Only targeted human judgments override silver. Random-stratified judgments remain excluded from tuning.",
  structuralRule: "Detect queries that contain an explicit philosophical area plus residual unrecognized domain terms, without a named philosopher/work/concept. In those queries, positive title/source adjustments require evidence from both the philosophical core and the residual domain constraint.",
  constrainedQueries,
  targetedHumanOverrides: targetedHuman.size,
  profiles: results,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const md = [];
md.push("# Ranking v2.3 development simulation", "", report.note, "", `> ${report.structuralRule}`, "", `> ${report.tuningPolicy}`, "");
md.push("## Structurally constrained queries detected", "");
for (const item of constrainedQueries) {
  md.push(`- **${item.id}** — ${item.query} — core=[${item.core.join(", ")}] residual=[${item.residual.join(", ")}]`);
}
md.push("", "## Overall", "");
md.push("| Profile | Silver P@10 | Δ | Targeted-human dev P@10 | Δ | Dev improved/worsened/tied | Dev interdisciplinary P@10 |");
md.push("|---|---:|---:|---:|---:|---:|---:|");
for (const result of results) {
  const d = result.dev.direction;
  const inter = result.dev.byIntent["interdisciplinary-challenge"]?.precision10 ?? null;
  md.push(`| ${result.profile.id} | ${result.silver.overall.precision10} | ${result.silver.deltaP10} | ${result.dev.overall.precision10} | ${result.dev.deltaP10} | ${d.improved}/${d.worsened}/${d.tied} | ${inter} |`);
}

md.push("", "## Targeted-human development P@10 by intent", "");
md.push("| Profile | philosopher-concept | work | interdisciplinary-challenge |");
md.push("|---|---:|---:|---:|");
for (const result of results) {
  const byIntent = result.dev.byIntent;
  md.push(`| ${result.profile.id} | ${byIntent["philosopher-concept"]?.precision10 ?? "-"} | ${byIntent.work?.precision10 ?? "-"} | ${byIntent["interdisciplinary-challenge"]?.precision10 ?? "-"} |`);
}

const critical = ["de-10", "es-10", "en-10", "fr-10", "pt-10", "de-02", "en-03", "en-04", "de-07"];
md.push("", "## Critical-query targeted-human development P@10", "");
md.push(`| Profile | ${critical.join(" | ")} |`);
md.push(`|---|${critical.map(() => "---:").join("|")}|`);
for (const result of results) {
  const map = new Map(result.dev.perQuery.map(row => [row.id, row.precision10]));
  md.push(`| ${result.profile.id} | ${critical.map(id => map.get(id) ?? "-").join(" | ")} |`);
}

md.push("", "## Caveats", "", "- Development-only; not independent validation.", "- Frozen candidate pool; cannot measure newly retrieved documents.", "- Unaudited rows remain AI-silver.", "- Random-stratified human labels are not used for tuning.", "");
fs.writeFileSync(OUT_MD, md.join("\n"), "utf8");

console.log("RANKING V2.3 DEVELOPMENT SIMULATION: PASS");
console.log(`targeted_human_overrides=${targetedHuman.size}`);
console.log(`constrained_queries=${constrainedQueries.map(item => item.id).join(",")}`);
for (const result of results) {
  const d = result.dev.direction;
  console.log(`${result.profile.id}: silver_p10=${result.silver.overall.precision10} dev_p10=${result.dev.overall.precision10} dev_delta=${result.dev.deltaP10} dev_queries=${d.improved}/${d.worsened}/${d.tied}`);
}
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);
