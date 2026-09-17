import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  averagePrecision,
  binaryMetrics,
  rocAuc,
  selectBestF1Threshold,
  spearman,
  thresholdSweep,
} from '../scripts/benchmark/core/metrics.mjs';

const calibrationPath = new URL('../scripts/benchmark/qwen3/calibrate.mjs', import.meta.url);

test('binary metrics and threshold sweep are deterministic', () => {
  const rows = [
    { label: true, score: 0.9 },
    { label: true, score: 0.7 },
    { label: false, score: 0.4 },
    { label: false, score: 0.1 },
  ];
  const metrics = binaryMetrics(rows, {
    labelOf: (row) => row.label,
    predictionOf: (row) => row.score >= 0.5,
  });
  assert.equal(metrics.tp, 2);
  assert.equal(metrics.fp, 0);
  assert.equal(metrics.tn, 2);
  assert.equal(metrics.fn, 0);
  assert.equal(metrics.f1, 1);

  const sweep = thresholdSweep(rows, {
    labelOf: (row) => row.label,
    scoreOf: (row) => row.score,
  });
  assert.equal(selectBestF1Threshold(sweep).f1, 1);
});

test('continuous ranking metrics reward perfect separation', () => {
  const rows = [
    { query_id: 'q1', record_id: 'a', label: true, score: 0.9, grade: 3 },
    { query_id: 'q1', record_id: 'b', label: true, score: 0.8, grade: 2 },
    { query_id: 'q1', record_id: 'c', label: false, score: 0.2, grade: 1 },
    { query_id: 'q1', record_id: 'd', label: false, score: 0.1, grade: 0 },
  ];
  assert.equal(rocAuc(rows, { labelOf: (row) => row.label, scoreOf: (row) => row.score }), 1);
  assert.equal(averagePrecision(rows, { labelOf: (row) => row.label, scoreOf: (row) => row.score }), 1);
  assert.equal(spearman(rows, { xOf: (row) => row.score, yOf: (row) => row.grade }), 1);
});

test('Qwen3 calibration joins humans, raw Qwen and historical silver without model inference', async () => {
  const source = await readFile(calibrationPath, 'utf8');
  assert.match(source, /human-audit-v1\.judgments\.jsonl/u);
  assert.match(source, /qwen3-reranker-v1\.raw\.jsonl/u);
  assert.match(source, /ai-silver-ranking-v2\.jsonl/u);
  assert.match(source, /human_relevance >= 2/u);
  assert.match(source, /development-calibration/u);
  assert.match(source, /Best-F1 threshold performance is in-sample/u);
  assert.doesNotMatch(source, /Qwen3RerankerAdapter/u);
  assert.doesNotMatch(source, /transformers/u);
  assert.doesNotMatch(source, /torch/u);
});
