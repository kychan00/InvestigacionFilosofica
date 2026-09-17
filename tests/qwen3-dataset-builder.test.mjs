import test from 'node:test';
import assert from 'node:assert/strict';

import { parseJsonlText, serializeJsonl } from '../scripts/benchmark/core/jsonl.mjs';
import { sha256Text } from '../scripts/benchmark/core/hashing.mjs';
import {
  buildDatasetMetadata,
  buildQwen3Dataset,
  toQwen3DatasetRecord,
} from '../scripts/benchmark/qwen3/build_dataset.mjs';
import { qwen3DatasetKeys } from '../scripts/benchmark/qwen3/contracts.mjs';

const source = {
  audit_id: 'H010',
  query_id: 'es-10',
  query: 'ontología en informática',
  record_id: 'doi:10.example/ontology',
  title: 'Ontology in Computer Science',
  abstract: 'A study of ontology engineering in computer science.',
  authors: ['Ada Example'],
  year: 2026,
  document_language: 'en',
  provider: 'Crossref',
  current_rank: 20,
  current_score: 22,
  human_relevance: 3,
  human_note: 'must never reach model input',
};

test('dataset builder strips labels, provider and ranking provenance', () => {
  const record = toQwen3DatasetRecord(source);
  assert.deepEqual(Object.keys(record), qwen3DatasetKeys());
  assert.equal(Object.hasOwn(record, 'human_relevance'), false);
  assert.equal(Object.hasOwn(record, 'provider'), false);
  assert.equal(Object.hasOwn(record, 'current_rank'), false);
});

test('dataset builder preserves the first identical query-document pair once', () => {
  const { records, stats } = buildQwen3Dataset([source, { ...source }]);
  assert.equal(records.length, 1);
  assert.equal(stats.source_rows, 2);
  assert.equal(stats.output_rows, 1);
  assert.equal(stats.duplicate_rows_removed, 1);
});

test('dataset builder rejects conflicting duplicate pairs', () => {
  assert.throws(
    () => buildQwen3Dataset([source, { ...source, title: 'Different title' }]),
    /conflicting duplicate query-document pair/u,
  );
});

test('JSONL utilities round-trip records and report line errors', () => {
  const record = toQwen3DatasetRecord(source);
  const text = serializeJsonl([record]);
  assert.deepEqual(parseJsonlText(text), [record]);
  assert.throws(
    () => parseJsonlText('{"ok":true}\n{broken}\n', { source: 'fixture.jsonl' }),
    /fixture\.jsonl: invalid JSON on line 2/u,
  );
});

test('dataset metadata fingerprints source and model-input dataset separately', () => {
  const { records, stats } = buildQwen3Dataset([source]);
  const sourceText = `${JSON.stringify(source)}\n`;
  const outputText = serializeJsonl(records);
  const meta = buildDatasetMetadata({
    datasetId: 'fixture',
    sourcePath: 'fixture.jsonl',
    sourceText,
    outputText,
    records,
    stats,
    builderCommit: 'abc123',
  });

  assert.equal(meta.source_sha256, sha256Text(sourceText));
  assert.equal(meta.dataset_sha256, sha256Text(outputText));
  assert.equal(meta.contains_human_labels, false);
  assert.equal(meta.contains_ranking_provenance, false);
  assert.equal(meta.row_count, 1);
});
