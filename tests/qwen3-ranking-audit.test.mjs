import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const builderPath = new URL('../scripts/benchmark/qwen3/build_ranking_delta_audit.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 ranking audit pins the frozen A/B artifacts and 352 changed Top-10 pairs', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /739a21abc41d34f8274a9be693e5d80b38845665d376a169c7f90214ff9c66d4/u);
  assert.match(source, /d8ef532ad4f67e51315761fc38d683ef80d07dd551af72bfca046ec49a6eab9b/u);
  assert.match(source, /AB_FREEZE_COMMIT = 'ebf816d'/u);
  assert.match(source, /EXPECTED_CHANGED_PAIRS = 352/u);
  assert.match(source, /sideCounts\['A-only'\] !== 176/u);
  assert.match(source, /sideCounts\['B-only'\] !== 176/u);
});

test('Qwen3 ranking audit public sample hides A/B provenance, IDs, scores, and ranks', async () => {
  const source = await readFile(builderPath, 'utf8');

  for (const token of [
    "'condition'",
    "'rank'",
    "'original_rank'",
    "'qwen_raw_score'",
    "'score'",
    "'record_id'",
    "'providers'",
    "'matchedQueries'",
    "'ranking'",
  ]) {
    assert.ok(source.includes(token), token);
  }

  assert.match(source, /contains_condition: false/u);
  assert.match(source, /contains_rank: false/u);
  assert.match(source, /contains_record_id: false/u);
  assert.match(source, /contains_qwen_score: false/u);
  assert.match(source, /contains_provider_provenance: false/u);
});

test('Qwen3 ranking audit order is deterministic and independent of condition', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /blindOrderKey/u);
  assert.match(source, /SHA-256 order over audit_version \+ query_id \+ record_id/u);
  assert.match(source, /QR/u);
  assert.doesNotMatch(source, /Math\.random/u);
});

test('Qwen3 ranking audit worksheet uses only blind relevance fields', async () => {
  const source = await readFile(builderPath, 'utf8');

  for (const label of [
    'Consulta:',
    'Título:',
    'Autores:',
    'Año:',
    'Tipo:',
    'Idioma del documento:',
    'Revista:',
    'Editorial:',
    'Resumen / abstract:',
    'Respuesta:',
    'Nota opcional:',
  ]) {
    assert.ok(source.includes(label), label);
  }

  assert.ok(!source.includes("renderWorksheet(sample, manifest)"));
});

test('Qwen3 ranking audit sample command is isolated from scoring and analysis', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:ranking:audit:sample'],
    'node scripts/benchmark/qwen3/build_ranking_delta_audit.mjs',
  );
});
