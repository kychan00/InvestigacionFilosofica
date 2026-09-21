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
### Candidate implementation — qwen3-ranking-1024-development-v1

**Implementation base commit:** `71cbe7e14b5e260ca1351d7a853602e3dd949599`
**Inference manifest SHA-256:** `57fbe1c8200d49093a9c54d357be56565b058de0dcf819aaa0450afc27f17df2`
**Preflight SHA-256:** `b78d412e29c8700fecef4a13b403f8a7441341d567a8f12c4c76a6bc42089ede`
**Test SHA-256:** `4c699e4a15c5d6da58c378e19bf54781b03fa48f2fa43a84a925218251fe2c0c`

The validated Python/MPS inference engine is reused unchanged. The candidate preserves the frozen model, revision, instruction, 1000-pair development dataset, scoring version, and MPS singleton strategy. The intended scoring-semantic change relative to the 4096 reference is only `max_length: 4096 -> 1024`.

Candidate raw score, metadata, and cache paths are isolated from both the frozen 4096 reference and the closed 512 experiment. The official command explicitly fixes `--device mps` and `--dtype float16`.

### Implementation incident

The first repository test run produced `191/192` passing tests because the newly copied 1024 test still looked up the existing `benchmark:qwen3:ranking:512-development:infer` npm script key. The 1024 manifest and preflight were already correct, and the preflight completed with no model execution. The stale test key was corrected to the 1024 command and the full suite and preflight were rerun before freezing this implementation.

No 1024 model inference or score observation occurred during implementation or testing. The fresh ranking holdout was not accessed, human labels were not used, and production was not changed.

### Decision

Freeze the corrected 1024 inference implementation before beginning the official 1000-pair candidate run.

### Next step

Run the frozen 1024 candidate once. Finalize and commit all 1000 candidate scores before comparison against the 4096 reference.

---
### Official inference — qwen3-ranking-1024-development-v1

**Frozen score commit:** `e6aa25d997ad1f7b772e71ccad2f744f6a0de7c2`
**Status:** completed
**Rows:** `1000/1000`
**Raw SHA-256:** `93618268d803c7221a116f07c5b65886f7d0e7881e7c9085eba65eb20d6d49b7`
**Metadata SHA-256:** `e7772d7bdf550b7d0572ed2b02a0ecafaa624b333f2ce2d0b32063d4c2d7c1f7`

### Runtime configuration

- model: `Qwen/Qwen3-Reranker-0.6B`
- revision: `e61197ed45024b0ed8a2d74b80b4d909f1255473`
- max length: `1024`
- device: `mps`
- dtype: `float16`
- batch size: `2`
- MPS model strategy: singleton forwards
- cache hits: `0`
- fresh scores: `1000`
- elapsed seconds: `2324.748376583`

### Structural validation

The finalized artifact contains 1000 unique `(query_id, record_id)` pairs across 50 queries with exactly 20 records per query. All rows use the expected `qwen3-score-v1` schema and finite raw probabilities in `[0,1]`.

### Post-inference validation incidents

The first structural-validation command incorrectly assumed a `document_id` field and raised `KeyError: document_id`. The actual score contract uses `record_id`, matching the closed 512-token artifact. Validation was repeated successfully without rerunning model inference.

The first attempt to append this inference result to `EXPERIMENT_LOG.md` then failed with a Python `NameError` caused by shell quoting around dictionary-key expressions. The raw scores and metadata had already been generated and were unchanged. They were frozen in Git as commit `e6aa25d`; the model was not rerun.

### Boundaries

The complete 1024-token candidate was finalized and committed before any official comparison with the frozen 4096-token reference. No human labels were used as model input, the fresh ranking holdout was not used, and production ranking was not changed.

### Decision

Treat commit `e6aa25d` as the frozen 1024 candidate score set. Do not alter or rerun those scores before comparison.

### Next step

After this audit-log commit, implement and freeze the preregistered 1024-vs-4096 comparison analyzer before executing the gate once.

---
### Comparison implementation — qwen3-ranking-1024-development-v1

