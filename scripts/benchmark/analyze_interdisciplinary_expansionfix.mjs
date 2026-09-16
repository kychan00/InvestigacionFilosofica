import fs from "node:fs";

const OLD_RUN = "benchmark/runs/human-v1.0-ranking-v2-e6ad110.jsonl";
const NEW_RUN = "benchmark/runs/human-v1.0-interdisciplinary-expansionfix-cfb853a.jsonl";
const HUMAN = "benchmark/human-audit-v1.judgments.jsonl";
const QUERIES = "benchmark/queries.json";
const OUT_JSON = "benchmark/interdisciplinary-expansionfix-analysis.json";
const OUT_MD = "benchmark/interdisciplinary-expansionfix-analysis.md";

function readJsonl(path) {
  return fs.readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
}

function key(queryId, recordId) {
  return `${queryId}\u0000${recordId}`;
}

function rowsFor(run, queryId, depth) {
  return run
    .filter(row => row.query_id === queryId && Number(row.rank) <= depth)
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}

function humanLabel(humanMap, queryId, recordId) {
  const row = humanMap.get(key(queryId, recordId));
  return row ? Number(row.human_relevance) : null;
}

function provenance(row) {
  const items = row.matchedQueries || [];
  if (!items.length) return "—";
  return items
    .map(item => {
      const type = item.type ? `:${item.type}` : "";
      const weight = Number.isFinite(Number(item.weight)) ? `@${Number(item.weight).toFixed(2)}` : "";
      return `${item.query}${type}${weight}`;
    })
    .join(" | ");
}

function compactProviders(row) {
  return (row.providers || []).join(" + ") || "—";
}

const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const oldRun = readJsonl(OLD_RUN);
const newRun = readJsonl(NEW_RUN);
const humanRows = readJsonl(HUMAN);
const humanMap = new Map(humanRows.map(row => [key(row.query_id, row.record_id), row]));
const queryMeta = new Map(benchmark.queries.map(query => [query.id, query]));

const queryIds = benchmark.queries
  .filter(query => query.intent === "interdisciplinary-challenge")
  .map(query => query.id);

const perQuery = [];
let top10SharedPairs = 0;
let top10UnionPairs = 0;
let top10HumanJudgedPairs = 0;
let top20SharedPairs = 0;
let top20UnionPairs = 0;
const unresolvedUnionPairs = [];

for (const queryId of queryIds) {
  const query = queryMeta.get(queryId);
  const old10 = rowsFor(oldRun, queryId, 10);
  const new10 = rowsFor(newRun, queryId, 10);
  const old20 = rowsFor(oldRun, queryId, 20);
  const new20 = rowsFor(newRun, queryId, 20);

  const old10Map = new Map(old10.map(row => [row.record_id, row]));
  const new10Map = new Map(new10.map(row => [row.record_id, row]));
  const old20Ids = new Set(old20.map(row => row.record_id));
  const new20Ids = new Set(new20.map(row => row.record_id));

  const shared10Ids = [...old10Map.keys()].filter(id => new10Map.has(id));
  const union10Ids = [...new Set([...old10Map.keys(), ...new10Map.keys()])];
  const shared20Ids = [...old20Ids].filter(id => new20Ids.has(id));
  const union20Ids = [...new Set([...old20Ids, ...new20Ids])];

  top10SharedPairs += shared10Ids.length;
  top10UnionPairs += union10Ids.length;
  top20SharedPairs += shared20Ids.length;
  top20UnionPairs += union20Ids.length;

  let humanJudged = 0;
  for (const recordId of union10Ids) {
    const label = humanLabel(humanMap, queryId, recordId);
    if (label == null) {
      const row = new10Map.get(recordId) || old10Map.get(recordId);
      unresolvedUnionPairs.push({
        query_id: queryId,
        query: query.query,
        record_id: recordId,
        title: row?.title || "",
        providers: row?.providers || [],
        old_rank: old10Map.get(recordId)?.rank ?? null,
        new_rank: new10Map.get(recordId)?.rank ?? null,
      });
    } else {
      humanJudged++;
      top10HumanJudgedPairs++;
    }
  }

  const newOnly = new10
    .filter(row => !old10Map.has(row.record_id))
    .map(row => ({
      rank: row.rank,
      record_id: row.record_id,
      title: row.title || "",
      providers: row.providers || [],
      human_relevance: humanLabel(humanMap, queryId, row.record_id),
      matchedQueries: row.matchedQueries || [],
    }));

  const oldOnly = old10
    .filter(row => !new10Map.has(row.record_id))
    .map(row => ({
      rank: row.rank,
      record_id: row.record_id,
      title: row.title || "",
      providers: row.providers || [],
      human_relevance: humanLabel(humanMap, queryId, row.record_id),
    }));

  perQuery.push({
    id: queryId,
    query: query.query,
    language: query.language,
    family: query.family,
    overlapTop10: shared10Ids.length,
    unionTop10: union10Ids.length,
    overlapTop20: shared20Ids.length,
    unionTop20: union20Ids.length,
    alreadyHumanJudgedTop10Union: humanJudged,
    unresolvedTop10Union: union10Ids.length - humanJudged,
    newTop10: new10.map(row => ({
      rank: row.rank,
      record_id: row.record_id,
      title: row.title || "",
      providers: row.providers || [],
      score: row.score ?? null,
      human_relevance: humanLabel(humanMap, queryId, row.record_id),
      matchedQueries: row.matchedQueries || [],
      status: old10Map.has(row.record_id) ? "shared" : "new-only",
      old_rank: old10Map.get(row.record_id)?.rank ?? null,
    })),
    newOnly,
    oldOnly,
  });
}

