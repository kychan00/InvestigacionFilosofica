import fs from "node:fs";

const OLD_RUN = "benchmark/runs/human-v1.0-ranking-v2-e6ad110.jsonl";
const NEW_RUN = "benchmark/runs/human-v1.0-interdisciplinary-expansionfix-cfb853a.jsonl";
const QUERIES = "benchmark/queries.json";
const PRIOR_HUMAN = "benchmark/human-audit-v1.judgments.jsonl";
const DELTA_SAMPLE = "benchmark/interdisciplinary-delta-audit-v1.sample.jsonl";
const DELTA_MANIFEST = "benchmark/interdisciplinary-delta-audit-v1.manifest.json";
const DELTA_JUDGMENTS = "benchmark/interdisciplinary-delta-audit-v1.judgments.jsonl";
const OUT_JSON = "benchmark/interdisciplinary-delta-audit-v1.report.json";
const OUT_MD = "benchmark/interdisciplinary-delta-audit-v1.report.md";

function readJsonl(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);
  return fs.readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1}: ${error.message}`);
      }
    });
}

function key(queryId, recordId) {
  return `${queryId}\u0000${recordId}`;
}

function rowsFor(run, queryId) {
  return run
    .filter(row => row.query_id === queryId && Number(row.rank) <= 10)
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}

function escapeMd(value = "") {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const oldRun = readJsonl(OLD_RUN);
const newRun = readJsonl(NEW_RUN);
const priorHuman = readJsonl(PRIOR_HUMAN);
const deltaSample = readJsonl(DELTA_SAMPLE);
const manifest = JSON.parse(fs.readFileSync(DELTA_MANIFEST, "utf8"));
const deltaJudgments = readJsonl(DELTA_JUDGMENTS);

if (deltaJudgments.length !== manifest.auditRows) {
  throw new Error(`Expected ${manifest.auditRows} delta judgments, found ${deltaJudgments.length}`);
}

const queryMeta = new Map(benchmark.queries.map(query => [query.id, query]));
const queryIds = benchmark.queries
  .filter(query => query.intent === "interdisciplinary-challenge")
  .map(query => query.id);

const priorMap = new Map(priorHuman.map(row => [key(row.query_id, row.record_id), row]));
const deltaMap = new Map(deltaJudgments.map(row => [key(row.query_id, row.record_id), row]));
const sampleMap = new Map(deltaSample.map(row => [key(row.query_id, row.record_id), row]));
const manifestMap = new Map();
for (const item of manifest.items || []) manifestMap.set(key(item.query_id, item.record_id), item);
for (const item of manifest.alreadyHuman || []) manifestMap.set(key(item.query_id, item.record_id), item);

function judgment(queryId, recordId) {
  const k = key(queryId, recordId);
  const delta = deltaMap.get(k);
  if (delta) {
    return {
      relevance: Number(delta.human_relevance),
      note: String(delta.human_note || ""),
      source: "delta-audit",
    };
  }
  const prior = priorMap.get(k);
  if (prior) {
    return {
      relevance: Number(prior.human_relevance),
      note: String(prior.human_note || ""),
      source: "human-audit-v1",
    };
  }
  return null;
}

const relevantThreshold = Number(benchmark.evaluation?.relevantThreshold ?? 2);
const perQuery = [];
const changedRows = [];
let totalOldRelevant = 0;
let totalNewRelevant = 0;
let totalOldOrdinal = 0;
let totalNewOrdinal = 0;
let improved = 0;
let worsened = 0;
let tied = 0;

for (const queryId of queryIds) {
  const query = queryMeta.get(queryId);
  const old10 = rowsFor(oldRun, queryId);
  const new10 = rowsFor(newRun, queryId);
  const oldMap = new Map(old10.map(row => [row.record_id, row]));
  const newMap = new Map(new10.map(row => [row.record_id, row]));
  const oldOnly = old10.filter(row => !newMap.has(row.record_id));
  const newOnly = new10.filter(row => !oldMap.has(row.record_id));

  if (oldOnly.length !== newOnly.length) {
    throw new Error(`${queryId}: asymmetric Top-10 delta ${oldOnly.length} vs ${newOnly.length}`);
  }

  const decorate = (row, side) => {
    const human = judgment(queryId, row.record_id);
    if (!human) throw new Error(`Missing human judgment for changed pair ${queryId} ${row.record_id}`);
    const manifestItem = manifestMap.get(key(queryId, row.record_id));
    const sample = sampleMap.get(key(queryId, row.record_id));
    const item = {
      query_id: queryId,
      query: query.query,
      side,
      rank: Number(row.rank),
      record_id: row.record_id,
      title: row.title || sample?.title || "",
      providers: row.providers || [],
      human_relevance: human.relevance,
      human_note: human.note,
      judgment_source: human.source,
      audit_id: sample?.audit_id || manifestItem?.audit_id || null,
    };
    changedRows.push(item);
    return item;
  };

  const oldChanged = oldOnly.map(row => decorate(row, "old-only"));
  const newChanged = newOnly.map(row => decorate(row, "new-only"));

  const oldRelevant = oldChanged.filter(row => row.human_relevance >= relevantThreshold).length;
  const newRelevant = newChanged.filter(row => row.human_relevance >= relevantThreshold).length;
  const oldOrdinal = oldChanged.reduce((sum, row) => sum + row.human_relevance, 0);
  const newOrdinal = newChanged.reduce((sum, row) => sum + row.human_relevance, 0);
  const deltaRelevant = newRelevant - oldRelevant;
  const deltaP10 = deltaRelevant / 10;

  totalOldRelevant += oldRelevant;
  totalNewRelevant += newRelevant;
  totalOldOrdinal += oldOrdinal;
  totalNewOrdinal += newOrdinal;

  if (deltaRelevant > 0) improved++;
  else if (deltaRelevant < 0) worsened++;
  else tied++;

  perQuery.push({
    query_id: queryId,
    query: query.query,
    language: query.language,
    family: query.family,
    changed_per_side: oldOnly.length,
    old_only_relevant: oldRelevant,
    new_only_relevant: newRelevant,
    delta_relevant: deltaRelevant,
    paired_delta_p10: Number(deltaP10.toFixed(4)),
    old_only_ordinal_sum: oldOrdinal,
    new_only_ordinal_sum: newOrdinal,
    delta_ordinal_sum: newOrdinal - oldOrdinal,
  });
}

const totalPositions = queryIds.length * 10;
const pairedDeltaP10 = (totalNewRelevant - totalOldRelevant) / totalPositions;
const report = {
  schemaVersion: 1,
  name: "Interdisciplinary expansion-fix paired human delta report",
  relevantThreshold,
  methodology: "Exact paired change in human P@10. Shared Top-10 rows cancel; only the symmetric difference is judged. This report does not claim absolute human P@10 because not every shared Top-10 row has a human label.",
  sources: {
    oldRun: OLD_RUN,
    newRun: NEW_RUN,
    priorHuman: PRIOR_HUMAN,
    deltaManifest: DELTA_MANIFEST,
    deltaJudgments: DELTA_JUDGMENTS,
  },
  summary: {
    queries: queryIds.length,
    changedTop10Pairs: changedRows.length,
    newlyJudgedDeltaPairs: deltaJudgments.length,
    priorHumanReused: changedRows.filter(row => row.judgment_source === "human-audit-v1").length,
    commentsOnNewDeltaJudgments: deltaJudgments.filter(row => String(row.human_note || "").trim()).length,
    oldOnlyRelevant: totalOldRelevant,
    newOnlyRelevant: totalNewRelevant,
    netRelevantTop10Positions: totalNewRelevant - totalOldRelevant,
    pairedDeltaP10: Number(pairedDeltaP10.toFixed(4)),
    oldOnlyOrdinalSum: totalOldOrdinal,
    newOnlyOrdinalSum: totalNewOrdinal,
    deltaOrdinalSum: totalNewOrdinal - totalOldOrdinal,
    improvedQueries: improved,
    worsenedQueries: worsened,
    tiedQueries: tied,
  },
  perQuery,
  changedRows,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const md = [];
md.push("# Interdisciplinary expansion-fix paired human delta", "");
md.push(report.methodology, "");
md.push("## Summary", "");
md.push(`- queries: ${report.summary.queries}`);
md.push(`- changed Top-10 pairs judged/reused: ${report.summary.changedTop10Pairs}`);
md.push(`- newly judged in delta audit: ${report.summary.newlyJudgedDeltaPairs}`);
md.push(`- prior human judgments reused: ${report.summary.priorHumanReused}`);
md.push(`- delta-audit judgments with comments: ${report.summary.commentsOnNewDeltaJudgments}/${report.summary.newlyJudgedDeltaPairs}`);
md.push(`- relevant old-only positions: ${report.summary.oldOnlyRelevant}`);
md.push(`- relevant new-only positions: ${report.summary.newOnlyRelevant}`);
md.push(`- net relevant Top-10 positions: ${report.summary.netRelevantTop10Positions >= 0 ? "+" : ""}${report.summary.netRelevantTop10Positions}`);
md.push(`- exact paired human ΔP@10: ${report.summary.pairedDeltaP10 >= 0 ? "+" : ""}${report.summary.pairedDeltaP10}`);
md.push(`- ordinal relevance sum old-only → new-only: ${report.summary.oldOnlyOrdinalSum} → ${report.summary.newOnlyOrdinalSum} (Δ ${report.summary.deltaOrdinalSum >= 0 ? "+" : ""}${report.summary.deltaOrdinalSum})`);
md.push(`- queries improved/worsened/tied by binary P@10 delta: ${improved}/${worsened}/${tied}`, "");

md.push("## Per query", "");
md.push("| Query | Changed/side | Old relevant | New relevant | Δ relevant | paired ΔP@10 | ordinal Δ |");
md.push("|---|---:|---:|---:|---:|---:|---:|");
for (const item of perQuery) {
  md.push(`| ${item.query_id} · ${escapeMd(item.query)} | ${item.changed_per_side} | ${item.old_only_relevant} | ${item.new_only_relevant} | ${item.delta_relevant >= 0 ? "+" : ""}${item.delta_relevant} | ${item.paired_delta_p10 >= 0 ? "+" : ""}${item.paired_delta_p10} | ${item.delta_ordinal_sum >= 0 ? "+" : ""}${item.delta_ordinal_sum} |`);
}

md.push("", "## Human comments on changed documents", "");
md.push("Side is revealed here only after the blind audit was finalized.", "");
for (const queryId of queryIds) {
  const rows = changedRows.filter(row => row.query_id === queryId);
  if (!rows.length) continue;
  md.push(`### ${queryId} — ${queryMeta.get(queryId).query}`, "");
  md.push("| side | rank | rel | source | title | comment |");
  md.push("|---|---:|---:|---|---|---|");
  for (const row of rows.sort((a, b) => a.side.localeCompare(b.side) || a.rank - b.rank)) {
    md.push(`| ${row.side} | ${row.rank} | ${row.human_relevance} | ${row.judgment_source} | ${escapeMd(row.title)} | ${escapeMd(row.human_note || "—")} |`);
  }
  md.push("");
}

