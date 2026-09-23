#!/usr/bin/env node

import { spawn, execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

import { parseJsonlText, readJsonl, serializeJsonl, writeJsonlAtomic } from '../core/jsonl.mjs';
import {
  QWEN3_SCORE_SCHEMA,
  buildQwen3DocumentText,
  validateQwen3DatasetRecord,
  validateQwen3ScoreRecord,
} from './contracts.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const EXPERIMENT_ID = 'qwen3-browser-q8-human-holdout-v1';
const PREREGISTRATION_PATH =
  'benchmark/qwen3/browser/q8-human-holdout/qwen3-browser-q8-human-holdout-v1.preregistered.json';
const SOURCE_Q8_PREREGISTRATION_PATH =
  'benchmark/qwen3/browser/q8-1024-parity-pilot/qwen3-browser-q8-1024-parity-pilot-v1.preregistered.json';
const DATASET_PATH =
  'benchmark/qwen3/browser/q8-human-holdout/datasets/qwen3-browser-q8-human-holdout-v1.jsonl';
const BROWSER_ENTRY_PATH =
  'scripts/benchmark/qwen3/browser_q8_1024_parity_pilot.js';
const SCORE_OUTPUT =
  'benchmark/qwen3/browser/q8-human-holdout/scores/qwen3-browser-q8-human-holdout-v1.raw.jsonl';
const SCORE_METADATA_OUTPUT =
  'benchmark/qwen3/browser/q8-human-holdout/scores/qwen3-browser-q8-human-holdout-v1.raw.meta.json';
const CHECKPOINT =
  'benchmark/qwen3/cache/qwen3-browser-q8-human-holdout-v1.partial.jsonl';

const EXPECTED_PREREG_SHA256 =
  '9575c35e5914dd7c6f48f1b03e12f31f381b91f52625f56155206d25ecd2b7ff';
const EXPECTED_SOURCE_Q8_PREREG_SHA256 =
  '5c4fd21aa9414048fe6c045350a773d661e316c902c13a225cc28ba5a976a79b';
const EXPECTED_DATASET_SHA256 =
  '52fa2d0c863c69270de5f77006b42106dcfb6ed7d998d9209934018e96edb4c4';
const EXPECTED_BROWSER_SCORER_SHA256 =
  '06d6ecb076113f2e2d77a47499a8f60e8d600ca49b34bc54dd6654e9f536b97c';
const EXPECTED_DATASET_FREEZE_COMMIT =
  'eb9e7147e94a194032fdd94045f03053374fe532';
const EXPECTED_CLOSED_Q8_RESULT_COMMIT = '34fd13a';
const EXPECTED_ROWS = 500;
const EXPECTED_QUERIES = 25;
const EXPECTED_PER_QUERY = 20;

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function currentCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function parseArgs(argv) {
  let mode = null;
  let launch = true;
  for (const argument of argv) {
    if (argument === '--preflight') {
      if (mode) throw new Error('choose exactly one mode');
      mode = 'preflight';
    } else if (argument === '--run') {
      if (mode) throw new Error('choose exactly one mode');
      mode = 'run';
    } else if (argument === '--no-launch') {
      launch = false;
    } else if (argument.startsWith('--diagnostic')) {
      throw new Error('diagnostic inference is forbidden for the fresh human holdout');
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (!mode) throw new Error('choose exactly one mode: --preflight or --run');
  return { mode, launch };
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
  await writeFile(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  await rename(temporaryPath, path);
}

function validateDatasetRows(rows) {
  if (!Array.isArray(rows) || rows.length !== EXPECTED_ROWS) {
    throw new Error(`dataset must contain exactly ${EXPECTED_ROWS} rows`);
  }
  const counts = new Map();
  const pairs = new Set();
  for (const row of rows) {
    validateQwen3DatasetRecord(row);
    counts.set(row.query_id, (counts.get(row.query_id) ?? 0) + 1);
    const key = `${row.query_id}\0${row.record_id}`;
    if (pairs.has(key)) throw new Error(`duplicate dataset pair: ${row.query_id}/${row.record_id}`);
    pairs.add(key);
  }
  if (counts.size !== EXPECTED_QUERIES) {
    throw new Error(`dataset must contain exactly ${EXPECTED_QUERIES} queries`);
  }
  for (const [queryId, count] of counts) {
    if (count !== EXPECTED_PER_QUERY) {
      throw new Error(`query ${queryId} must contain exactly ${EXPECTED_PER_QUERY} records`);
    }
  }
  return rows;
}

function assertFreshPreregistration(prereg, sourceQ8Prereg) {
  if (prereg.validation_id !== EXPERIMENT_ID) throw new Error('fresh holdout validation_id mismatch');
  if (prereg.status !== 'preregistered-before-retrieval') throw new Error('fresh holdout preregistration status mismatch');
  if (prereg.lineage.closed_q8_preregistration_sha256 !== EXPECTED_SOURCE_Q8_PREREG_SHA256) {
    throw new Error('fresh holdout does not pin the expected closed q8 preregistration');
  }
  if (prereg.planned_outputs.model_input_dataset !== DATASET_PATH) {
    throw new Error('fresh holdout dataset path mismatch');
  }
  if (prereg.planned_outputs.browser_scores !== SCORE_OUTPUT) {
    throw new Error('fresh holdout score path mismatch');
  }
  if (prereg.planned_outputs.browser_metadata !== SCORE_METADATA_OUTPUT) {
    throw new Error('fresh holdout score metadata path mismatch');
  }
  if (stableJson(prereg.browser_candidate.browser_model) !== stableJson(sourceQ8Prereg.browser_model)) {
    throw new Error('fresh holdout browser model differs from the closed q8 source contract');
  }
  if (stableJson(prereg.browser_candidate.prompt_contract) !== stableJson(sourceQ8Prereg.prompt_contract)) {
    throw new Error('fresh holdout prompt contract differs from the closed q8 source contract');
  }
  if (
    prereg.candidate_ranking_policy.binary_threshold_used_for_ranking ||
    prereg.candidate_ranking_policy.score_blending ||
    prereg.candidate_ranking_policy.pool_membership_changes
  ) {
    throw new Error('fresh holdout ranking policy unexpectedly permits tuning or pool changes');
  }
  return prereg;
}

async function readFrozenInputs() {
  execFileSync('git', ['merge-base', '--is-ancestor', EXPECTED_DATASET_FREEZE_COMMIT, 'HEAD']);
  execFileSync('git', ['merge-base', '--is-ancestor', EXPECTED_CLOSED_Q8_RESULT_COMMIT, 'HEAD']);

  const preregBytes = await readFile(resolve(projectRoot, PREREGISTRATION_PATH));
  const preregSha256 = sha256Bytes(preregBytes);
  if (preregSha256 !== EXPECTED_PREREG_SHA256) {
    throw new Error(`fresh preregistration SHA mismatch: ${preregSha256}`);
  }

  const sourceQ8PreregBytes = await readFile(resolve(projectRoot, SOURCE_Q8_PREREGISTRATION_PATH));
  const sourceQ8PreregSha256 = sha256Bytes(sourceQ8PreregBytes);
  if (sourceQ8PreregSha256 !== EXPECTED_SOURCE_Q8_PREREG_SHA256) {
    throw new Error(`closed q8 preregistration SHA mismatch: ${sourceQ8PreregSha256}`);
  }

  const sourceQ8Prereg = JSON.parse(sourceQ8PreregBytes.toString('utf8'));
  const prereg = assertFreshPreregistration(
    JSON.parse(preregBytes.toString('utf8')),
    sourceQ8Prereg,
  );

  const datasetBytes = await readFile(resolve(projectRoot, DATASET_PATH));
  const datasetSha256 = sha256Bytes(datasetBytes);
  if (datasetSha256 !== EXPECTED_DATASET_SHA256) {
    throw new Error(`dataset SHA mismatch: ${datasetSha256}`);
  }
  const rows = validateDatasetRows(
    parseJsonlText(datasetBytes.toString('utf8'), { source: DATASET_PATH }),
  );

  const scorerBytes = await readFile(resolve(projectRoot, BROWSER_ENTRY_PATH));
  const scorerSha256 = sha256Bytes(scorerBytes);
  if (scorerSha256 !== EXPECTED_BROWSER_SCORER_SHA256) {
    throw new Error(`frozen browser scorer SHA mismatch: ${scorerSha256}`);
  }

  const prompt = prereg.browser_candidate.prompt_contract;
  const instructionBytes = await readFile(resolve(projectRoot, prompt.instruction_path));
  const instructionSha256 = sha256Bytes(instructionBytes);
  if (instructionSha256 !== prompt.instruction_sha256) {
    throw new Error(`instruction SHA mismatch: ${instructionSha256}`);
  }

  const packageJson = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'));
  if (
    packageJson.dependencies?.['@huggingface/transformers'] !==
    prereg.browser_candidate.browser_model.transformers_js_version
  ) {
    throw new Error('Transformers.js dependency differs from frozen browser contract');
  }

  const scorerPrereg = {
    browser_model: prereg.browser_candidate.browser_model,
    prompt_contract: prereg.browser_candidate.prompt_contract,
  };

  return {
    prereg,
    preregSha256,
    sourceQ8PreregSha256,
    datasetSha256,
    scorerSha256,
    scorerPrereg,
    instruction: instructionBytes.toString('utf8'),
    instructionSha256,
    rows,
  };
}

export async function buildAndAuditBrowserBundle() {
  const result = await build({
    absWorkingDir: projectRoot,
    entryPoints: [BROWSER_ENTRY_PATH],
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
  if (forbidden.length) {
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
    transformersWebEntry:
      inputs.find((path) => path.endsWith('@huggingface/transformers/dist/transformers.web.js')),
    onnxWebInputCount: inputs.filter((path) => path.includes('onnxruntime-web')).length,
    forbiddenNodeBackendInputs: forbidden.length,
  };
}

async function assertNoCompletedOrLaterOutputs(prereg) {
  const allowedExisting = new Set([
    'production_pool',
    'production_pool_metadata',
    'model_input_dataset',
  ]);
  const existing = [];
  for (const [key, relativePath] of Object.entries(prereg.planned_outputs)) {
    if (allowedExisting.has(key)) continue;
    if (await exists(resolve(projectRoot, relativePath))) existing.push([key, relativePath]);
  }
  if (existing.length) {
    throw new Error(`post-dataset holdout output already exists: ${JSON.stringify(existing)}`);
  }
}

function buildInputFingerprint(instruction, row) {
  const document = buildQwen3DocumentText(row);
  return sha256Bytes(Buffer.from(`${instruction}\0${row.query}\0${document}`, 'utf8'));
}

function makeScoreRecord({ row, frozen, rawScore, latencyMs }) {
  const browserModel = frozen.prereg.browser_candidate.browser_model;
  return validateQwen3ScoreRecord({
    schema_version: QWEN3_SCORE_SCHEMA,
    experiment_id: EXPERIMENT_ID,
    query_id: row.query_id,
    record_id: row.record_id,
    model: browserModel.model_id,
    revision: browserModel.revision,
    instruction_sha256: frozen.instructionSha256,
    input_sha256: buildInputFingerprint(frozen.instruction, row),
    raw_score: rawScore,
    latency_ms: latencyMs,
    device: 'webgpu',
    dtype: 'q8',
    max_length: frozen.prereg.browser_candidate.prompt_contract.max_length,
    cache_hit: false,
  });
}

function validateScoreSequence(scores, rows, frozen) {
  if (!Array.isArray(scores) || scores.length > rows.length) {
    throw new Error('score sequence is not a valid dataset prefix');
  }
  const model = frozen.prereg.browser_candidate.browser_model;
  for (let index = 0; index < scores.length; index += 1) {
    const score = validateQwen3ScoreRecord(scores[index]);
    const row = rows[index];
    if (score.query_id !== row.query_id || score.record_id !== row.record_id) {
      throw new Error(`score row ${index + 1} does not match frozen dataset order`);
    }
    if (
      score.experiment_id !== EXPERIMENT_ID ||
      score.model !== model.model_id ||
      score.revision !== model.revision ||
      score.instruction_sha256 !== frozen.instructionSha256 ||
      score.device !== 'webgpu' ||
      score.dtype !== 'q8' ||
      score.max_length !== 1024 ||
      score.cache_hit !== false
    ) {
      throw new Error(`score row ${index + 1} violates the frozen browser scoring contract`);
    }
    if (score.input_sha256 !== buildInputFingerprint(frozen.instruction, row)) {
      throw new Error(`score row ${index + 1} input fingerprint mismatch`);
    }
  }
  return scores;
}

function assertRuntimeMetadata(metadata) {
  if (
    metadata.runtime !== 'browser' ||
    metadata.onnx_backend !== 'onnxruntime-web' ||
    metadata.execution_provider !== 'webgpu' ||
    metadata.device !== 'webgpu' ||
    metadata.dtype !== 'q8' ||
    metadata.wasm_host_threads !== 1 ||
    metadata.transformers_js_version !== '4.3.0'
  ) {
    throw new Error('browser runtime metadata violates frozen WebGPU/q8 contract');
  }
  if (metadata.num_logits_to_keep !== 1) {
    throw new Error('browser runtime must materialize exactly final next-token logits');
  }
  if (
    metadata.onnx_output_selection?.fetches?.length !== 1 ||
    metadata.onnx_output_selection.fetches[0] !== 'logits' ||
    typeof metadata.onnx_output_selection.session !== 'string'
  ) {
    throw new Error('browser runtime must fetch only logits');
  }
  if (metadata.adapter_info?.is_fallback_adapter === true) {
    throw new Error('fallback/software WebGPU adapter is forbidden');
  }
  const configs = Object.values(metadata.session_configs ?? {});
  if (
    configs.length === 0 ||
    configs.some((config) => config?.device !== 'webgpu' || config?.dtype !== 'q8')
  ) {
    throw new Error('one or more ONNX sessions did not report webgpu/q8');
  }
  return metadata;
}

async function loadCheckpoint(path, frozen) {
  if (!(await exists(path))) return [];
  const { records } = await readJsonl(path);
  return validateScoreSequence(records, frozen.rows, frozen);
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

export async function runPreflight() {
  const frozen = await readFrozenInputs();
  const bundle = await buildAndAuditBrowserBundle();
  await assertNoCompletedOrLaterOutputs(frozen.prereg);

  const checkpointPath = resolve(projectRoot, CHECKPOINT);
  if (await exists(checkpointPath)) {
    throw new Error('checkpoint already exists before official inference');
  }

  return {
    experiment_id: EXPERIMENT_ID,
    status: 'preflight-passed-no-model-execution',
    dataset: {
      rows: frozen.rows.length,
      queries: new Set(frozen.rows.map((row) => row.query_id)).size,
      sha256: frozen.datasetSha256,
    },
    fresh_preregistration_sha256: frozen.preregSha256,
    source_q8_preregistration_sha256: frozen.sourceQ8PreregSha256,
    browser_scorer_sha256: frozen.scorerSha256,
    inherited_browser_model_exact: true,
    inherited_prompt_contract_exact: true,
    instruction_sha256: frozen.instructionSha256,
    browser_bundle: {
      sha256: bundle.sha256,
      transformers_entry: bundle.transformersWebEntry,
      onnxruntime_web_input_count: bundle.onnxWebInputCount,
      forbidden_node_backend_inputs: bundle.forbiddenNodeBackendInputs,
    },
    max_length: frozen.prereg.browser_candidate.prompt_contract.max_length,
    scoring_policy: frozen.prereg.browser_candidate.scoring_policy,
    binary_threshold_used_for_ranking:
      frozen.prereg.browser_candidate.binary_threshold_used_for_ranking,
    checkpoint_absent: true,
    post_dataset_outputs_absent: true,
    inference_executed: false,
    model_downloaded: false,
    human_labels_used_during_inference: false,
    production_changed: false,
  };
}

async function runExperiment({ launch }) {
  const startedAt = Date.now();
  const frozen = await readFrozenInputs();
  const bundle = await buildAndAuditBrowserBundle();
  await assertNoCompletedOrLaterOutputs(frozen.prereg);

  const scorePath = resolve(projectRoot, SCORE_OUTPUT);
  const metadataPath = resolve(projectRoot, SCORE_METADATA_OUTPUT);
  if (await exists(scorePath) || await exists(metadataPath)) {
    throw new Error('completed fresh holdout browser scoring output already exists');
  }

  const checkpointPath = resolve(projectRoot, CHECKPOINT);
  const scores = await loadCheckpoint(checkpointPath, frozen);
  const resumedFromRows = scores.length;
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
        response.end(
          '<!doctype html><meta charset="utf-8"><title>qwen3-browser-q8-human-holdout-v1</title><script type="module" src="/runner.js"></script>',
        );
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/runner.js') {
        response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
        response.end(bundle.code);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/payload') {
        sendJson(response, 200, {
          prereg: frozen.scorerPrereg,
          instruction: frozen.instruction,
          rows: frozen.rows,
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
        if (body.index !== scores.length) {
          throw new Error(`expected score index ${scores.length}, got ${body.index}`);
        }
        const row = frozen.rows[body.index];
        const record = makeScoreRecord({
          row,
          frozen,
          rawScore: body.raw_score,
          latencyMs: body.latency_ms,
        });
        if (record.input_sha256 !== body.input_sha256) {
          throw new Error('browser/Node input fingerprint mismatch');
        }
        scores.push(record);
        await writeJsonlAtomic(checkpointPath, scores);
        sendJson(response, 200, { accepted: true, completed_rows: scores.length });
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/complete') {
        if (!runtimeMetadata) throw new Error('missing browser runtime proof');
        validateScoreSequence(scores, frozen.rows, frozen);
        if (scores.length !== frozen.rows.length) {
          throw new Error(`incomplete browser output: ${scores.length}/${frozen.rows.length}`);
        }
        if (await exists(scorePath) || await exists(metadataPath)) {
          throw new Error('completed fresh holdout browser scoring output already exists');
        }

        const scoreText = serializeJsonl(scores);
        await writeJsonlAtomic(scorePath, scores);
        const scoreSha256 = sha256Bytes(Buffer.from(scoreText, 'utf8'));

        const metadata = {
          schema_version: 'qwen3-browser-q8-human-holdout-score-meta-v1',
          experiment_id: EXPERIMENT_ID,
          runtime_commit: currentCommit(),
          preregistration_path: PREREGISTRATION_PATH,
          preregistration_sha256: frozen.preregSha256,
          source_q8_preregistration_path: SOURCE_Q8_PREREGISTRATION_PATH,
          source_q8_preregistration_sha256: frozen.sourceQ8PreregSha256,
          dataset_path: DATASET_PATH,
          dataset_sha256: frozen.datasetSha256,
          browser_scorer_path: BROWSER_ENTRY_PATH,
          browser_scorer_sha256: frozen.scorerSha256,
          instruction_path: frozen.prereg.browser_candidate.prompt_contract.instruction_path,
          instruction_sha256: frozen.instructionSha256,
          model: frozen.prereg.browser_candidate.browser_model.model_id,
          revision: frozen.prereg.browser_candidate.browser_model.revision,
          artifact: frozen.prereg.browser_candidate.browser_model.artifact,
          output_path: SCORE_OUTPUT,
          output_sha256: scoreSha256,
          row_count: scores.length,
          unique_query_count: new Set(scores.map((score) => score.query_id)).size,
          runtime: runtimeMetadata,
          browser_bundle_sha256: bundle.sha256,
          elapsed_seconds: (Date.now() - startedAt) / 1000,
          checkpointing_enabled: true,
          resumed_from_rows: resumedFromRows,
          human_labels_used_during_inference: false,
          threshold_used_during_scoring: false,
          score_blending_used_during_scoring: false,
          candidate_pool_changed_during_scoring: false,
          production_changed: false,
        };
        await writeJsonExclusive(metadataPath, metadata);
        await rm(checkpointPath, { force: true });

        const result = {
          experiment_id: EXPERIMENT_ID,
          status: 'browser-q8-scoring-complete',
          rows: scores.length,
          queries: metadata.unique_query_count,
          scores: SCORE_OUTPUT,
          scores_sha256: scoreSha256,
          metadata: SCORE_METADATA_OUTPUT,
          runtime_commit: metadata.runtime_commit,
          checkpoint_removed: true,
        };
        sendJson(response, 200, { accepted: true, result });
        settled = true;
        resolveFinished(result);
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
  console.log(`Fresh q8 human holdout runner ready: ${url}`);
  console.log(`Resume position: ${scores.length}/${frozen.rows.length}`);
  if (launch) await launchChrome(url);
  else console.log('Open the URL in Google Chrome; Node only serves and records frozen artifacts.');

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
  console.log(JSON.stringify(await runExperiment(options), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
