#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const preregistrationPath =
  "benchmark/qwen3/browser/q8-1024-feasibility/qwen3-browser-q8-1024-feasibility-v1.preregistered.json";

const browserEntryPath =
  "scripts/benchmark/qwen3/q8_feasibility_browser.js";

const expectedPreregSha256 =
  "9708b84836744bb1e4b40f0427ae9859386f76ecd66608d94bc10bde1bd4fb76";

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const options = { mode: null, launch: true };

  for (const argument of argv) {
    if (argument === "--preflight") options.mode = "preflight";
    else if (argument === "--run") options.mode = "run";
    else if (argument === "--no-launch") options.launch = false;
    else throw new Error(`unknown argument: ${argument}`);
  }

  if (!options.mode) throw new Error("choose --preflight or --run");
  return options;
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeExclusive(path, value) {
  if (await exists(path)) {
    throw new Error(`refusing to overwrite completed output: ${path}`);
  }

  await mkdir(dirname(path), { recursive: true });

  const temporaryPath = `${path}.tmp-${process.pid}`;

  await writeFile(temporaryPath, value, {
    encoding: "utf8",
    flag: "wx",
  });

  await rename(temporaryPath, path);
}

function buildRunCases(prereg) {
  const target = prereg.candidate.exact_total_tokens;

  return [
    { case_id: "first-1", target_total_tokens: target },
    { case_id: "warm-1", target_total_tokens: target },
    { case_id: "warm-2", target_total_tokens: target },
    { case_id: "warm-3", target_total_tokens: target },
    { case_id: "warm-4", target_total_tokens: target },
    { case_id: "warm-5", target_total_tokens: target },
  ];
}

function validatePrereg(prereg) {
  if (prereg.experiment_id !== "qwen3-browser-q8-1024-feasibility-v1") {
    throw new Error("unexpected experiment_id");
  }

  if (prereg.status !== "preregistered-before-runtime-execution") {
    throw new Error("unexpected preregistration status");
  }

  if (
    prereg.candidate.model_id !==
    "onnx-community/Qwen3-Reranker-0.6B-ONNX"
  ) {
    throw new Error("unexpected model_id");
  }

  if (
    prereg.candidate.revision !==
    "9995c50e2310679108a55f5ccd16ba8be9f17c20"
  ) {
    throw new Error("unexpected model revision");
  }

  if (prereg.candidate.artifact !== "onnx/model_quantized.onnx") {
    throw new Error("unexpected q8 artifact");
  }

  if (prereg.candidate.dtype !== "q8") {
    throw new Error("candidate dtype is not q8");
  }

  if (prereg.candidate.device !== "webgpu") {
    throw new Error("candidate device is not WebGPU");
  }

  if (prereg.candidate.exact_total_tokens !== 1024) {
    throw new Error("frozen token length is not 1024");
  }

  if (prereg.run_plan.first_forward_runs !== 1) {
    throw new Error("first_forward_runs changed");
  }

  if (prereg.run_plan.measured_warm_runs !== 5) {
    throw new Error("measured_warm_runs changed");
  }

  if (prereg.run_plan.total_forward_runs !== 6) {
    throw new Error("total_forward_runs changed");
  }

  if (prereg.primary_gate.required_successful_runs !== 6) {
    throw new Error("required_successful_runs changed");
  }

  if (prereg.primary_gate.total_runs !== 6) {
    throw new Error("primary gate total_runs changed");
  }

  if (prereg.primary_gate.latency_threshold !== null) {
    throw new Error("latency threshold must remain null");
  }

  if (prereg.run_plan.same_browser_session !== true) {
    throw new Error("same_browser_session must remain true");
  }

  if (prereg.run_plan.same_loaded_model_session !== true) {
    throw new Error("same_loaded_model_session must remain true");
  }

  if (prereg.run_plan.page_reload_between_runs !== false) {
    throw new Error("page reload must remain disabled");
  }

  if (prereg.run_plan.identical_input_each_run !== true) {
    throw new Error("input must remain identical");
  }

  if (prereg.synthetic_input_contract.uses_ranking_development_pool !== false) {
    throw new Error("ranking development pool must remain excluded");
  }

  if (prereg.synthetic_input_contract.uses_reference_qwen_scores !== false) {
    throw new Error("reference Qwen scores must remain excluded");
  }

  if (prereg.synthetic_input_contract.uses_ranking_holdout !== false) {
    throw new Error("ranking holdout must remain excluded");
  }

  if (prereg.synthetic_input_contract.uses_human_labels !== false) {
    throw new Error("human labels must remain excluded");
  }

  if (prereg.planned_outputs.report.includes("\\")) {
    throw new Error("report output path contains a backslash");
  }

  if (prereg.planned_outputs.runs.includes("\\")) {
    throw new Error("runs output path contains a backslash");
  }

  const cases = buildRunCases(prereg);

  if (cases.length !== 6) {
    throw new Error("runner did not construct exactly six cases");
  }

  if (!cases.every((item) => item.target_total_tokens === 1024)) {
    throw new Error("not every run targets exactly 1024 tokens");
  }

  return prereg;
}

