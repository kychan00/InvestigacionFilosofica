import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sha256Text } from '../core/hashing.mjs';
import { readJsonl, serializeJsonl, writeJsonlAtomic } from '../core/jsonl.mjs';
import { buildQwen3Dataset } from './build_dataset.mjs';
import { qwen3DatasetKeys } from './contracts.mjs';

const SOURCE = 'benchmark/qwen3/ranking/validation/runs/qwen3-ranking-holdout-v1-production-pool-e10bbc4.jsonl';
const OUTPUT = 'benchmark/qwen3/ranking/validation/datasets/qwen3-ranking-holdout-v1.jsonl';
const META = 'benchmark/qwen3/ranking/validation/datasets/qwen3-ranking-holdout-v1.meta.json';
const SOURCE_SHA256 = '26e39978dac68d37975732e2877830d58affc93a4e8c206edd4abd98f6b5d949';
const SOURCE_META_SHA256 = '0de6853b1b4e71fab74876152d0af41d8a5c242cbad7b0a936283a0f26a36918';
const SOURCE_FREEZE_COMMIT = '9c1bf8b';
const EXPECTED_ROWS = 500;
const EXPECTED_QUERIES = 25;
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
    throw new Error(`ranking holdout pool row mismatch: expected ${EXPECTED_ROWS}, got ${records.length}`);
  }

  const byQuery = new Map();
  for (const row of records) {
    const queryId = String(row.query_id || '');
    if (!byQuery.has(queryId)) byQuery.set(queryId, []);
    byQuery.get(queryId).push(row);
  }

  if (byQuery.size !== EXPECTED_QUERIES) {
    throw new Error(`ranking holdout query mismatch: expected ${EXPECTED_QUERIES}, got ${byQuery.size}`);
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

export async function buildRankingHoldoutDataset() {
  const sourcePath = resolve(SOURCE);
  const outputPath = resolve(OUTPUT);
  const metaPath = resolve(META);

  const { text: sourceText, records: sourceRecords } = await readJsonl(sourcePath);
  const actualSourceSha = sha256Text(sourceText);
  if (actualSourceSha !== SOURCE_SHA256) {
    throw new Error(`ranking holdout pool SHA mismatch: expected ${SOURCE_SHA256}, got ${actualSourceSha}`);
  }

  validateFrozenPool(sourceRecords);

  const { records, stats } = buildQwen3Dataset(
    sourceRecords.map(toModelInputSource),
  );

  if (records.length !== EXPECTED_ROWS) {
    throw new Error(`Qwen holdout dataset row mismatch: expected ${EXPECTED_ROWS}, got ${records.length}`);
  }
  if (stats.duplicate_rows_removed !== 0) {
    throw new Error(`Qwen ranking holdout dataset unexpectedly removed ${stats.duplicate_rows_removed} duplicate rows`);
  }
  if (stats.unique_queries !== EXPECTED_QUERIES) {
    throw new Error(`Qwen holdout dataset query mismatch: expected ${EXPECTED_QUERIES}, got ${stats.unique_queries}`);
  }

  const outputText = serializeJsonl(records);
  await writeJsonlAtomic(outputPath, records);

  const metadata = {
    schema_version: 'qwen3-ranking-holdout-dataset-meta-v1',
    dataset_id: 'qwen3-ranking-holdout-v1-model-input',
    validation_id: 'qwen3-ranking-holdout-v1',
    purpose: 'fresh-ranking-validation-model-input',
    source_path: SOURCE,
    source_freeze_commit: SOURCE_FREEZE_COMMIT,
    source_sha256: SOURCE_SHA256,
    source_metadata_sha256: SOURCE_META_SHA256,
    dataset_path: OUTPUT,
    dataset_sha256: sha256Text(outputText),
    builder_commit: currentCommit(),
    row_count: records.length,
    unique_query_count: stats.unique_queries,
    unique_record_count: stats.unique_records,
    duplicate_rows_removed: stats.duplicate_rows_removed,
    contains_human_labels: false,
    contains_ranking_provenance: false,
    contains_provider_provenance: false,
    model_input_fields: qwen3DatasetKeys(),
    stripped_source_semantics: [
      'rank',
      'score',
      'relevanceLevel',
      'providers',
      'matchedQueries',
      'ranking',
      'urls',
      'citedBy',
      'doi',
      'journal',
      'publisher',
      'type',
    ],
  };

  await mkdir(dirname(metaPath), { recursive: true });
  await writeFile(metaPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  return { metadata, records };
}

async function main() {
  const result = await buildRankingHoldoutDataset();
  console.log('Qwen3 fresh ranking holdout dataset build complete');
  console.log(`rows=${result.metadata.row_count}`);
  console.log(`queries=${result.metadata.unique_query_count}`);
  console.log(`records=${result.metadata.unique_record_count}`);
  console.log(`duplicates_removed=${result.metadata.duplicate_rows_removed}`);
  console.log(`source_sha256=${result.metadata.source_sha256}`);
  console.log(`dataset_sha256=${result.metadata.dataset_sha256}`);
  console.log(`output=${result.metadata.dataset_path}`);
  console.log(`meta=${META}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
