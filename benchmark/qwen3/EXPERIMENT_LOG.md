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
## 2026-09-19 — qwen3-ranking-512-development-v1

**Status:** preregistered before inference
**Base commit:** `8c530d4be73ec4dff086c25fd7220c9402fa92ce`
**Preregistration SHA-256:** `dc68ff205aceecd2972b0fdcce4d906c9e190e0d3b51bb77dbb4a93d97054eb8`

### Objective

Test whether changing only Qwen maximum sequence length from 4096 to 512 preserves the validated development ranking behavior.

### Frozen comparison

- same `Qwen/Qwen3-Reranker-0.6B`
- same model revision
- same instruction
- same 1000 query-document development pairs
- same 50 queries × 20 documents
- same MPS / float16 scoring implementation
- reference max length: `4096`
- candidate max length: `512`
- no threshold
- no score blending
- no new retrieval
- no human labels during inference
- no fresh holdout access

### Primary gate

Exact Top-10 membership equality for all `50/50` development queries.

The candidate must finalize all 1000 new scores before the frozen 4096 reference scores are used for comparison.

### Methodological boundary

This experiment isolates truncation only. Passing it would not establish q8/browser parity, browser performance, fresh validation, or production suitability.

---
### Implementation inspection — qwen3-ranking-512-development-v1

**Commit inspected:** `b4a777a4d506622acab9599624cb7e98b0068c29`

Before implementing 512-token candidate inference, the existing Python Qwen inference engine, adapter, package scripts, and ranking inference manifests were inspected read-only so the new experiment can reuse the validated MPS/float16/singleton machinery instead of duplicating it.

No model inference was executed, no reference scores were read for comparison, and no production files were changed during this inspection.

---
### Candidate implementation — qwen3-ranking-512-development-v1

**Implementation base commit:** `b4a777a4d506622acab9599624cb7e98b0068c29`
**Inference manifest SHA-256:** `73144aa390221746efe2e97ff767813235ac01a88d22b1f7fe3a06154a99ffa6`
**Preflight SHA-256:** `6fe7e95ee8e987a31b969d3621aec5c7eed5592162456ca67db7962a04ac5860`
**Test SHA-256:** `bab052058f562e449411f35783bb807f051886c434e50193b025cd19df5e76c2`

The existing validated Python/MPS inference engine is reused unchanged. The candidate manifest preserves the frozen model, revision, instruction, 1000-pair development dataset, scoring version, and MPS singleton strategy. The intended scoring-semantic change is only `max_length: 4096 -> 512`.

Candidate raw score, metadata, and cache paths are isolated from the frozen 4096 reference artifacts. The official command explicitly fixes `--device mps` and `--dtype float16`.

The repository test suite and isolated preflight passed before candidate inference. The preflight did not read the 4096 reference scores, load the model, execute inference, access the ranking holdout, use human labels, or change production.

During the earlier read-only implementation inspection, a zsh glob for `benchmark/qwen3/ranking/**/*inference*.json` produced `no matches found`; no inference or artifact mutation occurred. The relevant inference manifest was then inspected explicitly.

---
### Official inference — qwen3-ranking-512-development-v1

**Runner/config commit:** `c8e26d5bd3cf0753f84ed5936ffccf4817f90e0a`
**Status:** completed
**Rows:** `1000/1000`
**Raw SHA-256:** `45e236befd52e438acc46825e2b6a8ac523462ce4cc6dbdb45759f8da0366d23`
**Metadata SHA-256:** `6fb8ac5a7a9d28f58dc8cfea66a710556c00dd4614ddf45d20a3802e500d5008`

### Runtime configuration

- model: `Qwen/Qwen3-Reranker-0.6B`
- revision: `e61197ed45024b0ed8a2d74b80b4d909f1255473`
- max length: `512`
- device: `mps`
- dtype: `float16`
- batch size: `2`
- MPS model strategy: singleton forwards
- cache hits: `0`
- fresh scores: `1000`
- elapsed seconds: `495.411684083`

### Boundaries

The complete 512-token candidate score set was finalized before comparison with the frozen 4096-token reference. Human labels were not used as model input and production ranking was not changed.

The 4096 reference must remain unopened for comparison until these 512 candidate scores are frozen in Git.

---
### Comparison implementation — qwen3-ranking-512-development-v1

**Date:** `2026-09-19`
**Implementation base commit:** `c4f130d8f2cb3ae9c06cd8b9073e760447e3485a`
**Analyzer SHA-256:** `94e9b765c6f8a9cb777edfa7d2a60daded15486a72ae879a71d4ed2caac70a16`
**Test SHA-256:** `71d84adfbc2d3a767b7f7c7f721dc2fe8dac8311a3cb1d80155e5816b7856666`

### Action

Implemented the frozen 512-vs-4096 development comparison after the complete 512 score set had already been committed. The analyzer verifies the frozen preregistration, 512 candidate scores, 4096 reference scores, candidate metadata, and original production pool by SHA-256 before analysis.

### Configuration

- candidate max length: `512`
- reference max length: `4096`
- same 1000 query-document pairs
- 50 queries x 20 documents
- ranking: raw score descending
- exact score tie-break: original production rank ascending
- primary gate: exact Top-10 membership equality on `50/50` queries

