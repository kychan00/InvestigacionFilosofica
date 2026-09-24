import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const builderPath = new URL('../scripts/benchmark/qwen3/build_browser_q8_human_holdout_delta_audit.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('fresh q8 human holdout audit pins frozen A/B and all 192 changed Top-10 pairs', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /002ef734a26b7a7f7fc932422f4a4187f0bbb2bddab460df253dbddd1b0b196d/u);
  assert.match(source, /3225b67c62246ebc9697d30e4a278356ea45465f133676c89cfb305290b67f14/u);
  assert.match(source, /AB_FREEZE_COMMIT = '51d9106c45fd8fb5b2ba8d547b87f5f4f960e618'/u);
  assert.match(source, /EXPECTED_CHANGED_PAIRS = 192/u);
  assert.match(source, /EXPECTED_SIDE_COUNT = 96/u);
});

test('fresh q8 human holdout public sample hides condition, IDs, scores, ranks and provenance', async () => {
  const source = await readFile(builderPath, 'utf8');

  for (const token of [
    "'condition'",
    "'rank'",
    "'original_rank'",
    "'browser_q8_raw_score'",
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
  assert.match(source, /contains_browser_q8_score: false/u);
  assert.match(source, /contains_provider_provenance: false/u);
});

test('fresh q8 human holdout audit order is deterministic and condition-independent', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /blindOrderKey/u);
  assert.match(source, /SHA-256 order over audit_version \+ query_id \+ record_id/u);
  assert.match(source, /AUDIT_ID_PREFIX = 'Q8H'/u);
  assert.doesNotMatch(source, /Math\.random/u);
});

test('fresh q8 human holdout audit writes no private pre-adjudication mapping artifact', async () => {
  const source = await readFile(builderPath, 'utf8');

  assert.match(source, /private_mapping_artifact_written: false/u);
  assert.match(source, /After judgments are frozen/u);
  assert.doesNotMatch(source, /MANIFEST_PATH/u);
  assert.doesNotMatch(source, /private-audit-provenance/u);
});

test('fresh q8 human holdout worksheet exposes only blind relevance material', async () => {
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

test('fresh q8 human holdout audit sample commands isolate preflight from build', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-human-holdout:audit:sample:preflight'],
    'node scripts/benchmark/qwen3/build_browser_q8_human_holdout_delta_audit.mjs --preflight',
  );

  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-human-holdout:audit:sample:run'],
    'node scripts/benchmark/qwen3/build_browser_q8_human_holdout_delta_audit.mjs --run',
  );
});
