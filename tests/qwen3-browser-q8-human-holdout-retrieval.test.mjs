import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serverPath = new URL('../scripts/benchmark/qwen3/run_browser_q8_human_holdout_retrieval.mjs', import.meta.url);
const browserPath = new URL('../scripts/benchmark/qwen3/browser_q8_human_holdout_retrieval.js', import.meta.url);
const htmlPath = new URL('../benchmark/qwen3/runner-browser-q8-human-holdout.html', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('q8 human holdout retrieval pins frozen preregistration and queries', async () => {
  const source = await readFile(serverPath, 'utf8');
  assert.match(source, /9575c35e5914dd7c6f48f1b03e12f31f381b91f52625f56155206d25ecd2b7ff/u);
  assert.match(source, /8ace2daeb59d698e7fce9fab550600c9b3ddfb97beff0fa90d66465a4c8dbb4d/u);
  assert.match(source, /EXPECTED_QUERY_COUNT = 25/u);
  assert.match(source, /poolDepth !== 20/u);
});

test('q8 human holdout retrieval writes only preregistered production pool paths', async () => {
  const source = await readFile(serverPath, 'utf8');
  assert.match(source, /prereg\.planned_outputs\.production_pool/u);
  assert.match(source, /prereg\.planned_outputs\.production_pool_metadata/u);
  assert.match(source, /qwen3-browser-q8-human-holdout-v1-production-pool\.jsonl/u);
  assert.match(source, /qwen3-browser-q8-human-holdout-v1-production-pool\.meta\.json/u);
  assert.match(source, /Frozen retrieval output already exists/u);
});

test('q8 human holdout browser uses production search only during retrieval', async () => {
  const browser = await readFile(browserPath, 'utf8');
  assert.match(browser, /searchPhilosophy/u);
  assert.match(browser, /qwen3-browser-q8-human-holdout-v1\.preregistered\.json/u);
  assert.match(browser, /qwen3-browser-q8-human-holdout-v1\.queries\.json/u);
  assert.match(browser, /__qwen3_browser_q8_human_holdout/u);
  assert.doesNotMatch(browser, /browser_q8_raw_score/u);
  assert.doesNotMatch(browser, /qwen_raw_score/u);
  assert.doesNotMatch(browser, /human_relevance/u);
});

test('q8 human holdout server rejects scoring or human fields in retrieval payloads', async () => {
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

test('q8 human holdout retrieval UI is isolated from the prior holdout runner', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /browser_q8_human_holdout_retrieval\.js/u);
  assert.doesNotMatch(html, /runner-browser-ranking-holdout\.js/u);
});

test('q8 human holdout retrieval commands separate preflight from official run', async () => {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-human-holdout:retrieval:preflight'],
    'node scripts/benchmark/qwen3/run_browser_q8_human_holdout_retrieval.mjs --preflight',
  );
  assert.equal(
    pkg.scripts['benchmark:qwen3:browser-q8-human-holdout:retrieval:run'],
    'npm run build:duckdb && node scripts/benchmark/qwen3/run_browser_q8_human_holdout_retrieval.mjs --run',
  );
});
