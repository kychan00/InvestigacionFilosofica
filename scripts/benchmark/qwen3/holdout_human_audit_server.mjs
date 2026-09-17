import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const PORT = Number(process.env.QWEN3_HOLDOUT_AUDIT_PORT || 4188);

const SAMPLE_PATH = path.join(
  ROOT,
  "benchmark/qwen3/validation/qwen3-reranker-v1-holdout.sample.jsonl",
);
const SAMPLE_SHA256 = "e8ccace4407ce9d235aefdf0a2cdc8ec36ec0d1df9843d9ae53611001f0f8942";
const RAW_PATH = path.join(
  ROOT,
  "benchmark/qwen3/validation/scores/qwen3-reranker-v1-holdout-v1.raw.jsonl",
);
const RAW_SHA256 = "dc8cb4c9a377e7b4191e5299e274fe9a63af55cdea407026304a6c08a33b6f23";
const PREDICTIONS_PATH = path.join(
  ROOT,
  "benchmark/qwen3/validation/scores/qwen3-reranker-v1-holdout-v1.predictions.jsonl",
);
const PREDICTIONS_SHA256 = "27898e33a40b4b438946a69f616418697c6bd2862fb4e151dfbce09985657408";
const SCORE_FREEZE_COMMIT = "b8c4a7a";

const PROGRESS_PATH = path.join(
  ROOT,
  "benchmark/qwen3/cache/qwen3-reranker-v1-holdout-human-audit.progress.json",
);
const FINAL_PATH = path.join(
  ROOT,
  "benchmark/qwen3/validation/qwen3-reranker-v1-holdout.judgments.jsonl",
);
const FINAL_META_PATH = path.join(
  ROOT,
  "benchmark/qwen3/validation/qwen3-reranker-v1-holdout.judgments.meta.json",
);
const HTML_PATH = path.join(
  ROOT,
  "benchmark/qwen3/validation/qwen3-holdout-human-audit.html",
);
const APP_PATH = path.join(
  ROOT,
  "scripts/benchmark/qwen3/holdout_human_audit_browser.js",
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
    [SAMPLE_PATH, SAMPLE_SHA256, "blind sample"],
    [RAW_PATH, RAW_SHA256, "frozen raw scores"],
    [PREDICTIONS_PATH, PREDICTIONS_SHA256, "frozen predictions"],
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
      validationId: "qwen3-reranker-v1-holdout-v1",
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

const sample = readJsonl(SAMPLE_PATH);
if (sample.length !== 100) {
  throw new Error(`Expected 100 holdout sample rows, found ${sample.length}`);
}
const sampleById = new Map(sample.map((row) => [row.audit_id, row]));
if (sampleById.size !== 100) throw new Error("Holdout sample contains duplicate audit_id values");

const forbiddenSampleFields = new Set([
  "rank",
  "score",
  "relevanceLevel",
  "ranking",
  "providers",
  "matchedQueries",
  "urls",
  "citedBy",
  "qwen_score",
  "qwen_prediction",
  "predicted_relevant",
  "raw_score",
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
  if (request.method === "GET" && pathname === "/__qwen3_holdout_audit/state") {
    sendJson(response, 200, statePayload());
    return true;
  }

  if (request.method === "POST" && pathname === "/__qwen3_holdout_audit/save") {
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

  if (request.method === "POST" && pathname === "/__qwen3_holdout_audit/finalize") {
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
      query_id: row.query_id,
      record_id: row.record_id,
      human_relevance: judgments[row.audit_id].human_relevance,
      human_note: judgments[row.audit_id].human_note || "",
      judged_at: judgments[row.audit_id].savedAt || finalizedAt,
    }));

    const judgmentsText = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
    writeTextAtomic(FINAL_PATH, judgmentsText);
    const judgmentsSha256 = createHash("sha256").update(judgmentsText, "utf8").digest("hex");

    const metadata = {
      schema_version: "qwen3-holdout-human-judgments-meta-v1",
      validation_id: "qwen3-reranker-v1-holdout-v1",
      purpose: "fresh-blind-human-validation-judgments",
      row_count: rows.length,
      sample_path: path.relative(ROOT, SAMPLE_PATH),
      sample_sha256: SAMPLE_SHA256,
      raw_scores_sha256: RAW_SHA256,
      predictions_sha256: PREDICTIONS_SHA256,
      scores_frozen_before_human_adjudication: true,
      score_freeze_commit: SCORE_FREEZE_COMMIT,
      qwen_outputs_visible_during_adjudication: false,
      retrieval_rank_visible_during_adjudication: false,
      production_score_visible_during_adjudication: false,
      provider_provenance_visible_during_adjudication: false,
      one_human_adjudicator: true,
      relevance_scale: {
        "0": "irrelevant or noise",
        "1": "related but insufficient for the complete information need",
        "2": "relevant",
        "3": "highly relevant or central",
      },
      binary_relevant_threshold: 2,
      finalized_at: finalizedAt,
      judgments_path: path.relative(ROOT, FINAL_PATH),
      judgments_sha256: judgmentsSha256,
      known_protocol_note: "Before adjudication began, the adjudicator had previously seen document titles/abstracts while checking the model-input dataset, but did not see retrieval ranks, production scores, provider provenance, Qwen scores, Qwen predictions, or human labels.",
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
    if (request.method === "GET" && pathname === "/__qwen3_holdout_audit/app.js") {
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
  console.log("QWEN3 FRESH HOLDOUT · BLIND HUMAN ADJUDICATION");
  console.log("================================================");
  console.log(`Sample SHA: ${SAMPLE_SHA256}`);
  console.log(`Frozen scores SHA: ${RAW_SHA256}`);
  console.log(`Frozen predictions SHA: ${PREDICTIONS_SHA256}`);
  console.log(`Progress: ${state.labeled}/${state.total}`);
  console.log(`Open: http://127.0.0.1:${PORT}/audit`);
  console.log();
  console.log("Labels: 0=irrelevant, 1=related/insufficient, 2=relevant, 3=central");
  console.log("Qwen outputs, retrieval ranks, provider provenance, and production scores are not served.");
  console.log("Progress is saved after every judgment and can be resumed.");
  console.log("Ctrl+C stops the server.");
});
