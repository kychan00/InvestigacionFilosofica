import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { readJsonl } from '../core/jsonl.mjs';
import { sha256Text } from '../core/hashing.mjs';
import {
  averagePrecision,
  binaryMetrics,
  cohenKappaBinary,
  rocAuc,
  selectBestF1Threshold,
  spearman,
  thresholdSweep,
} from '../core/metrics.mjs';

const PATHS = {
  sample: 'benchmark/human-audit-v1.sample.jsonl',
  judgments: 'benchmark/human-audit-v1.judgments.jsonl',
  auditManifest: 'benchmark/human-audit-v1.manifest.json',
  qwen: 'benchmark/qwen3/scores/qwen3-reranker-v1.raw.jsonl',
  qwenMeta: 'benchmark/qwen3/scores/qwen3-reranker-v1.raw.meta.json',
  oldBaseline: 'benchmark/ai-silver-v1.jsonl',
  oldV2: 'benchmark/ai-silver-ranking-v2.jsonl',
  outputJson: 'benchmark/qwen3/reports/qwen3-reranker-v1.calibration.json',
  outputMd: 'benchmark/qwen3/reports/qwen3-reranker-v1.calibration.md',
};

const pairKey = (row) => `${row.query_id}\u0000${row.record_id}`;
const humanRelevant = (row) => row.human_relevance >= 2;
const qwenScore = (row) => row.qwen_raw_score;

function uniqueMap(rows, label) {
  const map = new Map();
  for (const row of rows) {
    const key = pairKey(row);
    if (map.has(key)) throw new Error(`${label}: duplicate pair ${row.query_id} / ${row.record_id}`);
    map.set(key, row);
  }
  return map;
}

function round(value, digits = 6) {
  if (value == null) return null;
  return Number(value.toFixed(digits));
}

function roundedMetrics(metrics) {
  return Object.fromEntries(Object.entries(metrics).map(([key, value]) => [
    key,
    typeof value === 'number' && !Number.isInteger(value) ? round(value) : value,
  ]));
}

function summarizeBinary(rows, predictionOf) {
  return {
    ...roundedMetrics(binaryMetrics(rows, { labelOf: humanRelevant, predictionOf })),
    cohen_kappa: round(cohenKappaBinary(rows, { labelOf: humanRelevant, predictionOf })),
  };
}

function breakdown(rows, field, threshold) {
  const groups = [...new Set(rows.map((row) => row[field] ?? 'unknown'))].sort();
  return Object.fromEntries(groups.map((group) => {
    const subset = rows.filter((row) => (row[field] ?? 'unknown') === group);
    return [group, {
      qwen: summarizeBinary(subset, (row) => row.qwen_raw_score >= threshold),
      historical_ai_composite: summarizeBinary(subset, (row) => row.old_ai_relevance >= 2),
    }];
  }));
}

function pairedSystemComparison(rows, oldField, threshold) {
  const subset = rows.filter((row) => Number.isInteger(row[oldField]));
  return {
    rows: subset.length,
    qwen: summarizeBinary(subset, (row) => row.qwen_raw_score >= threshold),
    historical_ai: summarizeBinary(subset, (row) => row[oldField] >= 2),
  };
}

