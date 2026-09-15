import fs from "node:fs";
import { normalizeText } from "../../src/core/parser.js";

const RUN = "benchmark/runs/human-v1.0-1064fdb.jsonl";
const JUDGMENTS = "benchmark/ai-silver-v1.jsonl";
const QUERIES = "benchmark/queries.json";
const OUT_JSON = "benchmark/ranking-simulations-v1.json";
const OUT_MD = "benchmark/ranking-simulations-v1.md";

function readJsonl(path) {
  return fs.readFileSync(path, "utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : null;
}

function tokens(text = "") {
  return normalizeText(text).split(" ").filter(Boolean);
}

function titleCoverage(query, title) {
  const q = [...new Set(tokens(query))];
  const t = new Set(tokens(title));
  if (!q.length) return 0;
  return q.filter(token => t.has(token)).length / q.length;
}

function hasProvider(row, name) {
  return (row.providers || []).includes(name);
}

function providerBonus(row, profile) {
  let bonus = 0;
  if (hasProvider(row, "CUCSH Filosofía")) bonus += profile.cucsh || 0;
  if (hasProvider(row, "Internet Archive")) bonus += profile.ia || 0;
  if (hasProvider(row, "Crossref")) bonus += profile.crossref || 0;
  if (hasProvider(row, "OpenAlex Philosophy")) bonus += profile.openalex || 0;
  return bonus;
}

const profiles = [
  {
    id: "baseline",
    description: "Frozen production order; no adjustment.",
    coverage: 0,
    cucsh: 0,
    ia: 0,
    crossref: 0,
    openalex: 0,
  },
  {
    id: "title_light",
    description: "Small title-query coverage boost only.",
    coverage: 4,
    cucsh: 0,
    ia: 0,
    crossref: 0,
    openalex: 0,
  },
  {
    id: "curated_light",
    description: "Small source prior for CUCSH and Internet Archive.",
    coverage: 0,
    cucsh: 5,
    ia: 3,
    crossref: 0,
    openalex: 0,
  },
  {
    id: "title_curated",
    description: "Title coverage plus small CUCSH/Internet Archive source prior.",
    coverage: 4,
    cucsh: 5,
    ia: 3,
    crossref: 0,
    openalex: 0,
  },
  {
    id: "cautious_crossref",
    description: "Title+curated profile and a very small Crossref penalty.",
    coverage: 4,
    cucsh: 5,
    ia: 3,
    crossref: -2,
    openalex: 0,
  },
];

const run = readJsonl(RUN);
const judgments = readJsonl(JUDGMENTS);
const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));

const judgmentMap = new Map(
  judgments.map(j => [`${j.query_id}\u0000${j.record_id}`, j])
);
const queryMeta = new Map(benchmark.queries.map(q => [q.id, q]));
const byQuery = new Map();
for (const row of run) {
  if (!byQuery.has(row.query_id)) byQuery.set(row.query_id, []);
  byQuery.get(row.query_id).push(row);
}
for (const rows of byQuery.values()) rows.sort((a, b) => a.rank - b.rank);

function dcg(grades) {
  return grades.reduce((sum, grade, index) => sum + ((2 ** grade) - 1) / Math.log2(index + 2), 0);
}

function metricsForRows(rows, queryId) {
  const top10 = rows.slice(0, 10);
  const top5 = rows.slice(0, 5);
  const grade = row => judgmentMap.get(`${queryId}\u0000${row.record_id}`)?.relevance ?? 0;
  const relevant = row => grade(row) >= 2;
  const allRelevant = rows.filter(relevant).length;
  const relevant10 = top10.filter(relevant).length;
  const firstRelevant = top10.findIndex(relevant);
  const actualGrades = top10.map(grade);
  const idealGrades = rows.map(grade).sort((a, b) => b - a).slice(0, 10);
  const idealDcg = dcg(idealGrades);
  return {
    precision5: top5.filter(relevant).length / top5.length,
    precision10: relevant10 / top10.length,
    recall10: allRelevant ? relevant10 / allRelevant : null,
    ndcg10: idealDcg ? dcg(actualGrades) / idealDcg : null,
    mrr10: firstRelevant >= 0 ? 1 / (firstRelevant + 1) : 0,
  };
}

function scoreRow(row, query, profile) {
  if (profile.id === "baseline") return -Number(row.rank);
  const base = Number(row.score || 0);
  const coverage = titleCoverage(query.query, row.title || "");
  const adjustment = coverage * profile.coverage + providerBonus(row, profile);
  return base + adjustment - Number(row.rank) * 1e-6;
}

