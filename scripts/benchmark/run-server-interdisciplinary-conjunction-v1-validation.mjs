import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const PORT = Number(process.env.BENCHMARK_PORT || 4182);
const VALIDATION_PATH = "benchmark/validation-interdisciplinary-conjunction-v1.queries.json";
const validation = JSON.parse(fs.readFileSync(path.join(ROOT, VALIDATION_PATH), "utf8"));
const runtimeCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const topK = Number(validation.evaluation?.topK || 10);
const poolDepth = 20;
const runName = `interdisciplinary-conjunction-v1-holdout-${runtimeCommit.slice(0, 7)}`;
const runDirectory = path.join(ROOT, "benchmark/runs");
const partialDirectory = path.join(runDirectory, `.${runName}.partial`);
const finalPath = path.join(runDirectory, `${runName}.jsonl`);
const metaPath = path.join(runDirectory, `${runName}.meta.json`);
const queryMap = new Map(validation.queries.map(query => [query.id, query]));

fs.mkdirSync(runDirectory, { recursive: true });

function queryFile(queryId) {
  return path.join(partialDirectory, `${queryId}.json`);
}

function completedQueryIds() {
  if (!fs.existsSync(partialDirectory)) return [];
  return validation.queries
    .filter(query => fs.existsSync(queryFile(query.id)))
    .map(query => query.id);
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value, null, 2);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 25_000_000) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(error); }
    });
    request.on("error", reject);
  });
}

function validateRows(queryId, condition, rows) {
  if (!Array.isArray(rows)) throw new Error(`${queryId}/${condition}: rows must be an array`);
  if (rows.length > poolDepth) throw new Error(`${queryId}/${condition}: more than ${poolDepth} rows`);
  const ids = new Set();
  rows.forEach((row, index) => {
    if (row.query_id !== queryId) throw new Error(`${queryId}/${condition}: query_id mismatch`);
    if (row.condition !== condition) throw new Error(`${queryId}/${condition}: condition mismatch`);
    if (row.rank !== index + 1) throw new Error(`${queryId}/${condition}: invalid rank ${row.rank}`);
    if (!row.record_id) throw new Error(`${queryId}/${condition}: missing record_id`);
    if (!Array.isArray(row.matchedQueries)) throw new Error(`${queryId}/${condition}: matchedQueries provenance missing`);
    if (ids.has(row.record_id)) throw new Error(`${queryId}/${condition}: duplicate record_id ${row.record_id}`);
    ids.add(row.record_id);
  });
}

function validatePayload(queryId, body) {
  validateRows(queryId, "A", body.rowsA);
  validateRows(queryId, "B", body.rowsB);
  if (!Number.isInteger(body.retrievedCandidates) || body.retrievedCandidates < 0) {
    throw new Error(`${queryId}: invalid retrievedCandidates`);
  }
  if (!Array.isArray(body.candidatePoolIds)) {
    throw new Error(`${queryId}: candidatePoolIds missing`);
  }
  if (body.candidatePoolIds.length !== body.retrievedCandidates) {
    throw new Error(`${queryId}: candidatePoolIds length mismatch`);
  }
  if (new Set(body.candidatePoolIds).size !== body.candidatePoolIds.length) {
    throw new Error(`${queryId}: duplicate candidatePoolIds`);
  }
  const pool = new Set(body.candidatePoolIds);
  for (const row of [...body.rowsA, ...body.rowsB]) {
    if (!pool.has(row.record_id)) throw new Error(`${queryId}: ranked row not found in shared candidate pool: ${row.record_id}`);
  }
}

