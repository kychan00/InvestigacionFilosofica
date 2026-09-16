import fs from "node:fs";
import { normalizeText } from "../../src/core/parser.js";

const RUN = "benchmark/runs/human-v1.0-1064fdb.jsonl";
const SILVER = "benchmark/ai-silver-v1.jsonl";
const QUERIES = "benchmark/queries.json";
const HUMAN = "benchmark/human-audit-v1.judgments.jsonl";
const MANIFEST = "benchmark/human-audit-v1.manifest.json";
const OUT_JSON = "benchmark/ranking-v21-development.json";
const OUT_MD = "benchmark/ranking-v21-development.md";

const STOPWORDS = new Set([
  // Spanish
  "a", "al", "de", "del", "el", "la", "las", "los", "en", "y", "o", "por", "para", "con", "sobre",
  // English
  "a", "an", "and", "of", "the", "in", "on", "for", "to", "with", "about",
  // German
  "am", "an", "auf", "bei", "das", "dem", "den", "der", "des", "die", "ein", "eine", "einer", "im", "in", "mit", "und", "von", "zu", "zur", "zum",
  // French
  "a", "au", "aux", "dans", "de", "des", "du", "en", "et", "la", "le", "les", "sur", "avec", "pour",
  // Portuguese
  "a", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "para", "por", "sobre",
]);

function readJsonl(path) {
  return fs.readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
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
  const matched = q.filter(token => t.has(token)).length;
  const required = Math.min(2, q.length);
  return {
    queryTokens: q,
    matched,
    required,
    coverage: q.length ? matched / q.length : 0,
    fullSourceSupport: required > 0 && matched >= required,
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
    id: "v21_strict_crossref",
    description: "Meaningful-token title coverage; curated priors require two meaningful query-token matches (or all tokens for a one-token query); Crossref -2 below 0.50 meaningful coverage.",
    mode: "meaningful",
    sourceMode: "strict",
    crossrefMode: "below-half",
  },
  {
    id: "v21_strict_zero_crossref",
    description: "Same strict curated-prior gate, but Crossref is penalized only when zero meaningful query tokens occur in the title.",
    mode: "meaningful",
    sourceMode: "strict",
    crossrefMode: "zero-match",
  },
  {
    id: "v21_soft_zero_crossref",
    description: "Meaningful-token coverage; curated prior is 25% with one meaningful match and 100% with two; Crossref penalty only at zero matches.",
    mode: "meaningful",
    sourceMode: "soft",
    crossrefMode: "zero-match",
  },
  {
    id: "v21_strict_no_crossref",
    description: "Strict meaningful-token curated-prior gate with no provider penalty for Crossref.",
    mode: "meaningful",
    sourceMode: "strict",
    crossrefMode: "none",
  },
];

const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const run = readJsonl(RUN);
const silverRows = readJsonl(SILVER);
const humanRows = readJsonl(HUMAN);

const queryMeta = new Map(benchmark.queries.map(query => [query.id, query]));
const silver = new Map(silverRows.map(row => [keyOf(row.query_id, row.record_id), row.relevance]));
const humanByAudit = new Map(humanRows.map(row => [row.audit_id, row]));

// Development labels deliberately use ONLY the targeted half of the human audit.
// The random-stratified half is never read into the tuning grade map.
const targetedHuman = new Map();
for (const item of manifest.items || []) {
  if (item.sample_group !== "targeted") continue;
  const judgment = humanByAudit.get(item.audit_id);
  if (!judgment) continue;
  targetedHuman.set(
    keyOf(item.query_id, item.record_id),
    Number(judgment.human_relevance)
  );
}

const byQuery = new Map();
for (const row of run) {
  if (!byQuery.has(row.query_id)) byQuery.set(row.query_id, []);
  byQuery.get(row.query_id).push(row);
}
for (const rows of byQuery.values()) rows.sort((a, b) => Number(a.rank) - Number(b.rank));