function summarize(perQuery) {
  const keys = ["precision5", "precision10", "recall10", "ndcg10", "mrr10"];
  const out = { queries: perQuery.length };
  for (const key of keys) out[key] = round(mean(perQuery.map(x => x[key]).filter(Number.isFinite)));
  return out;
}

function grouped(perQuery, field) {
  const groups = {};
  for (const row of perQuery) {
    const key = row[field];
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  return Object.fromEntries(Object.entries(groups).map(([key, rows]) => [key, summarize(rows)]));
}

const results = [];
for (const profile of profiles) {
  const perQuery = [];
  for (const [queryId, rows] of byQuery.entries()) {
    const query = queryMeta.get(queryId);
    const reranked = [...rows].sort((a, b) => scoreRow(b, query, profile) - scoreRow(a, query, profile));
    const metrics = metricsForRows(reranked, queryId);
    perQuery.push({
      id: queryId,
      language: query.language,
      intent: query.intent,
      family: query.family,
      ...metrics,
    });
  }

  const baselineById = results[0]?.perQuery ? new Map(results[0].perQuery.map(x => [x.id, x])) : null;
  let improved = 0;
  let worsened = 0;
  if (baselineById) {
    for (const row of perQuery) {
      const base = baselineById.get(row.id);
      if (row.precision10 > base.precision10) improved++;
      if (row.precision10 < base.precision10) worsened++;
    }
  }

  results.push({
    profile,
    overall: summarize(perQuery),
    byLanguage: grouped(perQuery, "language"),
    byIntent: grouped(perQuery, "intent"),
    improvedQueriesP10: improved,
    worsenedQueriesP10: worsened,
    perQuery,
  });
}

const baseline = results[0].overall;
for (const result of results) {
  result.delta = {
    precision5: round(result.overall.precision5 - baseline.precision5),
    precision10: round(result.overall.precision10 - baseline.precision10),
    recall10: round(result.overall.recall10 - baseline.recall10),
    ndcg10: round(result.overall.ndcg10 - baseline.ndcg10),
    mrr10: round(result.overall.mrr10 - baseline.mrr10),
  };
}

const report = {
  schemaVersion: 1,
  note: "Development-only simulation over the frozen silver benchmark. It is not an independent test and must not be presented as one.",
  importantCaveat: "No profile uses abstract presence because the AI silver judge itself consumed abstracts; boosting abstract availability here would risk optimizing to judge availability rather than true relevance.",
  run: RUN,
  judgments: JUDGMENTS,
  profiles: results,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n");

const md = [];
md.push("# Ranking simulations v1", "", report.note, "", `> ${report.importantCaveat}`, "");
md.push("| Profile | P@5 | P@10 | ΔP@10 | Recall@10 | nDCG@10 | MRR@10 | P@10 improved/worsened queries |");
md.push("|---|---:|---:|---:|---:|---:|---:|---:|");
for (const result of results) {
  md.push(`| ${result.profile.id} | ${result.overall.precision5} | ${result.overall.precision10} | ${result.delta.precision10} | ${result.overall.recall10} | ${result.overall.ndcg10} | ${result.overall.mrr10} | ${result.improvedQueriesP10}/${result.worsenedQueriesP10} |`);
}
md.push("", "## Profiles", "");
for (const result of results) md.push(`- **${result.profile.id}**: ${result.profile.description}`);
md.push("", "## By language — P@10", "");
md.push("| Profile | es | en | de | fr | pt |");
md.push("|---|---:|---:|---:|---:|---:|");
for (const result of results) {
  md.push(`| ${result.profile.id} | ${result.byLanguage.es?.precision10 ?? "-"} | ${result.byLanguage.en?.precision10 ?? "-"} | ${result.byLanguage.de?.precision10 ?? "-"} | ${result.byLanguage.fr?.precision10 ?? "-"} | ${result.byLanguage.pt?.precision10 ?? "-"} |`);
}
md.push("", "## By intent — P@10", "");
md.push("| Profile | philosopher-concept | work | interdisciplinary-challenge |");
md.push("|---|---:|---:|---:|");
for (const result of results) {
  md.push(`| ${result.profile.id} | ${result.byIntent["philosopher-concept"]?.precision10 ?? "-"} | ${result.byIntent.work?.precision10 ?? "-"} | ${result.byIntent["interdisciplinary-challenge"]?.precision10 ?? "-"} |`);
}
md.push("");
fs.writeFileSync(OUT_MD, md.join("\n"));

console.log("RANKING SIMULATION: PASS");
for (const result of results) {
  console.log(`${result.profile.id}: P@10=${result.overall.precision10} delta=${result.delta.precision10} nDCG=${result.overall.ndcg10} improved=${result.improvedQueriesP10} worsened=${result.worsenedQueriesP10}`);
}
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);