async function handleApi(request, response, pathname) {
  if (request.method === "POST" && pathname === "/__benchmark/start") {
    if (fs.existsSync(finalPath)) {
      sendJson(response, 409, { error: "Frozen conjunction validation run already exists.", run: path.relative(ROOT, finalPath) });
      return true;
    }
    fs.mkdirSync(partialDirectory, { recursive: true });
    sendJson(response, 200, {
      runName,
      runtimeCommit,
      topK,
      poolDepth,
      expectedQueries: validation.queries.length,
      completedQueryIds: completedQueryIds(),
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/__benchmark/query") {
    const body = await readJsonBody(request);
    const queryId = String(body.queryId || "");
    if (!queryMap.has(queryId)) {
      sendJson(response, 400, { error: `Unknown validation query: ${queryId}` });
      return true;
    }
    if (Array.isArray(body.sourceErrors) && body.sourceErrors.length) {
      sendJson(response, 422, { error: `${queryId}: source errors detected`, sourceErrors: body.sourceErrors });
      return true;
    }

    const destination = queryFile(queryId);
    if (fs.existsSync(destination)) {
      sendJson(response, 200, { status: "already-saved", queryId });
      return true;
    }

    try { validatePayload(queryId, body); }
    catch (error) {
      sendJson(response, 400, { error: error.message });
      return true;
    }

    fs.mkdirSync(partialDirectory, { recursive: true });
    const temporary = `${destination}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({
      queryId,
      savedAt: new Date().toISOString(),
      retrievedCandidates: body.retrievedCandidates,
      candidatePoolIds: body.candidatePoolIds,
      expansions: body.expansions || [],
      rowsA: body.rowsA,
      rowsB: body.rowsB,
    }, null, 2) + "\n", "utf8");
    fs.renameSync(temporary, destination);
    sendJson(response, 200, {
      status: "saved",
      queryId,
      rowsA: body.rowsA.length,
      rowsB: body.rowsB.length,
      retrievedCandidates: body.retrievedCandidates,
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/__benchmark/finalize") {
    const completed = new Set(completedQueryIds());
    const missing = validation.queries.map(query => query.id).filter(id => !completed.has(id));
    if (missing.length) {
      sendJson(response, 409, { error: "Conjunction validation is incomplete.", missing });
      return true;
    }

    const allRows = [];
    const perQuery = {};
    for (const query of validation.queries) {
      const payload = JSON.parse(fs.readFileSync(queryFile(query.id), "utf8"));
      validatePayload(query.id, payload);
      allRows.push(...payload.rowsA, ...payload.rowsB);
      const aTop = new Set(payload.rowsA.slice(0, topK).map(row => row.record_id));
      const bTop = new Set(payload.rowsB.slice(0, topK).map(row => row.record_id));
      const changedPairs = [...aTop].filter(id => !bTop.has(id)).length + [...bTop].filter(id => !aTop.has(id)).length;
      perQuery[query.id] = {
        retrievedCandidates: payload.retrievedCandidates,
        rowsA: payload.rowsA.length,
        rowsB: payload.rowsB.length,
        changedTop10Pairs: changedPairs,
        expansions: payload.expansions,
        savedAt: payload.savedAt,
      };
    }

    fs.writeFileSync(finalPath, allRows.map(row => JSON.stringify(row)).join("\n") + "\n", "utf8");
    const meta = {
      schemaVersion: 1,
      name: "Interdisciplinary conjunction ranking v1 fresh same-pool holdout",
      runName,
      runtimeCommit,
      generatedAt: new Date().toISOString(),
      validationQueries: VALIDATION_PATH,
      rankingImplementationCommit: validation.baseCommit,
      queryCount: validation.queries.length,
      topK,
      poolDepth,
      rows: allRows.length,
      perQuery,
      pairedDesign: {
        sameRetrievalPoolPerQuery: true,
        networkCallsPerQuery: 1,
        conditionA: "pre-conjunction score = clamp(baseScore + v2Adjustment)",
        conditionB: "conjunction-v1 production rankingSortScore",
        deterministicTieBreak: "record_id ascending for both conditions",
        purpose: "isolate ranking effect from live provider drift",
      },
      profile: {
        maxQueries: 5,
        providers: {
          openAlexPhilosophy: { enabled: true, rows: 12 },
          cucshFilosofia: { enabled: true, rows: 8 },
          openAlex: { enabled: false, perPage: 12 },
          crossref: { enabled: true, rows: 12 },
          internetArchive: { enabled: true, rows: 6 },
        },
        delayBetweenExpansions: 600,
      },
      limitations: validation.limitations,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
    fs.rmSync(partialDirectory, { recursive: true, force: true });
    sendJson(response, 200, {
      status: "finalized",
      run: path.relative(ROOT, finalPath),
      metadata: path.relative(ROOT, metaPath),
      rows: allRows.length,
    });
    return true;
  }

  return false;
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
};

function serveStatic(response, pathname) {
  let requested = pathname === "/" ? "/benchmark/runner-interdisciplinary-conjunction-v1-validation.html" : pathname;
  try { requested = decodeURIComponent(requested); }
  catch { response.writeHead(400); response.end("Bad request"); return; }
  const target = path.resolve(ROOT, `.${requested}`);
  const rootPrefix = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (target !== ROOT && !target.startsWith(rootPrefix)) { response.writeHead(403); response.end("Forbidden"); return; }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404); response.end("Not found"); return; }
  response.writeHead(200, { "content-type": mimeTypes[path.extname(target)] || "application/octet-stream", "cache-control": "no-store" });
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

server.on("error", error => {
  if (error?.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Check it with: lsof -nP -iTCP:${PORT} -sTCP\\:LISTEN`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, "127.0.0.1", () => {
  console.log();
  console.log("INTERDISCIPLINARY CONJUNCTION V1 HOLDOUT SERVER");
  console.log("==============================================");
  console.log(`Run: ${runName}`);
  console.log(`Runtime: ${runtimeCommit}`);
  console.log(`Queries: ${validation.queries.length}`);
  console.log(`Top K: ${topK}`);
  console.log(`Pool depth per condition: ${poolDepth}`);
  console.log("One live retrieval per query; A and B rerank the exact same candidate pool.");
  console.log("A=pre-conjunction score; B=conjunction-v1; tie-break=record_id ascending.");
  console.log();
  console.log(`Open: http://127.0.0.1:${PORT}/benchmark/runner-interdisciplinary-conjunction-v1-validation.html`);
  console.log();
  console.log("Ctrl+C stops the server.");
});
