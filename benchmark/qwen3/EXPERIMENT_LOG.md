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
