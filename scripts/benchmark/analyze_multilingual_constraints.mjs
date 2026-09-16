import fs from "node:fs";

const OLD_RUN = "benchmark/runs/human-v1.0-interdisciplinary-expansionfix-cfb853a.jsonl";
const NEW_RUN = "benchmark/runs/human-v1.0-interdisciplinary-multilingual-f02f02f.jsonl";
const QUERIES = "benchmark/queries.json";
const HUMAN_SOURCES = [
  "benchmark/human-audit-v1.judgments.jsonl",
  "benchmark/interdisciplinary-delta-audit-v1.judgments.jsonl"
];
const OUT_JSON = "benchmark/multilingual-constraints-analysis.json";
const OUT_MD = "benchmark/multilingual-constraints-analysis.md";

function readJsonl(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing required file: ${path}`);
  }

  const text = fs.readFileSync(path, "utf8").trim();
  if (!text) return [];

  return text
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

function rowsFor(run, queryId, depth) {
  return run
    .filter(row => row.query_id === queryId && Number(row.rank) <= depth)
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}

function buildHumanMap(paths) {
  const map = new Map();
  const sourceMap = new Map();

  for (const path of paths) {
    for (const row of readJsonl(path)) {
      const pairKey = key(row.query_id, row.record_id);
      const label = Number(row.human_relevance);

      if (map.has(pairKey) && map.get(pairKey) !== label) {
        throw new Error(
          `Conflicting human labels for ${row.query_id} / ${row.record_id}: ` +
          `${map.get(pairKey)} vs ${label}`
        );
      }

      map.set(pairKey, label);
      if (!sourceMap.has(pairKey)) sourceMap.set(pairKey, []);
      sourceMap.get(pairKey).push(path);
    }
  }

  return { map, sourceMap };
}

function humanLabel(humanMap, queryId, recordId) {
  const value = humanMap.get(key(queryId, recordId));
  return value == null ? null : Number(value);
}

function isRelevant(label) {
  return label != null && Number(label) >= 2;
}

function provenance(row) {
  const items = row.matchedQueries || [];
  if (!items.length) return "—";

  return items
    .map(item => {
      const type = item.type ? `:${item.type}` : "";
      const weight = Number.isFinite(Number(item.weight))
        ? `@${Number(item.weight).toFixed(2)}`
        : "";
      return `${item.query}${type}${weight}`;
    })
    .join(" | ");
}

function hasTranslationProvenance(row) {
  return (row.matchedQueries || []).some(item => item.type === "translation");
}

function hasOriginalProvenance(row) {
  return (row.matchedQueries || []).some(item => item.type === "original");
}

function translationMode(row) {
  const translation = hasTranslationProvenance(row);
  const original = hasOriginalProvenance(row);

  if (translation && original) return "original+translation";
  if (translation) return "translation-only";
  if (original) return "original-only";
  return "other";
}

function compactProviders(row) {
  return (row.providers || []).join(" + ") || "—";
}

function mdEscape(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const oldRun = readJsonl(OLD_RUN);
const newRun = readJsonl(NEW_RUN);
const { map: humanMap, sourceMap: humanSourceMap } = buildHumanMap(HUMAN_SOURCES);
const queryMeta = new Map(benchmark.queries.map(query => [query.id, query]));
const queryIds = benchmark.queries
  .filter(query => query.intent === "interdisciplinary-challenge")
  .map(query => query.id);

const perQuery = [];
const unresolvedChangedPairs = [];
let top10SharedPairs = 0;
let top10UnionPairs = 0;
let top10ChangedPairs = 0;
let top10ChangedAlreadyHuman = 0;
let top20SharedPairs = 0;
let top20UnionPairs = 0;
let newTop10TranslationAny = 0;
let newTop10TranslationOnly = 0;
let newOnlyTranslationAny = 0;
let changedOldRelevantKnown = 0;
let changedNewRelevantKnown = 0;
let knownChangedOldCount = 0;
let knownChangedNewCount = 0;

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

  const oldOnly = old10.filter(row => !new10Map.has(row.record_id));
  const newOnly = new10.filter(row => !old10Map.has(row.record_id));
  const changedPairs = oldOnly.length + newOnly.length;
  top10ChangedPairs += changedPairs;

  let changedAlreadyHuman = 0;
  let oldRelevantKnown = 0;
  let newRelevantKnown = 0;
  let oldKnown = 0;
  let newKnown = 0;

  for (const row of oldOnly) {
    const label = humanLabel(humanMap, queryId, row.record_id);
    if (label == null) {
      unresolvedChangedPairs.push({
        query_id: queryId,
        query: query.query,
        side: "old-only",
        old_rank: row.rank,
        new_rank: null,
        record_id: row.record_id,
        title: row.title || "",
        providers: row.providers || []
      });
    } else {
      changedAlreadyHuman++;
      oldKnown++;
      if (isRelevant(label)) oldRelevantKnown++;
    }
  }

  for (const row of newOnly) {
    const label = humanLabel(humanMap, queryId, row.record_id);
    if (label == null) {
      unresolvedChangedPairs.push({
        query_id: queryId,
        query: query.query,
        side: "new-only",
        old_rank: null,
        new_rank: row.rank,
        record_id: row.record_id,
        title: row.title || "",
        providers: row.providers || [],
        matchedQueries: row.matchedQueries || []
      });
    } else {
      changedAlreadyHuman++;
      newKnown++;
      if (isRelevant(label)) newRelevantKnown++;
    }
  }

  top10ChangedAlreadyHuman += changedAlreadyHuman;
  changedOldRelevantKnown += oldRelevantKnown;
  changedNewRelevantKnown += newRelevantKnown;
  knownChangedOldCount += oldKnown;
  knownChangedNewCount += newKnown;

  const translationAny = new10.filter(hasTranslationProvenance).length;
  const translationOnly = new10.filter(row => translationMode(row) === "translation-only").length;
  const newOnlyTranslation = newOnly.filter(hasTranslationProvenance).length;

  newTop10TranslationAny += translationAny;
  newTop10TranslationOnly += translationOnly;
  newOnlyTranslationAny += newOnlyTranslation;

  perQuery.push({
    id: queryId,
    query: query.query,
    language: query.language,
    overlapTop10: shared10Ids.length,
    unionTop10: union10Ids.length,
    changedTop10Pairs: changedPairs,
    changedAlreadyHuman,
    changedUnresolved: changedPairs - changedAlreadyHuman,
    overlapTop20: shared20Ids.length,
    unionTop20: union20Ids.length,
    newTop10TranslationAny: translationAny,
    newTop10TranslationOnly: translationOnly,
    newOnlyTranslationAny: newOnlyTranslation,
    knownChanged: {
      oldCount: oldKnown,
      newCount: newKnown,
      oldRelevant: oldRelevantKnown,
      newRelevant: newRelevantKnown,
      netRelevant: newRelevantKnown - oldRelevantKnown
    },
    newTop10: new10.map(row => ({
      rank: row.rank,
      old_rank: old10Map.get(row.record_id)?.rank ?? null,
      status: old10Map.has(row.record_id) ? "shared" : "new-only",
      record_id: row.record_id,
      title: row.title || "",
      providers: row.providers || [],
      human_relevance: humanLabel(humanMap, queryId, row.record_id),
      human_sources: humanSourceMap.get(key(queryId, row.record_id)) || [],
      translation_mode: translationMode(row),
      matchedQueries: row.matchedQueries || []
    })),
    oldOnly: oldOnly.map(row => ({
      rank: row.rank,
      record_id: row.record_id,
      title: row.title || "",
      providers: row.providers || [],
      human_relevance: humanLabel(humanMap, queryId, row.record_id),
      human_sources: humanSourceMap.get(key(queryId, row.record_id)) || []
    }))
  });
}

const report = {
  schemaVersion: 1,
  note: "Development-only structural comparison of the human-validated expansion-fix run against multilingual-constraints-v1. It does not infer relevance for unseen documents and is not an independent validation set.",
  pairedDeltaRule: "Shared Top-10 rows cancel in paired P@10. Exact paired human ΔP@10 requires human labels for every old-only/new-only Top-10 pair.",
  sources: {
    oldRun: OLD_RUN,
    newRun: NEW_RUN,
    humanJudgments: HUMAN_SOURCES
  },
  summary: {
    queries: queryIds.length,
    top10SharedPairs,
    top10UnionPairs,
    meanTop10Overlap: Number((top10SharedPairs / queryIds.length).toFixed(2)),
    top10ChangedPairs,
    top10ChangedAlreadyHuman,
    top10ChangedUnresolved: unresolvedChangedPairs.length,
    top20SharedPairs,
    top20UnionPairs,
    meanTop20Overlap: Number((top20SharedPairs / queryIds.length).toFixed(2)),
    newTop10TranslationAny,
    newTop10TranslationOnly,
    newOnlyTranslationAny,
    knownChangedOldCount,
    knownChangedNewCount,
    knownChangedOldRelevant: changedOldRelevantKnown,
    knownChangedNewRelevant: changedNewRelevantKnown,
    knownChangedNetRelevant: changedNewRelevantKnown - changedOldRelevantKnown
  },
  unresolvedChangedPairs,
  perQuery
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const md = [];
md.push("# Multilingual constraints v1 analysis", "");
md.push(report.note, "");
md.push(`> ${report.pairedDeltaRule}`, "");
md.push("## Summary", "");
md.push(`- queries: ${report.summary.queries}`);
md.push(`- Top-10 shared query-document pairs: ${report.summary.top10SharedPairs}`);
md.push(`- Top-10 union query-document pairs: ${report.summary.top10UnionPairs}`);
md.push(`- mean Top-10 overlap per query: ${report.summary.meanTop10Overlap}/10`);
md.push(`- changed Top-10 pairs: ${report.summary.top10ChangedPairs}`);
md.push(`- changed pairs already covered by prior human judgments: ${report.summary.top10ChangedAlreadyHuman}`);
md.push(`- changed pairs still requiring human judgment for exact paired ΔP@10: ${report.summary.top10ChangedUnresolved}`);
md.push(`- Top-20 shared query-document pairs: ${report.summary.top20SharedPairs}`);
md.push(`- mean Top-20 overlap per query: ${report.summary.meanTop20Overlap}/20`);
md.push(`- new-run Top-10 positions with translation provenance: ${report.summary.newTop10TranslationAny}/100`);
md.push(`- new-run Top-10 positions with translation-only provenance: ${report.summary.newTop10TranslationOnly}/100`);
md.push(`- new-only Top-10 positions with translation provenance: ${report.summary.newOnlyTranslationAny}`);
md.push(`- among already-judged changed pairs only: old relevant=${report.summary.knownChangedOldRelevant}/${report.summary.knownChangedOldCount}, new relevant=${report.summary.knownChangedNewRelevant}/${report.summary.knownChangedNewCount}, net=${report.summary.knownChangedNetRelevant}`);
md.push("- the partial human line above is descriptive only; it is not the final paired delta until all changed pairs are judged", "");

for (const item of perQuery) {
  md.push(`## ${item.id} — ${item.query}`, "");
  md.push(`Top-10 overlap: **${item.overlapTop10}/10** · changed=${item.changedTop10Pairs} · already-human=${item.changedAlreadyHuman} · unresolved=${item.changedUnresolved}`);
  md.push(`Top-20 overlap: **${item.overlapTop20}/20**`);
  md.push(`translation provenance in new Top 10: ${item.newTop10TranslationAny}/10 · translation-only=${item.newTop10TranslationOnly}/10 · new-only via translation=${item.newOnlyTranslationAny}`);
  md.push(`known changed labels: old relevant=${item.knownChanged.oldRelevant}/${item.knownChanged.oldCount} · new relevant=${item.knownChanged.newRelevant}/${item.knownChanged.newCount} · net=${item.knownChanged.netRelevant}`, "");

  md.push("### New run Top 10", "");
  md.push("| new | old | status | human | route | providers | matchedQueries | title |");
  md.push("|---:|---:|---|---:|---|---|---|---|");
  for (const row of item.newTop10) {
    md.push(
      `| ${row.rank} | ${row.old_rank ?? "—"} | ${row.status} | ${row.human_relevance ?? "?"} | ${row.translation_mode} | ${mdEscape(compactProviders(row))} | ${mdEscape(provenance(row))} | ${mdEscape(row.title)} |`
    );
  }

  md.push("", "### Left previous Top 10", "");
  if (!item.oldOnly.length) {
    md.push("- none");
  } else {
    for (const row of item.oldOnly) {
      md.push(`- old r${row.rank} · human=${row.human_relevance ?? "?"} · ${compactProviders(row)} · ${row.title}`);
    }
  }
  md.push("");
}

