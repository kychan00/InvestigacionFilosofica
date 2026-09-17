import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const QUERIES_PATH = path.join(ROOT, "benchmark/validation-multilingual-ab-v1.queries.json");
const RUN_DIR = path.join(ROOT, "benchmark/runs");
const MANIFEST_PATH = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.manifest.json");
const JUDGMENTS_PATH = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.judgments.jsonl");
const OUT_JSON = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.report.json");
const OUT_MD = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.report.md");

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { throw new Error(`${filePath}:${index + 1}: ${error.message}`); }
    });
}

function findRun() {
  if (process.env.MULTILINGUAL_AB_RUN) return path.resolve(ROOT, process.env.MULTILINGUAL_AB_RUN);
  const candidates = fs.readdirSync(RUN_DIR)
    .filter(name => /^heldout-multilingual-ab-v1-[^.]+\.jsonl$/.test(name))
    .map(name => path.join(RUN_DIR, name));
  if (candidates.length !== 1) throw new Error(`Expected exactly one held-out A/B run, found ${candidates.length}`);
  return candidates[0];
}

function rowsFor(run, queryId, condition) {
  return run
    .filter(row => row.query_id === queryId && row.condition === condition && Number(row.rank) <= 10)
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}

function key(queryId, recordId) {
  return `${queryId}\u0000${recordId}`;
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

function md(value = "") {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function summarize(items) {
  const oldRelevant = items.reduce((sum, x) => sum + x.a_only_relevant, 0);
  const newRelevant = items.reduce((sum, x) => sum + x.b_only_relevant, 0);
  const positions = items.length * 10;
  return {
    queries: items.length,
    aOnlyRelevant: oldRelevant,
    bOnlyRelevant: newRelevant,
    netRelevant: newRelevant - oldRelevant,
    pairedDeltaP10: positions ? Number(((newRelevant - oldRelevant) / positions).toFixed(4)) : 0,
  };
}

const validation = JSON.parse(fs.readFileSync(QUERIES_PATH, "utf8"));
const runPath = findRun();
const run = readJsonl(runPath);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const judgments = readJsonl(JUDGMENTS_PATH);
if (judgments.length !== manifest.auditRows) {
  throw new Error(`Expected ${manifest.auditRows} judgments, found ${judgments.length}`);
}

const judgmentMap = new Map(judgments.map(row => [key(row.query_id, row.record_id), row]));
const threshold = Number(validation.evaluation?.relevantThreshold ?? 2);
const perQuery = [];
const changedRows = [];
let totalARelevant = 0;
let totalBRelevant = 0;
let ordinalA = 0;
let ordinalB = 0;
let improved = 0;
let worsened = 0;
let tied = 0;
let bOnlyTranslationAny = 0;
let bOnlyTranslationRelevant = 0;
let bOnlyTranslationOnly = 0;
let bOnlyTranslationOnlyRelevant = 0;

for (const query of validation.queries) {
  const a10 = rowsFor(run, query.id, "A");
  const b10 = rowsFor(run, query.id, "B");
  const aMap = new Map(a10.map(row => [row.record_id, row]));
  const bMap = new Map(b10.map(row => [row.record_id, row]));
  const aOnly = a10.filter(row => !bMap.has(row.record_id));
  const bOnly = b10.filter(row => !aMap.has(row.record_id));
  if (aOnly.length !== bOnly.length) throw new Error(`${query.id}: asymmetric Top-10 delta`);

  const decorate = (row, side) => {
    const human = judgmentMap.get(key(query.id, row.record_id));
    if (!human) throw new Error(`Missing judgment for ${query.id} / ${row.record_id}`);
    const item = {
      query_id: query.id,
      query: query.query,
      language: query.language,
      family: query.family,
      side,
      rank: Number(row.rank),
      record_id: row.record_id,
      title: row.title || "",
      human_relevance: Number(human.human_relevance),
      human_note: String(human.human_note || ""),
      translation_mode: side === "B-only" ? translationMode(row) : null,
      matchedQueries: side === "B-only" ? (row.matchedQueries || []) : [],
    };
    changedRows.push(item);
    return item;
  };

  const aChanged = aOnly.map(row => decorate(row, "A-only"));
  const bChanged = bOnly.map(row => decorate(row, "B-only"));
  const aRel = aChanged.filter(row => row.human_relevance >= threshold).length;
  const bRel = bChanged.filter(row => row.human_relevance >= threshold).length;
  const aOrd = aChanged.reduce((sum, row) => sum + row.human_relevance, 0);
  const bOrd = bChanged.reduce((sum, row) => sum + row.human_relevance, 0);
  const deltaRelevant = bRel - aRel;

  for (const row of bChanged) {
    if (row.translation_mode === "translation-only" || row.translation_mode === "original+translation") {
      bOnlyTranslationAny++;
      if (row.human_relevance >= threshold) bOnlyTranslationRelevant++;
    }
    if (row.translation_mode === "translation-only") {
      bOnlyTranslationOnly++;
      if (row.human_relevance >= threshold) bOnlyTranslationOnlyRelevant++;
    }
  }

  totalARelevant += aRel;
  totalBRelevant += bRel;
  ordinalA += aOrd;
  ordinalB += bOrd;
  if (deltaRelevant > 0) improved++;
  else if (deltaRelevant < 0) worsened++;
  else tied++;

  perQuery.push({
    query_id: query.id,
    query: query.query,
    language: query.language,
    family: query.family,
    english_control: query.language === "en",
    changed_per_side: aOnly.length,
    a_only_relevant: aRel,
    b_only_relevant: bRel,
    delta_relevant: deltaRelevant,
    paired_delta_p10: Number((deltaRelevant / 10).toFixed(4)),
    a_only_ordinal_sum: aOrd,
    b_only_ordinal_sum: bOrd,
    delta_ordinal_sum: bOrd - aOrd,
    b_only_translation_any: bChanged.filter(row => row.translation_mode?.includes("translation")).length,
    b_only_translation_relevant: bChanged.filter(row => row.translation_mode?.includes("translation") && row.human_relevance >= threshold).length,
  });
}

const englishControls = perQuery.filter(x => x.english_control);
const nonEnglish = perQuery.filter(x => !x.english_control);
const byLanguage = Object.fromEntries(["es", "en", "de", "fr", "pt"].map(language => [language, summarize(perQuery.filter(x => x.language === language))]));
const byFamily = Object.fromEntries(validation.families.map(family => [family, summarize(perQuery.filter(x => x.family === family))]));
const totalPositions = validation.queries.length * 10;

const report = {
  schemaVersion: 1,
  name: "Held-out multilingual A/B paired human delta v1",
  methodology: "Exact paired human Top-10 delta for the frozen held-out A/B run. Shared A/B Top-10 rows cancel; every row in the symmetric difference was judged blind to condition, rank, provider, score, and translation provenance.",
  interpretationBoundary: "This is an internal held-out validation with one human adjudicator. A/B conditions were run consecutively with alternating order, reducing but not eliminating live-provider variability. English queries are drift controls because their logical expansion is unchanged.",
  relevantThreshold: threshold,
  sources: {
    queries: path.relative(ROOT, QUERIES_PATH),
    run: path.relative(ROOT, runPath),
    manifest: path.relative(ROOT, MANIFEST_PATH),
    judgments: path.relative(ROOT, JUDGMENTS_PATH),
  },
  summary: {
    queries: validation.queries.length,
    changedTop10Pairs: changedRows.length,
    judgments: judgments.length,
    comments: judgments.filter(row => String(row.human_note || "").trim()).length,
    aOnlyRelevant: totalARelevant,
    bOnlyRelevant: totalBRelevant,
    netRelevant: totalBRelevant - totalARelevant,
    pairedDeltaP10: Number(((totalBRelevant - totalARelevant) / totalPositions).toFixed(4)),
    aOnlyOrdinalSum: ordinalA,
    bOnlyOrdinalSum: ordinalB,
    deltaOrdinalSum: ordinalB - ordinalA,
    improvedQueries: improved,
    worsenedQueries: worsened,
    tiedQueries: tied,
    bOnlyTranslationAny,
    bOnlyTranslationRelevant,
    bOnlyTranslationRelevantRate: bOnlyTranslationAny ? Number((bOnlyTranslationRelevant / bOnlyTranslationAny).toFixed(4)) : null,
    bOnlyTranslationOnly,
    bOnlyTranslationOnlyRelevant,
    bOnlyTranslationOnlyRelevantRate: bOnlyTranslationOnly ? Number((bOnlyTranslationOnlyRelevant / bOnlyTranslationOnly).toFixed(4)) : null,
    englishControl: summarize(englishControls),
    nonEnglishTargets: summarize(nonEnglish),
    byLanguage,
    byFamily,
  },
  perQuery,
  changedRows,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const lines = [];
lines.push("# Held-out multilingual A/B paired human delta", "");
lines.push(report.methodology, "");
lines.push(`> ${report.interpretationBoundary}`, "");
lines.push("## Summary", "");
lines.push(`- changed Top-10 query-document pairs judged: ${report.summary.changedTop10Pairs}`);
lines.push(`- judgments with comments: ${report.summary.comments}/${report.summary.judgments}`);
lines.push(`- relevant A-only positions: ${report.summary.aOnlyRelevant}`);
lines.push(`- relevant B-only positions: ${report.summary.bOnlyRelevant}`);
lines.push(`- net relevant positions: ${report.summary.netRelevant >= 0 ? "+" : ""}${report.summary.netRelevant}`);
lines.push(`- exact paired human ΔP@10 (B−A): ${report.summary.pairedDeltaP10 >= 0 ? "+" : ""}${report.summary.pairedDeltaP10}`);
lines.push(`- ordinal relevance A-only → B-only: ${report.summary.aOnlyOrdinalSum} → ${report.summary.bOnlyOrdinalSum} (Δ ${report.summary.deltaOrdinalSum >= 0 ? "+" : ""}${report.summary.deltaOrdinalSum})`);
lines.push(`- improved/worsened/tied queries: ${improved}/${worsened}/${tied}`);
lines.push(`- B-only rows with translation provenance: ${bOnlyTranslationAny}; relevant=${bOnlyTranslationRelevant}; rate=${report.summary.bOnlyTranslationRelevantRate ?? "n/a"}`);
lines.push(`- B-only translation-only rows: ${bOnlyTranslationOnly}; relevant=${bOnlyTranslationOnlyRelevant}; rate=${report.summary.bOnlyTranslationOnlyRelevantRate ?? "n/a"}`, "");

lines.push("## English drift controls vs non-English targets", "");
lines.push(`- English controls (${report.summary.englishControl.queries} queries): ΔP@10=${report.summary.englishControl.pairedDeltaP10 >= 0 ? "+" : ""}${report.summary.englishControl.pairedDeltaP10}; net relevant=${report.summary.englishControl.netRelevant >= 0 ? "+" : ""}${report.summary.englishControl.netRelevant}`);
lines.push(`- Non-English targets (${report.summary.nonEnglishTargets.queries} queries): ΔP@10=${report.summary.nonEnglishTargets.pairedDeltaP10 >= 0 ? "+" : ""}${report.summary.nonEnglishTargets.pairedDeltaP10}; net relevant=${report.summary.nonEnglishTargets.netRelevant >= 0 ? "+" : ""}${report.summary.nonEnglishTargets.netRelevant}`, "");

lines.push("## By language", "");
lines.push("| language | queries | A-only rel | B-only rel | net | paired ΔP@10 |");
lines.push("|---|---:|---:|---:|---:|---:|");
for (const language of ["es", "en", "de", "fr", "pt"]) {
  const s = byLanguage[language];
  lines.push(`| ${language} | ${s.queries} | ${s.aOnlyRelevant} | ${s.bOnlyRelevant} | ${s.netRelevant >= 0 ? "+" : ""}${s.netRelevant} | ${s.pairedDeltaP10 >= 0 ? "+" : ""}${s.pairedDeltaP10} |`);
}

lines.push("", "## By family", "");
lines.push("| family | queries | A-only rel | B-only rel | net | paired ΔP@10 |");
lines.push("|---|---:|---:|---:|---:|---:|");
for (const family of validation.families) {
  const s = byFamily[family];
  lines.push(`| ${family} | ${s.queries} | ${s.aOnlyRelevant} | ${s.bOnlyRelevant} | ${s.netRelevant >= 0 ? "+" : ""}${s.netRelevant} | ${s.pairedDeltaP10 >= 0 ? "+" : ""}${s.pairedDeltaP10} |`);
}

lines.push("", "## Per query", "");
lines.push("| query | lang | control | changed/side | A rel | B rel | Δ rel | paired ΔP@10 | B translation rel/total |");
lines.push("|---|---|---|---:|---:|---:|---:|---:|---:|");
for (const item of perQuery) {
  lines.push(`| ${item.query_id} · ${md(item.query)} | ${item.language} | ${item.english_control ? "yes" : "no"} | ${item.changed_per_side} | ${item.a_only_relevant} | ${item.b_only_relevant} | ${item.delta_relevant >= 0 ? "+" : ""}${item.delta_relevant} | ${item.paired_delta_p10 >= 0 ? "+" : ""}${item.paired_delta_p10} | ${item.b_only_translation_relevant}/${item.b_only_translation_any} |`);
}

lines.push("", "## Human comments on changed documents", "");
lines.push("A/B side and translation provenance are revealed only after the blind audit was finalized.", "");
for (const query of validation.queries) {
  const rows = changedRows.filter(row => row.query_id === query.id);
  if (!rows.length) continue;
  lines.push(`### ${query.id} — ${md(query.query)}`, "");
  lines.push("| side | rank | rel | route | title | comment |");
  lines.push("|---|---:|---:|---|---|---|");
  for (const row of rows.sort((a, b) => a.side.localeCompare(b.side) || a.rank - b.rank)) {
    lines.push(`| ${row.side} | ${row.rank} | ${row.human_relevance} | ${row.translation_mode || "—"} | ${md(row.title)} | ${md(row.human_note || "—")} |`);
  }
  lines.push("");
}

lines.push("## Interpretation boundary", "");
lines.push("The paired ΔP@10 is exact for this frozen A/B run because shared Top-10 rows cancel. It is not an absolute P@10 estimate for either complete Top 10, and it should not be treated as an external population-level causal estimate.", "");

fs.writeFileSync(OUT_MD, lines.join("\n") + "\n", "utf8");

console.log("HELD-OUT MULTILINGUAL A/B HUMAN ANALYSIS: PASS");
console.log(`changed_pairs=${report.summary.changedTop10Pairs}`);
console.log(`judgments=${report.summary.judgments}`);
console.log(`comments=${report.summary.comments}/${report.summary.judgments}`);
console.log(`a_only_relevant=${report.summary.aOnlyRelevant}`);
console.log(`b_only_relevant=${report.summary.bOnlyRelevant}`);
console.log(`net_relevant=${report.summary.netRelevant}`);
console.log(`paired_delta_p10=${report.summary.pairedDeltaP10}`);
console.log(`english_control_delta_p10=${report.summary.englishControl.pairedDeltaP10}`);
console.log(`nonenglish_delta_p10=${report.summary.nonEnglishTargets.pairedDeltaP10}`);
console.log(`b_translation_relevant=${report.summary.bOnlyTranslationRelevant}/${report.summary.bOnlyTranslationAny}`);
console.log(`b_translation_only_relevant=${report.summary.bOnlyTranslationOnlyRelevant}/${report.summary.bOnlyTranslationOnly}`);
console.log(`queries=${improved}/${worsened}/${tied}`);
for (const item of perQuery) console.log(`${item.query_id}: delta_relevant=${item.delta_relevant} delta_p10=${item.paired_delta_p10}`);
console.log(`json=${path.relative(ROOT, OUT_JSON)}`);
console.log(`markdown=${path.relative(ROOT, OUT_MD)}`);
