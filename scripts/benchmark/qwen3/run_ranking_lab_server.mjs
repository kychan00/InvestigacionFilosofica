import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const PORT = Number(process.env.BENCHMARK_PORT || 4189);
const PREREG_PATH = 'benchmark/qwen3/ranking/qwen3-ranking-v1.preregistered.json';
const QUERIES_PATH = 'benchmark/queries.json';

const preregText = fs.readFileSync(path.join(ROOT, PREREG_PATH), 'utf8');
const queriesText = fs.readFileSync(path.join(ROOT, QUERIES_PATH), 'utf8');
const prereg = JSON.parse(preregText);
const benchmark = JSON.parse(queriesText);

const runtimeCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const preregSha256 = createHash('sha256').update(preregText, 'utf8').digest('hex');
const queriesSha256 = createHash('sha256').update(queriesText, 'utf8').digest('hex');

const poolDepth = Number(prereg.retrieval.pool_depth);
const minimumRows = Number(prereg.retrieval.minimum_results_per_query);
const runName = `${prereg.ranking_experiment_id}-production-pool-${runtimeCommit.slice(0, 7)}`;
const runDirectory = path.join(ROOT, 'benchmark/qwen3/ranking/runs');
const partialDirectory = path.join(runDirectory, `.${runName}.partial`);
const finalPath = path.join(runDirectory, `${runName}.jsonl`);
const metaPath = path.join(runDirectory, `${runName}.meta.json`);
const queryMap = new Map(benchmark.queries.map((query) => [query.id, query]));

if (benchmark.queries.length !== prereg.query_set.query_count) {
  throw new Error(`Expected ${prereg.query_set.query_count} development queries, got ${benchmark.queries.length}`);
}
if (poolDepth !== 20 || minimumRows !== 20) {
  throw new Error('Qwen3 ranking lab v1 requires exactly a complete Top-20 pool per query');
}

fs.mkdirSync(runDirectory, { recursive: true });

function queryFile(queryId) {
  return path.join(partialDirectory, `${queryId}.json`);
}

function completedQueryIds() {
  if (!fs.existsSync(partialDirectory)) return [];
  return benchmark.queries
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
    if (row.rank !== index + 1) throw new Error(`${queryId}: invalid rank ${row.rank}`);
    if (!row.record_id) throw new Error(`${queryId}: missing record_id`);
    if (!Array.isArray(row.matchedQueries)) throw new Error(`${queryId}: matchedQueries provenance missing`);
    if (ids.has(row.record_id)) throw new Error(`${queryId}: duplicate record_id ${row.record_id}`);
    ids.add(row.record_id);
  });
}

async function handleApi(request, response, pathname) {
  if (request.method === 'POST' && pathname === '/__qwen3_ranking/start') {
    if (fs.existsSync(finalPath)) {
      sendJson(response, 409, {
        error: 'Frozen Qwen3 ranking-lab production pool already exists.',
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
      productionBaseCommit: prereg.production_base_commit,
      expectedQueries: benchmark.queries.length,
      poolDepth,
      completedQueryIds: completedQueryIds(),
    });
    return true;
  }

  if (request.method === 'POST' && pathname === '/__qwen3_ranking/query') {
    const body = await readJsonBody(request);
    const queryId = String(body.queryId || '');
    if (!queryMap.has(queryId)) {
      sendJson(response, 400, { error: `Unknown development query: ${queryId}` });
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

  if (request.method === 'POST' && pathname === '/__qwen3_ranking/finalize') {
    const completed = new Set(completedQueryIds());
    const missing = benchmark.queries
      .map((query) => query.id)
      .filter((id) => !completed.has(id));

    if (missing.length) {
      sendJson(response, 409, {
        error: 'Qwen3 ranking-lab retrieval is incomplete.',
        missing,
      });
      return true;
    }

    const allRows = [];
    const perQuery = {};
    for (const query of benchmark.queries) {
      const payload = JSON.parse(fs.readFileSync(queryFile(query.id), 'utf8'));
      validateRows(query.id, payload.rows);
      perQuery[query.id] = payload.rows.length;
      allRows.push(...payload.rows);
    }

    if (allRows.length !== prereg.query_set.query_count * poolDepth) {
      throw new Error(`Expected 1000 rows, got ${allRows.length}`);
    }

    const jsonl = `${allRows.map((row) => JSON.stringify(row)).join('\n')}\n`;
    fs.writeFileSync(finalPath, jsonl, 'utf8');
    const runSha256 = createHash('sha256').update(jsonl, 'utf8').digest('hex');

    const meta = {
      schema_version: 'qwen3-ranking-production-pool-meta-v1',
      ranking_experiment_id: prereg.ranking_experiment_id,
      purpose: prereg.purpose,
      development_only: true,
      run_name: runName,
      runtime_commit: runtimeCommit,
      production_base_commit: prereg.production_base_commit,
      preregistration_path: PREREG_PATH,
      preregistration_sha256: preregSha256,
      query_set_path: QUERIES_PATH,
      query_set_sha256: queriesSha256,
      generated_at: new Date().toISOString(),
      query_count: benchmark.queries.length,
      pool_depth: poolDepth,
      rows: allRows.length,
      per_query: perQuery,
      run_sha256: runSha256,
      retrieval_profile: prereg.retrieval.profile,
      qwen_used_during_retrieval: false,
      human_labels_used_during_retrieval: false,
      production_ranking_changed: false,
      note: 'The evaluation/Qwen lab lineage does not modify src/ relative to production base bb9689da; this snapshot uses the current production search code and live providers.',
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
  let requested = pathname === '/' ? '/benchmark/qwen3/runner-ranking-lab.html' : pathname;
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

server.listen(PORT, '127.0.0.1', () => {
  console.log();
  console.log('QWEN3 OFFLINE RANKING LAB · FRESH PRODUCTION POOL');
  console.log('=================================================');
  console.log(`Experiment: ${prereg.ranking_experiment_id}`);
  console.log(`Runtime: ${runtimeCommit}`);
  console.log(`Production base: ${prereg.production_base_commit}`);
  console.log(`Queries: ${benchmark.queries.length}`);
  console.log(`Pool depth: ${poolDepth} (exact)`);
  console.log('Qwen is NOT used in this retrieval step.');
  console.log('Human labels are NOT used in this retrieval step.');
  console.log(`Open: http://127.0.0.1:${PORT}/benchmark/qwen3/runner-ranking-lab.html`);
  console.log('Ctrl+C stops the server.');
});
