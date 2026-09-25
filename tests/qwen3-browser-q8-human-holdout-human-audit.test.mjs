import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serverPath = new URL('../scripts/benchmark/qwen3/browser_q8_human_holdout_audit_server.mjs', import.meta.url);
const browserPath = new URL('../scripts/benchmark/qwen3/browser_q8_human_holdout_audit_browser.js', import.meta.url);
const htmlPath = new URL('../benchmark/qwen3/browser/q8-human-holdout/qwen3-browser-q8-human-holdout-human-audit.html', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('fresh q8 human holdout audit pins the frozen pre-adjudication artifacts', async () => {
  const server = await readFile(serverPath, 'utf8');
  assert.match(server, /b0ec1980f47e0f123a36f056c86b23965b3c9aa61693b382aac38abbb93855f9/u);
  assert.match(server, /d2f5be7b60104c2029331882646c8e742653f3a918edebf3716fa67a157b4ff4/u);
  assert.match(server, /4ff6c82768738f492330d85f4b76d4275e9488bcfa1bdede9a113f107e55e776/u);
  assert.match(server, /SAMPLE_FREEZE_COMMIT = "b39163d9fa0d7b21e3f7f277b19fd1a880febf43"/u);
  assert.match(server, /verifyFrozenInputs\(\)/u);
});

test('fresh q8 human holdout audit server does not serve repository files or Qwen outputs', async () => {
  const server = await readFile(serverPath, 'utf8');
  assert.doesNotMatch(server, /serveStatic/u);
  assert.match(server, /pathname === "\/__qwen3_browser_q8_human_holdout_audit\/app\.js"/u);
  assert.match(server, /response\.writeHead\(404/u);
  assert.match(server, /browser_q8_score_visible_during_adjudication: false/u);
  assert.match(server, /ranking_visible_during_adjudication: false/u);
  assert.match(server, /provider_provenance_visible_during_adjudication: false/u);
});

test('fresh q8 human holdout audit UI contains only blind human relevance controls', async () => {
  const [browser, html] = await Promise.all([
    readFile(browserPath, 'utf8'),
    readFile(htmlPath, 'utf8'),
  ]);

  assert.match(browser, /__qwen3_browser_q8_human_holdout_audit\/state/u);
  assert.match(browser, /__qwen3_browser_q8_human_holdout_audit\/save/u);
  assert.match(browser, /__qwen3_browser_q8_human_holdout_audit\/finalize/u);
  assert.doesNotMatch(browser, /raw_score/u);
  assert.doesNotMatch(browser, /predicted_relevant/u);
  assert.doesNotMatch(browser, /providers/u);
  assert.doesNotMatch(browser, /matchedQueries/u);

  for (const label of ['0', '1', '2', '3']) {
    assert.match(html, new RegExp(`data-label="${label}"`, 'u'));
  }
});

test("fresh q8 human holdout audit progress stays local until all 192 judgments are finalized", async () => {
  const [server, pkgText] = await Promise.all([
    readFile(serverPath, "utf8"),
    readFile(packagePath, "utf8"),
  ]);

  assert.match(server, /benchmark\/qwen3\/cache\/qwen3-browser-q8-human-holdout-v1-human-audit\.progress\.json/u);
  assert.match(server, /Expected 192 blind audit sample rows/u);
  assert.match(server, /Human holdout adjudication is incomplete/u);
  assert.match(server, /qwen3-browser-q8-human-holdout-v1-delta-audit\.judgments\.jsonl/u);
  assert.match(server, /ab_condition_visible_during_adjudication: false/u);
  assert.match(server, /ranking_visible_during_adjudication: false/u);
  assert.match(server, /browser_q8_score_visible_during_adjudication: false/u);
  assert.match(server, /production_score_visible_during_adjudication: false/u);
  assert.match(server, /provider_provenance_visible_during_adjudication: false/u);
  assert.match(server, /private_mapping_available_during_adjudication: false/u);

  const pkg = JSON.parse(pkgText);

  assert.equal(
    pkg.scripts["benchmark:qwen3:browser-q8-human-holdout:human-audit:preflight"],
    "node scripts/benchmark/qwen3/browser_q8_human_holdout_audit_server.mjs --preflight",
  );

  assert.equal(
    pkg.scripts["benchmark:qwen3:browser-q8-human-holdout:human-audit:run"],
    "node scripts/benchmark/qwen3/browser_q8_human_holdout_audit_server.mjs",
  );
});
