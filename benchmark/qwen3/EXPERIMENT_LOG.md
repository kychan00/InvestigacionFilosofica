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
