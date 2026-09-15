import fs from "node:fs";
import { normalizeText } from "../../src/core/parser.js";

const RUN = "benchmark/runs/human-v1.0-1064fdb.jsonl";
const JUDGMENTS = "benchmark/ai-silver-v1.jsonl";
const QUERIES = "benchmark/queries.json";
const OUT_JSON = "benchmark/ranking-changes-v1.json";
const OUT_MD = "benchmark/ranking-changes-v1.md";

function readJsonl(path) {
  return fs.readFileSync(path, "utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
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

function cautiousScore(row, query) {
  let adjustment = titleCoverage(query.query, row.title || "") * 4;
  if (hasProvider(row, "CUCSH Filosofía")) adjustment += 5;
  if (hasProvider(row, "Internet Archive")) adjustment += 3;
  if (hasProvider(row, "Crossref")) adjustment -= 2;
  return Number(row.score || 0) + adjustment - Number(row.rank) * 1e-6;
}

const run = readJsonl(RUN);
const judgments = readJsonl(JUDGMENTS);
const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));

const queryMeta = new Map(benchmark.queries.map(q => [q.id, q]));
const judgmentMap = new Map(judgments.map(j => [`${j.query_id}\u0000${j.record_id}`, j]));
const byQuery = new Map();
for (const row of run) {
  if (!byQuery.has(row.query_id)) byQuery.set(row.query_id, []);
  byQuery.get(row.query_id).push(row);
}
for (const rows of byQuery.values()) rows.sort((a, b) => Number(a.rank) - Number(b.rank));

function rel(queryId, row) {
  return judgmentMap.get(`${queryId}\u0000${row.record_id}`)?.relevance ?? null;
}

function p10(queryId, rows) {
  return rows.slice(0, 10).filter(row => (rel(queryId, row) ?? 0) >= 2).length / 10;
}

function summarizeRow(query, row, adjustedRank, baselineRank) {
  return {
    record_id: row.record_id,
    title: row.title,
    providers: row.providers || [],
    relevance: rel(query.id, row),
    discipline: judgmentMap.get(`${query.id}\u0000${row.record_id}`)?.discipline ?? null,
    baseline_rank: baselineRank,
    adjusted_rank: adjustedRank,
    base_score: Number(row.score || 0),
    title_coverage: Number(titleCoverage(query.query, row.title || "").toFixed(4)),
    cautious_score: Number(cautiousScore(row, query).toFixed(4)),
  };
}

const changes = [];
for (const [queryId, rows] of byQuery.entries()) {
  const query = queryMeta.get(queryId);
  const baseline = [...rows];
  const adjusted = [...rows].sort((a, b) => cautiousScore(b, query) - cautiousScore(a, query));
  const baseP10 = p10(queryId, baseline);
  const nextP10 = p10(queryId, adjusted);
  const delta = Number((nextP10 - baseP10).toFixed(3));
  if (delta === 0) continue;

  const baselineTop = baseline.slice(0, 10);
  const adjustedTop = adjusted.slice(0, 10);
  const baselineIds = new Set(baselineTop.map(x => x.record_id));
  const adjustedIds = new Set(adjustedTop.map(x => x.record_id));

  const outgoing = baselineTop
    .filter(row => !adjustedIds.has(row.record_id))
    .map(row => summarizeRow(
      query,
      row,
      adjusted.findIndex(x => x.record_id === row.record_id) + 1,
      baseline.findIndex(x => x.record_id === row.record_id) + 1,
    ));

  const incoming = adjustedTop
    .filter(row => !baselineIds.has(row.record_id))
    .map(row => summarizeRow(
      query,
      row,
      adjusted.findIndex(x => x.record_id === row.record_id) + 1,
      baseline.findIndex(x => x.record_id === row.record_id) + 1,
    ));

  changes.push({
    id: queryId,
    query: query.query,
    language: query.language,
    intent: query.intent,
    family: query.family,
    baseline_p10: baseP10,
    cautious_p10: nextP10,
    delta,
    outgoing,
    incoming,
  });
}

changes.sort((a, b) => a.delta - b.delta || a.id.localeCompare(b.id));

const report = {
  schemaVersion: 1,
  profile: "cautious_crossref",
  policy: {
    titleCoverageWeight: 4,
    providerAdjustments: {
      "CUCSH Filosofía": 5,
      "Internet Archive": 3,
      Crossref: -2,
      "OpenAlex Philosophy": 0,
    },
  },
  changedQueries: changes.length,
  regressions: changes.filter(x => x.delta < 0).length,
  improvements: changes.filter(x => x.delta > 0).length,
  changes,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n");

const md = [];
md.push("# Ranking changes v1 — cautious_crossref", "");
md.push("Diagnostic comparison of frozen production order vs. the cautious_crossref simulation.", "");
md.push(`- Changed queries: ${report.changedQueries}`);
md.push(`- Improvements: ${report.improvements}`);
md.push(`- Regressions: ${report.regressions}`, "");

for (const change of changes) {
  md.push(`## ${change.id} — ${change.query}`);
  md.push("");
  md.push(`- ${change.language} · ${change.intent} · ${change.family}`);
  md.push(`- P@10: ${change.baseline_p10} → ${change.cautious_p10} (${change.delta > 0 ? "+" : ""}${change.delta})`, "");
  md.push("### Leaves Top 10", "");
  if (!change.outgoing.length) md.push("- none");
  for (const row of change.outgoing) {
    md.push(`- r${row.baseline_rank} → r${row.adjusted_rank} · rel=${row.relevance} · providers=${row.providers.join(", ")} · coverage=${row.title_coverage} · ${row.title}`);
  }
  md.push("", "### Enters Top 10", "");
  if (!change.incoming.length) md.push("- none");
  for (const row of change.incoming) {
    md.push(`- r${row.baseline_rank} → r${row.adjusted_rank} · rel=${row.relevance} · providers=${row.providers.join(", ")} · coverage=${row.title_coverage} · ${row.title}`);
  }
  md.push("");
}

fs.writeFileSync(OUT_MD, md.join("\n") + "\n");

console.log("RANKING CHANGE INSPECTION: PASS");
console.log(`changed_queries=${report.changedQueries}`);
console.log(`improvements=${report.improvements}`);
console.log(`regressions=${report.regressions}`);
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);
