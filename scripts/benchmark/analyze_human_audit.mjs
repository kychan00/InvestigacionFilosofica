import fs from "node:fs";

const HUMAN = "benchmark/human-audit-v1.judgments.jsonl";
const SAMPLE = "benchmark/human-audit-v1.sample.jsonl";
const MANIFEST = "benchmark/human-audit-v1.manifest.json";
const QUERIES = "benchmark/queries.json";
const BASE_RUN = "benchmark/runs/human-v1.0-1064fdb.jsonl";
const V2_RUN = "benchmark/runs/human-v1.0-ranking-v2-e6ad110.jsonl";
const BASE_SILVER = "benchmark/ai-silver-v1.jsonl";
const V2_SILVER = "benchmark/ai-silver-ranking-v2.jsonl";
const OUT_JSON = "benchmark/human-audit-v1.report.json";
const OUT_MD = "benchmark/human-audit-v1.report.md";

function readJsonl(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing file: ${path}`);
  }

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

function keyOf(queryId, recordId) {
  return `${queryId}\u0000${recordId}`;
}

function byKey(rows) {
  return new Map(rows.map(row => [keyOf(row.query_id, row.record_id), row]));
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : null;
}

function mean(values) {
  const usable = values.filter(Number.isFinite);
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function dcg(grades) {
  return grades.reduce((sum, grade, index) => {
    const gain = (2 ** grade) - 1;
    return sum + gain / Math.log2(index + 2);
  }, 0);
}

function binaryKappa(humanLabels, silverLabels, threshold) {
  if (!humanLabels.length || humanLabels.length !== silverLabels.length) return null;

  let agree = 0;
  let humanPositive = 0;
  let silverPositive = 0;

  for (let i = 0; i < humanLabels.length; i++) {
    const h = humanLabels[i] >= threshold;
    const s = silverLabels[i] >= threshold;
    agree += Number(h === s);
    humanPositive += Number(h);
    silverPositive += Number(s);
  }

  const n = humanLabels.length;
  const po = agree / n;
  const ph = humanPositive / n;
  const ps = silverPositive / n;
  const pe = ph * ps + (1 - ph) * (1 - ps);

  if (pe === 1) return po === 1 ? 1 : null;
  return (po - pe) / (1 - pe);
}

const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const human = readJsonl(HUMAN);
const sample = readJsonl(SAMPLE);
const baseRun = readJsonl(BASE_RUN);
const v2Run = readJsonl(V2_RUN);
const baseSilverRows = readJsonl(BASE_SILVER);
const v2SilverRows = readJsonl(V2_SILVER);

if (human.length !== 100) {
  throw new Error(`Expected 100 human judgments, found ${human.length}`);
}

const humanIds = new Set(human.map(row => row.audit_id));
if (humanIds.size !== 100) {
  throw new Error("Human judgments contain duplicate audit_id values.");
}

const manifestById = new Map(manifest.items.map(row => [row.audit_id, row]));
const sampleById = new Map(sample.map(row => [row.audit_id, row]));
const baseSilver = byKey(baseSilverRows);
const v2Silver = byKey(v2SilverRows);
const relevantThreshold = benchmark.evaluation?.relevantThreshold || 2;
const rankingDepth = benchmark.evaluation?.rankingDepth || 10;
const poolDepth = benchmark.evaluation?.poolDepth || 20;
const queryById = new Map(benchmark.queries.map(query => [query.id, query]));

const enrichedHuman = human.map(row => {
  const manifestRow = manifestById.get(row.audit_id);
  const sampleRow = sampleById.get(row.audit_id);

  if (!manifestRow || !sampleRow) {
    throw new Error(`Missing sample/manifest row for ${row.audit_id}`);
  }

  return {
    ...row,
    sample_group: manifestRow.sample_group,
    selection_reason: manifestRow.selection_reason,
    title: sampleRow.title,
    query: sampleRow.query,
    query_language: sampleRow.query_language,
    intent: sampleRow.intent,
  };
});

function agreementStats(rows, silverMap) {
  const matched = [];
  const matrix = Array.from({ length: 4 }, () => Array(4).fill(0));

  for (const row of rows) {
    const silver = silverMap.get(keyOf(row.query_id, row.record_id));
    if (!silver) continue;

    const h = Number(row.human_relevance);
    const s = Number(silver.relevance);
    if (!Number.isInteger(h) || h < 0 || h > 3 || !Number.isInteger(s)) continue;

    matrix[h][s]++;
    matched.push({ human: h, silver: s, row, silverRow: silver });
  }

  const n = matched.length;
  const exact = matched.filter(item => item.human === item.silver).length;
  const withinOne = matched.filter(item => Math.abs(item.human - item.silver) <= 1).length;
  const binaryAgree = matched.filter(item =>
    (item.human >= relevantThreshold) === (item.silver >= relevantThreshold)
  ).length;
  const falsePositives = matched.filter(item =>
    item.silver >= relevantThreshold && item.human < relevantThreshold
  ).length;
  const falseNegatives = matched.filter(item =>
    item.silver < relevantThreshold && item.human >= relevantThreshold
  ).length;

  return {
    n,
    exactAgreement: n ? round(exact / n) : null,
    withinOneAgreement: n ? round(withinOne / n) : null,
    binaryAgreement: n ? round(binaryAgree / n) : null,
    binaryKappa: round(binaryKappa(
      matched.map(item => item.human),
      matched.map(item => item.silver),
      relevantThreshold,
    )),
    meanAbsoluteGradeError: n
      ? round(mean(matched.map(item => Math.abs(item.human - item.silver))))
      : null,
    silverFalsePositives: falsePositives,
    silverFalseNegatives: falseNegatives,
    confusionHumanRowsSilverColumns: matrix,
  };
}

function agreementByGroup(silverMap) {
  return {
    all: agreementStats(enrichedHuman, silverMap),
    random_stratified: agreementStats(
      enrichedHuman.filter(row => row.sample_group === "random_stratified"),
      silverMap,
    ),
    targeted: agreementStats(
      enrichedHuman.filter(row => row.sample_group === "targeted"),
      silverMap,
    ),
  };
}

function correctedJudgmentMap(silverRows) {
  const corrected = new Map();

  for (const row of silverRows) {
    corrected.set(keyOf(row.query_id, row.record_id), { ...row });
  }

  for (const humanRow of enrichedHuman) {
    const key = keyOf(humanRow.query_id, humanRow.record_id);
    if (!corrected.has(key)) continue;

    corrected.set(key, {
      ...corrected.get(key),
      relevance: humanRow.human_relevance,
      relevance_source: "human_audit_v1",
      human_audit_id: humanRow.audit_id,
    });
  }

  return corrected;
}

function evaluate(runRows, judgmentMap) {
  const runByQuery = new Map();

  for (const row of runRows) {
    if (!runByQuery.has(row.query_id)) runByQuery.set(row.query_id, []);
    runByQuery.get(row.query_id).push(row);
  }

  for (const rows of runByQuery.values()) {
    rows.sort((a, b) => Number(a.rank) - Number(b.rank));
  }

  const perQuery = [];

  for (const query of benchmark.queries) {
    const pool = (runByQuery.get(query.id) || []).slice(0, poolDepth);
    const top = pool.slice(0, rankingDepth);
    const judgedTop = top.map(row => ({
      row,
      judgment: judgmentMap.get(keyOf(query.id, row.record_id)),
    }));
    const judgedPool = pool.map(row => ({
      row,
      judgment: judgmentMap.get(keyOf(query.id, row.record_id)),
    }));

    if (judgedPool.some(item => !item.judgment) || judgedTop.some(item => !item.judgment)) {
      throw new Error(`Missing judgment while evaluating ${query.id}`);
    }

    const top5 = judgedTop.slice(0, 5);
    const relevant5 = top5.filter(item => item.judgment.relevance >= relevantThreshold).length;
    const relevant10 = judgedTop.filter(item => item.judgment.relevance >= relevantThreshold).length;
    const relevantPool = judgedPool.filter(item => item.judgment.relevance >= relevantThreshold).length;
    const firstRelevant = judgedTop.findIndex(item => item.judgment.relevance >= relevantThreshold);
    const actualGrades = judgedTop.map(item => item.judgment.relevance);
    const idealGrades = judgedPool
      .map(item => item.judgment.relevance)
      .sort((a, b) => b - a)
      .slice(0, rankingDepth);
    const idealDcg = dcg(idealGrades);

    perQuery.push({
      id: query.id,
      language: query.language,
      intent: query.intent,
      precision5: top5.length ? relevant5 / top5.length : null,
      precision10: judgedTop.length ? relevant10 / judgedTop.length : null,
      recall10: relevantPool ? relevant10 / relevantPool : null,
      ndcg10: idealDcg > 0 ? dcg(actualGrades) / idealDcg : null,
      mrr10: firstRelevant >= 0 ? 1 / (firstRelevant + 1) : 0,
    });
  }

  const summarize = rows => ({
    queries: rows.length,
    precision5: round(mean(rows.map(row => row.precision5))),
    precision10: round(mean(rows.map(row => row.precision10))),
    recall10: round(mean(rows.map(row => row.recall10))),
    ndcg10: round(mean(rows.map(row => row.ndcg10))),
    mrr10: round(mean(rows.map(row => row.mrr10))),
  });

  const byLanguage = {};
  for (const language of benchmark.languages) {
    byLanguage[language] = summarize(perQuery.filter(row => row.language === language));
  }

  const byIntent = {};
  for (const intent of [...new Set(benchmark.queries.map(query => query.intent))]) {
    byIntent[intent] = summarize(perQuery.filter(row => row.intent === intent));
  }

  return {
    overall: summarize(perQuery),
    byLanguage,
    byIntent,
    perQuery: perQuery.map(row => ({
      ...row,
      precision5: round(row.precision5),
      precision10: round(row.precision10),
      recall10: round(row.recall10),
      ndcg10: round(row.ndcg10),
      mrr10: round(row.mrr10),
    })),
  };
}

function correctionSummary(runRows, silverMap) {
  const rankMap = new Map(runRows.map(row => [keyOf(row.query_id, row.record_id), row.rank]));
  let auditedInPool = 0;
  let gradeChanged = 0;
  let binaryChanged = 0;
  let top10Audited = 0;
  let top10GradeChanged = 0;
  let top10BinaryChanged = 0;

  for (const humanRow of enrichedHuman) {
    const key = keyOf(humanRow.query_id, humanRow.record_id);
    const silver = silverMap.get(key);
    if (!silver || !rankMap.has(key)) continue;

    auditedInPool++;
    const rank = Number(rankMap.get(key));
    const gradeDiff = Number(silver.relevance) !== Number(humanRow.human_relevance);
    const binaryDiff =
      (Number(silver.relevance) >= relevantThreshold) !==
      (Number(humanRow.human_relevance) >= relevantThreshold);

    gradeChanged += Number(gradeDiff);
    binaryChanged += Number(binaryDiff);

    if (rank <= rankingDepth) {
      top10Audited++;
      top10GradeChanged += Number(gradeDiff);
      top10BinaryChanged += Number(binaryDiff);
    }
  }

  return {
    auditedInPool,
    gradeChanged,
    binaryChanged,
    top10Audited,
    top10GradeChanged,
    top10BinaryChanged,
  };
}

const baseOriginal = evaluate(baseRun, baseSilver);
const v2Original = evaluate(v2Run, v2Silver);
const baseCorrected = evaluate(baseRun, correctedJudgmentMap(baseSilverRows));
const v2Corrected = evaluate(v2Run, correctedJudgmentMap(v2SilverRows));

const correctedPerQuery = benchmark.queries.map(query => {
  const base = baseCorrected.perQuery.find(row => row.id === query.id);
  const v2 = v2Corrected.perQuery.find(row => row.id === query.id);
  const delta = round(v2.precision10 - base.precision10);
  return {
    id: query.id,
    query: query.query,
    language: query.language,
    intent: query.intent,
    baselineP10: base.precision10,
    rankingV2P10: v2.precision10,
    deltaP10: delta,
  };
});

const correctedDirection = {
  improved: correctedPerQuery.filter(row => row.deltaP10 > 0).length,
  worsened: correctedPerQuery.filter(row => row.deltaP10 < 0).length,
  tied: correctedPerQuery.filter(row => row.deltaP10 === 0).length,
};

function binaryDisagreements(silverMap, label) {
  return enrichedHuman
    .map(row => {
      const silver = silverMap.get(keyOf(row.query_id, row.record_id));
      if (!silver) return null;
      const humanRelevant = row.human_relevance >= relevantThreshold;
      const silverRelevant = silver.relevance >= relevantThreshold;
      if (humanRelevant === silverRelevant) return null;
      return {
        audit_id: row.audit_id,
        reference: label,
        sample_group: row.sample_group,
        query_id: row.query_id,
        query: row.query,
        title: row.title,
        human_relevance: row.human_relevance,
        silver_relevance: silver.relevance,
        human_note: row.human_note || "",
      };
    })
    .filter(Boolean);
}

const report = {
  schemaVersion: 1,
  humanJudgments: HUMAN,
  sample: SAMPLE,
  manifest: MANIFEST,
  sampleDesign: manifest.design,
  sampleCounts: manifest.counts,
  relevantThreshold,
  agreement: {
    baselineSilver: agreementByGroup(baseSilver),
    rankingV2Silver: agreementByGroup(v2Silver),
  },
  corrections: {
    baseline: correctionSummary(baseRun, baseSilver),
    rankingV2: correctionSummary(v2Run, v2Silver),
  },
  sensitivity: {
    description: "Hybrid sensitivity analysis: the 100 audited document labels replace AI-silver relevance where available; all unaudited documents retain their original AI-silver labels. This is not a fully human-judged benchmark.",
    silverOnly: {
      baseline: baseOriginal,
      rankingV2: v2Original,
      deltaP10: round(v2Original.overall.precision10 - baseOriginal.overall.precision10),
    },
    humanCorrectedHybrid: {
      baseline: baseCorrected,
      rankingV2: v2Corrected,
      deltaP10: round(v2Corrected.overall.precision10 - baseCorrected.overall.precision10),
      queryDirection: correctedDirection,
      perQuery: correctedPerQuery,
    },
  },
  binaryDisagreements: {
    baselineSilver: binaryDisagreements(baseSilver, "baseline_silver"),
    rankingV2Silver: binaryDisagreements(v2Silver, "ranking_v2_silver"),
  },
  cautions: [
    "The random_stratified half is the appropriate subset for estimating ordinary AI-human agreement within the sampled Top-10 union; the targeted half is deliberately enriched for hard/error-prone cases.",
    "The 100-document audit is not a complete human judgment of either 1000-document pool.",
    "Human-corrected metrics are a sensitivity analysis, not pure human-gold metrics, because unaudited labels remain AI-silver.",
    "Recall@10 remains relative to each frozen Top-20 pool, not corpus-wide recall.",
  ],
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

function pct(value) {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function fmt(value) {
  return value == null ? "—" : String(value);
}

const md = [];
md.push("# Human audit v1 analysis");
md.push("");
md.push("100 blinded human judgments: 50 random-stratified + 50 targeted difficult cases.");
md.push("");
md.push("> The random-stratified half is the appropriate subset for estimating ordinary AI↔human agreement. The targeted half is intentionally harder and must not be treated as prevalence-representative.");
md.push("");
md.push("## AI ↔ human agreement");
md.push("");
md.push("| Silver reference | Group | n | Exact grade | Within ±1 | Binary agreement | Binary κ | Silver FP | Silver FN |");
md.push("|---|---|---:|---:|---:|---:|---:|---:|---:|");

for (const [referenceName, reference] of [
  ["Baseline", report.agreement.baselineSilver],
  ["Ranking v2", report.agreement.rankingV2Silver],
]) {
  for (const group of ["random_stratified", "targeted", "all"]) {
    const stat = reference[group];
    md.push(`| ${referenceName} | ${group} | ${stat.n} | ${pct(stat.exactAgreement)} | ${pct(stat.withinOneAgreement)} | ${pct(stat.binaryAgreement)} | ${fmt(stat.binaryKappa)} | ${stat.silverFalsePositives} | ${stat.silverFalseNegatives} |`);
  }
}

md.push("");
md.push("## Human corrections applied to frozen pools");
md.push("");
md.push("| Version | Audited in Top20 | Grade changed | Binary changed | Audited in Top10 | Top10 grade changed | Top10 binary changed |");
md.push("|---|---:|---:|---:|---:|---:|---:|");
for (const [name, item] of [
  ["Baseline", report.corrections.baseline],
  ["Ranking v2", report.corrections.rankingV2],
]) {
  md.push(`| ${name} | ${item.auditedInPool} | ${item.gradeChanged} | ${item.binaryChanged} | ${item.top10Audited} | ${item.top10GradeChanged} | ${item.top10BinaryChanged} |`);
}

md.push("");
md.push("## Sensitivity of Ranking v2 advantage");
md.push("");
md.push("> Hybrid sensitivity analysis: audited labels are human; unaudited labels remain AI-silver. This is **not** a fully human-gold benchmark.");
md.push("");
md.push("| Metric | Baseline silver | V2 silver | Δ silver | Baseline human-corrected | V2 human-corrected | Δ corrected |");
md.push("|---|---:|---:|---:|---:|---:|---:|");

for (const metric of ["precision5", "precision10", "recall10", "ndcg10", "mrr10"]) {
  const bo = baseOriginal.overall[metric];
  const vo = v2Original.overall[metric];
  const bc = baseCorrected.overall[metric];
  const vc = v2Corrected.overall[metric];
  md.push(`| ${metric} | ${bo} | ${vo} | ${round(vo - bo)} | ${bc} | ${vc} | ${round(vc - bc)} |`);
}

md.push("");
md.push(`Human-corrected P@10 query direction: **${correctedDirection.improved} improved / ${correctedDirection.worsened} worsened / ${correctedDirection.tied} tied**.`);
md.push("");
md.push("## Human-corrected per-query P@10 changes");
md.push("");
md.push("| Query | Lang | Intent | Baseline | Ranking v2 | Delta |");
md.push("|---|---|---|---:|---:|---:|");
for (const row of correctedPerQuery.filter(row => row.deltaP10 !== 0).sort((a, b) => a.deltaP10 - b.deltaP10)) {
  md.push(`| ${row.id} | ${row.language} | ${row.intent} | ${row.baselineP10} | ${row.rankingV2P10} | ${row.deltaP10} |`);
}

md.push("");
md.push("## Binary AI↔human disagreements");
md.push("");
for (const [title, rows] of [
  ["Baseline silver", report.binaryDisagreements.baselineSilver],
  ["Ranking v2 silver", report.binaryDisagreements.rankingV2Silver],
]) {
  md.push(`### ${title} (${rows.length})`);
  md.push("");
  for (const row of rows.slice(0, 30)) {
    md.push(`- **${row.audit_id} · ${row.query_id} · ${row.sample_group}** — human=${row.human_relevance}, silver=${row.silver_relevance} — ${row.title}${row.human_note ? ` — nota: ${row.human_note}` : ""}`);
  }
  if (rows.length > 30) md.push(`- … ${rows.length - 30} more in ${OUT_JSON}`);
  md.push("");
}

md.push("## Methodological cautions");
md.push("");
for (const caution of report.cautions) md.push(`- ${caution}`);
md.push("");

fs.writeFileSync(OUT_MD, md.join("\n"), "utf8");

console.log("HUMAN AUDIT ANALYSIS: PASS");
console.log("judgments=100");
console.log(`baseline_random_binary_agreement=${report.agreement.baselineSilver.random_stratified.binaryAgreement}`);
console.log(`v2_random_binary_agreement=${report.agreement.rankingV2Silver.random_stratified.binaryAgreement}`);
console.log(`silver_delta_p10=${report.sensitivity.silverOnly.deltaP10}`);
console.log(`human_corrected_delta_p10=${report.sensitivity.humanCorrectedHybrid.deltaP10}`);
console.log(`corrected_queries=${correctedDirection.improved}/${correctedDirection.worsened}/${correctedDirection.tied}`);
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);
