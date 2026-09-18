import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { readJsonl } from '../core/jsonl.mjs';
import { sha256Text } from '../core/hashing.mjs';
import {
  averagePrecision,
  binaryMetrics,
  cohenKappaBinary,
  rocAuc,
  spearman,
} from '../core/metrics.mjs';

const PATHS = {
  sample: 'benchmark/qwen3/validation/qwen3-reranker-v1-holdout.sample.jsonl',
  judgments: 'benchmark/qwen3/validation/qwen3-reranker-v1-holdout.judgments.jsonl',
  judgmentsMeta: 'benchmark/qwen3/validation/qwen3-reranker-v1-holdout.judgments.meta.json',
  rawScores: 'benchmark/qwen3/validation/scores/qwen3-reranker-v1-holdout-v1.raw.jsonl',
  rawMeta: 'benchmark/qwen3/validation/scores/qwen3-reranker-v1-holdout-v1.raw.meta.json',
  predictions: 'benchmark/qwen3/validation/scores/qwen3-reranker-v1-holdout-v1.predictions.jsonl',
  predictionsMeta: 'benchmark/qwen3/validation/scores/qwen3-reranker-v1-holdout-v1.predictions.meta.json',
  developmentReport: 'benchmark/qwen3/reports/qwen3-reranker-v1.calibration.json',
  outputJson: 'benchmark/qwen3/validation/reports/qwen3-reranker-v1-holdout-v1.validation.json',
  outputMd: 'benchmark/qwen3/validation/reports/qwen3-reranker-v1-holdout-v1.validation.md',
};

const EXPECTED = {
  validationId: 'qwen3-reranker-v1-holdout-v1',
  rows: 100,
  sampleSha256: 'e8ccace4407ce9d235aefdf0a2cdc8ec36ec0d1df9843d9ae53611001f0f8942',
  judgmentsSha256: 'd9c260018e68c376e487486c38f57894e93abdf962de105ebc3a4fda72542c9c',
  rawScoresSha256: 'dc8cb4c9a377e7b4191e5299e274fe9a63af55cdea407026304a6c08a33b6f23',
  predictionsSha256: '27898e33a40b4b438946a69f616418697c6bd2862fb4e151dfbce09985657408',
  fixedThreshold: 0.679178715,
  scoreFreezeCommit: 'b8c4a7a',
  judgmentFreezeCommit: 'ad19e80',
};

const pairKey = (row) => `${row.query_id}\u0000${row.record_id}`;
const humanRelevant = (row) => row.human_relevance >= 2;
const scoreOf = (row) => row.qwen_raw_score;

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

function summarizeBinary(rows) {
  return {
    ...roundedMetrics(binaryMetrics(rows, {
      labelOf: humanRelevant,
      predictionOf: (row) => row.qwen_prediction,
    })),
    cohen_kappa: round(cohenKappaBinary(rows, {
      labelOf: humanRelevant,
      predictionOf: (row) => row.qwen_prediction,
    })),
  };
}

function uniqueMap(rows, label, keyOf = pairKey) {
  const map = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (map.has(key)) throw new Error(`${label}: duplicate key ${key}`);
    map.set(key, row);
  }
  return map;
}

function breakdown(rows, field) {
  const groups = [...new Set(rows.map((row) => row[field] ?? 'unknown'))].sort();
  return Object.fromEntries(groups.map((group) => {
    const subset = rows.filter((row) => (row[field] ?? 'unknown') === group);
    return [group, summarizeBinary(subset)];
  }));
}

