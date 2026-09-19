import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sha256Text } from '../core/hashing.mjs';
import { readJsonl, serializeJsonl, writeJsonlAtomic } from '../core/jsonl.mjs';

const AB_PATH = 'benchmark/qwen3/ranking/validation/runs/qwen3-ranking-holdout-v1-ab.jsonl';
const AB_META_PATH = 'benchmark/qwen3/ranking/validation/runs/qwen3-ranking-holdout-v1-ab.meta.json';
const AB_SHA256 = '6682bf7c19cd9acc77a589483977478857493e0a7f81ce1c086c83ce6c8851aa';
const AB_META_SHA256 = 'd4413cf9a87b0e2b4fc7a5b7fd28ea922509b851f75c34c45714d4d319ba6fe2';
const AB_FREEZE_COMMIT = '10afea1';

const SAMPLE_PATH = 'benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.sample.jsonl';
const SAMPLE_META_PATH = 'benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.sample.meta.json';
const WORKSHEET_PATH = 'benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.sample.txt';

const AUDIT_ID_PREFIX = 'QRH';
const AUDIT_VERSION = 'qwen3-ranking-holdout-v1-delta-audit-v1';
const EXPECTED_QUERIES = 25;
const EXPECTED_CHANGED_PAIRS = 160;
const EXPECTED_SIDE_COUNT = 80;
const RELEVANT_THRESHOLD = 2;

function key(queryId, recordId) {
  return `${queryId}\u0000${recordId}`;
}

