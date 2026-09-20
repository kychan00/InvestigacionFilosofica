#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  constants,
} from 'node:fs';
import {
  access,
  mkdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import {
  createServer,
} from 'node:http';
import {
  dirname,
  resolve,
} from 'node:path';
import {
  fileURLToPath,
} from 'node:url';

import {
  build,
} from 'esbuild';

const projectRoot =
  resolve(
    dirname(
      fileURLToPath(
        import.meta.url,
      ),
    ),
    '../../..',
  );

const preregistrationPath =
  'benchmark/qwen3/browser/q8/qwen3-browser-runtime-q8-feasibility-v1.preregistered.json';

const browserEntryPath =
  'scripts/benchmark/qwen3/q8_feasibility_browser.js';

const expectedPreregSha256 =
  'c6d8f9d2a6fd538f5aedab2d81f8b2097258338a2b0c0fb8657160f708b22802';

function sha256Bytes(value) {
  return createHash('sha256')
    .update(value)
    .digest('hex');
}

function parseArgs(argv) {
  const options = {
    mode: null,
    launch: true,
  };

  for (const argument of argv) {
    if (
      argument === '--preflight'
    ) {
      options.mode =
        'preflight';
    } else if (
      argument === '--run'
    ) {
      options.mode =
        'run';
    } else if (
      argument === '--no-launch'
    ) {
      options.launch =
        false;
    } else {
      throw new Error(
        `unknown argument: ${argument}`,
      );
    }
  }

  if (!options.mode) {
    throw new Error(
      'choose --preflight or --run',
    );
  }

  return options;
}

async function exists(path) {
  try {
    await access(
      path,
      constants.F_OK,
    );

    return true;
  } catch {
    return false;
  }
}

async function writeExclusive(
  path,
  value,
) {
  if (await exists(path)) {
    throw new Error(
      `refusing to overwrite completed output: ${path}`,
    );
  }

  await mkdir(
    dirname(path),
    {
      recursive: true,
    },
  );

  const temporaryPath =
    `${path}.tmp-${process.pid}`;

  await writeFile(
    temporaryPath,
    value,
    {
      encoding: 'utf8',
      flag: 'wx',
    },
  );

  await rename(
    temporaryPath,
    path,
  );
}

function validatePrereg(prereg) {
  if (
    prereg.experiment_id !==
    'qwen3-browser-runtime-q8-feasibility-v1'
  ) {
    throw new Error(
      'unexpected experiment_id',
    );
  }

  if (
    prereg.status !==
    'preregistered-before-runtime-execution'
  ) {
    throw new Error(
      'preregistration is not frozen in expected state',
    );
  }

  if (
    prereg.candidate.model_id !==
    'onnx-community/Qwen3-Reranker-0.6B-ONNX'
  ) {
    throw new Error(
      'unexpected model_id',
    );
  }

  if (
    prereg.candidate.revision !==
    '9995c50e2310679108a55f5ccd16ba8be9f17c20'
  ) {
    throw new Error(
      'unexpected model revision',
    );
  }

  if (
    prereg.candidate.artifact !==
    'onnx/model_quantized.onnx'
  ) {
    throw new Error(
      'unexpected q8 artifact',
    );
  }

  if (
    prereg.candidate.dtype !==
    'q8'
  ) {
    throw new Error(
      'candidate dtype is not q8',
    );
  }

  if (
    prereg.candidate.device !==
    'webgpu'
  ) {
    throw new Error(
      'candidate device is not WebGPU',
    );
  }

  const targets =
    prereg.cases.map(
      (item) =>
        item.target_total_tokens,
    );

  if (
    JSON.stringify(targets) !==
    JSON.stringify(
      [512, 2048, 4096],
    )
  ) {
    throw new Error(
      `unexpected token targets: ${JSON.stringify(targets)}`,
    );
  }

  if (
    prereg.synthetic_input_contract
      .uses_ranking_holdout !==
    false
  ) {
    throw new Error(
      'ranking holdout must be excluded',
    );
  }

  return prereg;
}

async function readFrozenPrereg() {
  const bytes =
    await readFile(
      resolve(
        projectRoot,
        preregistrationPath,
      ),
    );

  const sha256 =
    sha256Bytes(bytes);

  if (
    sha256 !==
    expectedPreregSha256
  ) {
    throw new Error(
      `preregistration SHA-256 mismatch: ${sha256}`,
    );
  }

  const prereg =
    validatePrereg(
      JSON.parse(
        bytes.toString('utf8'),
      ),
    );

  const packageJson =
    JSON.parse(
      await readFile(
        resolve(
          projectRoot,
          'package.json',
        ),
        'utf8',
      ),
    );

  if (
    packageJson.dependencies?.[
      '@huggingface/transformers'
    ] !==
    prereg.candidate
      .transformers_js_version
  ) {
    throw new Error(
      'installed Transformers.js dependency does not match preregistration',
    );
  }

  return {
    prereg,
    preregSha256:
      sha256,
  };
}

async function buildAndAuditBundle() {
  const result =
    await build({
      absWorkingDir:
        projectRoot,

      entryPoints: [
        browserEntryPath,
      ],

      bundle: true,
      platform: 'browser',
      format: 'esm',

      target: [
        'chrome131',
      ],

      write: false,
      metafile: true,
      logLevel: 'silent',
    });

  if (
    result.outputFiles.length !==
    1
  ) {
    throw new Error(
      `expected one browser bundle, got ${result.outputFiles.length}`,
    );
  }

  const inputs =
    Object.keys(
      result.metafile.inputs,
    );

  const transformersWebInputs =
    inputs.filter(
      (value) =>
        value.includes(
          'transformers.web.js',
        ),
    );

  const onnxruntimeWebInputs =
    inputs.filter(
      (value) =>
        value.includes(
          'onnxruntime-web',
        ),
    );

  const forbiddenNodeInputs =
    inputs.filter(
      (value) =>
        value.includes(
          'onnxruntime-node',
        ) ||
        value.includes(
          'transformers.node',
        ) ||
        value.includes(
          'onnx-node',
        ),
    );

  if (
    transformersWebInputs.length ===
    0
  ) {
    throw new Error(
      'browser bundle did not select transformers.web.js',
    );
  }

  if (
    onnxruntimeWebInputs.length ===
    0
  ) {
    throw new Error(
      'browser bundle contains no onnxruntime-web input',
    );
  }

  if (
    forbiddenNodeInputs.length !==
    0
  ) {
    throw new Error(
      `forbidden Node backend detected: ${forbiddenNodeInputs.join(', ')}`,
    );
  }

  const output =
    result.outputFiles[0];

  return {
    code:
      output.text,

    sha256:
      sha256Bytes(
        output.contents,
      ),

    transformers_web_input_count:
      transformersWebInputs.length,

    onnxruntime_web_input_count:
      onnxruntimeWebInputs.length,

    forbidden_node_backend_inputs:
      forbiddenNodeInputs.length,
  };
}

function sendJson(
  response,
  status,
  value,
) {
  response.writeHead(
    status,
    {
      'content-type':
        'application/json; charset=utf-8',
    },
  );

  response.end(
    `${JSON.stringify(value)}\n`,
  );
}

async function parseBody(
  request,
) {
  const chunks = [];

  for await (
    const chunk of request
  ) {
    chunks.push(chunk);
  }

  const text =
    Buffer.concat(chunks)
      .toString('utf8');

  if (!text) {
    return {};
  }

  return JSON.parse(text);
}

function validateRuntime(
  runtime,
  prereg,
) {
  if (
    runtime.runtime !==
    'browser'
  ) {
    throw new Error(
      'runtime is not browser',
    );
  }

  if (
    runtime.execution_provider !==
    'webgpu' ||
    runtime.device !==
    'webgpu'
  ) {
    throw new Error(
      'runtime did not remain on WebGPU',
    );
  }

  if (
    runtime.dtype !==
    'q8'
  ) {
    throw new Error(
      'runtime dtype is not q8',
    );
  }

  if (
    runtime.onnx_backend !==
    'onnxruntime-web'
  ) {
    throw new Error(
      'runtime backend is not onnxruntime-web',
    );
  }

  if (
    runtime.wasm_host_threads !==
    1
  ) {
    throw new Error(
      'WASM host thread count changed',
    );
  }

  if (
    runtime.model_artifact !==
    prereg.candidate.artifact
  ) {
    throw new Error(
      'runtime model artifact differs from preregistration',
    );
  }

  return runtime;
}

async function launchChrome(
  url,
) {
  if (
    process.platform !==
    'darwin'
  ) {
    throw new Error(
      `automatic launch only configured for macOS; open manually: ${url}`,
    );
  }

  const child =
    spawn(
      'open',
      [
        '-a',
        'Google Chrome',
        url,
      ],
      {
        stdio:
          'ignore',

        detached:
          true,
      },
    );

  child.unref();
}

async function runExperiment({
  launch,
}) {
  const frozen =
    await readFrozenPrereg();

  const bundle =
    await buildAndAuditBundle();

  const scorePath =
    resolve(
      projectRoot,
      frozen.prereg
        .planned_outputs
        .scores,
    );

  const reportPath =
    resolve(
      projectRoot,
      frozen.prereg
        .planned_outputs
        .result,
    );

  if (
    await exists(scorePath)
  ) {
    throw new Error(
      `score output already exists: ${scorePath}`,
    );
  }

  if (
    await exists(reportPath)
  ) {
    throw new Error(
      `report output already exists: ${reportPath}`,
    );
  }

  const startedAt =
    Date.now();

  const scores = [];
  let runtimeMetadata =
    null;

  let settled = false;
  let resolveFinished;
  let rejectFinished;

  const finished =
    new Promise(
      (
        resolvePromise,
        rejectPromise,
      ) => {
        resolveFinished =
          resolvePromise;

        rejectFinished =
          rejectPromise;
      },
    );

  async function finalize({
    status,
    error = null,
  }) {
    const passedCases =
      scores.filter(
        (item) =>
          Number.isFinite(
            item.raw_score,
          ) &&
          item.raw_score >= 0 &&
          item.raw_score <= 1 &&
          item.constructed_total_tokens ===
            item.target_total_tokens,
      ).length;

    const gatePassed =
      status === 'passed' &&
      passedCases ===
        frozen.prereg
          .primary_gate
          .required_cases_passed &&
      scores.length ===
        frozen.prereg
          .primary_gate
          .total_cases;

    const rawText =
      scores
        .map(
          (item) =>
            JSON.stringify(item),
        )
        .join('\n') +
      (scores.length > 0
        ? '\n'
        : '');

    const report = {
      experiment_id:
        frozen.prereg
          .experiment_id,

      status,

      preregistration_sha256:
        frozen.preregSha256,

      browser_bundle_sha256:
        bundle.sha256,

      candidate:
        frozen.prereg
          .candidate,

      runtime:
        runtimeMetadata,

      cases:
        scores,

      primary_gate: {
        passed:
          gatePassed,

        passed_cases:
          passedCases,

        required_cases:
          frozen.prereg
            .primary_gate
            .required_cases_passed,

        total_cases:
          frozen.prereg
            .primary_gate
            .total_cases,
      },

      error,

      elapsed_ms:
        Date.now() -
        startedAt,

      production_changed:
        false,

      holdout_accessed:
        false,
    };

    await writeExclusive(
      scorePath,
      rawText,
    );

    await writeExclusive(
      reportPath,
      `${JSON.stringify(
        report,
        null,
        2,
      )}\n`,
    );

    return report;
  }

  const server =
    createServer(
      async (
        request,
        response,
      ) => {
        response.setHeader(
          'cross-origin-opener-policy',
          'same-origin',
        );

        response.setHeader(
          'cross-origin-embedder-policy',
          'require-corp',
        );

        try {
          const requestUrl =
            new URL(
              request.url,
              'http://127.0.0.1',
            );

          if (
            request.method ===
              'GET' &&
            requestUrl.pathname ===
              '/'
          ) {
            response.writeHead(
              200,
              {
                'content-type':
                  'text/html; charset=utf-8',
              },
            );

            response.end(
              '<!doctype html>' +
              '<meta charset="utf-8">' +
              '<title>qwen3-browser-runtime-q8-feasibility-v1</title>' +
              '<script type="module" src="/runner.js"></script>',
            );

            return;
          }

          if (
            request.method ===
              'GET' &&
            requestUrl.pathname ===
              '/runner.js'
          ) {
            response.writeHead(
              200,
              {
                'content-type':
                  'text/javascript; charset=utf-8',
              },
            );

            response.end(
              bundle.code,
            );

            return;
          }

          if (
            request.method ===
              'GET' &&
            requestUrl.pathname ===
              '/payload'
          ) {
            sendJson(
              response,
              200,
              {
                prereg:
                  frozen.prereg,
              },
            );

            return;
          }

          if (
            request.method ===
              'POST' &&
            requestUrl.pathname ===
              '/runtime'
          ) {
            if (
              runtimeMetadata
            ) {
              throw new Error(
                'runtime metadata already received',
              );
            }

            runtimeMetadata =
              validateRuntime(
                await parseBody(
                  request,
                ),
                frozen.prereg,
              );

            sendJson(
              response,
              200,
              {
                ok: true,
              },
            );

            return;
          }

          if (
            request.method ===
              'POST' &&
            requestUrl.pathname ===
              '/case'
          ) {
            if (
              !runtimeMetadata
            ) {
              throw new Error(
                'case received before runtime metadata',
              );
            }

            const body =
              await parseBody(
                request,
              );

            if (
              body.index !==
              scores.length
            ) {
              throw new Error(
                `unexpected case index ${body.index}; expected ${scores.length}`,
              );
            }

            const expected =
              frozen.prereg
                .cases[
                  body.index
                ];

            if (
              !expected
            ) {
              throw new Error(
                'received extra case',
              );
            }

            if (
              body.case_id !==
              expected.case_id
            ) {
              throw new Error(
                'case_id mismatch',
              );
            }

            if (
              body.target_total_tokens !==
              expected.target_total_tokens
            ) {
              throw new Error(
                'target token count mismatch',
              );
            }

            if (
              body.constructed_total_tokens !==
              expected.target_total_tokens
            ) {
              throw new Error(
                'constructed token count mismatch',
              );
            }

            if (
              !Number.isFinite(
                body.raw_score,
              ) ||
              body.raw_score <
                0 ||
              body.raw_score >
                1
            ) {
              throw new Error(
                `invalid raw score: ${body.raw_score}`,
              );
            }

            if (
              !Number.isFinite(
                body.latency_ms,
              ) ||
              body.latency_ms <
                0
            ) {
              throw new Error(
                `invalid latency: ${body.latency_ms}`,
              );
            }

            scores.push({
              case_id:
                body.case_id,

              target_total_tokens:
                body.target_total_tokens,

              constructed_total_tokens:
                body.constructed_total_tokens,

              filler_tokens:
                body.filler_tokens,

              raw_score:
                body.raw_score,

              latency_ms:
                body.latency_ms,
            });

            console.log(
              `case ${scores.length}/${frozen.prereg.cases.length} PASS: ${body.case_id} ${body.latency_ms.toFixed(1)} ms`,
            );

            sendJson(
              response,
              200,
              {
                ok: true,
              },
            );

            return;
          }

          if (
            request.method ===
              'POST' &&
            requestUrl.pathname ===
              '/complete'
          ) {
            if (
              scores.length !==
              frozen.prereg
                .cases.length
            ) {
              throw new Error(
                `completion received with ${scores.length}/${frozen.prereg.cases.length} cases`,
              );
            }

            const report =
              await finalize({
                status:
                  'passed',
              });

            sendJson(
              response,
              200,
              {
                ok: true,
              },
            );

            if (!settled) {
              settled = true;
              resolveFinished(
                report,
              );
            }

            return;
          }

          if (
            request.method ===
              'POST' &&
            requestUrl.pathname ===
              '/error'
          ) {
            const body =
              await parseBody(
                request,
              );

            const error = {
              message:
                body.message ??
                'unknown browser error',

              stack:
                body.stack ??
                null,
            };

            const report =
              await finalize({
                status:
                  'failed-runtime',

                error,
              });

            sendJson(
              response,
              200,
              {
                ok: true,
              },
            );

            if (!settled) {
              settled = true;

              const failure =
                new Error(
                  `q8 feasibility failed: ${error.message}`,
                );

              failure.report =
                report;

              rejectFinished(
                failure,
              );
            }

            return;
          }

          response.writeHead(
            404,
          );
          response.end(
            'not found',
          );
        } catch (error) {
          console.error(
            error.stack ??
              error.message,
          );

          if (
            !response.headersSent
          ) {
            sendJson(
              response,
              500,
              {
                error:
                  error.message,
              },
            );
          } else {
            response.end();
          }
        }
      },
    );

  await new Promise(
    (resolvePromise) => {
      server.listen(
        0,
        '127.0.0.1',
        resolvePromise,
      );
    },
  );

  const address =
    server.address();

  const url =
    `http://127.0.0.1:${address.port}/`;

  console.log(
    `Q8 feasibility runner ready: ${url}`,
  );

  console.log(
    'Cases: 512 -> 2048 -> 4096 exact total tokens',
  );

  if (launch) {
    await launchChrome(
      url,
    );
  } else {
    console.log(
      `Open manually: ${url}`,
    );
  }

  try {
    return await finished;
  } finally {
    await new Promise(
      (resolvePromise) => {
        server.close(
          resolvePromise,
        );
      },
    );
  }
}

async function preflight() {
  const frozen =
    await readFrozenPrereg();

  const bundle =
    await buildAndAuditBundle();

  return {
    experiment_id:
      frozen.prereg
        .experiment_id,

    status:
      'preflight-passed-no-model-execution',

    preregistration_sha256:
      frozen.preregSha256,

    candidate: {
      artifact:
        frozen.prereg
          .candidate.artifact,

      dtype:
        frozen.prereg
          .candidate.dtype,

      device:
        frozen.prereg
          .candidate.device,

      revision:
        frozen.prereg
          .candidate.revision,
    },

    cases:
      frozen.prereg
        .cases,

    browser_bundle: {
      sha256:
        bundle.sha256,

      transformers_web_input_count:
        bundle.transformers_web_input_count,

      onnxruntime_web_input_count:
        bundle.onnxruntime_web_input_count,

      forbidden_node_backend_inputs:
        bundle.forbidden_node_backend_inputs,
    },

    ranking_holdout_accessed:
      false,

    inference_executed:
      false,

    model_downloaded:
      false,
  };
}

async function main() {
  const options =
    parseArgs(
      process.argv.slice(2),
    );

  if (
    options.mode ===
    'preflight'
  ) {
    console.log(
      JSON.stringify(
        await preflight(),
        null,
        2,
      ),
    );

    return;
  }

  const report =
    await runExperiment(
      options,
    );

  console.log(
    '===== Q8 FEASIBILITY RESULT =====',
  );

  console.log(
    JSON.stringify(
      report.primary_gate,
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) ===
    fileURLToPath(import.meta.url)
) {
  main().catch(
    (error) => {
      console.error(
        error.stack ??
          error.message,
      );

      process.exitCode = 1;
    },
  );
}