### Secondary metrics

Top-5 membership equality, Top-10 overlap and symmetric difference, mean/max absolute rank shift, same-rank count, Pearson score correlation, and Spearman score correlation.

### Implementation note

The first repository test run failed before executing the new analysis tests because the analyzer CLI footer ran during ES-module import and raised `expected --preflight or --run`. No comparison was executed and no reports were created. The analyzer was then guarded so CLI dispatch runs only when the module is invoked directly. The full test suite and comparison preflight were rerun successfully afterward.

### Boundary

No human labels, fresh holdout, new model inference, or production ranking changes are involved. Comparison metrics have not yet been executed.

### Decision

Freeze the corrected analyzer and tests before executing the official comparison once.

### Next step

After the implementation commit, execute the frozen comparison once and record the preregistered gate result without tuning against it.

---
### Official comparison result — qwen3-ranking-512-development-v1

**Date:** `2026-09-19`
**Frozen result commit:** `f7b9fde759ba0da677b2a25162becf67358ac0c6`
**Status:** `FAILED`
**Report SHA-256:** `267d64c31b79310444377051810b571277357f5c5a3760706d7312089fe81aaa`
**Markdown SHA-256:** `fafb76fce5adb25199198548f4c8aa72944dfdc71f031b65e57bc75db9eae421`

### Primary gate

Exact Top-10 membership equality was `44/50` development queries. The preregistered requirement was `50/50`; therefore the gate failed.

### Secondary observations

- Top-5 membership equal: `44/50`
- Top-10 membership equal: `44/50`
- Top-10 changed queries: `6/50`
- Top-10 symmetric-difference memberships: `12`
- Mean Top-10 overlap: `9.88`
- Minimum Top-10 overlap: `9`
- Mean absolute rank shift: `0.17`
- Maximum absolute rank shift: `8`
- Same-rank documents: `870/1000`
- Pearson score correlation: `0.9986107663826347`
- Spearman score correlation: `0.9986620602308067`

### Interpretation

Reducing the original Python Qwen maximum sequence length from 4096 to 512 preserved most development ranking behavior but did not satisfy the preregistered exact Top-10 equivalence criterion. Six queries changed Top-10 membership and the twelve symmetric-difference memberships correspond to one membership swap in each changed query.

This is a structural-equivalence failure, not evidence that the 512-token ranking has worse relevance quality. Human relevance labels were not used in this comparison.

### Logging incident

The first attempt to append this result to `EXPERIMENT_LOG.md` failed with a Python `NameError` caused by shell quoting inside the one-line logging command. The failure occurred only while writing the log: the frozen comparison reports were unchanged and were subsequently committed as `f7b9fde`. The comparison was not rerun.

### Decision

Close `qwen3-ranking-512-development-v1` as a failed preregistered equivalence experiment. Do not retune the 512-token candidate against these observed development results, do not use the fresh ranking holdout to rescue or reinterpret the result, and do not automatically proceed to browser q8 quality evaluation on the basis of this candidate.

### Next step

Any alternative context limit or browser-ranking candidate requires a separately preregistered development experiment before its outputs are observed. The frozen fresh 500-pair ranking holdout remains untouched by this experiment.

---
## 2026-09-19 — qwen3-ranking-1024-development-v1

**Status:** preregistered before inference
**Base commit:** `4761c7a099f7e6b968e89495ba5ab9063e27b466`
**Preregistration SHA-256:** `9101210b49f8cdf8c90b7c8f9caa4b650a9f154bd692c3ce1e180e16f3bffb6b`

### Objective

Test whether `max_length=1024` preserves the frozen 4096-token Qwen3 development ranking under the same strict exact Top-10 membership criterion.

### Adaptive development provenance

This experiment is intentionally development-adaptive. It was selected after the closed 512-token experiment failed its preregistered gate with aggregate result `44/50`. The identities and contents of the six changed queries have not been inspected for selecting or configuring 1024, and no 1024 candidate scores have been generated or observed before this preregistration.

### Frozen plan

- same `Qwen/Qwen3-Reranker-0.6B`
- same model revision and frozen instruction
- same 1000 development query-document pairs
- same 50 queries x 20 documents
- same MPS / float16 / singleton scoring implementation
- reference max length: `4096`
- candidate max length: `1024`
- ranking: raw score descending
- exact-score tie break: production rank ascending
- no threshold
- no score blending
- no retrieval rerun
- no human labels during inference
- no fresh ranking holdout access

### Primary gate

Exact Top-10 membership equality on all `50/50` development queries.

The complete 1000-score 1024 candidate must be finalized and frozen before comparison against the 4096 reference.

### Failure policy

A failure is frozen as observed. The 1024 candidate will not be tuned against the result and the fresh ranking holdout will not be used to rescue or reinterpret it. Any alternate context length requires another preregistration.

### Success policy

A pass establishes only development structural equivalence for this frozen pool. Browser q8 runtime, numerical parity, ranking parity, fresh validation, and production suitability would each require separate evidence.

### Next step

Freeze this preregistration in Git before implementing or executing 1024-token candidate inference.

---
