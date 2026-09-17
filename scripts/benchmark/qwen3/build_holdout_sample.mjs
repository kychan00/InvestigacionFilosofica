import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sha256Text } from '../core/hashing.mjs';
import { readJsonl, serializeJsonl, writeJsonlAtomic } from '../core/jsonl.mjs';
import { buildQwen3Dataset } from './build_dataset.mjs';
import { qwen3DatasetKeys } from './contracts.mjs';

export const HOLDOUT_PATHS = Object.freeze({
  prereg: 'benchmark/qwen3/validation/qwen3-reranker-v1-holdout.preregistered.json',
  run: 'benchmark/qwen3/validation/runs/qwen3-reranker-v1-holdout-v1-233ce94.jsonl',
  runMeta: 'benchmark/qwen3/validation/runs/qwen3-reranker-v1-holdout-v1-233ce94.meta.json',
  sample: 'benchmark/qwen3/validation/qwen3-reranker-v1-holdout.sample.jsonl',
  sampleMeta: 'benchmark/qwen3/validation/qwen3-reranker-v1-holdout.sample.meta.json',
  dataset: 'benchmark/qwen3/datasets/qwen3-reranker-v1-holdout-v1.jsonl',
  datasetMeta: 'benchmark/qwen3/datasets/qwen3-reranker-v1-holdout-v1.meta.json',
});

export const HOLDOUT_FINGERPRINTS = Object.freeze({
  preregSha256: '4e0e1525d5847d5a984fdca639c8a4e91d1239c10c789fb321c89b7b7f4391ce',
  runSha256: '228099a89a0eb2fac14db79fe462e7b291799b5c13fb05b0e38f31048e3485b3',
  retrievalRuntimeCommit: '233ce941d35bc71327a69796ee131d55782ad250',
  retrievalFreezeCommit: 'b49464d',
});

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

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
  return null;
}

function blindOrderKey(validationId, row) {
  return sha256Text(`${validationId}\u0000${row.query_id}\u0000${row.record_id}`);
}

function toBlindSampleRecord(row) {
  return {
    audit_id: null,
    query_id: row.query_id,
    query: row.query,
    query_language: row.query_language,
    family: row.family,
    intent: row.intent,
    record_id: row.record_id,
    title: String(row.title ?? '').trim(),
    authors: cleanAuthors(row.authors),
    year: cleanYear(row.year),
    type: cleanNullableString(row.type),
    document_language: cleanNullableString(row.language),
    journal: cleanNullableString(row.journal),
    publisher: cleanNullableString(row.publisher),
    abstract: cleanNullableString(row.abstract),
    human_relevance: null,
    human_note: '',
  };
}

export function buildHoldoutSampleRows(prereg, runRows) {
  const selectedRanks = prereg.query_design?.human_audit_ranks;
  if (!Array.isArray(selectedRanks) || selectedRanks.length === 0) {
    throw new Error('holdout preregistration is missing human_audit_ranks');
  }

  const byQuery = new Map();
  for (const row of runRows) {
    if (!byQuery.has(row.query_id)) byQuery.set(row.query_id, []);
    byQuery.get(row.query_id).push(row);
  }

  const selected = [];
  for (const query of prereg.queries) {
    const rows = byQuery.get(query.id) || [];
    const rankMap = new Map(rows.map((row) => [row.rank, row]));

    for (const rank of selectedRanks) {
      const row = rankMap.get(rank);
      if (!row) throw new Error(`${query.id}: missing preregistered rank ${rank}`);
      if (row.query !== query.query) throw new Error(`${query.id}: query text drift in frozen retrieval`);
      if (row.query_language !== query.language) throw new Error(`${query.id}: language drift in frozen retrieval`);
      if (row.family !== query.family) throw new Error(`${query.id}: family drift in frozen retrieval`);
      if (row.intent !== query.intent) throw new Error(`${query.id}: intent drift in frozen retrieval`);
      selected.push(row);
    }
  }

  const expected = Number(prereg.query_design.planned_human_pairs);
  if (selected.length !== expected) {
    throw new Error(`holdout sample row mismatch: expected ${expected}, got ${selected.length}`);
  }

  const pairKeys = new Set();
  for (const row of selected) {
    const key = `${row.query_id}\u0000${row.record_id}`;
    if (pairKeys.has(key)) throw new Error(`duplicate selected query-document pair: ${row.query_id} / ${row.record_id}`);
    pairKeys.add(key);
  }

  const ordered = selected
    .map((row) => ({ row, blindKey: blindOrderKey(prereg.validation_id, row) }))
    .sort((a, b) => a.blindKey.localeCompare(b.blindKey) || a.row.query_id.localeCompare(b.row.query_id) || a.row.record_id.localeCompare(b.row.record_id));

  return ordered.map(({ row }, index) => ({
    ...toBlindSampleRecord(row),
    audit_id: `QH${String(index + 1).padStart(3, '0')}`,
  }));
}

function assertBlindSample(sampleRows) {
  const forbidden = [
    'rank',
    'score',
    'relevanceLevel',
    'ranking',
    'providers',
    'matchedQueries',
    'urls',
    'citedBy',
    'qwen_score',
    'qwen_prediction',
  ];

  for (const row of sampleRows) {
    for (const field of forbidden) {
      if (Object.prototype.hasOwnProperty.call(row, field)) {
        throw new Error(`blind holdout sample leaked forbidden field: ${field}`);
      }
    }
    if (row.human_relevance !== null || row.human_note !== '') {
      throw new Error(`holdout sample unexpectedly contains a human judgment: ${row.audit_id}`);
    }
  }
}

