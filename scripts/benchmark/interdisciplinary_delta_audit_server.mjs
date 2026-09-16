import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PORT = Number(process.env.INTERDISCIPLINARY_DELTA_AUDIT_PORT || 4177);

const SAMPLE_PATH = path.join(ROOT, "benchmark/interdisciplinary-delta-audit-v1.sample.jsonl");
const PROGRESS_PATH = path.join(ROOT, "benchmark/.interdisciplinary-delta-audit-v1.progress.json");
const FINAL_PATH = path.join(ROOT, "benchmark/interdisciplinary-delta-audit-v1.judgments.jsonl");

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1}: ${error.message}`);
      }
    });
}

function readProgress() {
  if (!fs.existsSync(PROGRESS_PATH)) {
    return {
      schemaVersion: 1,
      updatedAt: null,
      finalizedAt: null,
      judgments: {},
    };
  }

  const value = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
  value.judgments ||= {};
  return value;
}

function writeProgress(progress) {
  const temporary = `${PROGRESS_PATH}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(progress, null, 2) + "\n", "utf8");
  fs.renameSync(temporary, PROGRESS_PATH);
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

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
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

if (!fs.existsSync(SAMPLE_PATH)) {
  console.error("Missing benchmark/interdisciplinary-delta-audit-v1.sample.jsonl");
  console.error("Run: npm run benchmark:interdisciplinary-delta-audit:sample");
  process.exit(1);
}

const sample = readJsonl(SAMPLE_PATH);
if (!sample.length) {
  console.error("Delta audit sample is empty; there is nothing to judge.");
  process.exit(1);
}

const sampleById = new Map(sample.map(row => [row.audit_id, row]));

function statePayload() {
  const progress = readProgress();
  const judgments = progress.judgments || {};
  const labeled = sample.filter(row =>
    Number.isInteger(judgments[row.audit_id]?.human_relevance)
  ).length;

  return {
    schemaVersion: 1,
    rows: sample,
    judgments,
    labeled,
    total: sample.length,
    finalized: fs.existsSync(FINAL_PATH),
    finalizedAt: progress.finalizedAt || null,
  };
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/__human-audit/state") {
    sendJson(response, 200, statePayload());
    return true;
  }

  if (request.method === "POST" && pathname === "/__human-audit/save") {
    const body = await readBody(request);
    const auditId = String(body.audit_id || "");
    if (!sampleById.has(auditId)) {
      sendJson(response, 400, { error: `Unknown audit_id: ${auditId}` });
      return true;
    }

    const relevance = body.human_relevance;
    if (
      relevance !== null &&
      !(Number.isInteger(relevance) && relevance >= 0 && relevance <= 3)
    ) {
      sendJson(response, 400, { error: "human_relevance must be 0, 1, 2, 3, or null" });
      return true;
    }

    const progress = readProgress();
    progress.updatedAt = new Date().toISOString();
    progress.finalizedAt = null;
    progress.judgments[auditId] = {
      human_relevance: relevance,
      human_note: String(body.human_note || "").slice(0, 4000),
      savedAt: progress.updatedAt,
    };
    writeProgress(progress);

    const state = statePayload();
    sendJson(response, 200, {
      status: "saved",
      audit_id: auditId,
      labeled: state.labeled,
      total: state.total,
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/__human-audit/finalize") {
    const progress = readProgress();
    const judgments = progress.judgments || {};
    const missing = sample
      .filter(row => !Number.isInteger(judgments[row.audit_id]?.human_relevance))
      .map(row => row.audit_id);

    if (missing.length) {
      sendJson(response, 409, { error: "Human audit is incomplete.", missing });
      return true;
    }

    const finalizedAt = new Date().toISOString();
    const rows = sample.map(row => ({
      audit_id: row.audit_id,
      query_id: row.query_id,
      record_id: row.record_id,
      human_relevance: judgments[row.audit_id].human_relevance,
      human_note: judgments[row.audit_id].human_note || "",
      judged_at: judgments[row.audit_id].savedAt || finalizedAt,
    }));

    fs.writeFileSync(
      FINAL_PATH,
      rows.map(row => JSON.stringify(row)).join("\n") + "\n",
      "utf8"
    );

    progress.finalizedAt = finalizedAt;
    progress.updatedAt = finalizedAt;
    writeProgress(progress);

    sendJson(response, 200, {
      status: "finalized",
      rows: rows.length,
      output: "benchmark/interdisciplinary-delta-audit-v1.judgments.jsonl",
      finalizedAt,
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
};

function serveStatic(response, pathname) {
  const requested = pathname === "/"
    ? "/benchmark/interdisciplinary-delta-audit.html"
    : pathname;

  let decoded;
  try {
    decoded = decodeURIComponent(requested);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const target = path.resolve(ROOT, `.${decoded}`);
  const rootPrefix = ROOT.endsWith(path.sep) ? ROOT : `${ROOT}${path.sep}`;
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
    if (!response.headersSent) sendJson(response, 500, { error: error.message });
    else response.end();
  }
});

server.on("error", error => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Check it with: lsof -nP -iTCP:${PORT} -sTCP:LISTEN`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, "127.0.0.1", () => {
  const state = statePayload();
  console.log();
  console.log("INTERDISCIPLINARY DELTA AUDIT SERVER");
  console.log("====================================");
  console.log(`Progress: ${state.labeled}/${state.total}`);
  console.log(`Open: http://127.0.0.1:${PORT}/benchmark/interdisciplinary-delta-audit.html`);
  console.log();
  console.log("Blindness: old/new side and ranks are not exposed in the browser sample.");
  console.log("Labels: 0=noise, 1=adjacent, 2=relevant, 3=central");
  console.log("Ctrl+C stops the server.");
});