const report = {
  schemaVersion: 1,
  note: "Structural comparison of the frozen Ranking v2 interdisciplinary Top-10/Top-20 against the real expansion-fix run. It does not infer relevance for unseen documents.",
  importantCaveat: "A new human judgment is required for any union Top-10 query-document pair not already covered by human-audit-v1 before reporting a human P@10 comparison.",
  sources: {
    oldRun: OLD_RUN,
    newRun: NEW_RUN,
    humanAudit: HUMAN,
  },
  summary: {
    queries: queryIds.length,
    top10SharedPairs,
    top10UnionPairs,
    meanTop10Overlap: Number((top10SharedPairs / queryIds.length).toFixed(2)),
    top10HumanJudgedPairs,
    top10UnresolvedPairs: unresolvedUnionPairs.length,
    top20SharedPairs,
    top20UnionPairs,
    meanTop20Overlap: Number((top20SharedPairs / queryIds.length).toFixed(2)),
  },
  unresolvedUnionPairs,
  perQuery,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const md = [];
md.push("# Interdisciplinary expansion-fix analysis", "");
md.push(report.note, "");
md.push(`> ${report.importantCaveat}`, "");
md.push("## Summary", "");
md.push(`- queries: ${report.summary.queries}`);
md.push(`- Top-10 shared query-document pairs: ${report.summary.top10SharedPairs}`);
md.push(`- Top-10 union query-document pairs: ${report.summary.top10UnionPairs}`);
md.push(`- mean Top-10 overlap per query: ${report.summary.meanTop10Overlap}/10`);
md.push(`- Top-10 union pairs already judged by human-audit-v1: ${report.summary.top10HumanJudgedPairs}`);
md.push(`- Top-10 union pairs still needing human judgment: ${report.summary.top10UnresolvedPairs}`);
md.push(`- Top-20 shared query-document pairs: ${report.summary.top20SharedPairs}`);
md.push(`- Top-20 union query-document pairs: ${report.summary.top20UnionPairs}`);
md.push(`- mean Top-20 overlap per query: ${report.summary.meanTop20Overlap}/20`, "");

for (const item of perQuery) {
  md.push(`## ${item.id} — ${item.query}`, "");
  md.push(`Top-10 overlap: **${item.overlapTop10}/10** · union=${item.unionTop10} · already-human=${item.alreadyHumanJudgedTop10Union} · unresolved=${item.unresolvedTop10Union}`);
  md.push(`Top-20 overlap: **${item.overlapTop20}/20** · union=${item.unionTop20}`, "");
  md.push("### New run Top 10", "");
  md.push("| new | old | status | human | providers | matchedQueries | title |");
  md.push("|---:|---:|---|---:|---|---|---|");
  for (const row of item.newTop10) {
    const human = row.human_relevance == null ? "?" : row.human_relevance;
    const oldRank = row.old_rank == null ? "—" : row.old_rank;
    md.push(`| ${row.rank} | ${oldRank} | ${row.status} | ${human} | ${compactProviders(row)} | ${provenance(row)} | ${row.title.replace(/\|/g, "\\|")} |`);
  }

  md.push("", "### Left old Top 10", "");
  if (!item.oldOnly.length) {
    md.push("- none");
  } else {
    for (const row of item.oldOnly) {
      const human = row.human_relevance == null ? "?" : row.human_relevance;
      md.push(`- old r${row.rank} · human=${human} · ${compactProviders(row)} · ${row.title}`);
    }
  }
  md.push("");
}

md.push("## Audit requirement", "");
md.push(`There are **${unresolvedUnionPairs.length}** unresolved query-document pairs in the union of old/new Top 10. A blind audit of those pairs, reusing the existing human labels for the remainder, is sufficient to compute a direct human P@10 comparison for all 10 queries.`, "");

fs.writeFileSync(OUT_MD, md.join("\n") + "\n", "utf8");

console.log("INTERDISCIPLINARY EXPANSION-FIX ANALYSIS: PASS");
console.log(`queries=${report.summary.queries}`);
console.log(`top10_overlap_mean=${report.summary.meanTop10Overlap}/10`);
console.log(`top10_union_pairs=${report.summary.top10UnionPairs}`);
console.log(`already_human=${report.summary.top10HumanJudgedPairs}`);
console.log(`needs_human=${report.summary.top10UnresolvedPairs}`);
for (const item of perQuery) {
  console.log(`${item.id}: overlap10=${item.overlapTop10}/10 unresolved=${item.unresolvedTop10Union}`);
}
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);