function renderMarkdown(report) {
  const m = report.qwen.fixed_threshold;
  const dev = report.development_reference;
  const lines = [
    '# Qwen3 reranker — fresh holdout validation',
    '',
    '> Fresh 100-pair multilingual holdout. Qwen scores and binary predictions were frozen before the human judgments were frozen. The candidate threshold was fixed from development and was not retuned on this holdout.',
    '',
    `- Pairs: ${report.rows}`,
    `- Human relevant (>=2): ${report.human.relevant}`,
    `- Human non-relevant (<2): ${report.human.non_relevant}`,
    `- Frozen threshold: ${report.qwen.threshold}`,
    `- ROC AUC: ${report.qwen.roc_auc}`,
    `- Average precision: ${report.qwen.average_precision}`,
    `- Spearman vs human 0–3: ${report.qwen.spearman_ordinal}`,
    '',
    '## Frozen-threshold performance',
    '',
    '| Accuracy | Precision | Recall | Specificity | F1 | Balanced acc. | Kappa | TP | FP | TN | FN |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    `| ${m.accuracy} | ${m.precision} | ${m.recall} | ${m.specificity} | ${m.f1} | ${m.balanced_accuracy} | ${m.cohen_kappa} | ${m.tp} | ${m.fp} | ${m.tn} | ${m.fn} |`,
    '',
    '## Development reference',
    '',
    `- Development best-F1 threshold: ${dev.threshold}`,
    `- Development F1 at that threshold: ${dev.f1}`,
    `- Fresh holdout F1 at the frozen same threshold: ${m.f1}`,
    `- F1 delta (holdout - development): ${dev.f1_delta_holdout_minus_development}`,
    '',
    '## Breakdown by intent',
    '',
    ...Object.entries(report.breakdowns.intent).map(([name, value]) =>
      `- ${name}: n=${value.n}, F1=${value.f1}, precision=${value.precision}, recall=${value.recall}, balanced_accuracy=${value.balanced_accuracy}`
    ),
    '',
    '## Error profile',
    '',
    `- False positives: ${report.errors.false_positives.length}`,
    `- False negatives: ${report.errors.false_negatives.length}`,
    '- Full error rows, language/family breakdowns, and immutable source hashes are preserved in the JSON report.',
    '',
    '## Interpretation boundaries',
    '',
    '- The threshold was selected only on development labels and was not retuned on this holdout.',
    '- Human judgments were frozen after Qwen raw scores and predictions were frozen.',
    '- The holdout has 80% binary-positive human labels, so accuracy and average precision should be interpreted alongside specificity, balanced accuracy, kappa, ROC AUC, and the confusion matrix.',
    '- One human adjudicator supplied the labels.',
    '- The adjudicator used some external bibliographic/source checking while judging individual cases; the judgment metadata records this protocol note.',
    '- Before manual adjudication, the adjudicator had previously seen document titles/abstracts during a dataset check, but not Qwen outputs, retrieval ranks, production scores, or provider provenance.',
    '- This validates the Qwen relevance classifier/score on the sampled query-document pairs; it does not by itself validate an end-to-end production reranking integration.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const [
    sampleFile,
    judgmentsFile,
    rawFile,
    predictionsFile,
    judgmentsMetaText,
    rawMetaText,
    predictionsMetaText,
    developmentText,
  ] = await Promise.all([
    readJsonl(PATHS.sample),
    readJsonl(PATHS.judgments),
    readJsonl(PATHS.rawScores),
    readJsonl(PATHS.predictions),
    readFile(PATHS.judgmentsMeta, 'utf8'),
    readFile(PATHS.rawMeta, 'utf8'),
    readFile(PATHS.predictionsMeta, 'utf8'),
    readFile(PATHS.developmentReport, 'utf8'),
  ]);

  const sourceHashes = {
    sample: sha256Text(sampleFile.text),
    judgments: sha256Text(judgmentsFile.text),
    raw_scores: sha256Text(rawFile.text),
    predictions: sha256Text(predictionsFile.text),
  };
  if (sourceHashes.sample !== EXPECTED.sampleSha256) throw new Error('sample SHA mismatch');
  if (sourceHashes.judgments !== EXPECTED.judgmentsSha256) throw new Error('judgments SHA mismatch');
  if (sourceHashes.raw_scores !== EXPECTED.rawScoresSha256) throw new Error('raw scores SHA mismatch');
  if (sourceHashes.predictions !== EXPECTED.predictionsSha256) throw new Error('predictions SHA mismatch');

  const judgmentsMeta = JSON.parse(judgmentsMetaText);
  const rawMeta = JSON.parse(rawMetaText);
  const predictionsMeta = JSON.parse(predictionsMetaText);
  const development = JSON.parse(developmentText);

  if (judgmentsMeta.score_freeze_commit !== EXPECTED.scoreFreezeCommit) {
    throw new Error('human judgment metadata score-freeze provenance mismatch');
  }
  if (predictionsMeta.fixed_binary_threshold !== EXPECTED.fixedThreshold) {
    throw new Error('prediction metadata threshold mismatch');
  }
  if (predictionsMeta.threshold_retuning !== false) {
    throw new Error('prediction metadata permits holdout threshold retuning');
  }
  if (predictionsMeta.human_labels_used !== false) {
    throw new Error('prediction metadata says human labels were used');
  }
  if (rawMeta.dataset_sha256 !== predictionsMeta.dataset_sha256) {
    throw new Error('raw-score/prediction dataset provenance mismatch');
  }

  const sampleByPair = uniqueMap(sampleFile.records, 'sample');
  const judgmentsByAudit = uniqueMap(judgmentsFile.records, 'judgments', (row) => row.audit_id);
  const rawByPair = uniqueMap(rawFile.records, 'raw scores');
  const predictionsByPair = uniqueMap(predictionsFile.records, 'predictions');

  if (
    sampleByPair.size !== EXPECTED.rows
    || judgmentsByAudit.size !== EXPECTED.rows
    || rawByPair.size !== EXPECTED.rows
    || predictionsByPair.size !== EXPECTED.rows
  ) {
    throw new Error('expected exactly 100 sample/judgment/raw/prediction rows');
  }

  const rows = [];
  for (const sampleRow of sampleFile.records) {
    const judgment = judgmentsByAudit.get(sampleRow.audit_id);
    const raw = rawByPair.get(pairKey(sampleRow));
    const prediction = predictionsByPair.get(pairKey(sampleRow));

    if (!judgment || !raw || !prediction) {
      throw new Error(`missing joined holdout row for ${sampleRow.audit_id}`);
    }
    if (judgment.query_id !== sampleRow.query_id || judgment.record_id !== sampleRow.record_id) {
      throw new Error(`judgment pair mismatch for ${sampleRow.audit_id}`);
    }
    if (raw.raw_score !== prediction.raw_score) {
      throw new Error(`raw/prediction score mismatch for ${sampleRow.audit_id}`);
    }
    if (prediction.fixed_threshold !== EXPECTED.fixedThreshold) {
      throw new Error(`threshold drift for ${sampleRow.audit_id}`);
    }
    if (prediction.predicted_relevant !== (raw.raw_score >= EXPECTED.fixedThreshold)) {
      throw new Error(`prediction inconsistency for ${sampleRow.audit_id}`);
    }
    if (![0, 1, 2, 3].includes(judgment.human_relevance)) {
      throw new Error(`invalid human relevance for ${sampleRow.audit_id}`);
    }

    rows.push({
      audit_id: sampleRow.audit_id,
      query_id: sampleRow.query_id,
      record_id: sampleRow.record_id,
      query: sampleRow.query,
      title: sampleRow.title,
      query_language: sampleRow.query_language,
      document_language: sampleRow.document_language,
      family: sampleRow.family,
      intent: sampleRow.intent,
      human_relevance: judgment.human_relevance,
      qwen_raw_score: raw.raw_score,
      qwen_prediction: prediction.predicted_relevant,
    });
  }

  const fixed = summarizeBinary(rows);
  const developmentBest = development.qwen.best_f1;

  const falsePositives = rows
    .filter((row) => !humanRelevant(row) && row.qwen_prediction)
    .map((row) => ({
      audit_id: row.audit_id,
      query_id: row.query_id,
      record_id: row.record_id,
      query: row.query,
      title: row.title,
      human_relevance: row.human_relevance,
      qwen_raw_score: round(row.qwen_raw_score, 9),
    }));
  const falseNegatives = rows
    .filter((row) => humanRelevant(row) && !row.qwen_prediction)
    .map((row) => ({
      audit_id: row.audit_id,
      query_id: row.query_id,
      record_id: row.record_id,
      query: row.query,
      title: row.title,
      human_relevance: row.human_relevance,
      qwen_raw_score: round(row.qwen_raw_score, 9),
    }));

  const report = {
    schema_version: 'qwen3-fresh-holdout-validation-report-v1',
    validation_id: EXPECTED.validationId,
    purpose: 'fresh-holdout-validation',
    rows: rows.length,
    frozen_commits: {
      qwen_scores_and_predictions: EXPECTED.scoreFreezeCommit,
      human_judgments: EXPECTED.judgmentFreezeCommit,
    },
    sources: {
      sample: { path: PATHS.sample, sha256: sourceHashes.sample },
      judgments: { path: PATHS.judgments, sha256: sourceHashes.judgments },
      raw_scores: { path: PATHS.rawScores, sha256: sourceHashes.raw_scores },
      predictions: { path: PATHS.predictions, sha256: sourceHashes.predictions },
      development_report: {
        path: PATHS.developmentReport,
        sha256: sha256Text(developmentText),
      },
    },
    human: {
      relevant_threshold: 2,
      relevant: rows.filter(humanRelevant).length,
      non_relevant: rows.filter((row) => !humanRelevant(row)).length,
      ordinal_distribution: Object.fromEntries([0, 1, 2, 3].map((label) => [
        String(label),
        rows.filter((row) => row.human_relevance === label).length,
      ])),
    },
    qwen: {
      threshold: EXPECTED.fixedThreshold,
      threshold_source: predictionsMeta.threshold_source,
      threshold_retuned_on_holdout: false,
      roc_auc: round(rocAuc(rows, { labelOf: humanRelevant, scoreOf })),
      average_precision: round(averagePrecision(rows, { labelOf: humanRelevant, scoreOf })),
      spearman_ordinal: round(spearman(rows, {
        xOf: scoreOf,
        yOf: (row) => row.human_relevance,
      })),
      fixed_threshold: fixed,
    },
    development_reference: {
      threshold: developmentBest.threshold,
      f1: developmentBest.f1,
      holdout_f1_same_frozen_threshold: fixed.f1,
      f1_delta_holdout_minus_development: round(fixed.f1 - developmentBest.f1),
      note: 'Development F1 is in-sample threshold-selection performance; holdout F1 uses the threshold frozen before holdout retrieval.',
    },
    breakdowns: {
      language: breakdown(rows, 'query_language'),
      family: breakdown(rows, 'family'),
      intent: breakdown(rows, 'intent'),
    },
    errors: {
      false_positives: falsePositives,
      false_negatives: falseNegatives,
    },
    protocol: {
      qwen_scores_frozen_before_human_judgments: true,
      threshold_retuned_on_holdout: false,
      one_human_adjudicator: true,
      external_source_checking_during_adjudication: true,
      titles_abstracts_seen_before_adjudication_during_dataset_check: true,
      qwen_outputs_seen_before_or_during_adjudication: false,
      judgment_metadata_protocol_notes: judgmentsMeta.protocol_notes,
    },
    caveats: [
      'The binary-positive prevalence is 80/100, so class-imbalance-sensitive metrics must be read alongside specificity, balanced accuracy, kappa, ROC AUC, and the confusion matrix.',
      'One human adjudicator supplied the relevance labels.',
      'Some individual judgments used external source or bibliographic checking beyond the frozen title/abstract fields.',
      'The adjudicator had previously seen titles/abstracts during a dataset check, but did not see Qwen outputs, retrieval ranks, production scores, or provider provenance before/during adjudication.',
      'This report validates the frozen Qwen candidate on sampled query-document pairs; it does not by itself establish end-to-end ranking gains in production.',
    ],
  };

  await mkdir(dirname(PATHS.outputJson), { recursive: true });
  await writeFile(PATHS.outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(PATHS.outputMd, renderMarkdown(report), 'utf8');

  console.log('Qwen3 fresh holdout validation complete');
  console.log(`rows=${report.rows}`);
  console.log(`human_relevant=${report.human.relevant}`);
  console.log(`human_non_relevant=${report.human.non_relevant}`);
  console.log(`threshold=${report.qwen.threshold}`);
  console.log(`accuracy=${fixed.accuracy}`);
  console.log(`precision=${fixed.precision}`);
  console.log(`recall=${fixed.recall}`);
  console.log(`specificity=${fixed.specificity}`);
  console.log(`f1=${fixed.f1}`);
  console.log(`balanced_accuracy=${fixed.balanced_accuracy}`);
  console.log(`cohen_kappa=${fixed.cohen_kappa}`);
  console.log(`roc_auc=${report.qwen.roc_auc}`);
  console.log(`average_precision=${report.qwen.average_precision}`);
  console.log(`spearman_ordinal=${report.qwen.spearman_ordinal}`);
  console.log(`false_positives=${falsePositives.length}`);
  console.log(`false_negatives=${falseNegatives.length}`);
  console.log(`development_f1=${developmentBest.f1}`);
  console.log(`holdout_minus_development_f1=${report.development_reference.f1_delta_holdout_minus_development}`);
  console.log(`output=${PATHS.outputJson}`);
}

await main();
