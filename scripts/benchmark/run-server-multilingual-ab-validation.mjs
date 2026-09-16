import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const PORT = Number(process.env.BENCHMARK_PORT || 4180);
const VALIDATION_PATH = "benchmark/validation-multilingual-ab-v1.queries.json";
const validation = JSON.parse(fs.readFileSync(path.join(ROOT, VALIDATION_PATH), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "release-manifest.json"), "utf8"));

const runtimeCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const rankingDepth = validation.evaluation?.rankingDepth || 10;
const poolDepth = validation.evaluation?.poolDepth || 20;
const conditions = ["A", "B"];
const runName = `heldout-multilingual-ab-v1-${runtimeCommit.slice(0, 7)}`;
const runDirectory = path.join(ROOT, "benchmark/runs");
const partialDirectory = path.join(runDirectory, `.${runName}.partial`);
const finalPath = path.join(runDirectory, `${runName}.jsonl`);
const metaPath = path.join(runDirectory, `${runName}.meta.json`);
const queryMap = new Map(validation.queries.map(query => [query.id, query]));
const expectedPairKeys = new Set(validation.queries.flatMap(query => conditions.map(condition => `${query.id}:${condition}`)));

fs.mkdirSync(runDirectory, { recursive: true });

function pairKey(queryId, condition) {
  return `${queryId}:${condition}`;
}

function pairFile(queryId, condition) {
  return path.join(partialDirectory, `${queryId}--${condition}.json`);
}

function completedPairKeys() {
  if (!fs.existsSync(partialDirectory)) return [];
  const out = [];
  for (const query of validation.queries) {
    for (const condition of conditions) {
      if (fs.existsSync(pairFile(query.id, condition))) out.push(pairKey(query.id, condition));
    }
  }
  return out;
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
  if (!Array.isArray(rows)) throw new Error("rows must be an array");
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

async function handleApi(request, response, pathname) {
  if (request.method === "POST" && pathname === "/__benchmark/start") {
    if (fs.existsSync(finalPath)) {
      sendJson(response, 409, { error: "Frozen held-out A/B run already exists.", run: path.relative(ROOT, finalPath) });
      return true;
    }
    fs.mkdirSync(partialDirectory, { recursive: true });
    sendJson(response, 200, {
      runName,
      runtimeCommit,
      rankingDepth,
      poolDepth,
      expectedPairs: expectedPairKeys.size,
      completedPairKeys: completedPairKeys(),
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/__benchmark/query") {
    const body = await readJsonBody(request);
    const queryId = String(body.queryId || "");
    const condition = String(body.condition || "");
    const key = pairKey(queryId, condition);
    if (!queryMap.has(queryId) || !conditions.includes(condition) || !expectedPairKeys.has(key)) {
      sendJson(response, 400, { error: `Unknown validation pair: ${key}` });
      return true;
    }
    if (Array.isArray(body.sourceErrors) && body.sourceErrors.length) {
      sendJson(response, 422, { error: `${key}: source errors detected`, sourceErrors: body.sourceErrors });
      return true;
    }
    const destination = pairFile(queryId, condition);
    if (fs.existsSync(destination)) {
      sendJson(response, 200, { status: "already-saved", pairKey: key });
      return true;
    }
    try { validateRows(queryId, condition, body.rows); }
    catch (error) {
      sendJson(response, 400, { error: error.message });
      return true;
    }
    fs.mkdirSync(partialDirectory, { recursive: true });
    const temporary = `${destination}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({
      queryId,
      condition,
      orderPosition: Number(body.orderPosition ?? -1),
      savedAt: new Date().toISOString(),
      rows: body.rows,
    }, null, 2) + "\n", "utf8");
    fs.renameSync(temporary, destination);
    sendJson(response, 200, { status: "saved", pairKey: key, rows: body.rows.length });
    return true;
  }

  if (request.method === "POST" && pathname === "/__benchmark/finalize") {
    const completed = new Set(completedPairKeys());
    const missing = [...expectedPairKeys].filter(key => !completed.has(key));
    if (missing.length) {
      sendJson(response, 409, { error: "Held-out A/B benchmark is incomplete.", missing });
      return true;
    }

    const allRows = [];
    const perQueryCondition = {};
    const executionOrder = [];
    for (const query of validation.queries) {
      for (const condition of conditions) {
        const payload = JSON.parse(fs.readFileSync(pairFile(query.id, condition), "utf8"));
        validateRows(query.id, condition, payload.rows);
        const key = pairKey(query.id, condition);
        perQueryCondition[key] = payload.rows.length;
        executionOrder.push({ query_id: query.id, condition, orderPosition: payload.orderPosition, savedAt: payload.savedAt });
        allRows.push(...payload.rows);
      }
    }
    executionOrder.sort((a, b) => a.orderPosition - b.orderPosition);

    fs.writeFileSync(finalPath, allRows.map(row => JSON.stringify(row)).join("\n") + "\n", "utf8");
    const meta = {
      schemaVersion: 1,
      name: "Held-out multilingual A/B validation v1",
      runName,
      runtimeCommit,
      generatedAt: new Date().toISOString(),
      validationQueries: VALIDATION_PATH,
      frozenFromCommit: validation.frozenFromCommit,
      queryCount: validation.queries.length,
      conditions: validation.conditions,
      rankingDepth,
      poolDepth,
      expectedPairs: expectedPairKeys.size,
      rows: allRows.length,
      perQueryCondition,
      executionOrder,
      pairedDesign: {
        queryMajor: true,
        orderRule: "even query index A→B; odd query index B→A",
        A: { maxQueries: 1, meaning: "original-only" },
        B: { maxQueries: 5, meaning: "safe multilingual expansion" },
        englishQueriesAreDriftControls: true,
      },
      profile: {
        baseProductionRuntime: manifest.release.runtimeCommit,
        rankingPolicy: "ranking-v2-current",
        providers: {
          openAlexPhilosophy: { enabled: true, rows: 12 },
          cucshFilosofia: { enabled: true, rows: 8 },
          openAlex: { enabled: false, perPage: 12 },
          crossref: { enabled: true, rows: 12 },
          internetArchive: { enabled: true, rows: 6 },
        },
        delayBetweenExpansions: 600,
      },
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
    fs.rmSync(partialDirectory, { recursive: true, force: true });
    sendJson(response, 200, { status: "finalized", run: path.relative(ROOT, finalPath), metadata: path.relative(ROOT, metaPath), rows: allRows.length });
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
  let requested = pathname === "/" ? "/benchmark/runner-multilingual-ab-validation.html" : pathname;
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
  console.log("HELD-OUT MULTILINGUAL A/B VALIDATION SERVER");
  console.log("===========================================");
  console.log(`Run: ${runName}`);
  console.log(`Runtime: ${runtimeCommit}`);
  console.log(`Queries: ${validation.queries.length}`);
  console.log(`Paired conditions: ${expectedPairKeys.size}`);
  console.log(`Pool depth: ${poolDepth}`);
  console.log("A=maxQueries 1 (original-only); B=maxQueries 5 (safe multilingual expansion)");
  console.log("Order alternates A→B / B→A by query; English rows are drift controls.");
  console.log();
  console.log(`Open: http://127.0.0.1:${PORT}/benchmark/runner-multilingual-ab-validation.html`);
  console.log();
  console.log("Ctrl+C stops the server.");
});