function renderMarkdown(report) {
  const q05 = report.qwen.threshold_0_5;
  const qbest = report.qwen.best_f1;
  const old = report.historical_ai_silver.composite.binary;
  const baseline = report.historical_ai_silver.baseline_matched;
  const v2 = report.historical_ai_silver.ranking_v2_matched;
  const lines = [
    '# Qwen3 reranker calibration — development set',
    '',
    '> These 100 human-labeled pairs are development data for Qwen calibration/model selection. They are not an independent validation set for Qwen.',
    '',
    `- Pairs: ${report.rows}`,
    `- Human relevant (>=2): ${report.human.relevant}`,
    `- Human non-relevant (<2): ${report.human.non_relevant}`,
    `- Qwen ROC AUC: ${report.qwen.roc_auc}`,
    `- Qwen average precision: ${report.qwen.average_precision}`,
    `- Qwen Spearman vs 0–3 human relevance: ${report.qwen.spearman_ordinal}`,
    '',
    '## Binary comparison',
    '',
    '| System | Threshold | Accuracy | Precision | Recall | F1 | Balanced acc. | Kappa |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    `| Qwen | 0.5 | ${q05.accuracy} | ${q05.precision} | ${q05.recall} | ${q05.f1} | ${q05.balanced_accuracy} | ${q05.cohen_kappa} |`,
    `| Qwen (dev best F1) | ${qbest.threshold} | ${qbest.accuracy} | ${qbest.precision} | ${qbest.recall} | ${qbest.f1} | ${qbest.balanced_accuracy} | ${qbest.cohen_kappa} |`,
    `| Historical AI silver composite | relevance >= 2 | ${old.accuracy} | ${old.precision} | ${old.recall} | ${old.f1} | ${old.balanced_accuracy} | ${old.cohen_kappa} |`,
    '',
    '## Historical AI coverage',
    '',
    `- Composite rows: ${report.historical_ai_silver.composite.rows}`,
    `- Ranking-v2 label used when available: ${report.historical_ai_silver.composite.provenance.ranking_v2}`,
    `- Baseline fallback label used: ${report.historical_ai_silver.composite.provenance.baseline_fallback}`,
    `- Baseline-only matched comparison rows: ${baseline.rows}`,
    `- Ranking-v2 matched comparison rows: ${v2.rows}`,
    '',
    'The composite is a convenience comparison because the human audit was sampled from the union of baseline and ranking-v2 pools. Separate matched-subset comparisons are retained in the JSON report.',
    '',
    '## Interpretation boundary',
    '',
    '- The best-F1 threshold is tuned on these same 100 human labels and must not be treated as independent validation performance.',
    '- The human audit sample was drawn from the union of baseline and ranking-v2 pools, so neither historical silver file covers all 100 pairs by itself.',
    '- The historical composite uses ranking-v2 silver when that pair exists and baseline silver only as a documented fallback.',
    '- Qwen raw scores remain immutable; this report does not rewrite or discretize the raw score store.',
    '- No production ranking code is changed by this analysis.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const [
    sampleFile,
    judgmentsFile,
    qwenFile,
    baselineFile,
    v2File,
    auditManifestText,
    qwenMetaText,
  ] = await Promise.all([
    readJsonl(PATHS.sample),
    readJsonl(PATHS.judgments),
    readJsonl(PATHS.qwen),
    readJsonl(PATHS.oldBaseline),
    readJsonl(PATHS.oldV2),
    readFile(PATHS.auditManifest, 'utf8'),
    readFile(PATHS.qwenMeta, 'utf8'),
  ]);

  const sample = uniqueMap(sampleFile.records, 'sample');
  const judgments = uniqueMap(judgmentsFile.records, 'judgments');
  const qwen = uniqueMap(qwenFile.records, 'qwen');
  const oldBaseline = uniqueMap(baselineFile.records, 'old baseline silver');
  const oldV2 = uniqueMap(v2File.records, 'old ranking-v2 silver');
  const auditManifest = JSON.parse(auditManifestText);
  const manifestByAuditId = new Map(auditManifest.items.map((row) => [row.audit_id, row]));
  const qwenMeta = JSON.parse(qwenMetaText);

  if (sample.size !== 100 || judgments.size !== 100 || qwen.size !== 100) {
    throw new Error(`expected 100 sample/judgment/Qwen pairs; got ${sample.size}/${judgments.size}/${qwen.size}`);
  }
  if (auditManifest.sampleSize !== 100 || manifestByAuditId.size !== 100) {
    throw new Error('human audit manifest does not contain the frozen 100-item sample');
  }

  const rows = [];
  let rankingV2CompositeCount = 0;
  let baselineFallbackCount = 0;

  for (const [key, sampleRow] of sample) {
    const judgment = judgments.get(key);
    const qwenRow = qwen.get(key);
    const baselineRow = oldBaseline.get(key) ?? null;
    const v2Row = oldV2.get(key) ?? null;
    const manifestRow = manifestByAuditId.get(sampleRow.audit_id);

    if (!judgment || !qwenRow || !manifestRow) {
      throw new Error(`missing joined human/Qwen/manifest row for ${sampleRow.query_id} / ${sampleRow.record_id}`);
    }
    if (!baselineRow && !v2Row) {
      throw new Error(`no historical AI silver row for ${sampleRow.query_id} / ${sampleRow.record_id}`);
    }
    if (manifestRow.query_id !== sampleRow.query_id || manifestRow.record_id !== sampleRow.record_id) {
      throw new Error(`human audit manifest mismatch for ${sampleRow.audit_id}`);
    }
    if (baselineRow && manifestRow.baseline_silver !== baselineRow.relevance) {
      throw new Error(`baseline silver provenance mismatch for ${sampleRow.audit_id}`);
    }
    if (!baselineRow && manifestRow.baseline_silver !== null) {
      throw new Error(`baseline silver missing but manifest is non-null for ${sampleRow.audit_id}`);
    }
    if (v2Row && manifestRow.v2_silver !== v2Row.relevance) {
      throw new Error(`ranking-v2 silver provenance mismatch for ${sampleRow.audit_id}`);
    }
    if (!v2Row && manifestRow.v2_silver !== null) {
      throw new Error(`ranking-v2 silver missing but manifest is non-null for ${sampleRow.audit_id}`);
    }
    if (![0, 1, 2, 3].includes(judgment.human_relevance)) {
      throw new Error(`invalid human relevance for ${sampleRow.audit_id}`);
    }
    if (!(qwenRow.raw_score >= 0 && qwenRow.raw_score <= 1)) {
      throw new Error(`invalid Qwen score for ${sampleRow.audit_id}`);
    }

    const compositeRow = v2Row ?? baselineRow;
    const compositeSource = v2Row ? 'ranking-v2' : 'baseline-fallback';
    if (v2Row) rankingV2CompositeCount += 1;
    else baselineFallbackCount += 1;

    rows.push({
      audit_id: sampleRow.audit_id,
      query_id: sampleRow.query_id,
      record_id: sampleRow.record_id,
      query_language: sampleRow.query_language,
      intent: sampleRow.intent,
      family: sampleRow.family,
      human_relevance: judgment.human_relevance,
      qwen_raw_score: qwenRow.raw_score,
      old_ai_relevance: compositeRow.relevance,
      old_ai_source: compositeSource,
      baseline_ai_relevance: baselineRow?.relevance ?? null,
      v2_ai_relevance: v2Row?.relevance ?? null,
    });
  }

  const sweep = thresholdSweep(rows, { labelOf: humanRelevant, scoreOf: qwenScore });
  const best = selectBestF1Threshold(sweep);
  const qwen05 = summarizeBinary(rows, (row) => row.qwen_raw_score >= 0.5);
  const qwenBest = {
    threshold: round(best.threshold, 9),
    ...summarizeBinary(rows, (row) => row.qwen_raw_score >= best.threshold),
  };
  const oldCompositeBinary = summarizeBinary(rows, (row) => row.old_ai_relevance >= 2);
  const baselineMatched = pairedSystemComparison(rows, 'baseline_ai_relevance', best.threshold);
  const v2Matched = pairedSystemComparison(rows, 'v2_ai_relevance', best.threshold);

  const report = {
    schema_version: 'qwen3-calibration-report-v1',
    purpose: 'development-calibration',
    rows: rows.length,
    sources: {
      sample: { path: PATHS.sample, sha256: sha256Text(sampleFile.text) },
      judgments: { path: PATHS.judgments, sha256: sha256Text(judgmentsFile.text) },
      human_audit_manifest: { path: PATHS.auditManifest, sha256: sha256Text(auditManifestText) },
      qwen_raw_scores: { path: PATHS.qwen, sha256: sha256Text(qwenFile.text) },
      historical_ai_baseline: { path: PATHS.oldBaseline, sha256: sha256Text(baselineFile.text) },
      historical_ai_ranking_v2: { path: PATHS.oldV2, sha256: sha256Text(v2File.text) },
    },
    qwen_runtime: {
      model: qwenMeta.model,
      revision: qwenMeta.revision,
      scoring_version: qwenMeta.scoring_version,
      device: qwenMeta.device,
      dtype: qwenMeta.dtype,
    },
    human: {
      relevant_threshold: 2,
      relevant: rows.filter(humanRelevant).length,
      non_relevant: rows.filter((row) => !humanRelevant(row)).length,
    },
    qwen: {
      roc_auc: round(rocAuc(rows, { labelOf: humanRelevant, scoreOf: qwenScore })),
      average_precision: round(averagePrecision(rows, { labelOf: humanRelevant, scoreOf: qwenScore })),
      spearman_ordinal: round(spearman(rows, { xOf: qwenScore, yOf: (row) => row.human_relevance })),
      threshold_0_5: qwen05,
      best_f1: qwenBest,
      threshold_selection: 'development-only; maximize F1, then balanced accuracy, precision, then threshold',
    },
    historical_ai_silver: {
      composite: {
        rows: rows.length,
        policy: 'use ranking-v2 silver when present; otherwise baseline silver fallback',
        provenance: {
          ranking_v2: rankingV2CompositeCount,
          baseline_fallback: baselineFallbackCount,
        },
        binary: oldCompositeBinary,
        exact_ordinal_agreement: round(rows.filter((row) => row.old_ai_relevance === row.human_relevance).length / rows.length),
        spearman_ordinal: round(spearman(rows, { xOf: (row) => row.old_ai_relevance, yOf: (row) => row.human_relevance })),
      },
      baseline_matched: baselineMatched,
      ranking_v2_matched: v2Matched,
    },
    breakdowns: {
      language_at_qwen_best_f1: breakdown(rows, 'query_language', best.threshold),
      intent_at_qwen_best_f1: breakdown(rows, 'intent', best.threshold),
      family_at_qwen_best_f1: breakdown(rows, 'family', best.threshold),
    },
    caveats: [
      'These 100 human labels are development data for Qwen calibration/model selection.',
      'Best-F1 threshold performance is in-sample and is not independent validation evidence.',
      'The human audit sample was drawn from the union of baseline and ranking-v2 pools, so neither historical silver artifact covers all 100 pairs alone.',
      'The 100-row historical silver composite uses ranking-v2 silver when available and baseline silver as a documented fallback.',
      'Separate baseline-matched and ranking-v2-matched comparisons are reported to avoid hiding source coverage differences.',
      'Raw Qwen scores are not modified by this analysis.',
      'No production ranking code is changed.',
    ],
  };

  await mkdir(dirname(PATHS.outputJson), { recursive: true });
  await writeFile(PATHS.outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(PATHS.outputMd, renderMarkdown(report), 'utf8');

  console.log('Qwen3 calibration complete');
  console.log(`rows=${report.rows}`);
  console.log(`human_relevant=${report.human.relevant}`);
  console.log(`qwen_roc_auc=${report.qwen.roc_auc}`);
  console.log(`qwen_average_precision=${report.qwen.average_precision}`);
  console.log(`qwen_f1_at_0_5=${report.qwen.threshold_0_5.f1}`);
  console.log(`qwen_best_f1_threshold=${report.qwen.best_f1.threshold}`);
  console.log(`qwen_best_f1=${report.qwen.best_f1.f1}`);
  console.log(`old_ai_composite_f1=${report.historical_ai_silver.composite.binary.f1}`);
  console.log(`old_ai_composite_v2_rows=${report.historical_ai_silver.composite.provenance.ranking_v2}`);
  console.log(`old_ai_composite_baseline_fallback_rows=${report.historical_ai_silver.composite.provenance.baseline_fallback}`);
  console.log(`output=${PATHS.outputJson}`);
}

await main();