function scoreRow(row, query, profile) {
  if (profile.id === "baseline") return -Number(row.rank);

  const base = Number(row.score || 0);

  if (profile.mode === "v2-current") {
    const coverage = rawCoverage(query.query, row.title || "");
    let adjustment = coverage * 4 + curatedPrior(row);
    if (hasProvider(row, "Crossref") && coverage < 0.50) adjustment -= 2;
    return base + adjustment - Number(row.rank) * 1e-6;
  }

  const match = meaningfulMatch(query.query, row.title || "");
  let sourceFactor = 0;

  if (profile.sourceMode === "strict") {
    sourceFactor = match.fullSourceSupport ? 1 : 0;
  } else if (profile.sourceMode === "soft") {
    if (match.fullSourceSupport) sourceFactor = 1;
    else if (match.matched === 1) sourceFactor = 0.25;
  }

  let adjustment = match.coverage * 4 + curatedPrior(row) * sourceFactor;

  if (hasProvider(row, "Crossref")) {
    if (profile.crossrefMode === "below-half" && match.coverage < 0.50) adjustment -= 2;
    if (profile.crossrefMode === "zero-match" && match.matched === 0) adjustment -= 2;
  }

  return base + adjustment - Number(row.rank) * 1e-6;
}

function dcg(grades) {
  return grades.reduce(
    (sum, grade, index) => sum + ((2 ** grade) - 1) / Math.log2(index + 2),
    0
  );
}

