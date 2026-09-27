import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serverPath = new URL('../scripts/benchmark/qwen3/run_browser_q8_confirmatory_holdout_v2_retrieval.mjs', import.meta.url);
const browserPath = new URL('../scripts/benchmark/qwen3/browser_q8_confirmatory_holdout_v2_retrieval.js', import.meta.url);
const htmlPath = new URL('../benchmark/qwen3/runner-browser-q8-confirmatory-holdout-v2.html', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('q8 confirmatory holdout v2 retrieval pins frozen preregistration and queries', async () => {
  const source = await readFile(serverPath, 'utf8');
  assert.match(source, /875910b573b56c5cba5fe586f95c621283cfdff6091f08ecbefb0a205cdf3c6e/u);
  assert.match(source, /eeaeb32e9f0de28ddb8a95a74657810ecbb61afc9ff9ea2d797e155849125ad1/u);
  assert.match(source, /EXPECTED_QUERY_COUNT = 30/u);
  assert.match(source, /EXPECTED_TOTAL_ROWS = 600/u);
  assert.match(source, /poolDepth !== 20/u);
});

test('q8 confirmatory holdout v2 retrieval writes only preregistered production pool paths', async () => {
  const source = await readFile(serverPath, 'utf8');
  assert.match(source, /prereg\.planned_outputs\.production_pool/u);
  assert.match(source, /prereg\.planned_outputs\.production_pool_metadata/u);
  assert.match(source, /qwen3-browser-q8-confirmatory-holdout-v2-production-pool\.jsonl/u);
  assert.match(source, /qwen3-browser-q8-confirmatory-holdout-v2-production-pool\.meta\.json/u);
  assert.match(source, /Frozen retrieval output already exists/u);
});

test('q8 confirmatory holdout v2 browser uses production search only during retrieval', async () => {
  const browser = await readFile(browserPath, 'utf8');
  assert.match(browser, /searchPhilosophy/u);
  assert.match(browser, /qwen3-browser-q8-confirmatory-holdout-v2\.preregistered\.json/u);
  assert.match(browser, /qwen3-browser-q8-confirmatory-holdout-v2\.queries\.json/u);
  assert.match(browser, /__qwen3_browser_q8_confirmatory_holdout_v2/u);
  assert.doesNotMatch(browser, /browser_q8_raw_score/u);
  assert.doesNotMatch(browser, /qwen_raw_score/u);
  assert.doesNotMatch(browser, /human_relevance/u);
});

test('q8 confirmatory holdout v2 server rejects scoring or human fields in retrieval payloads', async () => {
  const source = await readFile(serverPath, 'utf8');
  for (const token of ['browser_q8_raw_score', 'qwen_raw_score', 'human_relevance']) {
    assert.ok(source.includes(token), token);
  }
  assert.match(source, /qwen_used_during_retrieval: false/u);
  assert.match(source, /human_labels_used_during_retrieval: false/u);
  assert.match(source, /production_ranking_changed: false/u);
  assert.match(source, /preflight-passed-no-retrieval/u);
  assert.match(source, /retrieval_executed: false/u);
});

test('q8 confirmatory holdout v2 retrieval UI is isolated from the prior holdout runner', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /browser_q8_confirmatory_holdout_v2_retrieval\.js/u);
  assert.doesNotMatch(html, /runner-browser-ranking-holdout\.js/u);
});

test('q8 confirmatory holdout v2 retrieval commands separate preflight from official run', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-confirmatory-holdout-v2:retrieval:preflight'],
    'node scripts/benchmark/qwen3/run_browser_q8_confirmatory_holdout_v2_retrieval.mjs --preflight',
  );
  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-confirmatory-holdout-v2:retrieval:run'],
    'npm run build:duckdb && node scripts/benchmark/qwen3/run_browser_q8_confirmatory_holdout_v2_retrieval.mjs --run',
  );
});
