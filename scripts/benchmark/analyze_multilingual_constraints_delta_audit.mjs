import fs from "node:fs";

const OLD_RUN = "benchmark/runs/human-v1.0-interdisciplinary-expansionfix-cfb853a.jsonl";
const NEW_RUN = "benchmark/runs/human-v1.0-interdisciplinary-multilingual-f02f02f.jsonl";
const QUERIES = "benchmark/queries.json";
const PRIOR_HUMAN = [
  "benchmark/human-audit-v1.judgments.jsonl",
  "benchmark/interdisciplinary-delta-audit-v1.judgments.jsonl"
];
const SAMPLE = "benchmark/multilingual-constraints-delta-audit-v1.sample.jsonl";
const MANIFEST = "benchmark/multilingual-constraints-delta-audit-v1.manifest.json";
const JUDGMENTS = "benchmark/multilingual-constraints-delta-audit-v1.judgments.jsonl";
const OUT_JSON = "benchmark/multilingual-constraints-delta-audit-v1.report.json";
const OUT_MD = "benchmark/multilingual-constraints-delta-audit-v1.report.md";

function readJsonl(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);
  return fs.readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { throw new Error(`${path}:${index + 1}: ${error.message}`); }
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

function md(value = "") {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function translationMode(row) {
  const matches = row?.matchedQueries || [];
  const original = matches.some(item => item.type === "original");
  const translation = matches.some(item => item.type === "translation");
  if (original && translation) return "original+translation";
  if (translation) return "translation-only";
  if (original) return "original-only";
  return "other";
}

function buildHumanMap(paths, deltaRows) {
  const map = new Map();
  function add(row, source) {
    const k = key(row.query_id, row.record_id);
    const relevance = Number(row.human_relevance);
    if (map.has(k) && map.get(k).relevance !== relevance) {
      throw new Error(`Conflicting human labels for ${row.query_id} / ${row.record_id}`);
    }
    if (!map.has(k)) {
      map.set(k, {
        relevance,
        note: String(row.human_note || ""),
        sources: [source],
      });
    } else {
      const current = map.get(k);
      current.sources.push(source);
      if (!current.note && row.human_note) current.note = String(row.human_note);
    }
  }
  for (const path of paths) for (const row of readJsonl(path)) add(row, path);
  for (const row of deltaRows) add(row, "multilingual-constraints-delta-audit-v1");
  return map;
}

const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const oldRun = readJsonl(OLD_RUN);
const newRun = readJsonl(NEW_RUN);
const sample = readJsonl(SAMPLE);
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const deltaJudgments = readJsonl(JUDGMENTS);

if (deltaJudgments.length !== manifest.auditRows) {
  throw new Error(`Expected ${manifest.auditRows} new judgments, found ${deltaJudgments.length}`);
}

const humanMap = buildHumanMap(PRIOR_HUMAN, deltaJudgments);
const sampleMap = new Map(sample.map(row => [key(row.query_id, row.record_id), row]));
const queryMeta = new Map(benchmark.queries.map(query => [query.id, query]));
const queryIds = benchmark.queries
  .filter(query => query.intent === "interdisciplinary-challenge")
  .map(query => query.id);
const threshold = Number(benchmark.evaluation?.relevantThreshold ?? 2);

const perQuery = [];
const changedRows = [];
let totalOldRelevant = 0;
let totalNewRelevant = 0;
let oldOrdinal = 0;
let newOrdinal = 0;
let improved = 0;
let worsened = 0;
let tied = 0;
let translationNewOnly = 0;
let translationNewOnlyRelevant = 0;
let translationOnlyNewOnly = 0;
let translationOnlyNewOnlyRelevant = 0;

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

  function decorate(row, side) {
    const human = humanMap.get(key(queryId, row.record_id));
    if (!human) throw new Error(`Missing human judgment for ${queryId} / ${row.record_id}`);
    const item = {
      query_id: queryId,
      query: query.query,
      language: query.language,
      side,
      rank: Number(row.rank),
      record_id: row.record_id,
      title: row.title || sampleMap.get(key(queryId, row.record_id))?.title || "",
      human_relevance: human.relevance,
      human_note: human.note,
      human_sources: human.sources,
      translation_mode: side === "new-only" ? translationMode(row) : null,
      matchedQueries: side === "new-only" ? (row.matchedQueries || []) : [],
    };
    changedRows.push(item);
    return item;
  }

  const oldChanged = oldOnly.map(row => decorate(row, "old-only"));
  const newChanged = newOnly.map(row => decorate(row, "new-only"));
  const oldRelevant = oldChanged.filter(row => row.human_relevance >= threshold).length;
  const newRelevant = newChanged.filter(row => row.human_relevance >= threshold).length;
  const oldOrd = oldChanged.reduce((sum, row) => sum + row.human_relevance, 0);
  const newOrd = newChanged.reduce((sum, row) => sum + row.human_relevance, 0);
  const deltaRelevant = newRelevant - oldRelevant;

  for (const row of newChanged) {
    if (row.translation_mode === "translation-only" || row.translation_mode === "original+translation") {
      translationNewOnly++;
      if (row.human_relevance >= threshold) translationNewOnlyRelevant++;
    }
    if (row.translation_mode === "translation-only") {
      translationOnlyNewOnly++;
      if (row.human_relevance >= threshold) translationOnlyNewOnlyRelevant++;
    }
  }

  totalOldRelevant += oldRelevant;
  totalNewRelevant += newRelevant;
  oldOrdinal += oldOrd;
  newOrdinal += newOrd;
  if (deltaRelevant > 0) improved++;
  else if (deltaRelevant < 0) worsened++;
  else tied++;

  perQuery.push({
    query_id: queryId,
    query: query.query,
    language: query.language,
    control_no_new_translation: query.language === "en",
    changed_per_side: oldOnly.length,
    old_only_relevant: oldRelevant,
    new_only_relevant: newRelevant,
    delta_relevant: deltaRelevant,
    paired_delta_p10: Number((deltaRelevant / 10).toFixed(4)),
    old_only_ordinal_sum: oldOrd,
    new_only_ordinal_sum: newOrd,
    delta_ordinal_sum: newOrd - oldOrd,
    new_only_translation_any: newChanged.filter(row => row.translation_mode?.includes("translation")).length,
    new_only_translation_relevant: newChanged.filter(row => row.translation_mode?.includes("translation") && row.human_relevance >= threshold).length,
  });
}

