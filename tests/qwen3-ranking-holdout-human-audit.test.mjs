import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serverPath = new URL('../scripts/benchmark/qwen3/ranking_holdout_human_audit_server.mjs', import.meta.url);
const browserPath = new URL('../scripts/benchmark/qwen3/ranking_holdout_human_audit_browser.js', import.meta.url);
const htmlPath = new URL('../benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-human-audit.html', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 ranking holdout adjudication server pins only the frozen blind sample', async () => {
  const source = await readFile(serverPath, 'utf8');

  assert.match(source, /2981bcd4c48e59a40492d13163e9cc0a1f92e960aa7bd82bcda00f60250fc033/u);
  assert.match(source, /ae546efc00fe76779f22e47768b57a53d3cce6c8d2181308c20719cf926e951d/u);
  assert.match(source, /SAMPLE_FREEZE_COMMIT = "0ffceb0"/u);
  assert.match(source, /Expected 160 ranking holdout audit rows/u);
  assert.doesNotMatch(source, /qwen3-ranking-holdout-v1-ab\.jsonl/u);
  assert.doesNotMatch(source, /qwen3-ranking-holdout-v1\.raw\.jsonl/u);
});

test('Qwen3 ranking holdout adjudication never exposes hidden A/B provenance', async () => {
  const source = await readFile(serverPath, 'utf8');

  for (const token of [
    '"condition"',
    '"rank"',
    '"original_rank"',
    '"qwen_raw_score"',
    '"query_id"',
    '"record_id"',
    '"providers"',
    '"matchedQueries"',
  ]) assert.ok(source.includes(token), token);

  assert.match(source, /private_mapping_available_during_adjudication: false/u);
  assert.match(source, /qwen_scores_visible_during_adjudication: false/u);
  assert.match(source, /ab_condition_visible_during_adjudication: false/u);
  assert.match(source, /ranks_visible_during_adjudication: false/u);
  assert.match(source, /record_ids_visible_during_adjudication: false/u);
});

test('Qwen3 ranking holdout finalized judgments contain only audit identity and human judgments', async () => {
  const source = await readFile(serverPath, 'utf8');

  assert.match(source, /audit_id: row\.audit_id/u);
  assert.match(source, /human_relevance: judgments\[row\.audit_id\]\.human_relevance/u);
  assert.match(source, /human_note: judgments\[row\.audit_id\]\.human_note/u);
  assert.match(source, /judged_at:/u);

  const finalizedBlock = source.slice(
    source.indexOf('const rows = sample.map'),
    source.indexOf('const judgmentsText'),
  );
  assert.doesNotMatch(finalizedBlock, /query_id/u);
  assert.doesNotMatch(finalizedBlock, /record_id/u);
  assert.doesNotMatch(finalizedBlock, /condition/u);
});

test('Qwen3 ranking holdout audit UI is organized into four resumable blocks of 40', async () => {
  const [html, browser] = await Promise.all([
    readFile(htmlPath, 'utf8'),
    readFile(browserPath, 'utf8'),
  ]);

  assert.match(html, /160 documentos · 4 bloques de 40/u);
  assert.equal((html.match(/class="block-button"/gu) || []).length, 4);
  assert.match(browser, /blockSize = 40/u);
  assert.match(browser, /labeledInBlock/u);
  assert.match(browser, /findNextUnlabeled/u);
});

test('Qwen3 ranking holdout audit progress stays local until finalization', async () => {
  const source = await readFile(serverPath, 'utf8');

  assert.match(source, /benchmark\/qwen3\/cache\/qwen3-ranking-holdout-v1-human-audit\.progress\.json/u);
  assert.match(source, /qwen3-ranking-holdout-v1-delta-audit\.judgments\.jsonl/u);
  assert.match(source, /qwen3-ranking-holdout-v1-delta-audit\.judgments\.meta\.json/u);
});

test('Qwen3 ranking holdout human audit command is isolated from analysis and unblinding', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(
    pkg.scripts['benchmark:qwen3:ranking:holdout:audit'],
    'node scripts/benchmark/qwen3/ranking_holdout_human_audit_server.mjs',
  );
});
