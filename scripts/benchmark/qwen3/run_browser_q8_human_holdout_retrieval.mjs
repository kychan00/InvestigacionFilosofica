import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const PORT = Number(process.env.BENCHMARK_PORT || 4191);
const hasPreflight = process.argv.includes("--preflight");
const hasRun = process.argv.includes("--run");
if (hasPreflight === hasRun) throw new Error("Specify exactly one of --preflight or --run");
const MODE = hasPreflight ? "preflight" : "run";
const EXPECTED_PREREG_SHA256 = "9575c35e5914dd7c6f48f1b03e12f31f381b91f52625f56155206d25ecd2b7ff";
const EXPECTED_QUERIES_SHA256 = "8ace2daeb59d698e7fce9fab550600c9b3ddfb97beff0fa90d66465a4c8dbb4d";
const EXPECTED_PRODUCTION_BASE = "bb9689da2016ca26a08359e8655eca7a5b771937";
const EXPECTED_QUERY_COUNT = 25;
const EXPECTED_POOL_PATH = "benchmark/qwen3/browser/q8-human-holdout/runs/qwen3-browser-q8-human-holdout-v1-production-pool.jsonl";
const EXPECTED_META_PATH = "benchmark/qwen3/browser/q8-human-holdout/runs/qwen3-browser-q8-human-holdout-v1-production-pool.meta.json";
const PREREG_PATH = 'benchmark/qwen3/browser/q8-human-holdout/qwen3-browser-q8-human-holdout-v1.preregistered.json';
const QUERIES_PATH = 'benchmark/qwen3/browser/q8-human-holdout/qwen3-browser-q8-human-holdout-v1.queries.json';

const preregText = fs.readFileSync(path.join(ROOT, PREREG_PATH), 'utf8');
const queriesText = fs.readFileSync(path.join(ROOT, QUERIES_PATH), 'utf8');
const prereg = JSON.parse(preregText);
const querySet = JSON.parse(queriesText);

const runtimeCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const preregSha256 = createHash('sha256').update(preregText, 'utf8').digest('hex');
const queriesSha256 = createHash('sha256').update(queriesText, 'utf8').digest('hex');

const poolDepth = Number(prereg.retrieval.pool_depth);
const minimumRows = Number(prereg.retrieval.minimum_results_per_query);
const runName = `${prereg.validation_id}-production-pool`;
const finalRelativePath = prereg.planned_outputs.production_pool;
const metaRelativePath = prereg.planned_outputs.production_pool_metadata;
const finalPath = path.join(ROOT, finalRelativePath);
const metaPath = path.join(ROOT, metaRelativePath);
const runDirectory = path.dirname(finalPath);
const partialDirectory = path.join(runDirectory, `.${runName}.partial`);
const queryMap = new Map(querySet.queries.map((query) => [query.id, query]));

if (querySet.queries.length !== prereg.query_set.query_count) {
  throw new Error(`Expected ${prereg.query_set.query_count} fresh queries, got ${querySet.queries.length}`);
}
if (poolDepth !== 20 || minimumRows !== 20) {
  throw new Error('Qwen3 ranking holdout v1 requires exactly a complete Top-20 pool per query');
}

function assertFrozenContract() {
  if (preregSha256 !== EXPECTED_PREREG_SHA256) throw new Error("preregistration SHA mismatch");
  if (queriesSha256 !== EXPECTED_QUERIES_SHA256) throw new Error("query-set SHA mismatch");
  if (prereg.validation_id !== "qwen3-browser-q8-human-holdout-v1") throw new Error("validation_id mismatch");
  if (prereg.lineage.production_base_commit !== EXPECTED_PRODUCTION_BASE) throw new Error("production base mismatch");
  if (querySet.queries.length !== EXPECTED_QUERY_COUNT) throw new Error("query count mismatch");
  if (prereg.query_set.sha256 !== EXPECTED_QUERIES_SHA256) throw new Error("query SHA pointer mismatch");
  if (finalRelativePath !== EXPECTED_POOL_PATH) throw new Error("production pool path mismatch");
  if (metaRelativePath !== EXPECTED_META_PATH) throw new Error("metadata path mismatch");
  if (prereg.retrieval.qwen_used_during_retrieval !== false) throw new Error("Qwen retrieval boundary mismatch");
  if (prereg.retrieval.human_labels_used_during_retrieval !== false) throw new Error("human-label retrieval boundary mismatch");
  const committedSrcDiff = execFileSync("git", ["diff", "--name-only", prereg.lineage.production_base_commit + "..HEAD", "--", "src"], { encoding: "utf8" }).trim();
  const workingSrcDiff = execFileSync("git", ["diff", "--name-only", "--", "src"], { encoding: "utf8" }).trim();
  const stagedSrcDiff = execFileSync("git", ["diff", "--cached", "--name-only", "--", "src"], { encoding: "utf8" }).trim();
  if (committedSrcDiff || workingSrcDiff || stagedSrcDiff) throw new Error("production src differs from frozen production base");
  const laterOutputs = Object.entries(prereg.planned_outputs).filter(([key,value]) => !["production_pool","production_pool_metadata"].includes(key) && fs.existsSync(path.join(ROOT,value)));
  if (laterOutputs.length) throw new Error("later-stage holdout outputs already exist");
}

