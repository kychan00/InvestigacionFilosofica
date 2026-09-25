import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const PORT = Number(process.env.QWEN3_BROWSER_Q8_HUMAN_HOLDOUT_AUDIT_PORT || 4191);

const SAMPLE_PATH = path.join(
  ROOT,
  "benchmark/qwen3/browser/q8-human-holdout/audit/qwen3-browser-q8-human-holdout-v1-delta-audit.sample.jsonl",
);
const SAMPLE_SHA256 = "b0ec1980f47e0f123a36f056c86b23965b3c9aa61693b382aac38abbb93855f9";
const SAMPLE_META_PATH = path.join(
  ROOT,
  "benchmark/qwen3/browser/q8-human-holdout/audit/qwen3-browser-q8-human-holdout-v1-delta-audit.sample.meta.json",
);
const SAMPLE_META_SHA256 = "d2f5be7b60104c2029331882646c8e742653f3a918edebf3716fa67a157b4ff4";
const WORKSHEET_PATH = path.join(
  ROOT,
  "benchmark/qwen3/browser/q8-human-holdout/audit/qwen3-browser-q8-human-holdout-v1-delta-audit.sample.txt",
);
const WORKSHEET_SHA256 = "4ff6c82768738f492330d85f4b76d4275e9488bcfa1bdede9a113f107e55e776";
const SAMPLE_FREEZE_COMMIT = "b39163d9fa0d7b21e3f7f277b19fd1a880febf43";

const PROGRESS_PATH = path.join(
  ROOT,
  "benchmark/qwen3/cache/qwen3-browser-q8-human-holdout-v1-human-audit.progress.json",
);
const FINAL_PATH = path.join(
  ROOT,
  "benchmark/qwen3/browser/q8-human-holdout/audit/qwen3-browser-q8-human-holdout-v1-delta-audit.judgments.jsonl",
);
const FINAL_META_PATH = path.join(
  ROOT,
  "benchmark/qwen3/browser/q8-human-holdout/audit/qwen3-browser-q8-human-holdout-v1-delta-audit.judgments.meta.json",
);
const HTML_PATH = path.join(
  ROOT,
  "benchmark/qwen3/browser/q8-human-holdout/qwen3-browser-q8-human-holdout-human-audit.html",
);
const APP_PATH = path.join(
  ROOT,
  "scripts/benchmark/qwen3/browser_q8_human_holdout_audit_browser.js",
);

function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1}: ${error.message}`);
      }
    });
}

function verifyFrozenInputs() {
  const required = [
    [SAMPLE_PATH, SAMPLE_SHA256, "frozen blind sample"],
    [SAMPLE_META_PATH, SAMPLE_META_SHA256, "frozen blind sample metadata"],
    [WORKSHEET_PATH, WORKSHEET_SHA256, "frozen blind worksheet"],
  ];
  for (const [filePath, expectedSha, label] of required) {
    if (!fs.existsSync(filePath)) throw new Error(`Missing ${label}: ${filePath}`);
    const actual = sha256File(filePath);
    if (actual !== expectedSha) {
      throw new Error(`${label} SHA mismatch: expected ${expectedSha}, got ${actual}`);
    }
  }
}

function readProgress() {
  if (!fs.existsSync(PROGRESS_PATH)) {
    return {
      schemaVersion: 1,
      validationId: "qwen3-browser-q8-human-holdout-v1",
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
  fs.mkdirSync(path.dirname(PROGRESS_PATH), { recursive: true });
  const temporary = `${PROGRESS_PATH}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(progress, null, 2) + "\n", "utf8");
  fs.renameSync(temporary, PROGRESS_PATH);
}

function writeTextAtomic(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, text, "utf8");
  fs.renameSync(temporary, filePath);
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

