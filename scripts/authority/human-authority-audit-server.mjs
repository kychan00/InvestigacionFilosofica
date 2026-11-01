import http from "node:http";
import {
  existsSync,
  createReadStream,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} from "node:fs";
import {extname, join, resolve} from "node:path";

const ROOT = process.cwd();
const PORT = Number(
  process.env.AUTHORITY_AUDIT_PORT || 4177
);
const PACKET_ROOT = resolve(
  process.env.AUTHORITY_AUDIT_PACKET ||
  "artifacts/author-authority-human-audit-v1"
);
const SAMPLE_PATH = join(PACKET_ROOT, "sample.jsonl");
const EVIDENCE_PATH = join(PACKET_ROOT, "evidence.json");
const PROGRESS_PATH = join(
  ROOT,
  "benchmark/author-authority/human-audit-v1/.progress.json"
);
const FINAL_PATH = join(
  ROOT,
  "benchmark/author-authority/human-audit-v1/judgments.jsonl"
);

const ALLOWED = new Set([
  "same-person",
  "different-person",
  "unresolved"
]);

function readJsonLines(path) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
}

function readProgress() {
  if (!existsSync(PROGRESS_PATH)) {
    return {
      schemaVersion:
        "author-authority-human-audit-progress-v1",
      updatedAt: null,
      finalizedAt: null,
      judgments: {}
    };
  }

  const value = JSON.parse(
    readFileSync(PROGRESS_PATH, "utf8")
  );
  value.judgments ||= {};
  return value;
}

function writeProgress(progress) {
  const temporary = PROGRESS_PATH + ".tmp";
  writeFileSync(
    temporary,
    JSON.stringify(progress, null, 2) + "\n",
    "utf8"
  );
  renameSync(temporary, PROGRESS_PATH);
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value, null, 2);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
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
        resolveBody(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

if (!existsSync(SAMPLE_PATH) || !existsSync(EVIDENCE_PATH)) {
  console.error("Missing Human Authority Audit packet.");
  console.error(
    "Build it first with npm run benchmark:authority:audit:build"
  );
  process.exit(1);
}

const sample = readJsonLines(SAMPLE_PATH);
const evidenceFile = JSON.parse(
  readFileSync(EVIDENCE_PATH, "utf8")
);
const evidenceById = new Map(
  (evidenceFile.cases || []).map(item => [
    item.audit_id,
    item
  ])
);

if (sample.length !== 100) {
  throw new Error(
    "Expected 100 Human Authority Audit rows, got " +
    sample.length
  );
}

function presentedEvidence(auditId) {
  const item = evidenceById.get(auditId);
  if (!item) return [];

  const refs = [];
  for (const side of [item.left, item.right]) {
    if (side?.openAlexUrl) refs.push(side.openAlexUrl);
    for (const url of side?.orcidUrls || []) refs.push(url);
  }
  return [...new Set(refs)];
}

function statePayload() {
  const progress = readProgress();
  const judgments = progress.judgments || {};
  const judged = sample.filter(item =>
    ALLOWED.has(judgments[item.audit_id]?.judgment)
  ).length;

  return {
    schemaVersion:
      "author-authority-human-audit-review-state-v1",
    rows: sample.map(item => ({
      ...item,
      evidence: evidenceById.get(item.audit_id) || null
    })),
    judgments,
    labels: [...ALLOWED],
    judged,
    total: sample.length,
    finalized: existsSync(FINAL_PATH),
    finalizedAt: progress.finalizedAt || null
  };
}

async function handleApi(request, response, pathname) {
  if (
    request.method === "GET" &&
    pathname === "/__authority-audit/state"
  ) {
    sendJson(response, 200, statePayload());
    return true;
  }

  if (
    request.method === "POST" &&
    pathname === "/__authority-audit/save"
  ) {
    const body = await readBody(request);
    const auditId = String(body.audit_id || "");
    const row = sample.find(
      item => item.audit_id === auditId
    );

    if (!row) {
      sendJson(response, 400, {
        error: "Unknown audit_id: " + auditId
      });
      return true;
    }

    const judgment =
      body.judgment == null
        ? null
        : String(body.judgment);

    if (judgment !== null && !ALLOWED.has(judgment)) {
      sendJson(response, 400, {
        error:
          "judgment must be same-person, different-person, unresolved, or null"
      });
      return true;
    }

    const note = String(body.note || "").slice(0, 6000);
    const progress = readProgress();
    const savedAt = new Date().toISOString();

    progress.updatedAt = savedAt;
    progress.finalizedAt = null;
    progress.judgments[auditId] = {
      judgment,
      note,
      savedAt
    };
    writeProgress(progress);

    const state = statePayload();
    sendJson(response, 200, {
      status: "saved",
      audit_id: auditId,
      judged: state.judged,
      total: state.total
    });
    return true;
  }

  if (
    request.method === "POST" &&
    pathname === "/__authority-audit/finalize"
  ) {
    const progress = readProgress();
    const judgments = progress.judgments || {};
    const missing = sample
      .filter(
        item =>
          !ALLOWED.has(
            judgments[item.audit_id]?.judgment
          )
      )
      .map(item => item.audit_id);

    if (missing.length) {
      sendJson(response, 409, {
        error: "Human Authority Audit is incomplete.",
        missing
      });
      return true;
    }

    const finalizedAt = new Date().toISOString();
    const rows = sample.map(item => {
      const judgment = judgments[item.audit_id];
      return {
        audit_id: item.audit_id,
        judgment: judgment.judgment,
        note: judgment.note || "",
        evidence: presentedEvidence(item.audit_id),
        judged_at: judgment.savedAt || finalizedAt
      };
    });

    writeFileSync(
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
      output:
        "benchmark/author-authority/human-audit-v1/judgments.jsonl",
      finalizedAt
    });
    return true;
  }

  return false;
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

function serveStatic(response, pathname) {
  const requested =
    pathname === "/"
      ? "/benchmark/author-authority/human-audit-v1/review.html"
      : pathname;

  let decoded;
  try {
    decoded = decodeURIComponent(requested);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const target = resolve(ROOT, "." + decoded);
  const rootPrefix = ROOT.endsWith("/")
    ? ROOT
    : ROOT + "/";

  if (
    target !== ROOT &&
    !target.startsWith(rootPrefix)
  ) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (
    !existsSync(target) ||
    !statSync(target).isFile()
  ) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type":
      mimeTypes[extname(target)] ||
      "application/octet-stream",
    "cache-control": "no-store"
  });
  createReadStream(target).pipe(response);
}

const server = http.createServer(
  async (request, response) => {
    try {
      const url = new URL(
        request.url,
        "http://" + request.headers.host
      );
      const handled = await handleApi(
        request,
        response,
        url.pathname
      );
      if (!handled) {
        serveStatic(response, url.pathname);
      }
    } catch (error) {
      console.error(error);
      if (!response.headersSent) {
        sendJson(response, 500, {
          error: error.message
        });
      } else {
        response.end();
      }
    }
  }
);

server.on("error", error => {
  if (error.code === "EADDRINUSE") {
    console.error("Port " + PORT + " is already in use.");
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, "127.0.0.1", () => {
  const state = statePayload();
  console.log();
  console.log("HUMAN AUTHORITY AUDIT V1");
  console.log("========================");
  console.log(
    "Progress: " + state.judged + "/" + state.total
  );
  console.log(
    "Open: http://127.0.0.1:" +
      PORT +
      "/benchmark/author-authority/human-audit-v1/review.html"
  );
  console.log();
  console.log(
    "The reviewer never sees the algorithm's current relation."
  );
});
