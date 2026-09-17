import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { sha256Json, sha256Text } from '../scripts/benchmark/core/hashing.mjs';
import {
  QWEN3_DATASET_SCHEMA,
  QWEN3_SCORE_SCHEMA,
  buildQwen3DocumentText,
  validateQwen3DatasetRecord,
  validateQwen3ScoreRecord,
} from '../scripts/benchmark/qwen3/contracts.mjs';

const cleanDatasetRecord = {
  schema_version: QWEN3_DATASET_SCHEMA,
  query_id: 'smoke-es-01',
  query: 'ontología en informática',
  record_id: 'doi:10.example/test',
  title: 'Ontology in Computer Science',
  abstract: 'A document about ontology as used in computer science.',
  authors: ['Ada Example'],
  year: 2026,
  document_language: 'en',
};

test('Qwen3 dataset contract accepts only clean model input fields', () => {
  assert.equal(validateQwen3DatasetRecord(cleanDatasetRecord), cleanDatasetRecord);

  const leaked = {
    ...cleanDatasetRecord,
    current_rank: 20,
  };

  assert.throws(
    () => validateQwen3DatasetRecord(leaked),
    /forbidden\/unknown fields: current_rank/u,
  );
});

test('Qwen3 document formatter does not inject ranking or provider provenance', () => {
  const text = buildQwen3DocumentText(cleanDatasetRecord);

  assert.match(text, /Title: Ontology in Computer Science/u);
  assert.match(text, /Authors: Ada Example/u);
  assert.match(text, /Abstract: A document about ontology/u);
  assert.doesNotMatch(text, /rank|provider|Crossref|OpenAlex|conjunction/iu);
});

test('Qwen3 score contract keeps raw probability and reproducibility metadata separate', () => {
  const score = {
    schema_version: QWEN3_SCORE_SCHEMA,
    experiment_id: 'qwen3-reranker-v1',
    query_id: cleanDatasetRecord.query_id,
    record_id: cleanDatasetRecord.record_id,
    model: 'Qwen/Qwen3-Reranker-0.6B',
    revision: 'e61197ed45024b0ed8a2d74b80b4d909f1255473',
    instruction_sha256: 'a'.repeat(64),
    input_sha256: 'b'.repeat(64),
    raw_score: 0.873421,
    latency_ms: 42.5,
    device: 'mps',
    dtype: 'float16',
    max_length: 8192,
    cache_hit: false,
  };

  assert.equal(validateQwen3ScoreRecord(score), score);
  assert.throws(
    () => validateQwen3ScoreRecord({ ...score, raw_score: 1.01 }),
    /raw_score/u,
  );
});

test('stable hashing is independent of object key insertion order', () => {
  assert.equal(
    sha256Json({ b: 2, a: { d: 4, c: 3 } }),
    sha256Json({ a: { c: 3, d: 4 }, b: 2 }),
  );
});

test('frozen Qwen instruction hash matches experiment manifest', async () => {
  const instructionUrl = new URL(
    '../benchmark/qwen3/configs/qwen3-reranker-v1.instruction.txt',
    import.meta.url,
  );
  const manifestUrl = new URL(
    '../benchmark/qwen3/configs/qwen3-reranker-v1.experiment.json',
    import.meta.url,
  );

  const instruction = await readFile(instructionUrl, 'utf8');
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

  assert.equal(
    sha256Text(instruction),
    '5693a9a1377e10eb952d327aeec5c05cbbf040989feb786910b42e17cbf271a7',
  );
  assert.equal(manifest.instruction.sha256, sha256Text(instruction));
  assert.equal(manifest.base_commit, 'bb9689da2016ca26a08359e8655eca7a5b771937');
  assert.equal(manifest.model.revision, 'e61197ed45024b0ed8a2d74b80b4d909f1255473');
});