function metricsForRows(rows, queryId, gradeMap) {
  const top10 = rows.slice(0, 10);
  const top5 = rows.slice(0, 5);
  const grade = row => gradeMap(row, queryId);
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

function targetedDevelopmentGrade(row, queryId) {
  const key = keyOf(queryId, row.record_id);
  if (targetedHuman.has(key)) return Number(targetedHuman.get(key));
  return Number(silver.get(key) ?? 0);
}

function summarize(rows) {
  const keys = ["precision5", "precision10", "recall10", "ndcg10", "mrr10"];
  const result = { queries: rows.length };
  for (const key of keys) result[key] = round(mean(rows.map(row => row[key])));
  return result;
}

function grouped(rows, field) {
  const buckets = new Map();
  for (const row of rows) {
    if (!buckets.has(row[field])) buckets.set(row[field], []);
    buckets.get(row[field]).push(row);
  }
  return Object.fromEntries(
    [...buckets.entries()].map(([key, values]) => [key, summarize(values)])
  );
}

function direction(perQuery, baselineById) {
  let improved = 0;
  let worsened = 0;
  let tied = 0;
  for (const row of perQuery) {
    const base = baselineById.get(row.id);
    if (!base) continue;
    if (row.precision10 > base.precision10) improved++;
    else if (row.precision10 < base.precision10) worsened++;
    else tied++;
  }
  return { improved, worsened, tied };
}

const results = [];
for (const profile of profiles) {
  const perQuerySilver = [];
  const perQueryTargeted = [];

  for (const [queryId, rows] of byQuery.entries()) {
    const query = queryMeta.get(queryId);
    const reranked = [...rows].sort(
      (a, b) => scoreRow(b, query, profile) - scoreRow(a, query, profile)
    );

    const common = {
      id: queryId,
      language: query.language,
      intent: query.intent,
      family: query.family,
    };

    perQuerySilver.push({
      ...common,
      ...metricsForRows(reranked, queryId, silverGrade),
    });

    perQueryTargeted.push({
      ...common,
      ...metricsForRows(reranked, queryId, targetedDevelopmentGrade),
    });
  }

  results.push({
    profile,
    silver: {
      overall: summarize(perQuerySilver),
      byIntent: grouped(perQuerySilver, "intent"),
      perQuery: perQuerySilver,
    },
    targetedDevelopment: {
      overall: summarize(perQueryTargeted),
      byIntent: grouped(perQueryTargeted, "intent"),
      perQuery: perQueryTargeted,
    },
  });
}

const baselineSilverById = new Map(results[0].silver.perQuery.map(row => [row.id, row]));
const baselineTargetedById = new Map(results[0].targetedDevelopment.perQuery.map(row => [row.id, row]));

for (const result of results) {
  result.silver.directionVsBaseline = direction(result.silver.perQuery, baselineSilverById);
  result.targetedDevelopment.directionVsBaseline = direction(
    result.targetedDevelopment.perQuery,
    baselineTargetedById
  );
  result.silver.deltaP10 = round(
    result.silver.overall.precision10 - results[0].silver.overall.precision10
  );
  result.targetedDevelopment.deltaP10 = round(
    result.targetedDevelopment.overall.precision10 -
    results[0].targetedDevelopment.overall.precision10
  );
}

const report = {
  schemaVersion: 1,
  note: "Ranking v2.1 development-only simulation over the frozen baseline Top-20 pool.",
  tuningPolicy: "Only the 50 targeted human-audit cases may override silver labels here. The 50 random-stratified human labels are intentionally excluded from the tuning grade map.",
  caveats: [
    "This is not an independent validation run.",
    "The candidate pool is frozen and cannot measure newly retrieved documents.",
    "Unaudited documents still use AI-silver labels.",
    "A real benchmark run is required after choosing a candidate formula.",
  ],
  sources: {
    run: RUN,
    silver: SILVER,
    humanAudit: HUMAN,
    manifest: MANIFEST,
  },
  targetedHumanOverrides: targetedHuman.size,
  profiles: results,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const md = [];
md.push("# Ranking v2.1 development simulation", "");
md.push(report.note, "");
md.push(`> ${report.tuningPolicy}`, "");
md.push("## Overall", "");
md.push("| Profile | Silver P@10 | Δ | Targeted-human dev P@10 | Δ | Dev improved/worsened/tied | Dev interdisciplinary P@10 |");
md.push("|---|---:|---:|---:|---:|---:|---:|");
for (const result of results) {
  const directionValue = result.targetedDevelopment.directionVsBaseline;
  const interdisciplinary = result.targetedDevelopment.byIntent["interdisciplinary-challenge"]?.precision10 ?? null;
  md.push(
    `| ${result.profile.id} | ${result.silver.overall.precision10} | ${result.silver.deltaP10} | ${result.targetedDevelopment.overall.precision10} | ${result.targetedDevelopment.deltaP10} | ${directionValue.improved}/${directionValue.worsened}/${directionValue.tied} | ${interdisciplinary} |`
  );
}

md.push("", "## Profiles", "");
for (const result of results) md.push(`- **${result.profile.id}**: ${result.profile.description}`);

md.push("", "## Targeted-human development P@10 by intent", "");
md.push("| Profile | philosopher-concept | work | interdisciplinary-challenge |");
md.push("|---|---:|---:|---:|");
for (const result of results) {
  const byIntent = result.targetedDevelopment.byIntent;
  md.push(
    `| ${result.profile.id} | ${byIntent["philosopher-concept"]?.precision10 ?? "-"} | ${byIntent.work?.precision10 ?? "-"} | ${byIntent["interdisciplinary-challenge"]?.precision10 ?? "-"} |`
  );
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

console.log("RANKING V2.1 DEVELOPMENT SIMULATION: PASS");
console.log(`targeted_human_overrides=${targetedHuman.size}`);
for (const result of results) {
  const d = result.targetedDevelopment.directionVsBaseline;
  console.log(
    `${result.profile.id}: silver_p10=${result.silver.overall.precision10} dev_p10=${result.targetedDevelopment.overall.precision10} dev_delta=${result.targetedDevelopment.deltaP10} dev_queries=${d.improved}/${d.worsened}/${d.tied}`
  );
}
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);