md.push("## Interpretation boundary", "");
md.push("The paired ΔP@10 is exact for the old-vs-new Top-10 difference because shared rows cancel. Absolute human P@10 for either full Top 10 is still unavailable unless every shared row is also human-judged.", "");

fs.writeFileSync(OUT_MD, md.join("\n") + "\n", "utf8");

console.log("INTERDISCIPLINARY DELTA HUMAN ANALYSIS: PASS");
console.log(`changed_pairs=${report.summary.changedTop10Pairs}`);
console.log(`newly_judged=${report.summary.newlyJudgedDeltaPairs}`);
console.log(`prior_human_reused=${report.summary.priorHumanReused}`);
console.log(`comments=${report.summary.commentsOnNewDeltaJudgments}/${report.summary.newlyJudgedDeltaPairs}`);
console.log(`old_only_relevant=${report.summary.oldOnlyRelevant}`);
console.log(`new_only_relevant=${report.summary.newOnlyRelevant}`);
console.log(`net_relevant=${report.summary.netRelevantTop10Positions}`);
console.log(`paired_delta_p10=${report.summary.pairedDeltaP10}`);
console.log(`queries=${improved}/${worsened}/${tied}`);
for (const item of perQuery) {
  console.log(`${item.query_id}: delta_relevant=${item.delta_relevant} delta_p10=${item.paired_delta_p10}`);
}
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);