md.push("## Next audit requirement", "");
md.push(`For the exact paired human ΔP@10 between the expansion-fix run and multilingual-constraints-v1, **${unresolvedChangedPairs.length}** changed query-document pairs remain unlabeled. This is a development comparison because these query families informed the new multilingual design.`, "");

fs.writeFileSync(OUT_MD, md.join("\n") + "\n", "utf8");

console.log("MULTILINGUAL CONSTRAINTS ANALYSIS: PASS");
console.log(`queries=${report.summary.queries}`);
console.log(`top10_overlap_mean=${report.summary.meanTop10Overlap}/10`);
console.log(`changed_top10_pairs=${report.summary.top10ChangedPairs}`);
console.log(`changed_already_human=${report.summary.top10ChangedAlreadyHuman}`);
console.log(`changed_needs_human_for_delta=${report.summary.top10ChangedUnresolved}`);
console.log(`new_top10_translation_any=${report.summary.newTop10TranslationAny}/100`);
console.log(`new_top10_translation_only=${report.summary.newTop10TranslationOnly}/100`);
console.log(`new_only_translation_any=${report.summary.newOnlyTranslationAny}`);
console.log(`known_changed_net_relevant=${report.summary.knownChangedNetRelevant}`);
for (const item of perQuery) {
  console.log(`${item.id}: overlap10=${item.overlapTop10}/10 unresolved=${item.changedUnresolved} translation=${item.newTop10TranslationAny}/10 new_only_translation=${item.newOnlyTranslationAny}`);
}
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);