function summarizeSubset(items) {
  const positions = items.length * 10;
  const oldRel = items.reduce((sum, item) => sum + item.old_only_relevant, 0);
  const newRel = items.reduce((sum, item) => sum + item.new_only_relevant, 0);
  return {
    queries: items.length,
    oldOnlyRelevant: oldRel,
    newOnlyRelevant: newRel,
    netRelevant: newRel - oldRel,
    pairedDeltaP10: positions ? Number(((newRel - oldRel) / positions).toFixed(4)) : 0,
  };
}

const englishControls = perQuery.filter(item => item.control_no_new_translation);
const translationTargets = perQuery.filter(item => !item.control_no_new_translation);
const totalPositions = queryIds.length * 10;
const report = {
  schemaVersion: 1,
  name: "Multilingual constraints v1 paired human delta",
  methodology: "Observed paired human Top-10 delta between the expansion-fix run and multilingual-constraints-v1. Shared rows cancel; all changed rows are human judged or reused from prior human audits.",
  interpretationBoundary: "This is development evidence, not independent validation. Provider drift is visible in English queries where the expansion set is unchanged; therefore the observed run-to-run delta must not be interpreted as a pure causal effect of multilingual translation.",
  relevantThreshold: threshold,
  sources: {
    oldRun: OLD_RUN,
    newRun: NEW_RUN,
    priorHuman: PRIOR_HUMAN,
    auditManifest: MANIFEST,
    auditJudgments: JUDGMENTS,
  },
  summary: {
    queries: queryIds.length,
    changedTop10Pairs: changedRows.length,
    newlyJudgedPairs: deltaJudgments.length,
    priorHumanReused: changedRows.length - deltaJudgments.length,
    commentsOnNewJudgments: deltaJudgments.filter(row => String(row.human_note || "").trim()).length,
    oldOnlyRelevant: totalOldRelevant,
    newOnlyRelevant: totalNewRelevant,
    netRelevant: totalNewRelevant - totalOldRelevant,
    observedPairedDeltaP10: Number(((totalNewRelevant - totalOldRelevant) / totalPositions).toFixed(4)),
    oldOnlyOrdinalSum: oldOrdinal,
    newOnlyOrdinalSum: newOrdinal,
    deltaOrdinalSum: newOrdinal - oldOrdinal,
    improvedQueries: improved,
    worsenedQueries: worsened,
    tiedQueries: tied,
    translationNewOnly,
    translationNewOnlyRelevant,
    translationNewOnlyRelevantRate: translationNewOnly ? Number((translationNewOnlyRelevant / translationNewOnly).toFixed(4)) : null,
    translationOnlyNewOnly,
    translationOnlyNewOnlyRelevant,
    translationOnlyNewOnlyRelevantRate: translationOnlyNewOnly ? Number((translationOnlyNewOnlyRelevant / translationOnlyNewOnly).toFixed(4)) : null,
    englishControl: summarizeSubset(englishControls),
    translationTargetLanguages: summarizeSubset(translationTargets),
  },
  perQuery,
  changedRows,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const lines = [];
lines.push("# Multilingual constraints v1 paired human delta", "");
lines.push(report.methodology, "");
lines.push(`> ${report.interpretationBoundary}`, "");
lines.push("## Summary", "");
lines.push(`- changed Top-10 pairs judged/reused: ${report.summary.changedTop10Pairs}`);
lines.push(`- newly judged in this blind audit: ${report.summary.newlyJudgedPairs}`);
lines.push(`- prior human judgments reused: ${report.summary.priorHumanReused}`);
lines.push(`- comments on new judgments: ${report.summary.commentsOnNewJudgments}/${report.summary.newlyJudgedPairs}`);
lines.push(`- relevant old-only positions: ${report.summary.oldOnlyRelevant}`);
lines.push(`- relevant new-only positions: ${report.summary.newOnlyRelevant}`);
lines.push(`- net relevant positions: ${report.summary.netRelevant >= 0 ? "+" : ""}${report.summary.netRelevant}`);
lines.push(`- observed paired human ΔP@10: ${report.summary.observedPairedDeltaP10 >= 0 ? "+" : ""}${report.summary.observedPairedDeltaP10}`);
lines.push(`- ordinal relevance old-only → new-only: ${report.summary.oldOnlyOrdinalSum} → ${report.summary.newOnlyOrdinalSum} (Δ ${report.summary.deltaOrdinalSum >= 0 ? "+" : ""}${report.summary.deltaOrdinalSum})`);
lines.push(`- improved/worsened/tied queries: ${improved}/${worsened}/${tied}`);
lines.push(`- new-only rows with translation provenance: ${translationNewOnly}; relevant=${translationNewOnlyRelevant}; rate=${report.summary.translationNewOnlyRelevantRate ?? "n/a"}`);
lines.push(`- translation-only new rows: ${translationOnlyNewOnly}; relevant=${translationOnlyNewOnlyRelevant}; rate=${report.summary.translationOnlyNewOnlyRelevantRate ?? "n/a"}`, "");

lines.push("## Drift control and translation-target languages", "");
lines.push("English queries are a useful drift control because multilingual-constraints-v1 adds no distinct English translation query to them.", "");
lines.push(`- English control (${report.summary.englishControl.queries} queries): observed ΔP@10=${report.summary.englishControl.pairedDeltaP10 >= 0 ? "+" : ""}${report.summary.englishControl.pairedDeltaP10}, net relevant=${report.summary.englishControl.netRelevant >= 0 ? "+" : ""}${report.summary.englishControl.netRelevant}`);
lines.push(`- Non-English translation targets (${report.summary.translationTargetLanguages.queries} queries): observed ΔP@10=${report.summary.translationTargetLanguages.pairedDeltaP10 >= 0 ? "+" : ""}${report.summary.translationTargetLanguages.pairedDeltaP10}, net relevant=${report.summary.translationTargetLanguages.netRelevant >= 0 ? "+" : ""}${report.summary.translationTargetLanguages.netRelevant}`, "");

lines.push("## Per query", "");
lines.push("| query | lang | control | changed/side | old rel | new rel | Δ rel | observed ΔP@10 | translation new-only rel/total |");
lines.push("|---|---|---|---:|---:|---:|---:|---:|---:|");
for (const item of perQuery) {
  lines.push(`| ${item.query_id} · ${md(item.query)} | ${item.language} | ${item.control_no_new_translation ? "yes" : "no"} | ${item.changed_per_side} | ${item.old_only_relevant} | ${item.new_only_relevant} | ${item.delta_relevant >= 0 ? "+" : ""}${item.delta_relevant} | ${item.paired_delta_p10 >= 0 ? "+" : ""}${item.paired_delta_p10} | ${item.new_only_translation_relevant}/${item.new_only_translation_any} |`);
}

lines.push("", "## Human comments on changed documents", "");
lines.push("Old/new side and translation provenance are revealed only after the blind audit was finalized.", "");
for (const queryId of queryIds) {
  const rows = changedRows.filter(row => row.query_id === queryId);
  if (!rows.length) continue;
  lines.push(`### ${queryId} — ${md(queryMeta.get(queryId).query)}`, "");
  lines.push("| side | rank | rel | route | title | comment |");
  lines.push("|---|---:|---:|---|---|---|");
  for (const row of rows.sort((a, b) => a.side.localeCompare(b.side) || a.rank - b.rank)) {
    lines.push(`| ${row.side} | ${row.rank} | ${row.human_relevance} | ${row.translation_mode || "—"} | ${md(row.title)} | ${md(row.human_note || "—")} |`);
  }
  lines.push("");
}

fs.writeFileSync(OUT_MD, lines.join("\n") + "\n", "utf8");

console.log("MULTILINGUAL CONSTRAINTS DELTA HUMAN ANALYSIS: PASS");
console.log(`changed_pairs=${report.summary.changedTop10Pairs}`);
console.log(`newly_judged=${report.summary.newlyJudgedPairs}`);
console.log(`prior_human_reused=${report.summary.priorHumanReused}`);
console.log(`old_only_relevant=${report.summary.oldOnlyRelevant}`);
console.log(`new_only_relevant=${report.summary.newOnlyRelevant}`);
console.log(`net_relevant=${report.summary.netRelevant}`);
console.log(`observed_paired_delta_p10=${report.summary.observedPairedDeltaP10}`);
console.log(`english_control_delta_p10=${report.summary.englishControl.pairedDeltaP10}`);
console.log(`translation_target_delta_p10=${report.summary.translationTargetLanguages.pairedDeltaP10}`);
console.log(`translation_new_only_relevant=${report.summary.translationNewOnlyRelevant}/${report.summary.translationNewOnly}`);
console.log(`translation_only_new_relevant=${report.summary.translationOnlyNewOnlyRelevant}/${report.summary.translationOnlyNewOnly}`);
console.log(`queries=${improved}/${worsened}/${tied}`);
for (const item of perQuery) {
  console.log(`${item.query_id}: delta_relevant=${item.delta_relevant} delta_p10=${item.paired_delta_p10}`);
}
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);
