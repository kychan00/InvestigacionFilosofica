import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const PORT = Number(process.env.QWEN3_RANKING_HOLDOUT_AUDIT_PORT || 4192);

const SAMPLE_PATH = path.join(
  ROOT,
  "benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.sample.jsonl",
);
const SAMPLE_SHA256 = "2981bcd4c48e59a40492d13163e9cc0a1f92e960aa7bd82bcda00f60250fc033";
const SAMPLE_META_PATH = path.join(
  ROOT,
  "benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.sample.meta.json",
);
const SAMPLE_META_SHA256 = "ae546efc00fe76779f22e47768b57a53d3cce6c8d2181308c20719cf926e951d";
const SAMPLE_FREEZE_COMMIT = "0ffceb0";

const PROGRESS_PATH = path.join(
  ROOT,
  "benchmark/qwen3/cache/qwen3-ranking-holdout-v1-human-audit.progress.json",
);
const FINAL_PATH = path.join(
  ROOT,
  "benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.judgments.jsonl",
);
const FINAL_META_PATH = path.join(
  ROOT,
  "benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.judgments.meta.json",
);
const HTML_PATH = path.join(
  ROOT,
  "benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-human-audit.html",
);
const APP_PATH = path.join(
  ROOT,
  "scripts/benchmark/qwen3/ranking_holdout_human_audit_browser.js",
);

function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readJsonl(filePath) {
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

function writeTextAtomic(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, text, "utf8");
  fs.renameSync(temporary, filePath);
}

function verifyFrozenInputs() {
  for (const [filePath, expectedSha, label] of [
    [SAMPLE_PATH, SAMPLE_SHA256, "blind ranking holdout sample"],
    [SAMPLE_META_PATH, SAMPLE_META_SHA256, "blind ranking holdout sample metadata"],
  ]) {
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
      validationId: "qwen3-ranking-holdout-v1",
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
  writeTextAtomic(PROGRESS_PATH, JSON.stringify(progress, null, 2) + "\n");
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
if (sample.length !== 160) {
  throw new Error(`Expected 160 ranking holdout audit rows, found ${sample.length}`);
}
const sampleById = new Map(sample.map((row) => [row.audit_id, row]));
if (sampleById.size !== 160) throw new Error("Ranking holdout sample contains duplicate audit_id values");

const expectedIds = Array.from({ length: 160 }, (_, index) => `QRH${String(index + 1).padStart(3, "0")}`);
if (sample.some((row, index) => row.audit_id !== expectedIds[index])) {
  throw new Error("Ranking holdout audit IDs are not exactly QRH001..QRH160");
}

const forbiddenSampleFields = new Set([
  "condition",
  "rank",
  "original_rank",
  "qwen_raw_score",
  "score",
  "query_id",
  "record_id",
  "doi",
  "providers",
  "matchedQueries",
  "ranking",
  "urls",
  "citedBy",
]);
for (const row of sample) {
  for (const field of forbiddenSampleFields) {
    if (Object.prototype.hasOwnProperty.call(row, field)) {
      throw new Error(`Blind ranking holdout sample leaked forbidden field: ${field}`);
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
    blockSize: 40,
    finalized: fs.existsSync(FINAL_PATH),
    finalizedAt: progress.finalizedAt || null,
  };
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/__qwen3_ranking_holdout_audit/state") {
    sendJson(response, 200, statePayload());
    return true;
  }

  if (request.method === "POST" && pathname === "/__qwen3_ranking_holdout_audit/save") {
    if (fs.existsSync(FINAL_PATH)) {
      sendJson(response, 409, { error: "Ranking holdout adjudication is already finalized." });
      return true;
    }

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

  if (request.method === "POST" && pathname === "/__qwen3_ranking_holdout_audit/finalize") {
    if (fs.existsSync(FINAL_PATH)) {
      sendJson(response, 409, { error: "Ranking holdout adjudication is already finalized." });
      return true;
    }

    const progress = readProgress();
    const judgments = progress.judgments || {};
    const missing = sample
      .filter((row) => !Number.isInteger(judgments[row.audit_id]?.human_relevance))
      .map((row) => row.audit_id);

    if (missing.length) {
      sendJson(response, 409, {
        error: "Human ranking holdout adjudication is incomplete.",
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
      schema_version: "qwen3-ranking-holdout-human-judgments-meta-v1",
      validation_id: "qwen3-ranking-holdout-v1",
      purpose: "fresh-blind-human-ranking-delta-validation-judgments",
      row_count: rows.length,
      sample_path: path.relative(ROOT, SAMPLE_PATH),
      sample_sha256: SAMPLE_SHA256,
      sample_metadata_sha256: SAMPLE_META_SHA256,
      sample_freeze_commit: SAMPLE_FREEZE_COMMIT,
      private_mapping_available_during_adjudication: false,
      qwen_scores_visible_during_adjudication: false,
      ab_condition_visible_during_adjudication: false,
      ranks_visible_during_adjudication: false,
      record_ids_visible_during_adjudication: false,
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
      unblinding_allowed_after_this_artifact_is_frozen: true,
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
    if (request.method === "GET" && pathname === "/__qwen3_ranking_holdout_audit/app.js") {
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
  console.log("QWEN3 RANKING HOLDOUT · BLIND HUMAN ADJUDICATION");
  console.log("=================================================");
  console.log(`Sample SHA: ${SAMPLE_SHA256}`);
  console.log(`Sample freeze: ${SAMPLE_FREEZE_COMMIT}`);
  console.log(`Progress: ${state.labeled}/${state.total}`);
  console.log("Blocks: QRH001-040, 041-080, 081-120, 121-160");
  console.log(`Open: http://127.0.0.1:${PORT}/audit`);
  console.log();
  console.log("Labels: 0=irrelevant, 1=related/insufficient, 2=relevant, 3=central");
  console.log("A/B condition, ranks, Qwen scores, IDs, and provider provenance are not served.");
  console.log("Progress is saved after every judgment and can be resumed.");
  console.log("Ctrl+C stops the server.");
});