async function readFrozenPrereg() {
  const bytes = await readFile(resolve(projectRoot, preregistrationPath));

  const sha256 = sha256Bytes(bytes);

  if (sha256 !== expectedPreregSha256) {
    throw new Error(`preregistration SHA-256 mismatch: ${sha256}`);
  }

  const prereg = validatePrereg(
    JSON.parse(bytes.toString("utf8")),
  );

  const packageJson = JSON.parse(
    await readFile(resolve(projectRoot, "package.json"), "utf8"),
  );

  if (
    packageJson.dependencies?.["@huggingface/transformers"] !==
    prereg.candidate.transformers_js_version
  ) {
    throw new Error(
      "installed Transformers.js dependency does not match preregistration",
    );
  }

  return {
    prereg,
    preregSha256: sha256,
    cases: buildRunCases(prereg),
  };
}

async function buildAndAuditBundle() {
  const browserEntryBytes = await readFile(
    resolve(projectRoot, browserEntryPath),
  );

  const result = await build({
    absWorkingDir: projectRoot,
    entryPoints: [browserEntryPath],
    bundle: true,
    platform: "browser",
    format: "esm",
    target: ["chrome131"],
    write: false,
    metafile: true,
    logLevel: "silent",
  });

  if (result.outputFiles.length !== 1) {
    throw new Error(
      `expected one browser bundle, got ${result.outputFiles.length}`,
    );
  }

  const inputs = Object.keys(result.metafile.inputs);

  const transformersWebInputs = inputs.filter((value) =>
    value.includes("transformers.web.js"),
  );

  const onnxruntimeWebInputs = inputs.filter((value) =>
    value.includes("onnxruntime-web"),
  );

  const forbiddenNodeInputs = inputs.filter(
    (value) =>
      value.includes("onnxruntime-node") ||
      value.includes("transformers.node") ||
      value.includes("onnx-node"),
  );

  if (transformersWebInputs.length === 0) {
    throw new Error("browser bundle did not select transformers.web.js");
  }

  if (onnxruntimeWebInputs.length === 0) {
    throw new Error("browser bundle contains no onnxruntime-web input");
  }

  if (forbiddenNodeInputs.length !== 0) {
    throw new Error(
      `forbidden Node backend detected: ${forbiddenNodeInputs.join(", ")}`,
    );
  }

  const output = result.outputFiles[0];

  return {
    code: output.text,
    sha256: sha256Bytes(output.contents),
    browser_entry_sha256: sha256Bytes(browserEntryBytes),
    transformers_web_input_count: transformersWebInputs.length,
    onnxruntime_web_input_count: onnxruntimeWebInputs.length,
    forbidden_node_backend_inputs: forbiddenNodeInputs.length,
  };
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });

  response.end(`${JSON.stringify(value)}\n`);
}