**Date:** `2026-09-20`
**Implementation base commit:** `58631266d215148312f67c2682e264523262909a`
**Analyzer SHA-256:** `7be43888388d5ff8f82dab56958f52104bdae55112e5cb523f98bbf9bd450066`
**Test SHA-256:** `9f138ca0ef15bc0268b0d2277e3a05ccd345a99eff2ec993f42fcb12a07f04c1`

### Action

Implemented the frozen 1024-vs-4096 development comparison only after the complete 1024 candidate score set had already been finalized and committed. The analyzer verifies the preregistration, 1024 candidate scores, candidate metadata, frozen 4096 reference scores, and original production pool by SHA-256 before analysis.

### Configuration

- candidate max length: `1024`
- reference max length: `4096`
- same 1000 query-document pairs
- 50 queries x 20 documents
- ranking: raw score descending
- exact-score tie break: original production rank ascending
- primary gate: exact Top-10 membership equality on `50/50` queries

### Secondary metrics

Top-5 membership equality, Top-10 overlap and symmetric difference, mean/max absolute rank shift, same-rank count, Pearson score correlation, and Spearman score correlation.

### Verification

The repository test suite passed `197/197`. The comparison preflight verified all frozen artifact hashes and completed with `comparison_executed: false`. No report files exist yet.

### Boundaries

No human labels, fresh ranking holdout, new model inference, browser q8 inference, or production ranking changes are involved in this implementation step.

### Decision

Freeze the comparison analyzer and tests before executing the official preregistered gate once.

### Next step

After the implementation commit, execute the frozen 1024-vs-4096 comparison once and preserve the result without tuning against it.

---
### Official comparison result — qwen3-ranking-1024-development-v1

**Date:** `2026-09-20`
**Analyzer commit:** `164cdb3d688921d18f19f91a52b252d601a3e942`
**Status:** `PASSED`
**Report SHA-256:** `fa9ad9d39a85944d873002710d9fa45de15c50a1de4fae43324b2a9847b959de`
**Markdown SHA-256:** `6cadaa70e34abeff89e4ad96594948919236b40135b4ebe4a0f97c26ed77148a`

### Primary gate

Exact Top-10 membership equality was `50/50` development queries. The preregistered requirement was `50/50`; therefore the gate passed.

### Secondary observations

- Top-5 membership equal: `48/50`
- Top-5 changed queries: `2/50`
- Top-5 symmetric-difference memberships: `4`
- Top-10 membership equal: `50/50`
- Top-10 changed queries: `0/50`
- Top-10 symmetric-difference memberships: `0`
- Mean Top-10 overlap: `10`
- Minimum Top-10 overlap: `10`
- Mean absolute rank shift: `0.02`
- Maximum absolute rank shift: `5`
- Same-rank documents: `986/1000`
- Pearson score correlation: `0.9992102080368596`
- Spearman score correlation: `0.9998963645450404`

### Interpretation

The 1024-token candidate satisfied the preregistered structural-equivalence criterion for Top-10 membership on the frozen development pool. All 50 queries retained exactly the same Top-10 document membership as the 4096-token reference.

This does not imply complete ranking or score identity. Two queries changed Top-5 membership and some documents shifted internal rank positions, while Top-10 membership remained invariant.

### Boundaries

This is a development-only truncation result. No human relevance labels, fresh ranking holdout, new model inference, browser q8 inference, or production ranking changes were part of the comparison.

### Decision

Close `qwen3-ranking-1024-development-v1` as a successful preregistered Top-10 structural-equivalence experiment. Freeze the observed result without further tuning against this development pool.

### Next step

Any browser q8 experiment at 1024 tokens must be separately preregistered. Passing this experiment does not establish browser runtime feasibility, numerical parity, browser ranking parity, fresh validation, or production suitability.

---
### Preregistration — qwen3-browser-q8-1024-feasibility-v1

**Date:** `2026-09-20`
**Base commit:** `5bbb0b714e86b57e517a17e1c344b89d1a1963d7`
**Preregistration SHA-256:** `9708b84836744bb1e4b40f0427ae9859386f76ecd66608d94bc10bde1bd4fb76`