assertFrozenContract();

function queryFile(queryId) {
  return path.join(partialDirectory, `${queryId}.json`);
}

function completedQueryIds() {
  if (!fs.existsSync(partialDirectory)) return [];
  return querySet.queries
    .map((query) => query.id)
    .filter((queryId) => fs.existsSync(queryFile(queryId)));
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value, null, 2);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 25_000_000) {
        reject(new Error('Request body too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function validateRows(queryId, rows) {
  if (!Array.isArray(rows)) throw new Error('rows must be an array');
  if (rows.length !== poolDepth) {
    throw new Error(`${queryId}: expected exactly ${poolDepth} rows, got ${rows.length}`);
  }

  const expectedQuery = queryMap.get(queryId);
  const ids = new Set();
  rows.forEach((row, index) => {
    if (row.query_id !== queryId) throw new Error(`${queryId}: query_id mismatch`);
    if (row.query !== expectedQuery.query) throw new Error(`${queryId}: query text mismatch`);
    if (row.query_language !== expectedQuery.language) throw new Error(`${queryId}: language mismatch`);
    if (row.family !== expectedQuery.family) throw new Error(`${queryId}: family mismatch`);
    if (row.intent !== expectedQuery.intent) throw new Error(`${queryId}: intent mismatch`);
    if (row.rank !== index + 1) throw new Error(`${queryId}: invalid rank ${row.rank}`);
    if (!row.record_id) throw new Error(`${queryId}: missing record_id`);
    if (!Array.isArray(row.matchedQueries)) throw new Error(`${queryId}: matchedQueries provenance missing`);
    if (ids.has(row.record_id)) throw new Error(`${queryId}: duplicate record_id ${row.record_id}`);
    for (const forbidden of ["browser_q8_raw_score", "qwen_raw_score", "human_relevance"]) {
      if (Object.prototype.hasOwnProperty.call(row, forbidden)) throw new Error(`${queryId}: forbidden retrieval field ${forbidden}`);
    }
    ids.add(row.record_id);
  });
}

async function handleApi(request, response, pathname) {
  if (request.method === 'POST' && pathname === '/__qwen3_browser_q8_human_holdout/start') {
    if (fs.existsSync(finalPath) || fs.existsSync(metaPath)) {
      sendJson(response, 409, {
        error: 'Frozen retrieval output already exists',
        run: path.relative(ROOT, finalPath),
      });
      return true;
    }

    fs.mkdirSync(partialDirectory, { recursive: true });
    sendJson(response, 200, {
      runName,
      runtimeCommit,
      preregSha256,
      queriesSha256,
      productionBaseCommit: prereg.lineage.production_base_commit,
      expectedQueries: querySet.queries.length,
      poolDepth,
      completedQueryIds: completedQueryIds(),
    });
    return true;
  }

  if (request.method === 'POST' && pathname === '/__qwen3_browser_q8_human_holdout/query') {
    const body = await readJsonBody(request);
    const queryId = String(body.queryId || '');
    if (!queryMap.has(queryId)) {
      sendJson(response, 400, { error: `Unknown holdout query: ${queryId}` });
      return true;
    }

    if (Array.isArray(body.sourceErrors) && body.sourceErrors.length) {
      sendJson(response, 422, {
        error: `${queryId}: source errors detected`,
        sourceErrors: body.sourceErrors,
      });
      return true;
    }

    const destination = queryFile(queryId);
    if (fs.existsSync(destination)) {
      sendJson(response, 200, { status: 'already-saved', queryId });
      return true;
    }

    try {
      validateRows(queryId, body.rows);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return true;
    }

    fs.mkdirSync(partialDirectory, { recursive: true });
    const temporary = `${destination}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify({
      queryId,
      savedAt: new Date().toISOString(),
      rows: body.rows,
    }, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, destination);

    sendJson(response, 200, {
      status: 'saved',
      queryId,
      rows: body.rows.length,
    });
    return true;
  }

  if (request.method === 'POST' && pathname === '/__qwen3_browser_q8_human_holdout/finalize') {
    const completed = new Set(completedQueryIds());
    const missing = querySet.queries
      .map((query) => query.id)
      .filter((id) => !completed.has(id));

    if (missing.length) {
      sendJson(response, 409, {
        error: 'Qwen3 ranking holdout retrieval is incomplete.',
        missing,
      });
      return true;
    }

    const allRows = [];
    const perQuery = {};
    for (const query of querySet.queries) {
      const payload = JSON.parse(fs.readFileSync(queryFile(query.id), 'utf8'));
      validateRows(query.id, payload.rows);
      perQuery[query.id] = payload.rows.length;
      allRows.push(...payload.rows);
    }

    const expectedRows = prereg.query_set.query_count * poolDepth;
    if (allRows.length !== expectedRows) {
      throw new Error(`Expected ${expectedRows} rows, got ${allRows.length}`);
    }

    const jsonl = `${allRows.map((row) => JSON.stringify(row)).join('\n')}\n`;
    fs.writeFileSync(finalPath, jsonl, 'utf8');
    const runSha256 = createHash('sha256').update(jsonl, 'utf8').digest('hex');

    const meta = {
      schema_version: 'qwen3-browser-q8-human-holdout-production-pool-meta-v1',
      validation_id: prereg.validation_id,
      purpose: prereg.purpose,
      fresh_internal_validation: true,
      run_name: runName,
      runtime_commit: runtimeCommit,
      production_base_commit: prereg.lineage.production_base_commit,
      preregistration_path: PREREG_PATH,
      preregistration_sha256: preregSha256,
      query_set_path: QUERIES_PATH,
      query_set_sha256: queriesSha256,
      generated_at: new Date().toISOString(),
      query_count: querySet.queries.length,
      pool_depth: poolDepth,
      rows: allRows.length,
      per_query: perQuery,
      run_sha256: runSha256,
      retrieval_profile: prereg.retrieval.profile,
      qwen_used_during_retrieval: false,
      browser_q8_used_during_retrieval: false,
      human_labels_used_during_retrieval: false,
      production_ranking_changed: false,
      note: 'Fresh q8 human holdout retrieval using unchanged production search code. Browser q8 scoring and human labels are excluded from retrieval.',
    };

    fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
    fs.rmSync(partialDirectory, { recursive: true, force: true });

    sendJson(response, 200, {
      status: 'finalized',
      run: path.relative(ROOT, finalPath),
      metadata: path.relative(ROOT, metaPath),
      rows: allRows.length,
      runSha256,
    });
    return true;
  }

  return false;
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
};

function serveStatic(response, pathname) {
  let requested = pathname === '/' ? '/benchmark/qwen3/runner-browser-q8-human-holdout.html' : pathname;
  try {
    requested = decodeURIComponent(requested);
  } catch {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }

  const target = path.resolve(ROOT, `.${requested}`);
  const rootPrefix = ROOT.endsWith(path.sep) ? ROOT : `${ROOT}${path.sep}`;
  if (target !== ROOT && !target.startsWith(rootPrefix)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'content-type': mimeTypes[path.extname(target)] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  fs.createReadStream(target).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (await handleApi(request, response, url.pathname)) return;
    serveStatic(response, url.pathname);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: error.message });
    else response.end();
  }
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Check it with: lsof -nP -iTCP:${PORT} -sTCP\\:LISTEN`);
    process.exit(1);
  }
  throw error;
});

