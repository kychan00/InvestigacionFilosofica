import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const QUERIES_PATH = path.join(ROOT, "benchmark/validation-interdisciplinary-conjunction-v1.queries.json");
const SAMPLE_PATH = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-audit.sample.jsonl");
const MANIFEST_PATH = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-audit.manifest.json");
const MANUAL_PATH = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-audit.manual.jsonl");
const JUDGMENTS_PATH = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-audit.judgments.jsonl");
const REPORT_JSON_PATH = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-audit.report.json");
const REPORT_MD_PATH = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-audit.report.md");

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { throw new Error(`${filePath}:${index + 1}: ${error.message}`); }
    });
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function addAggregate(target, key, relevance, side) {
  if (!target[key]) {
    target[key] = {
      changedPairs: 0,
      aOnly: 0,
      bOnly: 0,
      aRelevant: 0,
      bRelevant: 0,
      aOrdinal: 0,
      bOrdinal: 0,
    };
  }
  const bucket = target[key];
  bucket.changedPairs++;
  if (side === "A-only") {
    bucket.aOnly++;
    bucket.aRelevant += relevance >= 2 ? 1 : 0;
    bucket.aOrdinal += relevance;
  } else if (side === "B-only") {
    bucket.bOnly++;
    bucket.bRelevant += relevance >= 2 ? 1 : 0;
    bucket.bOrdinal += relevance;
  } else {
    throw new Error(`Unknown selection side: ${side}`);
  }
}

function finalizeAggregate(bucket, denominatorQueries, topK) {
  const netRelevant = bucket.bRelevant - bucket.aRelevant;
  return {
    ...bucket,
    netRelevant,
    deltaP10: round(netRelevant / (denominatorQueries * topK)),
    ordinalDelta: bucket.bOrdinal - bucket.aOrdinal,
  };
}

