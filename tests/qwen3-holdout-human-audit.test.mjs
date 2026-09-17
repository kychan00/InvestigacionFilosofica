import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serverPath = new URL('../scripts/benchmark/qwen3/holdout_human_audit_server.mjs', import.meta.url);
const browserPath = new URL('../scripts/benchmark/qwen3/holdout_human_audit_browser.js', import.meta.url);
const htmlPath = new URL('../benchmark/qwen3/validation/qwen3-holdout-human-audit.html', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('Qwen3 holdout audit pins the frozen pre-adjudication artifacts', async () => {
  const server = await readFile(serverPath, 'utf8');
  assert.match(server, /e8ccace4407ce9d235aefdf0a2cdc8ec36ec0d1df9843d9ae53611001f0f8942/u);
  assert.match(server, /dc8cb4c9a377e7b4191e5299e274fe9a63af55cdea407026304a6c08a33b6f23/u);
  assert.match(server, /27898e33a40b4b438946a69f616418697c6bd2862fb4e151dfbce09985657408/u);
  assert.match(server, /SCORE_FREEZE_COMMIT = "b8c4a7a"/u);
  assert.match(server, /verifyFrozenInputs\(\)/u);
});

test('Qwen3 holdout audit server does not serve repository files or Qwen outputs', async () => {
  const server = await readFile(serverPath, 'utf8');
  assert.doesNotMatch(server, /serveStatic/u);
  assert.match(server, /pathname === "\/__qwen3_holdout_audit\/app\.js"/u);
  assert.match(server, /response\.writeHead\(404/u);
  assert.match(server, /qwen_outputs_visible_during_adjudication: false/u);
  assert.match(server, /retrieval_rank_visible_during_adjudication: false/u);
  assert.match(server, /provider_provenance_visible_during_adjudication: false/u);
});

test('Qwen3 holdout audit UI contains only blind human relevance controls', async () => {
  const [browser, html] = await Promise.all([
    readFile(browserPath, 'utf8'),
    readFile(htmlPath, 'utf8'),
  ]);

  assert.match(browser, /__qwen3_holdout_audit\/state/u);
  assert.match(browser, /__qwen3_holdout_audit\/save/u);
  assert.match(browser, /__qwen3_holdout_audit\/finalize/u);
  assert.doesNotMatch(browser, /raw_score/u);
  assert.doesNotMatch(browser, /predicted_relevant/u);
  assert.doesNotMatch(browser, /providers/u);
  assert.doesNotMatch(browser, /matchedQueries/u);

  for (const label of ['0', '1', '2', '3']) {
    assert.match(html, new RegExp(`data-label="${label}"`, 'u'));
  }
});

test('Qwen3 holdout audit progress stays local until all 100 judgments are finalized', async () => {
  const [server, pkgText] = await Promise.all([
    readFile(serverPath, 'utf8'),
    readFile(packagePath, 'utf8'),
  ]);

  assert.match(server, /benchmark\/qwen3\/cache\/qwen3-reranker-v1-holdout-human-audit\.progress\.json/u);
  assert.match(server, /Expected 100 holdout sample rows/u);
  assert.match(server, /Human holdout adjudication is incomplete/u);
  assert.match(server, /qwen3-reranker-v1-holdout\.judgments\.jsonl/u);
  assert.match(server, /known_protocol_note/u);

  const pkg = JSON.parse(pkgText);
  assert.equal(
    pkg.scripts['benchmark:qwen3:holdout:audit'],
    'node scripts/benchmark/qwen3/holdout_human_audit_server.mjs',
  );
});