function sendFile(response, filePath, contentType) {
  response.writeHead(200, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  fs.createReadStream(filePath).pipe(response);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
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

verifyFrozenInputs();

if (process.argv.includes("--preflight")) {
  console.log(JSON.stringify({
    status: "preflight-passed-no-output",
    sample_rows_expected: 192,
    sample_sha256: SAMPLE_SHA256,
    sample_meta_sha256: SAMPLE_META_SHA256,
    worksheet_sha256: WORKSHEET_SHA256,
    sample_freeze_commit: SAMPLE_FREEZE_COMMIT,
    ab_condition_visible: false,
    ranking_visible: false,
    browser_q8_score_visible: false,
    production_score_visible: false,
    provider_provenance_visible: false,
    private_mapping_available: false,
    progress_written: false,
    judgments_written: false,
  }, null, 2));
  process.exit(0);
}

const sample = readJsonl(SAMPLE_PATH);
if (sample.length !== 192) {
  throw new Error(`Expected 192 blind audit sample rows, found ${sample.length}`);
}
const sampleById = new Map(sample.map((row) => [row.audit_id, row]));
if (sampleById.size !== 192) throw new Error("Holdout sample contains duplicate audit_id values");
if (sample.some((row) => row.human_relevance !== null || row.human_note !== "")) {
  throw new Error("Frozen blind sample unexpectedly contains human judgments");
}
const expectedAuditIds = Array.from({ length: 192 }, (_, index) => `Q8H${String(index + 1).padStart(3, "0")}`);
if (sample.some((row, index) => row.audit_id !== expectedAuditIds[index])) {
  throw new Error("Frozen blind sample audit_id sequence is not Q8H001..Q8H192");
}

const forbiddenSampleFields = new Set([
  "condition",
  "rank",
  "original_rank",
  "browser_q8_raw_score",
  "score",
  "relevanceLevel",
  "ranking",
  "providers",
  "matchedQueries",
  "urls",
  "citedBy",
  "record_id",
  "query_id",
  "doi",
]);
for (const row of sample) {
  for (const field of forbiddenSampleFields) {
    if (Object.prototype.hasOwnProperty.call(row, field)) {
      throw new Error(`Blind sample leaked forbidden field: ${field}`);
    }
  }
}

function statePayload() {
  const progress = readProgress();
  const judgments = progress.judgments || {};
  const labeled = sample.filter((row) =>
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
  if (request.method === "GET" && pathname === "/__qwen3_browser_q8_human_holdout_audit/state") {
    sendJson(response, 200, statePayload());
    return true;
  }

  if (request.method === "POST" && pathname === "/__qwen3_browser_q8_human_holdout_audit/save") {
    if (fs.existsSync(FINAL_PATH)) {
      sendJson(response, 409, { error: "Holdout adjudication is already finalized." });
      return true;
    }

    const body = await readBody(request);
    const auditId = String(body.audit_id || "");
    const sampleRow = sampleById.get(auditId);
    if (!sampleRow) {
      sendJson(response, 400, { error: `Unknown audit_id: ${auditId}` });
      return true;
    }

    const relevance = body.human_relevance;
    if (
      relevance !== null &&
      !(Number.isInteger(relevance) && relevance >= 0 && relevance <= 3)
    ) {
      sendJson(response, 400, {
        error: "human_relevance must be 0, 1, 2, 3, or null",
      });
      return true;
    }

    const note = String(body.human_note || "").slice(0, 4000);
    const progress = readProgress();
    progress.updatedAt = new Date().toISOString();
    progress.finalizedAt = null;
    progress.judgments[auditId] = {
      human_relevance: relevance,
      human_note: note,
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

  if (request.method === "POST" && pathname === "/__qwen3_browser_q8_human_holdout_audit/finalize") {
    if (fs.existsSync(FINAL_PATH)) {
      sendJson(response, 409, { error: "Holdout adjudication is already finalized." });
      return true;
    }

    const progress = readProgress();
    const judgments = progress.judgments || {};
    const missing = sample
      .filter((row) => !Number.isInteger(judgments[row.audit_id]?.human_relevance))
      .map((row) => row.audit_id);

    if (missing.length) {
      sendJson(response, 409, {
        error: "Human holdout adjudication is incomplete.",
        missing,
      });
      return true;
    }

    const finalizedAt = new Date().toISOString();
    const rows = sample.map((row) => ({
      audit_id: row.audit_id,
      human_relevance: judgments[row.audit_id].human_relevance,
      human_note: judgments[row.audit_id].human_note || "",
      judged_at: judgments[row.audit_id].savedAt || finalizedAt,
    }));

    const judgmentsText = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
    writeTextAtomic(FINAL_PATH, judgmentsText);
    const judgmentsSha256 = createHash("sha256").update(judgmentsText, "utf8").digest("hex");

    const metadata = {
      schema_version: "qwen3-browser-q8-human-holdout-human-judgments-meta-v1",
      validation_id: "qwen3-browser-q8-human-holdout-v1",
      purpose: "fresh-blind-human-top10-delta-judgments",
      row_count: rows.length,
      sample_path: path.relative(ROOT, SAMPLE_PATH),
      sample_sha256: SAMPLE_SHA256,
      sample_metadata_path: path.relative(ROOT, SAMPLE_META_PATH),
      sample_metadata_sha256: SAMPLE_META_SHA256,
      worksheet_sha256: WORKSHEET_SHA256,
      sample_freeze_commit: SAMPLE_FREEZE_COMMIT,
      ab_condition_visible_during_adjudication: false,
      ranking_visible_during_adjudication: false,
      browser_q8_score_visible_during_adjudication: false,
      production_score_visible_during_adjudication: false,
      provider_provenance_visible_during_adjudication: false,
      private_mapping_available_during_adjudication: false,
      one_human_adjudicator: true,
      relevance_scale: {
        "0": "irrelevant or noise",
        "1": "related but insufficient",
        "2": "relevant",
        "3": "highly relevant or central",
      },
      binary_relevant_threshold: 2,
      finalized_at: finalizedAt,
      judgments_path: path.relative(ROOT, FINAL_PATH),
      judgments_sha256: judgmentsSha256,
      unblinding_rule: "Reconstruct A/B mapping only after this judgment artifact is frozen.",
    };
    writeTextAtomic(FINAL_META_PATH, JSON.stringify(metadata, null, 2) + "\n");

    progress.finalizedAt = finalizedAt;
    progress.updatedAt = finalizedAt;
    writeProgress(progress);

    sendJson(response, 200, {
      status: "finalized",
      rows: rows.length,
      output: path.relative(ROOT, FINAL_PATH),
      metadata: path.relative(ROOT, FINAL_META_PATH),
      judgmentsSha256,
      finalizedAt,
    });
    return true;
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname;

    if (await handleApi(request, response, pathname)) return;

    if (request.method === "GET" && (pathname === "/" || pathname === "/audit")) {
      sendFile(response, HTML_PATH, "text/html; charset=utf-8");
      return;
    }
    if (request.method === "GET" && pathname === "/__qwen3_browser_q8_human_holdout_audit/app.js") {
      sendFile(response, APP_PATH, "text/javascript; charset=utf-8");
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: error.message });
    else response.end();
  }
});

server.on("error", (error) => {
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
  console.log("QWEN3 BROWSER Q8 · FRESH BLIND HUMAN ADJUDICATION");
  console.log("================================================");
  console.log(`Sample SHA: ${SAMPLE_SHA256}`);
  console.log(`Progress: ${state.labeled}/${state.total}`);
  console.log(`Open: http://127.0.0.1:${PORT}/audit`);
  console.log();
  console.log("Labels: 0=irrelevant, 1=related/insufficient, 2=relevant, 3=central");
  console.log("A/B condition, rankings, q8 scores, production scores, provider provenance, and private mapping are not served.");
  console.log("Progress is saved after every judgment and can be resumed.");
  console.log("Ctrl+C stops the server.");
});
