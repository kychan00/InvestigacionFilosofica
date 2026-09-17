import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sha256Text, stableJson } from '../core/hashing.mjs';
import { readJsonl, serializeJsonl, writeJsonlAtomic } from '../core/jsonl.mjs';
import {
  QWEN3_DATASET_SCHEMA,
  qwen3DatasetKeys,
  validateQwen3DatasetRecord,
} from './contracts.mjs';

const DEFAULTS = Object.freeze({
  datasetId: 'human-audit-v1-model-input',
  source: 'benchmark/human-audit-v1.sample.jsonl',
  output: 'benchmark/qwen3/datasets/human-audit-v1.jsonl',
  meta: 'benchmark/qwen3/datasets/human-audit-v1.meta.json',
});

function cleanNullableString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function cleanAuthors(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((author) => typeof author === 'string')
    .map((author) => author.trim())
    .filter(Boolean);
}

function cleanYear(value) {
  if (Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d{1,4}$/u.test(value.trim())) {
    return Number.parseInt(value, 10);
  }
  return null;
}

export function toQwen3DatasetRecord(sourceRecord) {
  const record = {
    schema_version: QWEN3_DATASET_SCHEMA,
    query_id: String(sourceRecord.query_id ?? '').trim(),
    query: String(sourceRecord.query ?? '').trim(),
    record_id: String(sourceRecord.record_id ?? '').trim(),
    title: String(sourceRecord.title ?? '').trim(),
    abstract: cleanNullableString(sourceRecord.abstract),
    authors: cleanAuthors(sourceRecord.authors),
    year: cleanYear(sourceRecord.year),
    document_language: cleanNullableString(sourceRecord.document_language),
  };

  return validateQwen3DatasetRecord(record);
}

export function buildQwen3Dataset(sourceRecords) {
  if (!Array.isArray(sourceRecords)) {
    throw new TypeError('buildQwen3Dataset expects an array');
  }

  const output = [];
  const seen = new Map();
  let duplicateRows = 0;

  for (const sourceRecord of sourceRecords) {
    const record = toQwen3DatasetRecord(sourceRecord);
    const pairKey = `${record.query_id}\u0000${record.record_id}`;
    const canonical = stableJson(record);

    if (seen.has(pairKey)) {
      duplicateRows += 1;
      if (seen.get(pairKey) !== canonical) {
        throw new Error(`conflicting duplicate query-document pair: ${record.query_id} / ${record.record_id}`);
      }
      continue;
    }

    seen.set(pairKey, canonical);
    output.push(record);
  }

  return {
    records: output,
    stats: {
      source_rows: sourceRecords.length,
      output_rows: output.length,
      duplicate_rows_removed: duplicateRows,
      unique_queries: new Set(output.map((record) => record.query_id)).size,
      unique_records: new Set(output.map((record) => record.record_id)).size,
    },
  };
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  const aliases = new Map([
    ['--dataset-id', 'datasetId'],
    ['--source', 'source'],
    ['--output', 'output'],
    ['--meta', 'meta'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const key = aliases.get(flag);
    if (!key) throw new Error(`unknown argument: ${flag}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${flag} requires a value`);
    }
    options[key] = value;
    index += 1;
  }

  return options;
}

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function buildDatasetMetadata({
  datasetId,
  sourcePath,
  sourceText,
  outputText,
  records,
  stats,
  builderCommit,
}) {
  return {
    schema_version: 'qwen3-dataset-meta-v1',
    dataset_id: datasetId,
    purpose: 'development-model-input',
    source_path: sourcePath,
    source_sha256: sha256Text(sourceText),
    dataset_sha256: sha256Text(outputText),
    builder_commit: builderCommit,
    row_count: records.length,
    unique_query_count: stats.unique_queries,
    unique_record_count: stats.unique_records,
    duplicate_rows_removed: stats.duplicate_rows_removed,
    contains_human_labels: false,
    contains_ranking_provenance: false,
    model_input_fields: qwen3DatasetKeys(),
  };
}

export async function buildDatasetFiles(options = DEFAULTS) {
  const sourcePath = resolve(options.source);
  const outputPath = resolve(options.output);
  const metaPath = resolve(options.meta);

  const { text: sourceText, records: sourceRecords } = await readJsonl(sourcePath);
  const { records, stats } = buildQwen3Dataset(sourceRecords);
  const outputText = serializeJsonl(records);

  await writeJsonlAtomic(outputPath, records);

  const metadata = buildDatasetMetadata({
    datasetId: options.datasetId,
    sourcePath: options.source,
    sourceText,
    outputText,
    records,
    stats,
    builderCommit: currentCommit(),
  });

  await mkdir(dirname(metaPath), { recursive: true });
  await writeFile(metaPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  return { records, stats, metadata, outputPath, metaPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await buildDatasetFiles(options);

  console.log('Qwen3 dataset build complete');
  console.log(`dataset_id=${result.metadata.dataset_id}`);
  console.log(`rows=${result.metadata.row_count}`);
  console.log(`queries=${result.metadata.unique_query_count}`);
  console.log(`records=${result.metadata.unique_record_count}`);
  console.log(`duplicates_removed=${result.metadata.duplicate_rows_removed}`);
  console.log(`dataset_sha256=${result.metadata.dataset_sha256}`);
  console.log(`output=${options.output}`);
  console.log(`meta=${options.meta}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