async function writeJson(path, value) {
  const resolved = resolve(path);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function buildHoldoutArtifacts() {
  const preregPath = resolve(HOLDOUT_PATHS.prereg);
  const runPath = resolve(HOLDOUT_PATHS.run);
  const runMetaPath = resolve(HOLDOUT_PATHS.runMeta);

  const preregText = await (await import('node:fs/promises')).readFile(preregPath, 'utf8');
  const preregSha = sha256Text(preregText);
  if (preregSha !== HOLDOUT_FINGERPRINTS.preregSha256) {
    throw new Error(`preregistration SHA mismatch: expected ${HOLDOUT_FINGERPRINTS.preregSha256}, got ${preregSha}`);
  }
  const prereg = JSON.parse(preregText);

  const { text: runText, records: runRows } = await readJsonl(runPath);
  const runSha = sha256Text(runText);
  if (runSha !== HOLDOUT_FINGERPRINTS.runSha256) {
    throw new Error(`retrieval run SHA mismatch: expected ${HOLDOUT_FINGERPRINTS.runSha256}, got ${runSha}`);
  }

  const runMeta = JSON.parse(await (await import('node:fs/promises')).readFile(runMetaPath, 'utf8'));
  if (runMeta.run_sha256 !== HOLDOUT_FINGERPRINTS.runSha256) throw new Error('retrieval metadata run_sha256 mismatch');
  if (runMeta.runtime_commit !== HOLDOUT_FINGERPRINTS.retrievalRuntimeCommit) throw new Error('retrieval runtime commit mismatch');
  if (runMeta.qwen_used_during_retrieval !== false || runMeta.human_labels_used_during_retrieval !== false) {
    throw new Error('retrieval provenance indicates Qwen or human labels were used');
  }

  const sampleRows = buildHoldoutSampleRows(prereg, runRows);
  assertBlindSample(sampleRows);
  const sampleText = serializeJsonl(sampleRows);
  const sampleSha = sha256Text(sampleText);
  await writeJsonlAtomic(resolve(HOLDOUT_PATHS.sample), sampleRows);

  const byLanguage = Object.fromEntries(prereg.query_design.languages.map((language) => [language, 0]));
  const byIntent = {};
  const byFamily = {};
  for (const row of sampleRows) {
    byLanguage[row.query_language] = (byLanguage[row.query_language] || 0) + 1;
    byIntent[row.intent] = (byIntent[row.intent] || 0) + 1;
    byFamily[row.family] = (byFamily[row.family] || 0) + 1;
  }

  const sampleMeta = {
    schema_version: 'qwen3-holdout-sample-meta-v1',
    validation_id: prereg.validation_id,
    purpose: 'blind-human-holdout-sample',
    preregistration_path: HOLDOUT_PATHS.prereg,
    preregistration_sha256: preregSha,
    retrieval_run_path: HOLDOUT_PATHS.run,
    retrieval_run_sha256: runSha,
    retrieval_freeze_commit: HOLDOUT_FINGERPRINTS.retrievalFreezeCommit,
    sampling_ranks: [...prereg.query_design.human_audit_ranks],
    sampling_rule: prereg.query_design.sampling_rule,
    audit_order: 'deterministic SHA-256 order over validation_id + query_id + record_id; source retrieval rank is omitted',
    row_count: sampleRows.length,
    query_count: new Set(sampleRows.map((row) => row.query_id)).size,
    by_language: byLanguage,
    by_intent: byIntent,
    by_family: byFamily,
    sample_sha256: sampleSha,
    contains_retrieval_rank: false,
    contains_production_score: false,
    contains_provider_provenance: false,
    contains_qwen_outputs: false,
    contains_human_judgments: false,
    builder_commit: currentCommit(),
  };
  await writeJson(HOLDOUT_PATHS.sampleMeta, sampleMeta);

  const { records: datasetRows, stats } = buildQwen3Dataset(sampleRows);
  if (datasetRows.length !== sampleRows.length) {
    throw new Error(`model-input dataset unexpectedly removed rows: sample=${sampleRows.length}, dataset=${datasetRows.length}`);
  }
  const datasetText = serializeJsonl(datasetRows);
  const datasetSha = sha256Text(datasetText);
  await writeJsonlAtomic(resolve(HOLDOUT_PATHS.dataset), datasetRows);

  const datasetMeta = {
    schema_version: 'qwen3-dataset-meta-v1',
    dataset_id: 'qwen3-reranker-v1-holdout-v1-model-input',
    purpose: 'validation-model-input',
    source_path: HOLDOUT_PATHS.sample,
    source_sha256: sampleSha,
    dataset_sha256: datasetSha,
    builder_commit: currentCommit(),
    row_count: datasetRows.length,
    unique_query_count: stats.unique_queries,
    unique_record_count: stats.unique_records,
    duplicate_rows_removed: stats.duplicate_rows_removed,
    contains_human_labels: false,
    contains_ranking_provenance: false,
    model_input_fields: qwen3DatasetKeys(),
  };
  await writeJson(HOLDOUT_PATHS.datasetMeta, datasetMeta);

  return { sampleRows, sampleMeta, datasetRows, datasetMeta };
}

async function main() {
  const result = await buildHoldoutArtifacts();
  console.log('Qwen3 holdout sample build complete');
  console.log(`sample_rows=${result.sampleMeta.row_count}`);
  console.log(`sample_queries=${result.sampleMeta.query_count}`);
  console.log(`sample_sha256=${result.sampleMeta.sample_sha256}`);
  console.log(`dataset_sha256=${result.datasetMeta.dataset_sha256}`);
  console.log(`sample=${HOLDOUT_PATHS.sample}`);
  console.log(`sample_meta=${HOLDOUT_PATHS.sampleMeta}`);
  console.log(`dataset=${HOLDOUT_PATHS.dataset}`);
  console.log(`dataset_meta=${HOLDOUT_PATHS.datasetMeta}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
