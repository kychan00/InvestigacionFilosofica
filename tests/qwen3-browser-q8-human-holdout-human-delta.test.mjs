import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const analyzerPath = new URL('../scripts/benchmark/qwen3/analyze_browser_q8_human_holdout_delta_audit.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 browser q8 human holdout analyzer pins frozen A/B, blind sample, and judgments', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  for (const token of [
    '51d9106c45fd8fb5b2ba8d547b87f5f4f960e618',
    'b39163d9fa0d7b21e3f7f277b19fd1a880febf43',
    '216e789803dec5b666fff1a49dccb4baaea11c22',
    '002ef734a26b7a7f7fc932422f4a4187f0bbb2bddab460df253dbddd1b0b196d',
    '3225b67c62246ebc9697d30e4a278356ea45465f133676c89cfb305290b67f14',
    'b0ec1980f47e0f123a36f056c86b23965b3c9aa61693b382aac38abbb93855f9',
    'd2f5be7b60104c2029331882646c8e742653f3a918edebf3716fa67a157b4ff4',
    '17778c8ec5479758a9639165c53f400d366166d0aefd8263c2f4515acf64ae7b',
    'e70ce2cd19cb6d6cacbbbbd757d6dc61dbf571add4a202e45fb4ad035915f97c',
  ]) assert.ok(source.includes(token), token);
});

test('Qwen3 browser q8 human holdout analyzer reconstructs blind mapping only after judgment freeze', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  assert.match(source, /blindOrderKey/u);
  assert.match(source, /AUDIT_VERSION = 'qwen3-browser-q8-human-holdout-v1-delta-audit-v1'/u);
  assert.match(source, /mapping_reconstructed_deterministically_after_judgment_freeze: true/u);
  assert.match(source, /human_judgments_frozen_before_unblinding: true/u);
  assert.match(source, /private_ab_mapping_available_during_adjudication: false/u);
  assert.doesNotMatch(source, /delta-audit\.manifest\.json/u);
});

test('Qwen3 browser q8 human holdout analyzer verifies reconstructed public rows against frozen blind sample', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  assert.match(source, /publicRow\(item\.audit_id, item\.public_source\)/u);
  assert.match(source, /stablePublicEqual\(sample, expectedPublic\)/u);
  assert.match(source, /reconstructed mapping does not reproduce frozen public row/u);
});

test('Qwen3 browser q8 human holdout analyzer computes exact delta P@10 but not absolute P@10', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  assert.match(source, /EXPECTED_AUDIT_ROWS = 192/u);
  assert.match(source, /EXPECTED_SIDE_ROWS = 96/u);
  assert.match(source, /EXPECTED_QUERIES = 25/u);
  assert.match(source, /EXPECTED_CHANGED_QUERIES = 25/u);
  assert.match(source, /queries_with_changed_top10: changedQueryIds\.size/u);
  assert.match(source, /queries_with_unchanged_top10: EXPECTED_QUERIES - changedQueryIds\.size/u);
  assert.match(source, /exact_human_delta_p10_identified: true/u);
  assert.match(source, /absolute_p10_identified: false/u);
  assert.match(source, /netRelevant \/ \(EXPECTED_QUERIES \* TOP_K\)/u);
});

test('Qwen3 browser q8 human holdout analyzer preserves fresh internal validation boundaries', async () => {
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

test('Qwen3 browser q8 human holdout analyzer keeps unchanged Top-10 queries as zero-delta ties', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  assert.match(source, /queryMetaById/u);
  assert.match(source, /new Map\(\s*\[\.\.\.queryMetaById\.entries\(\)\]/u);
  assert.match(source, /\{ A: \[\], B: \[\], meta \}/u);
  assert.match(source, /expected .*queries with changed Top-10 membership/u);
});

test('Qwen3 browser q8 human holdout analyzer reports language, intent, family, and per-query effects', async () => {
  const source = await readFile(analyzerPath, 'utf8');

  assert.match(source, /by_language: groupSummary/u);
  assert.match(source, /by_intent: groupSummary/u);
  assert.match(source, /by_family: groupSummary/u);
  assert.match(source, /per_query: perQuery/u);
});

test('Qwen3 browser q8 human holdout analysis command is wired', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-human-holdout:analyze'],
    'node scripts/benchmark/qwen3/analyze_browser_q8_human_holdout_delta_audit.mjs',
  );
});

test("Qwen3 browser q8 human holdout analyzer pins production A and browser-q8 B semantics", async () => {
  const source = await readFile(analyzerPath, "utf8");
  assert.match(source, /original production order/u);
  assert.match(source, /browser_q8_raw_score descending/u);
  assert.match(source, /binary_threshold_used !== false/u);
  assert.match(source, /score_blending !== false/u);
  assert.match(source, /pool_membership_changes !== false/u);
});

test("Qwen3 browser q8 human holdout analyzer refuses to overwrite reports", async () => {
  const source = await readFile(analyzerPath, "utf8");
  assert.match(source, /assertOutputsAbsent/u);
  assert.match(source, /refusing to overwrite frozen human-delta report/u);
});