if (MODE === "preflight") {
  const existingOutputs = Object.entries(prereg.planned_outputs).filter(([,value]) => fs.existsSync(path.join(ROOT,value)));
  const partialExists = fs.existsSync(partialDirectory);
  if (existingOutputs.length || partialExists) throw new Error(`preflight found existing holdout state: ${JSON.stringify({ existingOutputs, partialExists })}`);
  console.log(JSON.stringify({
    experiment_id: prereg.validation_id,
    status: "preflight-passed-no-retrieval",
    preregistration_sha256: preregSha256,
    query_set_sha256: queriesSha256,
    query_count: querySet.queries.length,
    pool_depth: poolDepth,
    production_base_commit: prereg.lineage.production_base_commit,
    production_src_unchanged: true,
    planned_outputs_absent: true,
    partial_state_absent: true,
    retrieval_executed: false,
    qwen_used_during_retrieval: false,
    browser_q8_used_during_retrieval: false,
    human_labels_used_during_retrieval: false
  }, null, 2));
  process.exit(0);
}
server.listen(PORT, '127.0.0.1', () => {
  console.log();
  console.log('QWEN3 BROWSER Q8 HUMAN HOLDOUT · FRESH PRODUCTION POOL');
  console.log('==============================================');
  console.log(`Validation: ${prereg.validation_id}`);
  console.log(`Runtime: ${runtimeCommit}`);
  console.log(`Production base: ${prereg.lineage.production_base_commit}`);
  console.log(`Queries: ${querySet.queries.length}`);
  console.log(`Pool depth: ${poolDepth} (exact)`);
  console.log('Qwen is NOT used in this retrieval step.');
  console.log('Human labels are NOT used in this retrieval step.');
  console.log(`Open: http://127.0.0.1:${PORT}/benchmark/qwen3/runner-browser-q8-human-holdout.html`);
  console.log('Ctrl+C stops the server.');
});