### Purpose

Test runtime feasibility and repeatability of the frozen q8 WebGPU browser candidate at exactly `1024` total tokens before any browser ranking-parity experiment.

### Selection provenance

This is an adaptive runtime-development experiment. Exact 512-token q8 execution previously passed and exact 2048-token q8 execution previously failed at runtime. Separately, Python/MPS at max length 1024 passed the preregistered development Top-10 structural-equivalence gate versus 4096. No q8 1024 output was observed before this preregistration.

### Frozen gate

Use one browser/model session with one first forward followed by five warm forwards over the identical synthetic exact-1024-token input. PASS requires all `6/6` forwards to complete, remain q8/WebGPU, and produce finite scores in `[0,1]`. There is no latency threshold; latency is observational only.

### Boundaries

No ranking development pool, fresh ranking holdout, human labels, frozen Python reference scores, browser ranking-quality evaluation, or production changes are part of this experiment.

### Next step

Freeze a dedicated runner and tests before executing this runtime experiment once.

---
### Runner implementation — qwen3-browser-q8-1024-feasibility-v1

**Date:** `2026-09-20`
**Implementation base commit:** `0a294a33ce5707dd9d1e60346fef455bac214e2d`
**Runner SHA-256:** `dad6a75102cbb395398497ca6b3feb0b0d77eb05dbc9443e1323782c0b747eb8`
**Test SHA-256:** `5f64287b3112ca6507166871a1dea23fe5c5a8be5d08ac23a118696e5984b7e3`

### Implementation

The dedicated exact-1024 runner reuses the already frozen browser-only q8/WebGPU scorer and the one-session first-plus-five-warm execution structure from the closed 512-token stability experiment. The shared browser scorer itself was not modified.

The runner pins preregistration SHA-256 `9708b84836744bb1e4b40f0427ae9859386f76ecd66608d94bc10bde1bd4fb76`, exact total length `1024`, q8, WebGPU, one first forward, five warm forwards, and a `6/6` finite-score gate with no latency threshold.

The runner additionally enforces exclusion of the ranking development pool, fresh ranking holdout, human labels, and frozen reference Qwen scores.

### Verification

The complete repository test suite and dedicated preflight passed before runtime execution. The planned report and run artifacts remained absent after preflight.

### Boundaries

No WebGPU model forward was executed during implementation/preflight, no ranking data were accessed, and production was not changed.

### Decision

Freeze the dedicated 1024 q8 runtime runner before the single official execution.

### Next step

After this implementation commit, perform a final preflight from the frozen runner commit and execute the preregistered exact-1024 six-forward runtime experiment once.

---
### Official runtime result — qwen3-browser-q8-1024-feasibility-v1

**Date:** `2026-09-20`
**Runner commit:** `99af8706218f3a577251520c1151443dc64728f4`
**Status:** `PASSED`
**Report SHA-256:** `2d666c704eb30ec2b0327f2c769083cbdbf9e70102cea6cdf7ce01435a4ff53a`
**Runs SHA-256:** `054783b30a1ee3814f8ff34edfa949e4292bfb253957e821230a36b3c510daa0`

### Primary gate

The exact-1024 q8/WebGPU runtime experiment completed all `6/6` preregistered forwards successfully in one browser/model session. Every constructed input contained exactly `1024` total tokens, all scores were finite and in `[0,1]`, execution remained browser/WebGPU, dtype remained q8, and no fallback adapter was used.

### Score repeatability

All six forwards returned the identical raw score `0.10684293458965702`. Observed score range was `0`.

### Runtime observations

- first forward: `174447.55499994755` ms
- warm minimum: `207968.79000002146` ms
- warm maximum: `270688.4649999738` ms
- warm mean: `226335.44999998808` ms
- warm median: `219678.75999999046` ms
- total experiment elapsed: `1413385` ms

Latency was observational only and had no preregistered pass/fail threshold.

