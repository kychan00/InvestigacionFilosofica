#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

import { parseJsonlText, readJsonl, serializeJsonl, writeJsonlAtomic } from '../core/jsonl.mjs';
import {
  BROWSER_CHECKPOINT,
  BROWSER_PARITY_EXPERIMENT_ID,
  BROWSER_PARITY_LOG_OUTPUT,
  BROWSER_PARITY_REPORT_OUTPUT,
  BROWSER_SCORE_METADATA_OUTPUT,
  BROWSER_SCORE_OUTPUT,
  assertFrozenBrowserParityPreregistration,
  buildBrowserParityReport,
  formatParityLog,
  makeBrowserScoreRecord,
  sha256Bytes,
  validateFrozenDatasetRows,
  validateScoreSequence,
} from './browser_parity_core.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const preregistrationPath = 'benchmark/qwen3/browser/qwen3-browser-parity-v1.preregistered.json';
const browserEntryPath = 'scripts/benchmark/qwen3/browser_parity_browser.js';

function parseArgs(argv) {
  const options = {
    mode: null,
    launch: true,
    diagnosticIndex: null,
  };
  for (const argument of argv) {
    if (argument === '--preflight') options.mode = 'preflight';
    else if (argument === '--run') options.mode = 'run';
    else if (argument.startsWith('--diagnostic-index=')) {
      options.mode = 'diagnostic';

      const value = Number(
        argument.slice('--diagnostic-index='.length)
      );

      if (!Number.isInteger(value) || value < 0) {
        throw new Error(
          '--diagnostic-index requires a zero-based non-negative integer'
        );
      }

      options.diagnosticIndex = value;
    }
    else if (argument === '--no-launch') options.launch = false;
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (!options.mode) throw new Error('choose exactly one mode: --preflight or --run');
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

async function writeJsonExclusive(path, value) {
  if (await exists(path)) throw new Error(`refusing to overwrite completed output: ${path}`);
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await rename(temporaryPath, path);
}

async function writeTextExclusive(path, value) {
  if (await exists(path)) throw new Error(`refusing to overwrite completed output: ${path}`);
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, value, { encoding: 'utf8', flag: 'wx' });
  await rename(temporaryPath, path);
}

async function readFrozenInputs() {
  const preregAbsolute = resolve(projectRoot, preregistrationPath);
  const preregBytes = await readFile(preregAbsolute);
  const prereg = assertFrozenBrowserParityPreregistration(JSON.parse(preregBytes.toString('utf8')));

  const datasetPath = resolve(projectRoot, prereg.model_input.dataset_path);
  const datasetBytes = await readFile(datasetPath);
  const datasetSha256 = sha256Bytes(datasetBytes);
  if (datasetSha256 !== prereg.model_input.dataset_sha256) {
    throw new Error(`dataset SHA-256 mismatch: ${datasetSha256}`);
  }
  const rows = validateFrozenDatasetRows(
    parseJsonlText(datasetBytes.toString('utf8'), { source: prereg.model_input.dataset_path }),
    prereg,
  );

  const instructionPath = resolve(projectRoot, prereg.prompt_contract.instruction_path);
  const instructionBytes = await readFile(instructionPath);
  const instructionSha256 = sha256Bytes(instructionBytes);
  if (instructionSha256 !== prereg.prompt_contract.instruction_sha256) {
    throw new Error(`instruction SHA-256 mismatch: ${instructionSha256}`);
  }

  const referencePath = resolve(projectRoot, prereg.reference_model.raw_scores_path);
  const referenceBytes = await readFile(referencePath);
  const referenceSha256 = sha256Bytes(referenceBytes);
  if (referenceSha256 !== prereg.reference_model.raw_scores_sha256) {
    throw new Error(`reference score SHA-256 mismatch: ${referenceSha256}`);
  }

  const packageJson = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'));
  if (packageJson.dependencies?.['@huggingface/transformers'] !== prereg.browser_model.transformers_js_version) {
    throw new Error('installed Transformers.js dependency does not match the frozen preregistration');
  }

  return {
    prereg,
    preregSha256: sha256Bytes(preregBytes),
    rows,
    datasetSha256,
    instruction: instructionBytes.toString('utf8'),
    instructionSha256,
    referenceBytes,
    referenceSha256,
  };
}

export async function buildAndAuditBrowserBundle() {
  const result = await build({
    absWorkingDir: projectRoot,
    entryPoints: [browserEntryPath],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: ['chrome131'],
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  const inputs = Object.keys(result.metafile.inputs);
  const forbidden = inputs.filter((path) =>
    /onnxruntime-node|transformers\.node|backends\/onnx-node/u.test(path),
  );
  if (forbidden.length > 0) {
    throw new Error(`browser bundle contains forbidden Node backend inputs: ${forbidden.join(', ')}`);
  }
  if (!inputs.some((path) => path.endsWith('@huggingface/transformers/dist/transformers.web.js'))) {
    throw new Error('browser bundle did not resolve the Transformers.js web export');
  }
  if (!inputs.some((path) => path.includes('onnxruntime-web'))) {
    throw new Error('browser bundle does not contain onnxruntime-web');
  }
  const output = result.outputFiles.find((file) => file.path.endsWith('.js')) ?? result.outputFiles[0];
  return {
    code: output.text,
    sha256: sha256Bytes(output.contents),
    inputs,
    transformersWebEntry: inputs.find((path) => path.endsWith('@huggingface/transformers/dist/transformers.web.js')),
    onnxWebInputCount: inputs.filter((path) => path.includes('onnxruntime-web')).length,
  };
}

async function assertOutputTargetsAreNew() {
  for (const relativePath of [
    BROWSER_SCORE_OUTPUT,
    BROWSER_SCORE_METADATA_OUTPUT,
    BROWSER_PARITY_REPORT_OUTPUT,
    BROWSER_PARITY_LOG_OUTPUT,
  ]) {
    const absolutePath = resolve(projectRoot, relativePath);
    if (await exists(absolutePath)) {
      throw new Error(`completed output already exists; refusing overwrite: ${relativePath}`);
    }
  }
}

export async function runPreflight() {
  const frozen = await readFrozenInputs();
  const bundle = await buildAndAuditBrowserBundle();
  await assertOutputTargetsAreNew();
  return {
    experiment_id: BROWSER_PARITY_EXPERIMENT_ID,
    status: 'preflight-passed-no-model-execution',
    dataset: { rows: frozen.rows.length, sha256: frozen.datasetSha256 },
    instruction_sha256: frozen.instructionSha256,
    reference_scores_sha256: frozen.referenceSha256,
    browser_bundle: {
      sha256: bundle.sha256,
      transformers_entry: bundle.transformersWebEntry,
      onnxruntime_web_input_count: bundle.onnxWebInputCount,
      forbidden_node_backend_inputs: 0,
    },
    inference_executed: false,
    model_downloaded: false,
  };
}

function parseBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let length = 0;
    request.on('data', (chunk) => {
      length += chunk.length;
      if (length > 1_000_000) {
        rejectBody(new Error('request body is too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (error) {
        rejectBody(error);
      }
    });
    request.on('error', rejectBody);
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(value)}\n`);
}

function assertRuntimeMetadata(metadata) {
  if (
    metadata.runtime !== 'browser' ||
    metadata.onnx_backend !== 'onnxruntime-web' ||
    metadata.execution_provider !== 'webgpu' ||
    metadata.device !== 'webgpu' ||
    metadata.dtype !== 'q4' ||
    metadata.wasm_host_threads !== 1 ||
    metadata.transformers_js_version !== '4.3.0'
  ) {
    throw new Error('browser runtime metadata violates the frozen WebGPU/q4 contract');
  }
  if (metadata.num_logits_to_keep !== 1) {
    throw new Error('browser runtime must materialize exactly the final next-token logits');
  }
  if (
    metadata.onnx_output_selection?.fetches?.length !== 1 ||
    metadata.onnx_output_selection.fetches[0] !== 'logits' ||
    typeof metadata.onnx_output_selection.session !== 'string'
  ) {
    throw new Error('browser runtime must fetch only logits from the model ONNX session');
  }
  if (metadata.adapter_info?.is_fallback_adapter === true) {
    throw new Error('fallback/software WebGPU adapter is forbidden');
  }
  const configs = Object.values(metadata.session_configs ?? {});
  if (configs.length === 0 || configs.some((config) => config?.device !== 'webgpu' || config?.dtype !== 'q4')) {
    throw new Error('one or more ONNX sessions did not report webgpu/q4');
  }
  return metadata;
}

async function loadCheckpoint(path, rows, prereg) {
  if (!(await exists(path))) return [];
  const { records } = await readJsonl(path);
  return validateScoreSequence(records, rows, prereg);
}

async function launchChrome(url) {
  if (process.platform !== 'darwin') {
    throw new Error(`automatic browser launch is only configured for macOS; open manually: ${url}`);
  }
  const child = spawn('open', ['-a', 'Google Chrome', url], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
}

async function runExperiment({
  launch,
  mode,
  diagnosticIndex,
}) {
  const startedAt = Date.now();
  const frozen = await readFrozenInputs();

  const diagnostic =
    mode === 'diagnostic';

  if (diagnostic) {
    if (
      !Number.isInteger(diagnosticIndex) ||
      diagnosticIndex < 0 ||
      diagnosticIndex >= frozen.rows.length
    ) {
      throw new Error(
        `diagnostic index out of range: ${diagnosticIndex}; ` +
        `expected 0-${frozen.rows.length - 1}`
      );
    }
  }
  const bundle = await buildAndAuditBrowserBundle();
  if (!diagnostic) {
    await assertOutputTargetsAreNew();
  }
  const checkpointPath = resolve(projectRoot, BROWSER_CHECKPOINT);
  const scores = diagnostic
    ? []
    : await loadCheckpoint(
        checkpointPath,
        frozen.rows,
        frozen.prereg
      );
  let runtimeMetadata = null;
  let settled = false;

  let resolveFinished;
  let rejectFinished;
  const finished = new Promise((resolvePromise, rejectPromise) => {
    resolveFinished = resolvePromise;
    rejectFinished = rejectPromise;
  });

  const server = createServer(async (request, response) => {
    response.setHeader('cross-origin-opener-policy', 'same-origin');
    response.setHeader('cross-origin-embedder-policy', 'require-corp');
    try {
      const requestUrl = new URL(request.url, 'http://127.0.0.1');
      if (request.method === 'GET' && requestUrl.pathname === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end('<!doctype html><meta charset="utf-8"><title>qwen3-browser-parity-v1</title><script type="module" src="/runner.js"></script>');
        return;
      }
      if (request.method === 'GET' && requestUrl.pathname === '/runner.js') {
        response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
        response.end(bundle.code);
        return;
      }
      if (request.method === 'GET' && requestUrl.pathname === '/payload') {
        sendJson(response, 200, {
          prereg: frozen.prereg,
          instruction: frozen.instruction,
          rows: diagnostic
              ? [frozen.rows[diagnosticIndex]]
              : frozen.rows,
          completed_rows: scores.length,
        });
        return;
      }
      if (request.method === 'POST' && requestUrl.pathname === '/runtime') {
        runtimeMetadata = assertRuntimeMetadata(await parseBody(request));
        sendJson(response, 200, { accepted: true });
        return;
      }
      if (request.method === 'POST' && requestUrl.pathname === '/checkpoint') {
        if (!runtimeMetadata) throw new Error('runtime proof must be accepted before scores');
        const body = await parseBody(request);
        if (body.index !== scores.length) throw new Error(`expected score index ${scores.length}, got ${body.index}`);
        const originalIndex = diagnostic
            ? diagnosticIndex
            : body.index;

          const row =
            frozen.rows[originalIndex];
        const record = makeBrowserScoreRecord({
          row,
          prereg: frozen.prereg,
          instruction: frozen.instruction,
          rawScore: body.raw_score,
          latencyMs: body.latency_ms,
        });
        if (record.input_sha256 !== body.input_sha256) throw new Error('browser/Node input fingerprint mismatch');
        scores.push(record);
        if (!diagnostic) {
            await writeJsonlAtomic(
              checkpointPath,
              scores
            );
          }
        sendJson(response, 200, { accepted: true, completed_rows: scores.length });
        return;
      }
      if (request.method === 'POST' && requestUrl.pathname === '/complete') {
        if (!runtimeMetadata) throw new Error('missing browser runtime proof');
        if (diagnostic) {
          if (scores.length !== 1) {
            throw new Error(
              `diagnostic expected exactly 1 score, got ${scores.length}`
            );
          }

          const row =
            frozen.rows[diagnosticIndex];

          const result = {
            diagnostic: true,
            experiment_id:
              BROWSER_PARITY_EXPERIMENT_ID,
            original_index:
              diagnosticIndex,
            row_number:
              diagnosticIndex + 1,
            query_id:
              row.query_id,
            record_id:
              row.record_id,
            score_record:
              scores[0],
            runtime:
              runtimeMetadata,
            browser_bundle_sha256:
              bundle.sha256,
            checkpoint_written:
              false,
            final_outputs_written:
              false,
            human_labels_used_during_inference:
              false,
            production_changed:
              false,
          };

          console.log(
            '===== DIAGNOSTIC RESULT ====='
          );
          console.log(
            JSON.stringify(result, null, 2)
          );

          sendJson(response, 200, {
            accepted: true,
            diagnostic: true,
            original_index:
              diagnosticIndex,
          });

          settled = true;
          resolveFinished(result);
          return;
        }

        validateScoreSequence(scores, frozen.rows, frozen.prereg);
        if (scores.length !== frozen.rows.length) throw new Error(`incomplete browser output: ${scores.length}/500`);
        await assertOutputTargetsAreNew();

        const scorePath = resolve(projectRoot, BROWSER_SCORE_OUTPUT);
        const scoreText = serializeJsonl(scores);
        await writeJsonlAtomic(scorePath, scores);
        const scoreSha256 = sha256Bytes(Buffer.from(scoreText, 'utf8'));
        const metadata = {
          schema_version: 'qwen3-browser-score-meta-v1',
          experiment_id: BROWSER_PARITY_EXPERIMENT_ID,
          preregistration_path: preregistrationPath,
          preregistration_sha256: frozen.preregSha256,
          dataset_path: frozen.prereg.model_input.dataset_path,
          dataset_sha256: frozen.datasetSha256,
          instruction_path: frozen.prereg.prompt_contract.instruction_path,
          instruction_sha256: frozen.instructionSha256,
          model: frozen.prereg.browser_model.model_id,
          revision: frozen.prereg.browser_model.revision,
          artifact: frozen.prereg.browser_model.artifact,
          output_path: BROWSER_SCORE_OUTPUT,
          output_sha256: scoreSha256,
          row_count: scores.length,
          runtime: runtimeMetadata,
          browser_bundle_sha256: bundle.sha256,
          elapsed_seconds: (Date.now() - startedAt) / 1000,
          human_labels_used_during_inference: false,
          production_changed: false,
        };
        const metadataText = `${JSON.stringify(metadata, null, 2)}\n`;
        const metadataSha256 = sha256Bytes(Buffer.from(metadataText, 'utf8'));
        await writeJsonExclusive(resolve(projectRoot, BROWSER_SCORE_METADATA_OUTPUT), metadata);

        const referenceScores = parseJsonlText(frozen.referenceBytes.toString('utf8'), {
          source: frozen.prereg.reference_model.raw_scores_path,
        });
        const report = {
          ...buildBrowserParityReport({
            rows: frozen.rows,
            browserScores: scores,
            referenceScores,
            prereg: frozen.prereg,
          }),
          artifacts: {
            browser_scores: { path: BROWSER_SCORE_OUTPUT, sha256: scoreSha256 },
            browser_metadata: { path: BROWSER_SCORE_METADATA_OUTPUT, sha256: metadataSha256 },
            reference_scores: {
              path: frozen.prereg.reference_model.raw_scores_path,
              sha256: frozen.referenceSha256,
            },
          },
          runtime: runtimeMetadata,
        };
        await writeJsonExclusive(resolve(projectRoot, BROWSER_PARITY_REPORT_OUTPUT), report);
        const reportText = `${JSON.stringify(report, null, 2)}\n`;
        const log = formatParityLog({
          report,
          runtimeMetadata,
          outputHashes: { scores: scoreSha256, metadata: metadataSha256 },
        });
        await writeTextExclusive(resolve(projectRoot, BROWSER_PARITY_LOG_OUTPUT), log);
        await rm(checkpointPath, { force: true });
        sendJson(response, 200, { accepted: true, primary_gate: report.primary_gate });
        settled = true;
        resolveFinished(report);
        return;
      }
      if (request.method === 'POST' && requestUrl.pathname === '/error') {
        const body = await parseBody(request);
        sendJson(response, 200, { accepted: true });
        settled = true;
        rejectFinished(new Error(`browser runner failed: ${body.message}\n${body.stack ?? ''}`));
        return;
      }
      response.writeHead(404).end('not found');
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      if (!settled) {
        settled = true;
        rejectFinished(error);
      }
    }
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/`;
  console.log(`Browser parity runner ready: ${url}`);
  console.log(`Resume position: ${scores.length}/${frozen.rows.length}`);
  if (launch) await launchChrome(url);
  else console.log('Open the URL in a WebGPU-capable browser; Node will only serve/record artifacts.');

  try {
    return await finished;
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === 'preflight') {
    console.log(JSON.stringify(await runPreflight(), null, 2));
    return;
  }
  const report = await runExperiment(options);
  console.log(JSON.stringify(report.primary_gate, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
