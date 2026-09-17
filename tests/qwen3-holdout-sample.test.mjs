import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  HOLDOUT_FINGERPRINTS,
  HOLDOUT_PATHS,
  buildHoldoutSampleRows,
} from '../scripts/benchmark/qwen3/build_holdout_sample.mjs';

const packagePath = new URL('../package.json', import.meta.url);

function syntheticRows(query) {
  return Array.from({ length: 10 }, (_, index) => ({
    query_id: query.id,
    query: query.query,
    query_language: query.language,
    family: query.family,
    intent: query.intent,
    rank: index + 1,
    record_id: `${query.id}-doc-${index + 1}`,
    title: `Document ${index + 1}`,
    authors: ['Author'],
    year: 2026,
    type: 'journal-article',
    language: query.language,
    journal: 'Journal',
    publisher: 'Publisher',
    abstract: `Abstract ${index + 1}`,
    providers: ['hidden-provider'],
    matchedQueries: [{ query: query.query }],
    score: 99,
    ranking: { hidden: true },
    urls: { canonical: 'https://example.invalid' },
  }));
}

test('Qwen3 holdout sample builder pins the frozen retrieval snapshot', () => {
  assert.equal(
    HOLDOUT_FINGERPRINTS.runSha256,
    '228099a89a0eb2fac14db79fe462e7b291799b5c13fb05b0e38f31048e3485b3',
  );
  assert.equal(HOLDOUT_FINGERPRINTS.retrievalFreezeCommit, 'b49464d');
  assert.equal(
    HOLDOUT_PATHS.run,
    'benchmark/qwen3/validation/runs/qwen3-reranker-v1-holdout-v1-233ce94.jsonl',
  );
});

test('Qwen3 holdout sample selects preregistered ranks but blinds their provenance', () => {
  const queries = [
    { id: 'q1', query: 'query one', language: 'es', family: 'f1', intent: 'work' },
    { id: 'q2', query: 'query two', language: 'de', family: 'f2', intent: 'philosopher-concept' },
  ];
  const prereg = {
    validation_id: 'synthetic-holdout',
    queries,
    query_design: {
      human_audit_ranks: [1, 3, 5],
      planned_human_pairs: 6,
    },
  };

  const rows = queries.flatMap(syntheticRows);
  const sample = buildHoldoutSampleRows(prereg, rows);

  assert.equal(sample.length, 6);
  assert.deepEqual(sample.map((row) => row.audit_id).sort(), ['QH001', 'QH002', 'QH003', 'QH004', 'QH005', 'QH006']);

  const selectedIds = new Set(sample.map((row) => row.record_id));
  for (const query of queries) {
    assert.equal(selectedIds.has(`${query.id}-doc-1`), true);
    assert.equal(selectedIds.has(`${query.id}-doc-3`), true);
    assert.equal(selectedIds.has(`${query.id}-doc-5`), true);
  }

  const forbidden = ['rank', 'score', 'ranking', 'providers', 'matchedQueries', 'urls', 'qwen_score', 'qwen_prediction'];
  for (const row of sample) {
    for (const field of forbidden) assert.equal(Object.hasOwn(row, field), false, field);
    assert.equal(row.human_relevance, null);
    assert.equal(row.human_note, '');
  }
});

test('Qwen3 holdout sample order is deterministic and independent of retrieval order', () => {
  const query = { id: 'q1', query: 'query one', language: 'fr', family: 'f1', intent: 'work' };
  const prereg = {
    validation_id: 'synthetic-holdout',
    queries: [query],
    query_design: { human_audit_ranks: [1, 3, 5, 7, 10], planned_human_pairs: 5 },
  };
  const rows = syntheticRows(query);
  const reversed = [...rows].reverse();

  assert.deepEqual(
    buildHoldoutSampleRows(prereg, rows),
    buildHoldoutSampleRows(prereg, reversed),
  );
});

test('Qwen3 holdout sample build command is wired separately from model inference', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.equal(
    pkg.scripts['benchmark:qwen3:holdout:sample'],
    'node scripts/benchmark/qwen3/build_holdout_sample.mjs',
  );
});
