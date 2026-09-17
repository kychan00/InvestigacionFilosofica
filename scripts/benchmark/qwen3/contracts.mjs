export const QWEN3_DATASET_SCHEMA = 'qwen3-dataset-v1';
export const QWEN3_SCORE_SCHEMA = 'qwen3-score-v1';

const DATASET_KEYS = Object.freeze([
  'schema_version',
  'query_id',
  'query',
  'record_id',
  'title',
  'abstract',
  'authors',
  'year',
  'document_language',
]);

const SCORE_KEYS = Object.freeze([
  'schema_version',
  'experiment_id',
  'query_id',
  'record_id',
  'model',
  'revision',
  'instruction_sha256',
  'input_sha256',
  'raw_score',
  'latency_ms',
  'device',
  'dtype',
  'max_length',
  'cache_hit',
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

function assertExactKeys(value, allowedKeys, label) {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = allowedKeys.filter((key) => !Object.hasOwn(value, key));

  if (unknown.length > 0) {
    throw new Error(`${label} contains forbidden/unknown fields: ${unknown.join(', ')}`);
  }

  if (missing.length > 0) {
    throw new Error(`${label} is missing fields: ${missing.join(', ')}`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function assertNullableString(value, label) {
  if (value !== null && typeof value !== 'string') {
    throw new TypeError(`${label} must be a string or null`);
  }
}

function assertSha256(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${label} must be a lowercase SHA-256 hex digest`);
  }
}

export function validateQwen3DatasetRecord(record) {
  assertPlainObject(record, 'dataset record');
  assertExactKeys(record, DATASET_KEYS, 'dataset record');

  if (record.schema_version !== QWEN3_DATASET_SCHEMA) {
    throw new Error(`dataset record schema_version must be ${QWEN3_DATASET_SCHEMA}`);
  }

  assertNonEmptyString(record.query_id, 'query_id');
  assertNonEmptyString(record.query, 'query');
  assertNonEmptyString(record.record_id, 'record_id');
  assertNonEmptyString(record.title, 'title');
  assertNullableString(record.abstract, 'abstract');
  assertNullableString(record.document_language, 'document_language');

  if (!Array.isArray(record.authors) || record.authors.some((author) => typeof author !== 'string')) {
    throw new TypeError('authors must be an array of strings');
  }

  if (record.year !== null && (!Number.isInteger(record.year) || record.year < 0)) {
    throw new TypeError('year must be a non-negative integer or null');
  }

  return record;
}

export function buildQwen3DocumentText(record) {
  validateQwen3DatasetRecord(record);

  const lines = [`Title: ${record.title}`];

  if (record.authors.length > 0) {
    lines.push(`Authors: ${record.authors.join('; ')}`);
  }

  if (record.year !== null) {
    lines.push(`Year: ${record.year}`);
  }

  if (record.document_language) {
    lines.push(`Document language: ${record.document_language}`);
  }

  lines.push(`Abstract: ${record.abstract?.trim() || '[unavailable]'}`);
  return lines.join('\n');
}

export function validateQwen3ScoreRecord(record) {
  assertPlainObject(record, 'score record');
  assertExactKeys(record, SCORE_KEYS, 'score record');

  if (record.schema_version !== QWEN3_SCORE_SCHEMA) {
    throw new Error(`score record schema_version must be ${QWEN3_SCORE_SCHEMA}`);
  }

  for (const field of ['experiment_id', 'query_id', 'record_id', 'model', 'revision', 'device', 'dtype']) {
    assertNonEmptyString(record[field], field);
  }

  assertSha256(record.instruction_sha256, 'instruction_sha256');
  assertSha256(record.input_sha256, 'input_sha256');

  if (typeof record.raw_score !== 'number' || !Number.isFinite(record.raw_score) || record.raw_score < 0 || record.raw_score > 1) {
    throw new TypeError('raw_score must be a finite number in [0, 1]');
  }

  if (typeof record.latency_ms !== 'number' || !Number.isFinite(record.latency_ms) || record.latency_ms < 0) {
    throw new TypeError('latency_ms must be a finite non-negative number');
  }

  if (!Number.isInteger(record.max_length) || record.max_length <= 0) {
    throw new TypeError('max_length must be a positive integer');
  }

  if (typeof record.cache_hit !== 'boolean') {
    throw new TypeError('cache_hit must be boolean');
  }

  return record;
}

export function qwen3DatasetKeys() {
  return [...DATASET_KEYS];
}

export function qwen3ScoreKeys() {
  return [...SCORE_KEYS];
}