### Boundaries

This result establishes synthetic runtime feasibility and repeatability for the frozen q8 WebGPU candidate at exactly 1024 tokens on this browser/runtime configuration. It does not establish numerical parity with Python, ranking parity on real documents, fresh validation, human relevance quality, or production suitability. The ranking holdout and human labels were not accessed, and production was not changed.

### Decision

Close `qwen3-browser-q8-1024-feasibility-v1` as a successful preregistered runtime-feasibility experiment. Do not rerun or tune this frozen experiment after observing the result.

### Next step

A separate preregistered experiment may now test browser q8 versus the frozen Python-1024 reference on development ranking data. That future experiment must define its numerical/ranking parity gates before browser scores are observed.

---
### Preregistration — qwen3-browser-q8-1024-parity-pilot-v1

**Date:** `2026-09-20`
**Base commit:** `ea2cc19069ab5f9fc33aa7f22fa9977b78894ea0`
**Dataset SHA-256:** `8e9490479af6c6d01491e8053ea17f580ae41af9df42048b508be56feb178185`
**Python-1024 reference subset SHA-256:** `089fd2b2399d162e14e2a14b263133f49e90d014d35dc8929deb03ea5e7a3f20`
**Preregistration SHA-256:** `80cc612a0cd7760c14f0b3185374592941873bba3489f4664973eb99aa215a8f`

### Purpose

Development-only browser parity pilot for q8/WebGPU at max length `1024` against the frozen Python/MPS float16 1024-token reference.

### Frozen selection

Five complete 20-document query groups were selected deterministically by SHA-256 ordering of `query_id` under seed `qwen3-browser-q8-1024-parity-pilot-v1`, before any q8 ranking scores were observed: `es-10`, `de-01`, `en-03`, `es-08`, `en-08`. Total: `100` pairs.

Selection did not use query contents, human labels, browser scores, or Python score values.

### Primary gate

PASS requires exact Top-10 membership equality between browser q8 and frozen Python-1024 on all `5/5` selected queries. Exact-score ties use original production rank. No thresholds or score blending are permitted.

### Boundaries

This is adaptive development, not fresh validation. The fresh ranking holdout and human labels are excluded. A pilot PASS does not authorize production changes and does not establish production suitability.

### Next step

Implement and freeze a dedicated q8/WebGPU 1024 pilot runner and tests before executing any browser score on these 100 pairs.

---
### Pre-inference correction — qwen3-browser-q8-1024-parity-pilot-v1

**Date:** `2026-09-20`
**Correction base commit:** `6e4aaf112796f3c1dc11e6ff26f815e45a460b9f`
**Corrected dataset SHA-256:** `8fa7c38f4ee6e5dc4c2b8a140b13ce8152b9836922f79ab89a06ef833b2b9e01`
**Corrected Python-1024 reference subset SHA-256:** `52d3dc847f2faa124d395effa6d6a8864b0e683ee17b499a0c6a7bac6714b708`
**Corrected preregistration SHA-256:** `a2dd96d0be79ccfe4da67ba4b0f09e2740b06646595170c0bf2d626ec5740c19`

### Issue discovered

The initial frozen pilot artifacts contained the correct five selected query groups and exactly the correct 100 unique query-document pairs, and the dataset/reference pair sequences were identical. However, the physical query-group order in the pilot dataset preserved source-dataset order rather than the already frozen SHA-256 selection order.

### Correction

Before any browser q8 score was observed, the dataset was regenerated in the exact preregistered selection order: `es-10`, `de-01`, `en-03`, `es-08`, `en-08`. The Python-1024 reference subset was regenerated to follow that identical pair order, and the preregistration hashes were updated accordingly.

### Invariants

Selection membership did not change. The five query IDs did not change. Each query still contains exactly 20 documents. The primary gate remains exact Top-10 membership equality on `5/5` queries. No thresholds, blending, holdout access, human labels, or production behavior changed.

### Contamination boundary

No browser q8 ranking score had been generated before this correction. Therefore this is a pre-inference artifact-order correction, not tuning against observed browser results.

