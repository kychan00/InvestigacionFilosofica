# Qwen3 Browser Experiment Log

Bitácora versionada de los experimentos Qwen3 para Investigación Filosófica.

## Regla de trazabilidad

Todo experimento o cambio debe registrar fecha, commit, configuración, acciones, resultados, errores, decisión metodológica y siguiente paso.

Los experimentos cerrados no se modifican para hacerlos pasar.

---

## 2026-09-19 — qwen3-browser-runtime-q8-feasibility-v1

**Branch:** `experiment/qwen3-browser-q8-feasibility-v1`
**Runner commit:** `d56844f3600985f4e2558ab7963a2cdd26386f74`
**Status:** FAIL — browser runtime feasibility

### Frozen candidate

- Model: `onnx-community/Qwen3-Reranker-0.6B-ONNX`
- Revision: `9995c50e2310679108a55f5ccd16ba8be9f17c20`
- Artifact: `onnx/model_quantized.onnx`
- dtype: `q8`
- execution provider: `WebGPU`
- Transformers.js: `4.3.0`
- WASM host threads: `1`
- `num_logits_to_keep=1`
- ONNX output: `logits` only

### Observed result

- `synthetic-512` — PASS
- exact input length: `512` tokens
- score: `0.03741093707626879`
- latency: `46903.8 ms`
- `synthetic-2048` — FAIL during model execution
- `synthetic-4096` — NOT RUN because the preregistered gate had already failed

### Runtime error

`RuntimeError: table index is out of bounds`

Observed stack passed through `_OrtReleaseTensor`, `sessionRun`, and `decoder_forward`.

### Decision

The preregistered primary gate required 3/3 successful cases. Result: FAIL.

Do not rerun this experiment, reduce the frozen token targets, tune against this failure, access the 500-pair holdout with q8, or change production.

Any subsequent runtime candidate must be a new preregistered experiment.

### Frozen outputs

- `benchmark/qwen3/browser/q8/reports/qwen3-browser-runtime-q8-feasibility-v1.report.json`
- `benchmark/qwen3/browser/q8/scores/qwen3-browser-runtime-q8-feasibility-v1.raw.jsonl`

---


### Artifact hashes

- Report SHA-256: `6e943bd330c4d45502ace324c7ed32c32c435d00a307434f9c17bc337e347869`
- Scores SHA-256: `58bd7b243dbb135aacd911b97a1718587d1f89c9fc86749a9931aaca7c918470`

---


### Tracking note

During the result commit, git diff --cached --check detected trailing whitespace and an extra blank line at EOF in this Markdown log.
The formatting was cleaned before commit. No experimental data, configuration, hashes, or conclusions were changed.

---
### Frozen-path anomaly

The preregistered q8 score output path accidentally contains a literal backslash before `.jsonl`.
The frozen preregistration contains `qwen3-browser-runtime-q8-feasibility-v1.raw\\.jsonl`, and the generated Git-tracked file therefore also contains that literal backslash.
The file is intentionally not renamed because the experiment is already closed and its frozen output path must remain reproducible.
This naming anomaly does not affect the experimental result or hashes.

---
## 2026-09-19 — qwen3-browser-q8-512-warm-v1

**Status:** preregistered before runtime execution
**Base commit:** `455f71f4fdc0aed5a2c49ed7ef9b11c621ebd93d`
**Preregistration SHA-256:** `553681d80c38d45bb5337f7ec6553511acb56cf83449ffae250d118e3c0342e1`

### Objective

Measure repeated q8 browser execution at exactly 512 total tokens in one WebGPU/model session, separating the first forward from five subsequent warm forwards.

### Frozen plan

- q8 / WebGPU / `onnx/model_quantized.onnx`
- exact input length: `512` tokens
- first forwards: `1`
- measured warm forwards: `5`
- total forwards: `6`
- same browser session and same loaded model
- no reload between runs
- synthetic input only
- no ranking holdout
- no human labels
- no latency threshold in the primary gate
- primary gate requires `6/6` successful finite scores with no runtime exception

### Methodological boundary

This is a runtime/stability experiment only. It cannot establish ranking quality or production suitability. A successful result may only authorize a separately preregistered development ranking experiment.

---
### Runner implementation — q8-512-warm-v1

**Implementation base commit:** `b85f42c4d8f3a8694ed0c4ffeaf21e9cd6dd1192`
**Runner SHA-256:** `391e948592a9ef426f49953158a6970fdb1296c1a41040e6c1bc5ef4664f7516`
**Test SHA-256:** `1461680e3ffa4785fa9df04566645b7b748333cf9c7648462a6b5c19a5b0adfc`

The experiment reuses the already frozen `scripts/benchmark/qwen3/q8_feasibility_browser.js` browser scorer unchanged. A new Node orchestration runner derives exactly six 512-token cases: one first forward and five warm forwards, all inside the same browser page and loaded model session.

The runner records first-forward latency, all five warm latencies, warm minimum/maximum/mean/median, and score repeatability. Latency remains observational and is not a pass/fail criterion.

Preflight and the complete repository test suite were run before any experimental inference. No model inference, ranking holdout access, human-label access, or production change occurred during runner construction and preflight.

---
### Result — q8-512-warm-v1

**Runner commit:** `f30e0de15e18363acf9273b746909eb51363b3d7`
**Status:** `passed`
**Primary gate:** `6/6` successful runs — PASS

### Observed runtime

- first forward: `58507.320 ms`
- warm runs: `5`
- warm minimum: `30391.795 ms`
- warm maximum: `40624.465 ms`
- warm mean: `35420.551 ms`
- warm median: `35701.920 ms`
- score range: `0`
- all six identical-input scores identical: `true`

### Interpretation

The preregistered runtime/stability gate passed. q8 WebGPU repeatedly executed the exact 512-token synthetic input six times in one loaded browser/model session without a runtime error.

Warm execution was faster than the first forward, but observed warm latency remained approximately 30–41 seconds per forward on the tested environment. Because latency had no preregistered threshold, this does not change the PASS result. Interactive production suitability has not been established.

This experiment does not establish ranking quality. No ranking holdout, human labels, or production ranking were used.

### Frozen artifacts

- `benchmark/qwen3/browser/q8-512-warm/reports/qwen3-browser-q8-512-warm-v1.report.json`
- `benchmark/qwen3/browser/q8-512-warm/scores/qwen3-browser-q8-512-warm-v1.runs.jsonl`
- report SHA-256: `14cd4da681cd17aa2df3c5c583682999a06fc041bc75355780690d3b9fa06ae9`
- runs SHA-256: `912d2570bd630661bbbc5d6ecb9755be1a3765e9cb0658b4087f67eab05cc478`

### Tracking note

The first attempt to write this result entry aborted before modifying the log because shell quoting transformed a dictionary-key expression inside the Python command and produced `NameError: name status is not defined`. The experimental outputs were not changed or rerun.

### Next methodological step

The preregistered success policy permits a separate development-only 512-token ranking-quality experiment. That experiment must be preregistered independently and must not reuse the already-observed ranking holdout as a fresh validation set.

---
