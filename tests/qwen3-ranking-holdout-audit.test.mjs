import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const builderPath = new URL('../scripts/benchmark/qwen3/build_ranking_holdout_delta_audit.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 ranking holdout audit pins frozen A/B and all 160 changed Top-10 pairs', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /6682bf7c19cd9acc77a589483977478857493e0a7f81ce1c086c83ce6c8851aa/u);
  assert.match(source, /d4413cf9a87b0e2b4fc7a5b7fd28ea922509b851f75c34c45714d4d319ba6fe2/u);
  assert.match(source, /AB_FREEZE_COMMIT = '10afea1'/u);
  assert.match(source, /EXPECTED_CHANGED_PAIRS = 160/u);
  assert.match(source, /EXPECTED_SIDE_COUNT = 80/u);
});

test('Qwen3 ranking holdout public sample hides condition, IDs, scores, ranks and provenance', async () => {
  const source = await readFile(builderPath, 'utf8');

  for (const token of [
    "'condition'",
    "'rank'",
    "'original_rank'",
    "'qwen_raw_score'",
    "'score'",
    "'query_id'",
    "'record_id'",
    "'providers'",
    "'matchedQueries'",
    "'ranking'",
  ]) assert.ok(source.includes(token), token);

  assert.match(source, /contains_condition: false/u);
  assert.match(source, /contains_rank: false/u);
  assert.match(source, /contains_query_id: false/u);
  assert.match(source, /contains_record_id: false/u);
  assert.match(source, /contains_qwen_score: false/u);
  assert.match(source, /contains_provider_provenance: false/u);
});

test('Qwen3 ranking holdout audit order is deterministic and condition-independent', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /blindOrderKey/u);
  assert.match(source, /SHA-256 order over audit_version \+ query_id \+ record_id/u);
  assert.match(source, /AUDIT_ID_PREFIX = 'QRH'/u);
  assert.doesNotMatch(source, /Math\.random/u);
});

test('Qwen3 ranking holdout audit writes no private pre-adjudication mapping artifact', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /private_mapping_artifact_written: false/u);
  assert.match(source, /After judgments are frozen/u);
  assert.doesNotMatch(source, /MANIFEST_PATH/u);
  assert.doesNotMatch(source, /private-audit-provenance/u);
});

test('Qwen3 ranking holdout worksheet exposes only blind relevance material', async () => {
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
  ]) assert.ok(source.includes(label), label);
});

test('Qwen3 ranking holdout audit sample command is isolated from scoring and analysis', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:ranking:holdout:audit:sample'],
    'node scripts/benchmark/qwen3/build_ranking_holdout_delta_audit.mjs',
  );
});