async function parseBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function validateRuntime(runtime, prereg) {
  if (runtime.runtime !== "browser") {
    throw new Error("runtime is not browser");
  }

  if (
    runtime.execution_provider !== "webgpu" ||
    runtime.device !== "webgpu"
  ) {
    throw new Error("runtime did not remain on WebGPU");
  }

  if (runtime.dtype !== "q8") {
    throw new Error("runtime dtype is not q8");
  }

  if (runtime.onnx_backend !== "onnxruntime-web") {
    throw new Error("runtime backend is not onnxruntime-web");
  }

  if (runtime.wasm_host_threads !== 1) {
    throw new Error("WASM host thread count changed");
  }

  if (runtime.model_artifact !== prereg.candidate.artifact) {
    throw new Error("runtime model artifact differs from preregistration");
  }

  return runtime;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function buildObservations(runs) {
  if (runs.length === 0) {
    return {
      first_forward_latency_ms: null,
      warm: null,
      score_repeatability: null,
    };
  }

  const scores = runs.map((item) => item.raw_score);
  const scoreMin = Math.min(...scores);
  const scoreMax = Math.max(...scores);

  const warmRuns = runs.slice(1);
  const warmLatencies = warmRuns.map((item) => item.latency_ms);

  return {
    first_forward_latency_ms: runs[0].latency_ms,
    warm:
      warmLatencies.length === 0
        ? null
        : {
            count: warmLatencies.length,
            min_ms: Math.min(...warmLatencies),
            max_ms: Math.max(...warmLatencies),
            mean_ms: mean(warmLatencies),
            median_ms: median(warmLatencies),
          },
    score_repeatability: {
      count: scores.length,
      min: scoreMin,
      max: scoreMax,
      range: scoreMax - scoreMin,
      all_scores_identical: scoreMin === scoreMax,
    },
  };
}

async function launchChrome(url) {
  if (process.platform !== "darwin") {
    throw new Error(
      `automatic launch only configured for macOS; open manually: ${url}`,
    );
  }

  const child = spawn(
    "open",
    ["-a", "Google Chrome", url],
    {
      stdio: "ignore",
      detached: true,
    },
  );

  child.unref();
}

async function runExperiment({ launch }) {
  const frozen = await readFrozenPrereg();
  const bundle = await buildAndAuditBundle();

  const runsPath = resolve(
    projectRoot,
    frozen.prereg.planned_outputs.runs,
  );

  const reportPath = resolve(
    projectRoot,
    frozen.prereg.planned_outputs.report,
  );

  if (await exists(runsPath)) {
    throw new Error(`runs output already exists: ${runsPath}`);
  }

  if (await exists(reportPath)) {
    throw new Error(`report output already exists: ${reportPath}`);
  }

  const startedAt = Date.now();
  const runs = [];

  let runtimeMetadata = null;
  let settled = false;
  let resolveFinished;
  let rejectFinished;

  const finished = new Promise((resolvePromise, rejectPromise) => {
    resolveFinished = resolvePromise;
    rejectFinished = rejectPromise;
  });

  const browserPrereg = {
    ...frozen.prereg,
    cases: frozen.cases,
  };

  async function finalize({ status, error = null }) {
    const successfulRuns = runs.filter(
      (item) =>
        item.constructed_total_tokens === 1024 &&
        Number.isFinite(item.raw_score) &&
        item.raw_score >= 0 &&
        item.raw_score <= 1,
    ).length;

    const gatePassed =
      status === "passed" &&
      successfulRuns === 6 &&
      runs.length === 6;

    const runsText =
      runs.map((item) => JSON.stringify(item)).join("\n") +
      (runs.length > 0 ? "\n" : "");

    const report = {
      experiment_id: frozen.prereg.experiment_id,
      status,
      preregistration_sha256: frozen.preregSha256,
      browser_bundle_sha256: bundle.sha256,
      browser_entry_sha256: bundle.browser_entry_sha256,
      reused_browser_entry: browserEntryPath,
      candidate: frozen.prereg.candidate,
      runtime: runtimeMetadata,
      runs,
      observations: buildObservations(runs),
      primary_gate: {
        passed: gatePassed,
        successful_runs: successfulRuns,
        required_successful_runs:
          frozen.prereg.primary_gate.required_successful_runs,
        total_runs: frozen.prereg.primary_gate.total_runs,
      },
      error,
      elapsed_ms: Date.now() - startedAt,
      production_changed: false,
      holdout_accessed: false,
      human_labels_accessed: false,
    };

    await writeExclusive(runsPath, runsText);

    await writeExclusive(
      reportPath,
      `${JSON.stringify(report, null, 2)}\n`,
    );

    return report;
  }

  const server = createServer(async (request, response) => {
    response.setHeader(
      "cross-origin-opener-policy",
      "same-origin",
    );

    response.setHeader(
      "cross-origin-embedder-policy",
      "require-corp",
    );

    try {
      const requestUrl = new URL(
        request.url,
        "http://127.0.0.1",
      );

      if (
        request.method === "GET" &&
        requestUrl.pathname === "/"
      ) {
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
        });

        response.end(
          "<!doctype html>" +
            "<meta charset=\"utf-8\">" +
            "<title>qwen3-browser-q8-1024-feasibility-v1</title>" +
            "<script type=\"module\" src=\"/runner.js\"></script>",
        );

        return;
      }

      if (
        request.method === "GET" &&
        requestUrl.pathname === "/runner.js"
      ) {
        response.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
        });

        response.end(bundle.code);
        return;
      }

      if (
        request.method === "GET" &&
        requestUrl.pathname === "/payload"
      ) {
        sendJson(response, 200, {
          prereg: browserPrereg,
        });

        return;
      }

      if (
        request.method === "POST" &&
        requestUrl.pathname === "/runtime"
      ) {
        if (runtimeMetadata) {
          throw new Error("runtime metadata already received");
        }

        runtimeMetadata = validateRuntime(
          await parseBody(request),
          frozen.prereg,
        );

        sendJson(response, 200, { ok: true });
        return;
      }

      if (
        request.method === "POST" &&
        requestUrl.pathname === "/case"
      ) {
        if (!runtimeMetadata) {
          throw new Error("run received before runtime metadata");
        }

        const body = await parseBody(request);

        if (body.index !== runs.length) {
          throw new Error(
            `unexpected run index ${body.index}; expected ${runs.length}`,
          );
        }

        const expected = frozen.cases[body.index];

        if (!expected) {
          throw new Error("received extra run");
        }

        if (body.case_id !== expected.case_id) {
          throw new Error(
            `case_id mismatch: ${body.case_id} != ${expected.case_id}`,
          );
        }

        if (body.target_total_tokens !== 1024) {
          throw new Error("target token count changed");
        }

        if (body.constructed_total_tokens !== 1024) {
          throw new Error("constructed token count is not exactly 1024");
        }

        if (
          !Number.isFinite(body.raw_score) ||
          body.raw_score < 0 ||
          body.raw_score > 1
        ) {
          throw new Error(`invalid raw score: ${body.raw_score}`);
        }

        if (
          !Number.isFinite(body.latency_ms) ||
          body.latency_ms < 0
        ) {
          throw new Error(`invalid latency: ${body.latency_ms}`);
        }

        const phase = body.index === 0 ? "first" : "warm";

        runs.push({
          run_index: body.index,
          phase,
          case_id: body.case_id,
          target_total_tokens: 1024,
          constructed_total_tokens: 1024,
          filler_tokens: body.filler_tokens,
          raw_score: body.raw_score,
          latency_ms: body.latency_ms,
        });

        console.log(
          `run ${runs.length}/6 PASS: ${body.case_id} ${body.latency_ms.toFixed(1)} ms score=${body.raw_score}`,
        );

        sendJson(response, 200, { ok: true });
        return;
      }

      if (
        request.method === "POST" &&
        requestUrl.pathname === "/complete"
      ) {
        if (runs.length !== 6) {
          throw new Error(
            `completion received with ${runs.length}/6 runs`,
          );
        }

        const report = await finalize({
          status: "passed",
        });

        sendJson(response, 200, { ok: true });

        if (!settled) {
          settled = true;
          resolveFinished(report);
        }

        return;
      }

      if (
        request.method === "POST" &&
        requestUrl.pathname === "/error"
      ) {
        const body = await parseBody(request);

        const error = {
          message: body.message ?? "unknown browser error",
          stack: body.stack ?? null,
        };

        const report = await finalize({
          status: "failed-runtime",
          error,
        });

        sendJson(response, 200, { ok: true });

        if (!settled) {
          settled = true;

          const failure = new Error(
            `q8 1024 warm experiment failed: ${error.message}`,
          );

          failure.report = report;
          rejectFinished(failure);
        }

        return;
      }

      response.writeHead(404);
      response.end("not found");
    } catch (error) {
      console.error(error.stack ?? error.message);

      if (!response.headersSent) {
        sendJson(response, 500, {
          error: error.message,
        });
      } else {
        response.end();
      }
    }
  });

  await new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", resolvePromise);
  });

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/`;

  console.log(`Q8 1024 warm runner ready: ${url}`);
  console.log("Runs: first-1 -> warm-1 -> warm-2 -> warm-3 -> warm-4 -> warm-5");
  console.log("All runs use exactly 1024 total tokens in one loaded browser/model session.");

  if (launch) {
    await launchChrome(url);
  } else {
    console.log(`Open manually: ${url}`);
  }

  try {
    return await finished;
  } finally {
    await new Promise((resolvePromise) => {
      server.close(resolvePromise);
    });
  }
}

async function preflight() {
  const frozen = await readFrozenPrereg();
  const bundle = await buildAndAuditBundle();

  return {
    experiment_id: frozen.prereg.experiment_id,
    status: "preflight-passed-no-model-execution",
    preregistration_sha256: frozen.preregSha256,
    candidate: {
      artifact: frozen.prereg.candidate.artifact,
      dtype: frozen.prereg.candidate.dtype,
      device: frozen.prereg.candidate.device,
      revision: frozen.prereg.candidate.revision,
      exact_total_tokens:
        frozen.prereg.candidate.exact_total_tokens,
    },
    run_plan: {
      first_forward_runs:
        frozen.prereg.run_plan.first_forward_runs,
      measured_warm_runs:
        frozen.prereg.run_plan.measured_warm_runs,
      total_forward_runs:
        frozen.prereg.run_plan.total_forward_runs,
      same_browser_session:
        frozen.prereg.run_plan.same_browser_session,
      same_loaded_model_session:
        frozen.prereg.run_plan.same_loaded_model_session,
      page_reload_between_runs:
        frozen.prereg.run_plan.page_reload_between_runs,
    },
    derived_cases: frozen.cases,
    browser_bundle: {
      sha256: bundle.sha256,
      browser_entry: browserEntryPath,
      browser_entry_sha256: bundle.browser_entry_sha256,
      transformers_web_input_count:
        bundle.transformers_web_input_count,
      onnxruntime_web_input_count:
        bundle.onnxruntime_web_input_count,
      forbidden_node_backend_inputs:
        bundle.forbidden_node_backend_inputs,
    },
    ranking_holdout_accessed: false,
    human_labels_accessed: false,
    inference_executed: false,
    model_downloaded: false,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.mode === "preflight") {
    console.log(
      JSON.stringify(await preflight(), null, 2),
    );

    return;
  }

  const report = await runExperiment(options);

  console.log("===== Q8 1024 WARM RESULT =====");

  console.log(
    JSON.stringify(
      {
        primary_gate: report.primary_gate,
        observations: report.observations,
      },
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
