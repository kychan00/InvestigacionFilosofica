import fs from "node:fs";
import { normalizeText } from "../../src/core/parser.js";

const RUN = "benchmark/runs/human-v1.0-1064fdb.jsonl";
const SILVER = "benchmark/ai-silver-v1.jsonl";
const HUMAN = "benchmark/human-audit-v1.judgments.jsonl";
const MANIFEST = "benchmark/human-audit-v1.manifest.json";
const QUERIES = "benchmark/queries.json";
const OUT_JSON = "benchmark/ranking-v21-changes.json";
const OUT_MD = "benchmark/ranking-v21-changes.md";

const STOPWORDS = new Set([
  "a","al","de","del","el","la","las","los","en","y","o","por","para","con","sobre",
  "an","and","of","the","in","on","for","to","with","about",
  "am","an","auf","bei","das","dem","den","der","des","die","ein","eine","einer","im","mit","und","von","zu","zur","zum",
  "au","aux","dans","des","du","et","le","les","sur","avec","pour",
  "as","com","da","das","do","dos","e","em","na","nas","no","nos","os",
]);

function readJsonl(path) {
  return fs.readFileSync(path, "utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}
function keyOf(q, r) { return `${q}\u0000${r}`; }
function tokens(text = "") { return normalizeText(text).split(" ").filter(Boolean); }
function meaningfulTokens(text = "") { return [...new Set(tokens(text).filter(t => !STOPWORDS.has(t)))]; }
function rawCoverage(query, title) {
  const q = [...new Set(tokens(query))];
  const t = new Set(tokens(title));
  return q.length ? q.filter(x => t.has(x)).length / q.length : 0;
}
function meaningfulMatch(query, title) {
  const q = meaningfulTokens(query);
  const t = new Set(meaningfulTokens(title));
  const matchedTokens = q.filter(x => t.has(x));
  return {
    queryTokens: q,
    matchedTokens,
    matched: matchedTokens.length,
    coverage: q.length ? matchedTokens.length / q.length : 0,
    fullSourceSupport: q.length > 0 && matchedTokens.length >= Math.min(2, q.length),
  };
}
function hasProvider(row, name) { return (row.providers || []).includes(name); }
function curatedPrior(row) {
  let prior = 0;
  if (hasProvider(row, "CUCSH Filosofía")) prior += 5;
  if (hasProvider(row, "Internet Archive")) prior += 3;
  return prior;
}
function adjustments(row, query) {
  const raw = rawCoverage(query.query, row.title || "");
  const mm = meaningfulMatch(query.query, row.title || "");

  let v2 = raw * 4 + curatedPrior(row);
  if (hasProvider(row, "Crossref") && raw < 0.5) v2 -= 2;

  let factor = 0;
  if (mm.fullSourceSupport) factor = 1;
  else if (mm.matched === 1) factor = 0.25;
  let soft = mm.coverage * 4 + curatedPrior(row) * factor;
  if (hasProvider(row, "Crossref") && mm.matched === 0) soft -= 2;

  return { rawCoverage: raw, meaningful: mm, v2, soft };
}
function score(row, query, profile) {
  if (profile === "baseline") return -Number(row.rank);
  const a = adjustments(row, query);
  const adj = profile === "v2_current" ? a.v2 : a.soft;
  return Number(row.score || 0) + adj - Number(row.rank) * 1e-6;
}

const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const queryMeta = new Map(benchmark.queries.map(q => [q.id, q]));
const run = readJsonl(RUN);
const silver = new Map(readJsonl(SILVER).map(r => [keyOf(r.query_id, r.record_id), Number(r.relevance)]));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const humanByAudit = new Map(readJsonl(HUMAN).map(r => [r.audit_id, r]));
const targeted = new Map();
for (const item of manifest.items || []) {
  if (item.sample_group !== "targeted") continue;
  const h = humanByAudit.get(item.audit_id);
  if (h) targeted.set(keyOf(item.query_id, item.record_id), Number(h.human_relevance));
}
function devGrade(row) {
  const k = keyOf(row.query_id, row.record_id);
  return targeted.has(k) ? targeted.get(k) : (silver.get(k) ?? 0);
}

const byQuery = new Map();
for (const row of run) {
  if (!byQuery.has(row.query_id)) byQuery.set(row.query_id, []);
  byQuery.get(row.query_id).push(row);
}
for (const rows of byQuery.values()) rows.sort((a,b) => Number(a.rank) - Number(b.rank));

const profiles = ["baseline", "v2_current", "v21_soft_zero_crossref"];
const critical = ["de-10","es-10","en-10","fr-10","pt-10","en-04","de-02","en-03","de-07"];
const report = { schemaVersion: 1, queries: [] };

for (const queryId of critical) {
  const rows = byQuery.get(queryId) || [];
  const query = queryMeta.get(queryId);
  const ranked = Object.fromEntries(profiles.map(p => [
    p,
    [...rows].sort((a,b) => score(b, query, p) - score(a, query, p))
  ]));

  const profileRows = {};
  for (const p of profiles) {
    profileRows[p] = ranked[p].slice(0, 10).map((row, i) => {
      const a = adjustments(row, query);
      return {
        rank: i + 1,
        originalRank: Number(row.rank),
        record_id: row.record_id,
        title: row.title || "",
        providers: row.providers || [],
        devRelevance: devGrade(row),
        baseScore: Number(row.score || 0),
        adjustment: p === "baseline" ? 0 : (p === "v2_current" ? a.v2 : a.soft),
        queryTokens: a.meaningful.queryTokens,
        matchedTokens: a.meaningful.matchedTokens,
        meaningfulCoverage: Number(a.meaningful.coverage.toFixed(4)),
      };
    });
  }

  report.queries.push({
    query_id: queryId,
    query: query.query,
    intent: query.intent,
    profiles: profileRows,
  });
}

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const md = [];
md.push("# Ranking v2.1 critical-query inspection", "");
md.push("Development diagnostic using only targeted human overrides; all other grades remain AI-silver.", "");
for (const q of report.queries) {
  md.push(`## ${q.query_id} — ${q.query}`, "");
  for (const p of profiles) {
    const relevant = q.profiles[p].filter(x => x.devRelevance >= 2).length;
    md.push(`### ${p} — dev P@10 ${relevant / 10}`, "");
    md.push("| # | orig | rel | adj | match | providers | title |", "|---:|---:|---:|---:|---|---|---|");
    for (const row of q.profiles[p]) {
      const match = `${row.matchedTokens.join(",") || "—"} (${row.meaningfulCoverage})`;
      md.push(`| ${row.rank} | ${row.originalRank} | ${row.devRelevance} | ${row.adjustment.toFixed(2)} | ${match} | ${row.providers.join(" + ")} | ${String(row.title).replace(/\|/g, "\\|")} |`);
    }
    md.push("");
  }
}
fs.writeFileSync(OUT_MD, md.join("\n") + "\n", "utf8");

console.log("RANKING V2.1 CHANGE INSPECTION: PASS");
console.log(`queries=${report.queries.length}`);
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);
