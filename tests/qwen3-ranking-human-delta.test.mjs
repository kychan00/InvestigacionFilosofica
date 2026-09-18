import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const analyzerPath = new URL('../scripts/benchmark/qwen3/analyze_ranking_delta_audit.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 ranking human-delta analyzer pins frozen audit and judgment inputs', async () => {
  const source = await readFile(analyzerPath, 'utf8');
  for (const token of [
    '800f938',
    '5987766',
    '739a21abc41d34f8274a9be693e5d80b38845665d376a169c7f90214ff9c66d4',
    '11fe8e4f5ee4ffbe64cbfa4a2b4346955c75fe136618539c08c3f6f347aa9068',
    '59a0d3e67677df21f298f184d939530120cdc5778862d936f711b8062eb03cd1',
    'af12c4d47da6e80bab77464d8937a5d4e2bd40681484e34fa7877ca0cb7e7861',
  ]) assert.ok(source.includes(token), token);
});

test('Qwen3 ranking human-delta analyzer computes exact delta but not absolute P@10', async () => {
  const source = await readFile(analyzerPath, 'utf8');
  assert.match(source, /exact_delta_only: true/u);
  assert.match(source, /absolute_p10_identified: false/u);
  assert.match(source, /shared_top10_slots/u);
  assert.match(source, /netRelevant \/ \(EXPECTED_QUERIES \* TOP_K\)/u);
});

test('Qwen3 ranking human-delta analyzer preserves human/Qwen separation', async () => {
  const source = await readFile(analyzerPath, 'utf8');
  assert.match(source, /human_audit_blind_to_ab_before_freeze: true/u);
  assert.match(source, /human_judgments_used_by_qwen: false/u);
  assert.match(source, /qwen_used_as_relevance_judge: false/u);
  assert.match(source, /query_set_role: 'development'/u);
  assert.match(source, /fresh_independent_end_to_end_validation: false/u);
});

test('Qwen3 ranking human-delta analyzer reports language, intent, family and per-query deltas', async () => {
  const source = await readFile(analyzerPath, 'utf8');
  assert.match(source, /by_language: groupSummary/u);
  assert.match(source, /by_intent: groupSummary/u);
  assert.match(source, /by_family: groupSummary/u);
  assert.match(source, /per_query: perQuery/u);
});

test('Qwen3 ranking human-delta analysis command is wired', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.equal(
    pkg.scripts['benchmark:qwen3:ranking:audit:analyze'],
    'node scripts/benchmark/qwen3/analyze_ranking_delta_audit.mjs',
  );
});