for (const filePath of [QUERIES_PATH, SAMPLE_PATH, MANIFEST_PATH, MANUAL_PATH]) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${path.relative(ROOT, filePath)}`);
}

const validation = JSON.parse(fs.readFileSync(QUERIES_PATH, "utf8"));
const sample = readJsonl(SAMPLE_PATH);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const manual = readJsonl(MANUAL_PATH);
const topK = Number(validation.evaluation?.topK || 10);
const relevantThreshold = Number(validation.evaluation?.relevantThreshold || 2);

if (sample.length !== 56 || manifest.items?.length !== 56 || manual.length !== 56) {
  throw new Error(`Expected 56 rows in sample/manifest/manual, got ${sample.length}/${manifest.items?.length || 0}/${manual.length}`);
}

const expectedIds = sample.map(row => row.audit_id);
const expectedIdSet = new Set(expectedIds);
if (expectedIdSet.size !== expectedIds.length) throw new Error("Duplicate audit_id in sample");

const manualById = new Map();
for (const row of manual) {
  if (!row.audit_id || !expectedIdSet.has(row.audit_id)) throw new Error(`Unknown audit_id in manual judgments: ${row.audit_id}`);
  if (manualById.has(row.audit_id)) throw new Error(`Duplicate manual judgment: ${row.audit_id}`);
  const relevance = Number(row.human_relevance);
  if (!Number.isInteger(relevance) || relevance < 0 || relevance > 3) {
    throw new Error(`${row.audit_id}: human_relevance must be integer 0..3`);
  }
  manualById.set(row.audit_id, {
    human_relevance: relevance,
    human_note: String(row.human_note || "").trim(),
  });
}

const missing = expectedIds.filter(id => !manualById.has(id));
if (missing.length) throw new Error(`Missing judgments: ${missing.join(", ")}`);

const sampleById = new Map(sample.map(row => [row.audit_id, row]));
const manifestById = new Map((manifest.items || []).map(row => [row.audit_id, row]));
if (manifestById.size !== expectedIds.length) throw new Error("Manifest audit IDs are incomplete or duplicated");

const judgments = expectedIds.map(auditId => {
  const publicRow = sampleById.get(auditId);
  const hidden = manifestById.get(auditId);
  const human = manualById.get(auditId);
  if (!hidden) throw new Error(`Missing manifest item: ${auditId}`);
  if (publicRow.query_id !== hidden.query_id || publicRow.record_id !== hidden.record_id) {
    throw new Error(`${auditId}: sample/manifest mismatch`);
  }
  return {
    audit_id: auditId,
    query_id: publicRow.query_id,
    query: publicRow.query,
    language: hidden.language,
    family: hidden.family,
    record_id: publicRow.record_id,
    title: publicRow.title,
    selection_side: hidden.selection_side,
    a_rank: hidden.a_rank,
    b_rank: hidden.b_rank,
    conjunction_bucket: hidden.conjunction_bucket,
    conjunction_adjustment: hidden.conjunction_adjustment,
    human_relevance: human.human_relevance,
    human_note: human.human_note,
  };
});

const queryById = new Map(validation.queries.map(query => [query.id, query]));
const byQueryRaw = {};
const byFamilyRaw = {};
const byLanguageRaw = {};
let aRelevant = 0;
let bRelevant = 0;
let aOrdinal = 0;
let bOrdinal = 0;
let aOnly = 0;
let bOnly = 0;

const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };

for (const row of judgments) {
  distribution[row.human_relevance]++;
  addAggregate(byQueryRaw, row.query_id, row.human_relevance, row.selection_side);
  addAggregate(byFamilyRaw, row.family, row.human_relevance, row.selection_side);
  addAggregate(byLanguageRaw, row.language, row.human_relevance, row.selection_side);

  if (row.selection_side === "A-only") {
    aOnly++;
    aRelevant += row.human_relevance >= relevantThreshold ? 1 : 0;
    aOrdinal += row.human_relevance;
  } else if (row.selection_side === "B-only") {
    bOnly++;
    bRelevant += row.human_relevance >= relevantThreshold ? 1 : 0;
    bOrdinal += row.human_relevance;
  }
}

if (aOnly !== 28 || bOnly !== 28) throw new Error(`Expected 28/28 A-only/B-only, got ${aOnly}/${bOnly}`);

const byQuery = {};
let improved = 0;
let worsened = 0;
let tied = 0;
let ordinalImproved = 0;
let ordinalWorsened = 0;
let ordinalTied = 0;

for (const query of validation.queries) {
  const raw = byQueryRaw[query.id] || {
    changedPairs: 0,
    aOnly: 0,
    bOnly: 0,
    aRelevant: 0,
    bRelevant: 0,
    aOrdinal: 0,
    bOrdinal: 0,
  };
  if (raw.aOnly !== raw.bOnly) throw new Error(`${query.id}: asymmetric judged delta`);
  const finalized = finalizeAggregate(raw, 1, topK);
  byQuery[query.id] = {
    query: query.query,
    language: query.language,
    family: query.family,
    ...finalized,
  };
  if (finalized.netRelevant > 0) improved++;
  else if (finalized.netRelevant < 0) worsened++;
  else tied++;

  if (finalized.ordinalDelta > 0) ordinalImproved++;
  else if (finalized.ordinalDelta < 0) ordinalWorsened++;
  else ordinalTied++;
}

const familyQueryCounts = Object.fromEntries(validation.families.map(family => [family.id, validation.queries.filter(query => query.family === family.id).length]));
const languageQueryCounts = Object.fromEntries((validation.evaluation?.languages || ["es", "en", "de", "fr", "pt"]).map(language => [language, validation.queries.filter(query => query.language === language).length]));

const byFamily = {};
for (const family of validation.families) {
  const raw = byFamilyRaw[family.id] || { changedPairs: 0, aOnly: 0, bOnly: 0, aRelevant: 0, bRelevant: 0, aOrdinal: 0, bOrdinal: 0 };
  byFamily[family.id] = finalizeAggregate(raw, familyQueryCounts[family.id], topK);
}

const byLanguage = {};
for (const language of validation.evaluation?.languages || ["es", "en", "de", "fr", "pt"]) {
  const raw = byLanguageRaw[language] || { changedPairs: 0, aOnly: 0, bOnly: 0, aRelevant: 0, bRelevant: 0, aOrdinal: 0, bOrdinal: 0 };
  byLanguage[language] = finalizeAggregate(raw, languageQueryCounts[language], topK);
}

const netRelevant = bRelevant - aRelevant;
const ordinalDelta = bOrdinal - aOrdinal;
const deltaP10 = round(netRelevant / (validation.queries.length * topK));

const report = {
  schemaVersion: 1,
  name: "Interdisciplinary conjunction v1 fresh holdout human audit",
  run: manifest.run,
  queries: manifest.queries,
  auditRows: judgments.length,
  relevantThreshold,
  topK,
  distribution,
  comments: judgments.filter(row => row.human_note).length,
  summary: {
    aOnly,
    bOnly,
    aOnlyRelevant: aRelevant,
    bOnlyRelevant: bRelevant,
    netRelevant,
    exactPairedDeltaP10: deltaP10,
    aOrdinal,
    bOrdinal,
    ordinalDelta,
    improvedWorsenedTied: { improved, worsened, tied },
    ordinalImprovedWorsenedTied: { improved: ordinalImproved, worsened: ordinalWorsened, tied: ordinalTied },
  },
  byFamily,
  byLanguage,
  byQuery,
  methodology: "Human relevance labels (0-3; relevant >=2) for every query-document pair in the symmetric difference between A and B Top 10. Because shared Top-10 rows cancel, net relevant positions / (20*10) is the exact paired ΔP@10 for this frozen same-pool run. No unchanged Top-10 documents are relabeled or needed for the paired delta.",
  limitations: "Fresh internal holdout with one human adjudicator. Query families were preregistered after conjunction-v1 tuning and checked for detected exact-query and same-line family-pair exposure in the frozen pre-validation repository scope. This is not independent external validation and does not estimate population-wide causal performance.",
};

fs.writeFileSync(JUDGMENTS_PATH, judgments.map(row => JSON.stringify(row)).join("\n") + "\n", "utf8");
fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");

const familyRows = validation.families.map(family => {
  const x = byFamily[family.id];
  return `| ${family.id} | ${familyQueryCounts[family.id]} | ${x.aRelevant} | ${x.bRelevant} | ${x.netRelevant >= 0 ? "+" : ""}${x.netRelevant} | ${x.deltaP10 >= 0 ? "+" : ""}${x.deltaP10} | ${x.ordinalDelta >= 0 ? "+" : ""}${x.ordinalDelta} |`;
}).join("\n");

const languageRows = (validation.evaluation?.languages || ["es", "en", "de", "fr", "pt"]).map(language => {
  const x = byLanguage[language];
  return `| ${language} | ${languageQueryCounts[language]} | ${x.aRelevant} | ${x.bRelevant} | ${x.netRelevant >= 0 ? "+" : ""}${x.netRelevant} | ${x.deltaP10 >= 0 ? "+" : ""}${x.deltaP10} | ${x.ordinalDelta >= 0 ? "+" : ""}${x.ordinalDelta} |`;
}).join("\n");

const queryRows = validation.queries.map(query => {
  const x = byQuery[query.id];
  return `| ${query.id} · ${query.query.replaceAll("|", "\\|")} | ${query.language} | ${x.changedPairs} | ${x.aRelevant} | ${x.bRelevant} | ${x.netRelevant >= 0 ? "+" : ""}${x.netRelevant} | ${x.deltaP10 >= 0 ? "+" : ""}${x.deltaP10} | ${x.ordinalDelta >= 0 ? "+" : ""}${x.ordinalDelta} |`;
}).join("\n");

const md = `# Interdisciplinary conjunction v1 · fresh holdout human audit\n\nHuman adjudication of all ${judgments.length} changed Top-10 query-document pairs from the preregistered same-pool holdout. Relevance threshold is >=${relevantThreshold}. Shared Top-10 documents cancel, so the paired ΔP@10 below is exact for this frozen run.\n\n> Fresh internal holdout with one human adjudicator. This is stronger evidence than the tuning set, but it is not independent external validation and should not be reused to tune conjunction-v1 weights.\n\n## Summary\n\n- judged changed pairs: ${judgments.length}\n- judgments with comments: ${report.comments}/${judgments.length}\n- distribution: ${JSON.stringify(distribution)}\n- A-only / B-only: ${aOnly}/${bOnly}\n- A-only relevant: ${aRelevant}\n- B-only relevant: ${bRelevant}\n- net relevant positions: ${netRelevant >= 0 ? "+" : ""}${netRelevant}\n- exact paired ΔP@10: ${deltaP10 >= 0 ? "+" : ""}${deltaP10}\n- ordinal relevance A/B: ${aOrdinal}/${bOrdinal}\n- ordinal Δ: ${ordinalDelta >= 0 ? "+" : ""}${ordinalDelta}\n- binary improved/worsened/tied queries: ${improved}/${worsened}/${tied}\n- ordinal improved/worsened/tied queries: ${ordinalImproved}/${ordinalWorsened}/${ordinalTied}\n\n## By family\n\n| family | queries | A rel | B rel | net | ΔP@10 | ordinal Δ |\n|---|---:|---:|---:|---:|---:|---:|\n${familyRows}\n\n## By language\n\n| language | queries | A rel | B rel | net | ΔP@10 | ordinal Δ |\n|---|---:|---:|---:|---:|---:|---:|\n${languageRows}\n\n## Per query\n\n| query | lang | changed pairs | A rel | B rel | net | ΔP@10 | ordinal Δ |\n|---|---|---:|---:|---:|---:|---:|---:|\n${queryRows}\n\n## Interpretation boundary\n\nThe exact paired ΔP@10 applies to the frozen 20-query same-pool holdout only. It does not provide absolute P@10 because unchanged Top-10 documents were intentionally not relabeled, and it is not an external population estimate. The holdout queries and labels must not be used to retune conjunction-v1 if this result is to remain validation evidence.\n`;

fs.writeFileSync(REPORT_MD_PATH, md, "utf8");

console.log("INTERDISCIPLINARY CONJUNCTION V1 HOLDOUT HUMAN ANALYSIS: PASS");
console.log(`judgments=${judgments.length}`);
console.log(`distribution=${JSON.stringify(distribution)}`);
console.log(`comments=${report.comments}/${judgments.length}`);
console.log(`A_only_relevant=${aRelevant}`);
console.log(`B_only_relevant=${bRelevant}`);
console.log(`net_relevant=${netRelevant}`);
console.log(`exact_paired_delta_p10=${deltaP10}`);
console.log(`ordinal_delta=${ordinalDelta}`);
console.log(`queries_binary=${improved}/${worsened}/${tied}`);
console.log(`judgments_out=${path.relative(ROOT, JUDGMENTS_PATH)}`);
console.log(`json=${path.relative(ROOT, REPORT_JSON_PATH)}`);
console.log(`markdown=${path.relative(ROOT, REPORT_MD_PATH)}`);
