import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sha256Text } from '../core/hashing.mjs';
import { readJsonl, serializeJsonl, writeJsonlAtomic } from '../core/jsonl.mjs';
import { buildQwen3Dataset } from './build_dataset.mjs';
import { qwen3DatasetKeys } from './contracts.mjs';

const SOURCE = 'benchmark/qwen3/browser/q8-confirmatory-holdout-v2/runs/qwen3-browser-q8-confirmatory-holdout-v2-production-pool.jsonl';
const SOURCE_META = 'benchmark/qwen3/browser/q8-confirmatory-holdout-v2/runs/qwen3-browser-q8-confirmatory-holdout-v2-production-pool.meta.json';
const OUTPUT = 'benchmark/qwen3/browser/q8-confirmatory-holdout-v2/datasets/qwen3-browser-q8-confirmatory-holdout-v2.jsonl';
const SOURCE_SHA256 = '122a9414377c10e4805639e5022cce926130efd17e82111abd4756d5be33f9f8';
const SOURCE_META_SHA256 = '782575648eaa1b9bc29a429cb9eb7f0f6896c4bb7532704d5f4f8e43ed8c3f75';
const SOURCE_FREEZE_COMMIT = '85f866ecc56bcfca5c53e00c2fdceb014ea77fbe';
const EXPECTED_ROWS = 600;
const EXPECTED_QUERIES = 30;
const EXPECTED_PER_QUERY = 20;

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function validateFrozenPool(records) {
  if (records.length !== EXPECTED_ROWS) {
    throw new Error(`confirmatory holdout pool row mismatch: expected ${EXPECTED_ROWS}, got ${records.length}`);
  }

  const byQuery = new Map();
  for (const row of records) {
    const queryId = String(row.query_id || '');
    if (!byQuery.has(queryId)) byQuery.set(queryId, []);
    byQuery.get(queryId).push(row);
  }

  if (byQuery.size !== EXPECTED_QUERIES) {
    throw new Error(`confirmatory holdout query mismatch: expected ${EXPECTED_QUERIES}, got ${byQuery.size}`);
  }

  for (const [queryId, rows] of byQuery) {
    if (rows.length !== EXPECTED_PER_QUERY) {
      throw new Error(`${queryId}: expected ${EXPECTED_PER_QUERY} rows, got ${rows.length}`);
    }

    const actualRanks = rows.map((row) => row.rank);
    const expectedRanks = Array.from({ length: EXPECTED_PER_QUERY }, (_, index) => index + 1);
    if (actualRanks.some((rank, index) => rank !== expectedRanks[index])) {
      throw new Error(`${queryId}: source ranks are not exactly 1..20`);
    }

    const pairIds = new Set(rows.map((row) => row.record_id));
    if (pairIds.size !== EXPECTED_PER_QUERY) {
      throw new Error(`${queryId}: duplicate record_id in frozen holdout pool`);
    }
  }
}

function toModelInputSource(row) {
  return {
    ...row,
    document_language: row.document_language ?? row.language ?? null,
  };
}

function validateFrozenMetadata(meta) {
  if (meta.run_sha256 !== SOURCE_SHA256) throw new Error('source metadata run SHA mismatch');
  if (meta.runtime_commit !== '35a938d43bd6c62a851ace8d56f1f6bdb0153124') throw new Error('retrieval runtime commit mismatch');
  if (meta.preregistration_sha256 !== '875910b573b56c5cba5fe586f95c621283cfdff6091f08ecbefb0a205cdf3c6e') throw new Error('preregistration SHA mismatch');
  if (meta.query_set_sha256 !== 'eeaeb32e9f0de28ddb8a95a74657810ecbb61afc9ff9ea2d797e155849125ad1') throw new Error('query-set SHA mismatch');
  if (meta.production_base_commit !== 'bb9689da2016ca26a08359e8655eca7a5b771937') throw new Error('production base mismatch');
  if (meta.production_ranking_changed !== false) throw new Error('production ranking changed during retrieval');
  if (meta.rows !== EXPECTED_ROWS || meta.query_count !== EXPECTED_QUERIES || meta.pool_depth !== EXPECTED_PER_QUERY) throw new Error('source metadata shape mismatch');
  if (meta.qwen_used_during_retrieval !== false) throw new Error('Qwen was used during retrieval');
  if (meta.browser_q8_used_during_retrieval !== false) throw new Error('browser q8 was used during retrieval');
  if (meta.human_labels_used_during_retrieval !== false) throw new Error('human labels were used during retrieval');
}