### Next step

Freeze this correction before implementing the dedicated browser parity pilot runner.

---
### Pre-inference prompt-contract completion — qwen3-browser-q8-1024-parity-pilot-v1

**Date:** `2026-09-20`
**Previous preregistration commit:** `71f1e15`
**Completed preregistration SHA-256:** `5c4fd21aa9414048fe6c045350a773d661e316c902c13a225cc28ba5a976a79b`

### Issue discovered

During dedicated runner implementation, the reused parity core was found to enforce the exact system prefix and suffix used by the frozen Qwen3 prompt construction. The pilot preregistration already froze the instruction, content format, truncation rule, and score formula, but omitted explicit `system_prefix` and `system_suffix` fields.

### Completion

Before any browser q8 pilot score was generated, the preregistration was completed with the exact already-established system text, prefix, and suffix used by the browser and Python parity contract.

### Invariants

No query selection, dataset pair, Python reference score, model artifact, dtype, max length, ranking rule, or primary gate changed. The pilot remains `100` development pairs across `5` complete queries with a `5/5` exact Top-10 membership gate.

### Contamination boundary

No browser q8 pilot score, checkpoint, report, metadata, or result log existed when this prompt-contract completion was made. This change therefore completes preregistration metadata before inference rather than adapting to observed results.

### Next step

Freeze this completed preregistration, then continue implementation and preflight of the dedicated browser runner.

---
### Implementation freeze — qwen3-browser-q8-1024-parity-pilot-v1

**Date:** `2026-09-20`
**Implementation base commit:** `8b46322e5ea2490a16a8e695b85a906e86315080`
**Preregistration SHA-256:** `5c4fd21aa9414048fe6c045350a773d661e316c902c13a225cc28ba5a976a79b`
**Core SHA-256:** `efeaeac205d74dfa05912b284cb6999f8ce5471728db68c6561c75d5f070db31`
**Browser scorer SHA-256:** `06d6ecb076113f2e2d77a47499a8f60e8d600ca49b34bc54dd6654e9f536b97c`
**Runner SHA-256:** `6389334987ee90c84a9995d35b55f39e7dec9711d7c6d5edeaa58eb51fac77ca`
**Test SHA-256:** `b31a0a403b91df3c58ce7a7b2ae2145735adef34330257ccecff7884a3470eb5`
**package.json SHA-256:** `5fcfb383f5f928a1dfc049847e83fe3d6fd91d2e728ac053f76a8202f0df880c`
**Browser bundle SHA-256:** `10331143893127b266366568631b4d50ea8867c2be2ee1ab790f2627aee9f39f`

### Implementation

A dedicated development-only browser parity pilot runner was implemented for the frozen `100`-pair, `5`-query subset. The browser candidate is fixed to q8, WebGPU only, max length `1024`, one-logit-position scoring with `num_logits_to_keep=1`, and logits-only ONNX output retrieval. The runner consumes only the frozen pilot dataset and frozen Python-1024 reference subset.

Diagnostic browser scoring is forbidden. The runner pins the completed preregistration SHA-256 and permits only the preregistered official `--run` path for model execution. Checkpointing remains available solely to resume the same frozen official execution after process interruption.

### Verification

The complete repository test suite passed `205/205`. Dedicated preflight passed with dataset `100` rows, the frozen dataset/reference/instruction hashes, Transformers.js web export, one onnxruntime-web input, and zero forbidden Node backend inputs. Preflight reported `inference_executed=false` and `model_downloaded=false`.

### Boundaries

No browser q8 pilot score has been generated. No checkpoint, final browser score file, metadata, parity report, or result log exists. Fresh holdout data, human labels, and production behavior remain outside this development pilot.

### Decision

Freeze this implementation before the single official browser execution. Do not modify the preregistration, dataset, Python reference subset, scoring semantics, ranking gate, or implementation after browser scores are observed.

### Next step

From the frozen implementation commit, perform one final no-inference preflight and then execute the preregistered official browser q8 parity pilot once.

---