function blindOrderKey(queryId, recordId) {
  return sha256Text(`${AUDIT_VERSION}\u0000${queryId}\u0000${recordId}`);
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

function publicRow(auditId, row) {
  return {
    audit_id: auditId,
    query: String(row.query || '').trim(),
    query_language: cleanNullableString(row.query_language),
    family: cleanNullableString(row.family),
    intent: cleanNullableString(row.intent),
    title: String(row.title || '').trim(),
    authors: cleanAuthors(row.authors),
    year: Number.isInteger(row.year) ? row.year : null,
    type: cleanNullableString(row.type),
    document_language: cleanNullableString(row.language),
    journal: cleanNullableString(row.journal),
    publisher: cleanNullableString(row.publisher),
    abstract: cleanNullableString(row.abstract),
    human_relevance: null,
    human_note: '',
  };
}

function assertBlindSample(rows) {
  const forbidden = [
    'condition',
    'rank',
    'original_rank',
    'qwen_raw_score',
    'score',
    'relevanceLevel',
    'record_id',
    'query_id',
    'doi',
    'providers',
    'matchedQueries',
    'ranking',
    'urls',
    'citedBy',
  ];

  for (const row of rows) {
    for (const field of forbidden) {
      if (Object.prototype.hasOwnProperty.call(row, field)) {
        throw new Error(`blind ranking holdout audit leaked forbidden field: ${field}`);
      }
    }
    if (row.human_relevance !== null || row.human_note !== '') {
      throw new Error(`blind ranking holdout audit unexpectedly contains judgment: ${row.audit_id}`);
    }
  }
}

function value(value, fallback = 'No disponible.') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function authorsText(authors) {
  if (!Array.isArray(authors) || authors.length === 0) return 'No disponibles.';
  return authors.join(', ');
}

function renderWorksheet(sample, metadata) {
  const header = [
    'AUDITORÍA HUMANA CIEGA · QWEN3 RANKING HOLDOUT V1',
    '',
    `Documentos por juzgar: ${metadata.row_count}`,
    `Consultas cubiertas: ${metadata.query_count}`,
    '',
    'OBJETIVO',
    'Juzgue únicamente qué tan relevante es cada documento para la consulta mostrada.',
    'El archivo oculta si el documento pertenece al Top 10 de producción o al Top 10 rerankeado por Qwen, además de rangos, scores, IDs y procedencia de recuperación.',
    '',
    'ESCALA',
    '0 · No relevante',
    'No aborda sustantivamente la consulta; es ruido o falso positivo.',
    '',
    '1 · Relacionado, pero insuficiente',
    'Hay relación temática, pero el filósofo, obra, concepto o problema consultado es periférico o insuficiente para satisfacer la consulta.',
    '',
    '2 · Relevante',
    'Aborda sustantivamente el objeto consultado como una parte importante del documento.',
    '',
    '3 · Central',
    'Está específicamente centrado y directamente dedicado al objeto de la consulta.',
    '',
    `Para el análisis binario posterior, relevante = ${RELEVANT_THRESHOLD} o 3.`,
    '',
    'Puede consultar la fuente original si el título/resumen es insuficiente, pero anótelo brevemente en la nota para conservar esa información metodológica.',
    '',
  ].join('\n');

  const blocks = sample.map((row) => [
    '============================================================',
    row.audit_id,
    '============================================================',
    '',
    'Consulta:',
    value(row.query),
    '',
    'Título:',
    value(row.title),
    '',
    'Autores:',
    authorsText(row.authors),
    '',
    'Año:',
    value(row.year),
    '',
    'Tipo:',
    value(row.type),
    '',
    'Idioma del documento:',
    value(row.document_language),
    '',
    'Revista:',
    value(row.journal),
    '',
    'Editorial:',
    value(row.publisher),
    '',
    'Resumen / abstract:',
    row.abstract ? String(row.abstract).trim() : 'Abstract no disponible.',
    '',
    'Respuesta:',
    '[0 / 1 / 2 / 3]',
    '',
    'Nota opcional:',
    '[Escriba aquí o déjelo vacío]',
    '',
  ].join('\n')).join('\n');

  return `${header}\n${blocks}\n`;
}

export async function buildRankingHoldoutDeltaAudit() {
  const [{ text: abText, records: abRows }, abMetaText] = await Promise.all([
    readJsonl(resolve(AB_PATH)),
    readFile(resolve(AB_META_PATH), 'utf8'),
  ]);

  const abSha = sha256Text(abText);
  const abMetaSha = sha256Text(abMetaText);
  if (abSha !== AB_SHA256) throw new Error(`A/B SHA mismatch: expected ${AB_SHA256}, got ${abSha}`);
  if (abMetaSha !== AB_META_SHA256) throw new Error(`A/B metadata SHA mismatch: expected ${AB_META_SHA256}, got ${abMetaSha}`);

  const abMeta = JSON.parse(abMetaText);
  if (abMeta.same_pool_per_condition !== true) throw new Error('A/B metadata does not preserve same pool');
  if (abMeta.human_labels_used !== false) throw new Error('A/B metadata indicates human labels were used');
  if (abMeta.qwen_model_called_during_ab_build !== false) throw new Error('A/B build unexpectedly called Qwen');

  const byQuery = new Map();
  for (const row of abRows) {
    if (!byQuery.has(row.query_id)) byQuery.set(row.query_id, { A: [], B: [] });
    const bucket = byQuery.get(row.query_id);
    if (!bucket[row.condition]) throw new Error(`unknown A/B condition: ${row.condition}`);
    bucket[row.condition].push(row);
  }

  if (byQuery.size !== EXPECTED_QUERIES) {
    throw new Error(`expected ${EXPECTED_QUERIES} queries, got ${byQuery.size}`);
  }

  const changed = [];
  for (const [queryId, conditions] of byQuery) {
    const a = conditions.A.sort((left, right) => Number(left.rank) - Number(right.rank));
    const b = conditions.B.sort((left, right) => Number(left.rank) - Number(right.rank));
    if (a.length !== 20 || b.length !== 20) throw new Error(`${queryId}: incomplete A/B pool`);

    const aById = new Map(a.map((row) => [row.record_id, row]));
    const bById = new Map(b.map((row) => [row.record_id, row]));
    if (aById.size !== 20 || bById.size !== 20) throw new Error(`${queryId}: duplicate records in A/B`);
    for (const recordId of aById.keys()) {
      if (!bById.has(recordId)) throw new Error(`${queryId}: A/B pool membership differs`);
    }

    const a10 = a.filter((row) => Number(row.rank) <= 10);
    const b10 = b.filter((row) => Number(row.rank) <= 10);
    const a10Ids = new Set(a10.map((row) => row.record_id));
    const b10Ids = new Set(b10.map((row) => row.record_id));
    const aOnly = a10.filter((row) => !b10Ids.has(row.record_id));
    const bOnly = b10.filter((row) => !a10Ids.has(row.record_id));
    if (aOnly.length !== bOnly.length) throw new Error(`${queryId}: asymmetric Top-10 delta`);

    for (const row of aOnly) {
      changed.push({
        query_id: queryId,
        record_id: row.record_id,
        side: 'A-only',
        public_source: row,
      });
    }

    for (const row of bOnly) {
      changed.push({
        query_id: queryId,
        record_id: row.record_id,
        side: 'B-only',
        public_source: row,
      });
    }
  }

  if (changed.length !== EXPECTED_CHANGED_PAIRS) {
    throw new Error(`expected ${EXPECTED_CHANGED_PAIRS} changed Top-10 pairs, got ${changed.length}`);
  }

  const changedKeys = new Set(changed.map((item) => key(item.query_id, item.record_id)));
  if (changedKeys.size !== EXPECTED_CHANGED_PAIRS) {
    throw new Error('duplicate query-document pair in changed Top-10 holdout audit set');
  }

  const sideCounts = {
    'A-only': changed.filter((item) => item.side === 'A-only').length,
    'B-only': changed.filter((item) => item.side === 'B-only').length,
  };
  if (sideCounts['A-only'] !== EXPECTED_SIDE_COUNT || sideCounts['B-only'] !== EXPECTED_SIDE_COUNT) {
    throw new Error(`unexpected side balance: ${JSON.stringify(sideCounts)}`);
  }

  const ordered = [...changed]
    .map((item) => ({
      item,
      blind_key: blindOrderKey(item.query_id, item.record_id),
    }))
    .sort((left, right) =>
      left.blind_key.localeCompare(right.blind_key)
      || left.item.query_id.localeCompare(right.item.query_id)
      || left.item.record_id.localeCompare(right.item.record_id));

  const sample = ordered.map(({ item }, index) =>
    publicRow(`${AUDIT_ID_PREFIX}${String(index + 1).padStart(3, '0')}`, item.public_source));

  assertBlindSample(sample);

  const byLanguage = {};
  const byIntent = {};
  const byFamily = {};
  for (const row of sample) {
    byLanguage[row.query_language] = (byLanguage[row.query_language] || 0) + 1;
    byIntent[row.intent] = (byIntent[row.intent] || 0) + 1;
    byFamily[row.family] = (byFamily[row.family] || 0) + 1;
  }

  const sampleText = serializeJsonl(sample);
  const sampleSha = sha256Text(sampleText);
  await writeJsonlAtomic(resolve(SAMPLE_PATH), sample);

  const sampleMeta = {
    schema_version: 'qwen3-ranking-holdout-delta-audit-sample-meta-v1',
    validation_id: 'qwen3-ranking-holdout-v1',
    audit_version: AUDIT_VERSION,
    purpose: 'blind-human-top10-delta-audit',
    ab_run_path: AB_PATH,
    ab_run_sha256: AB_SHA256,
    ab_metadata_path: AB_META_PATH,
    ab_metadata_sha256: AB_META_SHA256,
    ab_freeze_commit: AB_FREEZE_COMMIT,
    sampling_rule: 'every query-document pair in the symmetric difference between A and B Top 10',
    audit_order: 'deterministic SHA-256 order over audit_version + query_id + record_id',
    row_count: sample.length,
    query_count: byQuery.size,
    side_count_expected_each: EXPECTED_SIDE_COUNT,
    side_counts_not_exposed_in_public_rows: true,
    by_language: byLanguage,
    by_intent: byIntent,
    by_family: byFamily,
    relevant_threshold: RELEVANT_THRESHOLD,
    sample_sha256: sampleSha,
    contains_condition: false,
    contains_rank: false,
    contains_query_id: false,
    contains_record_id: false,
    contains_production_score: false,
    contains_qwen_score: false,
    contains_provider_provenance: false,
    contains_human_judgments: false,
    private_mapping_artifact_written: false,
    unblinding_rule: 'After judgments are frozen, reconstruct audit_id-to-pair mapping deterministically from the frozen A/B using the same audit_version and ordering function.',
  };

  const worksheet = renderWorksheet(sample, sampleMeta);

  await mkdir(dirname(resolve(SAMPLE_META_PATH)), { recursive: true });
  await writeFile(resolve(SAMPLE_META_PATH), `${JSON.stringify(sampleMeta, null, 2)}\n`, 'utf8');
  await mkdir(dirname(resolve(WORKSHEET_PATH)), { recursive: true });
  await writeFile(resolve(WORKSHEET_PATH), worksheet, 'utf8');

  return {
    sample,
    sampleMeta,
    hashes: {
      sample: sampleSha,
      sample_meta: sha256Text(`${JSON.stringify(sampleMeta, null, 2)}\n`),
      worksheet: sha256Text(worksheet),
    },
  };
}

async function main() {
  const result = await buildRankingHoldoutDeltaAudit();
  console.log('Qwen3 ranking holdout blind delta audit build complete');
  console.log(`audit_rows=${result.sampleMeta.row_count}`);
  console.log(`queries=${result.sampleMeta.query_count}`);
  console.log(`expected_A_only_hidden=${EXPECTED_SIDE_COUNT}`);
  console.log(`expected_B_only_hidden=${EXPECTED_SIDE_COUNT}`);
  console.log('private_mapping_artifact_written=false');
  console.log(`sample_sha256=${result.hashes.sample}`);
  console.log(`sample_meta_sha256=${result.hashes.sample_meta}`);
  console.log(`worksheet_sha256=${result.hashes.worksheet}`);
  console.log(`sample=${SAMPLE_PATH}`);
  console.log(`sample_meta=${SAMPLE_META_PATH}`);
  console.log(`worksheet=${WORKSHEET_PATH}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
