import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const analyzerPath = new URL('../scripts/benchmark/qwen3/analyze_ranking_holdout_delta_audit.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 ranking holdout analyzer pins frozen A/B, blind sample, and judgments', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  for (const token of [
    '10afea1',
    '0ffceb0',
    '18479e5',
    '6682bf7c19cd9acc77a589483977478857493e0a7f81ce1c086c83ce6c8851aa',
    'd4413cf9a87b0e2b4fc7a5b7fd28ea922509b851f75c34c45714d4d319ba6fe2',
    '2981bcd4c48e59a40492d13163e9cc0a1f92e960aa7bd82bcda00f60250fc033',
    'ae546efc00fe76779f22e47768b57a53d3cce6c8d2181308c20719cf926e951d',
    'bb1a44f71605b5415a2b9a47a111d6557c32f6f77c399613bc7afb87a5ba26a1',
    '9a99a82d96eac66ec1d102a714833cd4e0011e210d580af17e4a9582302250f0',
  ]) assert.ok(source.includes(token), token);
});

test('Qwen3 ranking holdout analyzer reconstructs blind mapping only after judgment freeze', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  assert.match(source, /blindOrderKey/u);
  assert.match(source, /AUDIT_VERSION = 'qwen3-ranking-holdout-v1-delta-audit-v1'/u);
  assert.match(source, /mapping_reconstructed_deterministically_after_judgment_freeze: true/u);
  assert.match(source, /human_judgments_frozen_before_unblinding: true/u);
  assert.match(source, /private_ab_mapping_available_during_adjudication: false/u);
  assert.doesNotMatch(source, /delta-audit\.manifest\.json/u);
});

test('Qwen3 ranking holdout analyzer verifies reconstructed public rows against frozen blind sample', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  assert.match(source, /publicRow\(item\.audit_id, item\.public_source\)/u);
  assert.match(source, /stablePublicEqual\(sample, expectedPublic\)/u);
  assert.match(source, /reconstructed mapping does not reproduce frozen public row/u);
});

test('Qwen3 ranking holdout analyzer computes exact delta P@10 but not absolute P@10', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  assert.match(source, /EXPECTED_AUDIT_ROWS = 160/u);
  assert.match(source, /EXPECTED_SIDE_ROWS = 80/u);
  assert.match(source, /EXPECTED_QUERIES = 25/u);
  assert.match(source, /exact_human_delta_p10_identified: true/u);
  assert.match(source, /absolute_p10_identified: false/u);
  assert.match(source, /netRelevant \/ \(EXPECTED_QUERIES \* TOP_K\)/u);
});

test('Qwen3 ranking holdout analyzer preserves fresh internal validation boundaries', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  assert.match(source, /fresh_queries_preregistered_before_retrieval: true/u);
  assert.match(source, /holdout_labels_used_for_tuning: false/u);
  assert.match(source, /threshold_used_for_ranking: false/u);
  assert.match(source, /score_blending: false/u);
  assert.match(source, /candidate_pool_changed_by_qwen: false/u);
  assert.match(source, /query_set_role: 'fresh-internal-validation'/u);
  assert.match(source, /fresh_internal_ranking_validation: true/u);
  assert.match(source, /external_independent_validation: false/u);
});

test('Qwen3 ranking holdout analyzer reports language, intent, family, and per-query effects', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  assert.match(source, /by_language: groupSummary/u);
  assert.match(source, /by_intent: groupSummary/u);
  assert.match(source, /by_family: groupSummary/u);
  assert.match(source, /per_query: perQuery/u);
});

test('Qwen3 ranking holdout analysis command is wired', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:ranking:holdout:analyze'],
    'node scripts/benchmark/qwen3/analyze_ranking_holdout_delta_audit.mjs',
  );
});