function assertCleanDataset(records, sourceRecords) {
  const expectedKeys = [...qwen3DatasetKeys()].sort();
  for (const [index, row] of records.entries()) {
    const actualKeys = Object.keys(row).sort();
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
      throw new Error(`dataset row ${index + 1} violates clean model-input field contract`);
    }
  }

  const sourcePairs = sourceRecords.map((row) => `${row.query_id}\u0000${row.record_id}`);
  const datasetPairs = records.map((row) => `${row.query_id}\u0000${row.record_id}`);
  if (JSON.stringify(sourcePairs) !== JSON.stringify(datasetPairs)) {
    throw new Error('dataset pair sequence differs from frozen production pool');
  }

  for (const [index, row] of records.entries()) {
    for (const key of ['rank','score','relevanceLevel','providers','matchedQueries','ranking','urls','citedBy','doi','journal','publisher','type','browser_q8_raw_score','qwen_raw_score','human_relevance']) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        throw new Error(`dataset row ${index + 1} contains forbidden field ${key}`);
      }
    }
  }
}

export async function buildBrowserQ8HumanHoldoutDataset({ writeOutput = false } = {}) {
  const sourcePath = resolve(SOURCE);
  const sourceMetaPath = resolve(SOURCE_META);
  const outputPath = resolve(OUTPUT);

  const { text: sourceText, records: sourceRecords } = await readJsonl(sourcePath);
  const sourceMetaText = fs.readFileSync(sourceMetaPath, 'utf8');

  const actualSourceSha = sha256Text(sourceText);
  const actualSourceMetaSha = sha256Text(sourceMetaText);
  if (actualSourceSha !== SOURCE_SHA256) {
    throw new Error(`frozen pool SHA mismatch: expected ${SOURCE_SHA256}, got ${actualSourceSha}`);
  }
  if (actualSourceMetaSha !== SOURCE_META_SHA256) {
    throw new Error(`frozen pool metadata SHA mismatch: expected ${SOURCE_META_SHA256}, got ${actualSourceMetaSha}`);
  }

  validateFrozenMetadata(JSON.parse(sourceMetaText));
  validateFrozenPool(sourceRecords);

  const { records, stats } = buildQwen3Dataset(sourceRecords.map(toModelInputSource));

  if (records.length !== EXPECTED_ROWS) throw new Error(`dataset row mismatch: expected ${EXPECTED_ROWS}, got ${records.length}`);
  if (stats.duplicate_rows_removed !== 0) throw new Error(`dataset unexpectedly removed ${stats.duplicate_rows_removed} duplicate rows`);
  if (stats.unique_queries !== EXPECTED_QUERIES) throw new Error(`dataset query mismatch: expected ${EXPECTED_QUERIES}, got ${stats.unique_queries}`);

  assertCleanDataset(records, sourceRecords);

  const outputText = serializeJsonl(records);
  const datasetSha256 = sha256Text(outputText);

  if (writeOutput) {
    if (fs.existsSync(outputPath)) throw new Error(`refusing to overwrite frozen dataset output: ${OUTPUT}`);
    await writeJsonlAtomic(outputPath, records);
  }

  return {
    dataset_sha256: datasetSha256,
    rows: records.length,
    unique_queries: stats.unique_queries,
    unique_records: stats.unique_records,
    duplicate_rows_removed: stats.duplicate_rows_removed,
    source_sha256: SOURCE_SHA256,
    source_metadata_sha256: SOURCE_META_SHA256,
    source_freeze_commit: SOURCE_FREEZE_COMMIT,
    builder_commit: currentCommit(),
    model_input_fields: qwen3DatasetKeys(),
    pair_sequence_identical_to_frozen_pool: true,
    contains_human_labels: false,
    contains_ranking_provenance: false,
    contains_provider_provenance: false,
    output: OUTPUT,
    output_written: writeOutput,
  };
}

async function main() {
  const preflight = process.argv.includes('--preflight');
  const run = process.argv.includes('--run');
  if (preflight === run) throw new Error('Specify exactly one of --preflight or --run');

  const result = await buildBrowserQ8HumanHoldoutDataset({ writeOutput: run });

  console.log(JSON.stringify({
    experiment_id: 'qwen3-browser-q8-confirmatory-holdout-v2',
    stage: 'model-input-dataset',
    mode: preflight ? 'preflight' : 'run',
    status: preflight ? 'preflight-passed-no-output' : 'dataset-built',
    ...result,
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
