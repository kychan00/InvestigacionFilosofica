import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const PORT = Number(process.env.BENCHMARK_PORT || 4174);

const benchmark = JSON.parse(
  fs.readFileSync(path.join(ROOT, "benchmark/queries.json"), "utf8")
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "release-manifest.json"), "utf8")
);

const runtimeCommit = execFileSync(
  "git",
  ["rev-parse", "HEAD"],
  { encoding: "utf8" }
).trim();
const harnessCommit = runtimeCommit;
const benchmarkVersion = benchmark.version;
const rankingDepth = benchmark.evaluation?.rankingDepth || 10;
const poolDepth = benchmark.evaluation?.poolDepth || 20;
const runName =
  `human-v${benchmarkVersion}-ranking-v2-` + runtimeCommit.slice(0, 7);

const runDirectory = path.join(ROOT, "benchmark/runs");
const partialDirectory = path.join(runDirectory, `.${runName}.partial`);
const finalPath = path.join(runDirectory, `${runName}.jsonl`);
const metaPath = path.join(runDirectory, `${runName}.meta.json`);
const expectedQueries = new Set(benchmark.queries.map(query => query.id));

fs.mkdirSync(runDirectory, { recursive: true });

function queryFile(queryId) {
  return path.join(partialDirectory, `${queryId}.json`);
}

function completedQueryIds() {
  if (!fs.existsSync(partialDirectory)) return [];
  return fs.readdirSync(partialDirectory)
    .filter(name => name.endsWith(".json"))
    .map(name => name.slice(0, -5))
    .filter(id => expectedQueries.has(id));
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
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function validateRows(queryId, rows) {
  if (!Array.isArray(rows)) throw new Error("rows must be an array");
  if (rows.length > poolDepth) {
    throw new Error(`${queryId}: more than ${poolDepth} rows`);
  }

  const ids = new Set();
  rows.forEach((row, index) => {
    if (row.query_id !== queryId) {
      throw new Error(`${queryId}: query_id mismatch`);
    }
    if (row.rank !== index + 1) {
      throw new Error(`${queryId}: invalid rank ${row.rank}`);
    }
    if (!row.record_id) {
      throw new Error(`${queryId}: missing record_id`);
    }
    if (ids.has(row.record_id)) {
      throw new Error(`${queryId}: duplicate record_id ${row.record_id}`);
    }
    ids.add(row.record_id);
  });
}

async function handleApi(request, response, pathname) {
  if (request.method === "POST" && pathname === "/__benchmark/start") {
    if (fs.existsSync(finalPath)) {
      sendJson(response, 409, {
        error: "Frozen Ranking v2 benchmark run already exists.",
        run: path.relative(ROOT, finalPath),
      });
      return true;
    }

    fs.mkdirSync(partialDirectory, { recursive: true });
    sendJson(response, 200, {
      runName,
      benchmarkVersion,
      runtimeCommit,
      harnessCommit,
      rankingDepth,
      poolDepth,
      expectedQueries: benchmark.queries.length,
      completedQueryIds: completedQueryIds(),
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/__benchmark/query") {
    const body = await readJsonBody(request);
    const queryId = body.queryId;

    if (!expectedQueries.has(queryId)) {
      sendJson(response, 400, { error: `Unknown query: ${queryId}` });
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
      sendJson(response, 200, { status: "already-saved", queryId });
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
    fs.writeFileSync(
      temporary,
      JSON.stringify(
        { queryId, savedAt: new Date().toISOString(), rows: body.rows },
        null,
        2
      ) + "\n",
      "utf8"
    );
    fs.renameSync(temporary, destination);
    sendJson(response, 200, {
      status: "saved",
      queryId,
      rows: body.rows.length,
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/__benchmark/finalize") {
    const completed = new Set(completedQueryIds());
    const missing = benchmark.queries
      .map(query => query.id)
      .filter(id => !completed.has(id));

    if (missing.length) {
      sendJson(response, 409, { error: "Benchmark is incomplete.", missing });
      return true;
    }

    const allRows = [];
    const perQuery = {};
    for (const query of benchmark.queries) {
      const payload = JSON.parse(
        fs.readFileSync(queryFile(query.id), "utf8")
      );
      validateRows(query.id, payload.rows);
      perQuery[query.id] = payload.rows.length;
      allRows.push(...payload.rows);
    }

    fs.writeFileSync(
      finalPath,
      allRows.map(row => JSON.stringify(row)).join("\n") + "\n",
      "utf8"
    );

    const meta = {
      schemaVersion: 1,
      benchmarkVersion,
      runName,
      runtimeCommit,
      harnessCommit,
      generatedAt: new Date().toISOString(),
      queryCount: benchmark.queries.length,
      rankingDepth,
      poolDepth,
      rows: allRows.length,
      perQuery,
      profile: {
        name: "experimental-ranking-v2",
        baseProductionRuntime: manifest.release.runtimeCommit,
        rankingPolicy: "crossref_lowcov_050",
        maxQueries: 5,
        openAlexPhilosophy: { enabled: true, rows: 12 },
        cucshFilosofia: { enabled: true, rows: 8 },
        openAlex: { enabled: false, perPage: 12 },
        crossref: { enabled: true, rows: 12 },
        internetArchive: { enabled: true, rows: 6 },
        delayBetweenExpansions: 600,
      },
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
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function serveStatic(response, pathname) {
  let requested = pathname === "/" ? "/benchmark/runner.html" : pathname;
  try {
    requested = decodeURIComponent(requested);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const target = path.resolve(ROOT, `.${requested}`);
  const rootPrefix = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (target !== ROOT && !target.startsWith(rootPrefix)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": mimeTypes[path.extname(target)] || "application/octet-stream",
    "cache-control": "no-store",
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
    if (!response.headersSent) {
      sendJson(response, 500, { error: error.message });
    } else {
      response.end();
    }
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log();
  console.log("RANKING V2 BENCHMARK SERVER");
  console.log("===========================");
  console.log(`Run: ${runName}`);
  console.log(`Runtime: ${runtimeCommit}`);
  console.log(`Base production runtime: ${manifest.release.runtimeCommit}`);
  console.log(`Pool depth: ${poolDepth}`);
  console.log();
  console.log(`Open: http://127.0.0.1:${PORT}/benchmark/runner.html`);
  console.log();
  console.log("Ctrl+C stops the server.");
});
