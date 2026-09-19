# Codex Project Context — Investigación Filosófica

This document is the long-form project handoff for agents working on `kychan00/InvestigacionFilosofica`.

Read `/AGENTS.md` first. This file gives the detailed history, frozen experiment lineage, product constraints, benchmark semantics, and current state.

---

## 1. Project identity and purpose

**Investigación Filosófica** is an academic philosophy search engine and experimentation platform.

Repository:

`kychan00/InvestigacionFilosofica`

Production GitHub Pages:

`https://kychan00.github.io/InvestigacionFilosofica/`

Typical local path:

`~/filosofia/web`

Do not confuse this repository with:

`~/Developer/philosophia`

They are separate projects.

The user built this project as part of a philosophy-research workflow. The goal is a useful academic search experience for philosophy, with particular attention to multilingual search, conceptual relevance, interdisciplinary queries, local UdeG/CUCSH sources, and reproducible ranking experiments.

---

## 2. Product architecture

The deployed application is browser-first and hosted on GitHub Pages.

The project does not currently rely on its own production backend/database for the main search experience.

Important properties:

- static GitHub Pages deployment;
- federated retrieval from external scholarly/library sources;
- browser-side normalization, parsing, deduplication, and ranking;
- no project-owned persistent search-history service;
- no project-owned credential database for users;
- no production AI server;
- deterministic non-AI ranking remains the fallback and current production behavior.

The project intentionally separates:

1. **retrieval** — which documents become candidates;
2. **production ranking** — the hand-engineered deterministic ranker;
3. **experimental reranking** — currently Qwen3, applied only to a frozen Top-20 candidate pool during evaluation.

The Qwen experiments were designed to avoid conflating better retrieval with better reranking.

---

## 3. Main search sources

Sources currently represented in the search project include:

- OpenAlex
- Crossref
- Internet Archive
- Biblioteca UdeG / institutional material
- CUCSH philosophy content
- Protrepsis
- Quadripartita Ratio

The CUCSH work was specifically intended to expose metadata from philosophy journals so searches can retrieve local academic material quickly.

The project includes source-specific normalization, deduplication, institutional search generation, language handling, and source priors.

---

## 4. Production query processing

The parser and expander recognize philosophy-specific semantics such as:

- philosophers;
- works;
- concepts;
- multilingual aliases;
- explicit interdisciplinary domains;
- work-oriented queries;
- philosopher + concept queries.

Multilingual behavior was developed around Spanish, English, German, French, and Portuguese.

Examples of benchmark concepts/families used over time include:

- Kant + freedom
- Heidegger + Being and Time
- Aristotle + virtue
- Husserl + intentionality
- Levinas + alterity
- Spinoza + substance
- Dussel + liberation
- Hegel + Phenomenology of Spirit
- phenomenology + nursing
- ontology + computer science

Later fresh families used for Qwen ranking validation were deliberately different:

- Nietzsche + eternal recurrence
- Aquinas + natural law
- Plato + Republic
- feminist epistemology + science
- philosophy of language + linguistics

The project has tests to prevent common multilingual/parser regressions, including confusing `ética` with `estética`, translating ontology-computing queries incorrectly, and dropping unknown qualifiers from multi-concept queries.

---

## 5. Production ranking lineage

Historical production baseline:

`total = Q*.28 + P*.30 + D*.20 + S*.10 + B*.08 + I*.04 - penalty`

The exact implementation lives in production ranking code, primarily `src/core/rank.js` and related modules.

### Ranking v2

Ranking v2 introduced restrained source/query heuristics:

- original-query title coverage bonus;
- CUCSH prior;
- Internet Archive prior;
- Crossref penalty only when title coverage is low.

Offline simulation improved over baseline.

The implemented v2 lineage includes historical commits:

- implementation around `ff72e5d...`;
- tests around `2806b8...`;
- real runtime lineage around `e6ad110...`.

The v2 AI-silver evaluation showed improvements across language and intent slices, but remained development evidence.

### Interdisciplinary conjunction

The project later added a moderate adjustment for queries with an explicit philosophy area plus an external domain.

Current rule:

- both sides substantively present in title+abstract: +2
- philosophy-area only: -2
- domain-only: 0
- neither, abstract exists: -1
- neither, no abstract: 0

This behavior was validated on a fresh internal conjunction set and later integrated into production.

Current production base for Qwen ranking experiments:

`bb9689da2016ca26a08359e8655eca7a5b771937`

Do not alter these production ranking mechanics during the browser-parity phase.

---

## 6. Benchmark baseline

The original multilingual benchmark contains 50 queries:

- 10 Spanish
- 10 English
- 10 German
- 10 French
- 10 Portuguese

It covers 10 semantic families × 5 languages.

Intent distribution:

- 30 philosopher-concept
- 10 work
- 10 interdisciplinary

Human relevance rubric:

- 0 = noise / irrelevant
- 1 = adjacent / related but insufficient
- 2 = relevant
- 3 = highly relevant / central

Binary relevance threshold:

`human_relevance >= 2`

Frozen baseline run:

`benchmark/runs/human-v1.0-1064fdb.jsonl`

Baseline freeze lineage:

`83608ce`

---

## 7. AI silver history

The project built an automated multilingual silver standard before Qwen.

Important terminology:

**Never call this human gold.**

Use:

- AI-assisted judgments;
- silver standard;
- AI-judged relevance.

Historical models:

- NLI: `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli`
- reranker: `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`

Historical silver baseline included 1000 judged pairs.

Approximate frozen baseline metrics included:

- P@5 .444
- P@10 .434
- pool Recall@10 .5642
- nDCG@10 .5466
- MRR@10 .7064

A ranking-v2 silver run improved these metrics.

The point of this phase was to support development and diagnosis, not to establish human-ground-truth performance.

---

## 8. Human audit v1

A later blinded human audit covered 100 labels.

This is a **human audit/adjudication**, not a full human-gold benchmark.

The random half showed relatively weak agreement between the historical automated silver and human labels, especially because the AI judge produced many false negatives.

The audit therefore motivated moving toward a stronger Qwen-based relevance/reranking model.

Tracked files include:

- `benchmark/human-audit-v1.sample.jsonl`
- `benchmark/human-audit-v1.judgments.jsonl`

Freeze lineage:

`34d9aec...`

Do not claim the historical silver is validated by this audit.

---

## 9. Multilingual and interdisciplinary validation history

### Multilingual constraints

A frozen experimental retrieval branch:

`retrieval/multilingual-constraints-v1`

freeze:

`15d3564`

A validation branch:

`validation/multilingual-ab-v1`

freeze:

`1b9d4ea`

The multilingual A/B evaluation used 20 queries and showed a positive exact paired change in P@10 based on human review of changed results.

Important caveat:

- the evaluation was internal;
- some family exposure occurred during development;
- do not call it external independent validation.

### Interdisciplinary conjunction

Development branch:

`ranking/interdisciplinary-conjunction-v1`

Fresh validation branch:

`validation/interdisciplinary-conjunction-v1`

The fresh validation used 20 new pairing queries.

Result:

- exact ΔP@10 = +.025
- +5 net relevant changed docs
- improved/worse/tied = 5/2/13

The production conjunction integration eventually landed in the production lineage at:

`bb9689da2016ca26a08359e8655eca7a5b771937`

---

## 10. Qwen3 research objective

The project evaluated:

`Qwen/Qwen3-Reranker-0.6B`

The model was not initially intended to run directly inside GitHub Pages because the reference model is large.

The Qwen program was separated into:

1. offline relevance/classifier validation;
2. offline ranking development;
3. fresh ranking validation;
4. current browser-runtime parity;
5. future production integration only if parity/validation is satisfactory.

The Qwen model must never be used as its own relevance judge when evaluating its ranking.

---

## 11. Frozen Qwen instruction

Exact file:

`benchmark/qwen3/configs/qwen3-reranker-v1.instruction.txt`

Instruction SHA-256:

`5693a9a1377e10eb952d327aeec5c05cbbf040989feb786910b42e17cbf271a7`

The instruction says, in substance:

- retrieve documents that substantively address the complete academic philosophy information need;
- explicit authors, works, concepts, and disciplinary domains are required constraints unless the query says otherwise;
- interdisciplinary results must connect both sides substantively;
- do not reward incidental keyword overlap, journal names, metadata, retrieval provenance, or retrieval variant;
- judge only from query + document content.

Do not edit this instruction during the current integration/parity work.

Any instruction edit means a new experiment and invalidates direct comparison to the frozen validation.

---

## 12. Reference Qwen model and adapter

Reference model:

`Qwen/Qwen3-Reranker-0.6B`

Frozen model revision:

`e61197ed45024b0ed8a2d74b80b4d909f1255473`

Python adapter:

`scripts/benchmark/qwen3/adapter.py`

Reference behavior:

- causal-LM next-token yes/no scoring;
- score is softmax probability of `yes` over the two logits `no` and `yes`;
- max length = 4096;
- exact system prefix/suffix;
- model input consists only of query plus clean document fields;
- no human labels;
- no production ranking score;
- no current rank;
- no provider identity;
- no retrieval provenance;
- no A/B condition.

Scoring version:

`qwen3-yes-no-softmax-v1-mps-singleton`

On Apple MPS, padded multi-item fp16/bfloat16 forwards produced non-finite outputs in local validation, so the validated adapter uses singleton model microbatches while keeping the model loaded.

---

## 13. Qwen development calibration

A 100-row development dataset was frozen from historical human-audit material.

Development calibration results were strong:

- ROC AUC ≈ .9208
- AP ≈ .9340
- Spearman ≈ .724

A development-selected binary threshold:

`0.679178715`

Development F1:

≈ .8908

This threshold was frozen before the classifier holdout and must not be retuned using holdout labels.

This threshold is relevant to the classifier-validation experiment but **not used in the ranking experiment**, which sorts continuous raw Qwen scores.

---

## 14. Fresh Qwen classifier holdout

A separate fresh classifier holdout used 20 new multilingual queries covering:

- Descartes mind-body dualism
- Rawls justice as fairness
- Wittgenstein Tractatus
- philosophy of mind + psychology

100 pairs were audited.

Frozen threshold:

`0.679178715`

Fresh classifier holdout result:

- accuracy .83
- precision ≈ .9701
- recall .8125
- specificity .9
- F1 ≈ .8844
- balanced accuracy ≈ .8563
- kappa ≈ .5729
- ROC AUC .90625
- AP ≈ .9780

The weakest family was philosophy of mind + psychology.

This validated Qwen score/classification behavior on sampled candidates.

It did **not** validate end-to-end ranking metrics such as P@10, MRR, or nDCG.

Report freeze:

`86c7fe2`

---

## 15. Qwen ranking development

Branch:

`ranking/qwen3-reranker-v1`

Policy was preregistered before ranking evaluation:

- A = existing production order;
- B = same exact Top-20, sorted by raw Qwen score descending;
- tie-breaker = production/original rank;
- no binary threshold;
- no score blending;
- no pool change;
- no retrieval change.

Frozen production pool:

`benchmark/qwen3/ranking/runs/qwen3-ranking-v1-production-pool-c2ca5ed.jsonl`

Pool SHA:

`596dcb74f786a4e4ff40a705ec9f440accdfebca1ffcdadcdad2548ef7003b4c`

Dataset:

`benchmark/qwen3/ranking/datasets/qwen3-ranking-v1.jsonl`

Dataset SHA:

`d0f6b29834053615b44f823c7cb61f14478965eb72409ba1ab98742da224c548`

Raw-score SHA:

`09483050c0c327c3fb9115c245a0584ac9f38107133e0363fa255d23a0b4b29c`

A/B changed all 50 Top-10s and produced 352 changed memberships total.

A blind human audit adjudicated all 352 changed entries.

Development result:

- A-only relevant: 111/176
- B-only relevant: 141/176
- net +30 relevant
- exact paired ΔP@10 = **+0.060**
- improved/worsened/tied = **15/4/31**
- ordinal total A→B: 316→412, Δ +96

Important:

- absolute P@10 was not identified;
- P@5, MRR, nDCG were not identified;
- this was an exposed development query set;
- it was not enough to authorize production.

Frozen development human-delta report commit:

`d12ba5c`

---

## 16. Fresh Qwen ranking holdout design

Branch:

`validation/qwen3-ranking-holdout-v1`

This was a fresh internal end-to-end **ranking** validation.

25 new exact queries:

5 families × 5 languages.

Families:

1. Nietzsche — eternal recurrence
2. Aquinas — natural law
3. Plato — Republic
4. feminist epistemology in science
5. philosophy of language in linguistics

Languages:

- es
- en
- de
- fr
- pt

Intent balance:

- 10 philosopher-concept
- 5 work
- 10 interdisciplinary-challenge

The exact queries were absent from the 50-query ranking-development set and from the earlier Qwen classifier holdout.

---

## 17. Fresh ranking holdout frozen sequence

The freeze order was deliberate:

1. preregistration + query set
2. production retrieval pool
3. clean model-input dataset
4. raw Qwen scores
5. deterministic A/B ranking
6. blind audit sample
7. human judgments
8. unblind/reconstruct mapping
9. final human-delta analysis

This sequence protects against tuning after seeing labels.

### Production pool

Path:

`benchmark/qwen3/ranking/validation/runs/qwen3-ranking-holdout-v1-production-pool-e10bbc4.jsonl`

Rows:

500 = 25 × Top-20

SHA:

`26e39978dac68d37975732e2877830d58affc93a4e8c206edd4abd98f6b5d949`

Freeze:

`9c1bf8b`

### Clean dataset

Path:

`benchmark/qwen3/ranking/validation/datasets/qwen3-ranking-holdout-v1.jsonl`

Rows:

500

Unique records:

421

SHA:

`99745f88c232d50d8b6715d6062beae556a71c364623916b9c41239076d56f17`

Metadata SHA:

`e30a84ba6350f1192682031d8483793abf20bd5de9d5801593d40957586a668b`

Freeze:

`212a197`

### Raw Qwen scores

Path:

`benchmark/qwen3/ranking/validation/scores/qwen3-ranking-holdout-v1.raw.jsonl`

500 finite scores.

SHA:

`a463a8473cd9a2d465e6368849a341e6fbba1923ddea9d8fe785da92a10cdbd3`

Metadata SHA:

`2071ea327a2b90c94c6c9f2ec620ba4109d9334c91fbe515dc2d58117d678aa2`

Freeze:

`833ef9b`

### A/B

A = production order.

B = raw Qwen descending, original production rank tie-breaker.

1000 rows total: 500 per condition.

A/B SHA:

`6682bf7c19cd9acc77a589483977478857493e0a7f81ce1c086c83ce6c8851aa`

Metadata SHA:

`d4413cf9a87b0e2b4fc7a5b7fd28ea922509b851f75c34c45714d4d319ba6fe2`

Top-10:

- 24/25 queries changed membership;
- 1/25 unchanged;
- 160 changed memberships;
- 80 A-only;
- 80 B-only.

Freeze:

`10afea1`

### Blind audit sample

Public sample:

`benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.sample.jsonl`

Audit IDs:

`QRH001` through `QRH160`

The audit intentionally exposed no:

- A/B condition;
- rank;
- original rank;
- Qwen raw score;
- production score;
- query_id;
- record_id;
- provider identity;
- matchedQueries;
- retrieval provenance.

Importantly, unlike an earlier development audit, no private mapping artifact was generated before judgment freeze.

Sample SHA:

`2981bcd4c48e59a40492d13163e9cc0a1f92e960aa7bd82bcda00f60250fc033`

Metadata SHA:

`ae546efc00fe76779f22e47768b57a53d3cce6c8d2181308c20719cf926e951d`

Freeze:

`0ffceb0`

The user preferred four plain-text review blocks rather than a web page:

- QRH001–040
- QRH041–080
- QRH081–120
- QRH121–160

That preference should be preserved for future manual audits unless explicitly changed.

### Frozen human judgments

Judgment path:

`benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.judgments.jsonl`

Rows:

160

Distribution:

- 0: 27
- 1: 40
- 2: 21
- 3: 72

Relevant >= 2:

93

Nonrelevant:

67

Judgment SHA:

`bb1a44f71605b5415a2b9a47a111d6557c32f6f77c399613bc7afb87a5ba26a1`

Metadata SHA:

`9a99a82d96eac66ec1d102a714833cd4e0011e210d580af17e4a9582302250f0`

Freeze:

`18479e5`

The A/B mapping was reconstructed only after this freeze.

---

## 18. Fresh Qwen ranking validation result

Final report:

`benchmark/qwen3/ranking/validation/reports/qwen3-ranking-holdout-v1-human-delta.json`

Markdown:

`benchmark/qwen3/ranking/validation/reports/qwen3-ranking-holdout-v1-human-delta.md`

Freeze commit:

`ad180f6ebb4f78196f71355a48d1673cb60ebda4`

Hashes:

- JSON: `c503b06280ebc7e1ea98fbb2c2d680469c2639de72a9649834e310a272abb92c`
- Markdown: `44ef58c5553312e0b563200dca8488b6739b3cb743b2fef7600109de3aedef4d`

Result:

- queries: 25
- queries with changed Top-10: 24
- queries with unchanged Top-10: 1
- A-only rows: 80
- B-only rows: 80
- A-only relevant: 27
- B-only relevant: 66
- net relevant gain: **+39**
- exact paired ΔP@10: **+0.156**
- improved queries: **17**
- worsened queries: **0**
- tied queries: **8**
- A-only ordinal relevance: 104
- B-only ordinal relevance: 194
- ordinal delta: **+90**

The +0.156 is exact for ΔP@10 because shared Top-10 slots cancel in B−A.

However:

- absolute P@10 is not identified;
- P@5 is not identified;
- MRR is not identified;
- nDCG is not identified.

The final experiment-close commit is:

`e99a8d221d176a4b5ec179aa318084a7e0e23b24`

Interpretation:

This is strong fresh internal evidence that pure Qwen reranking improves the existing production Top-20 ordering. The effect is larger than the +0.060 development result and showed no query-level binary P@10 regressions in this 25-query holdout.

Do not extrapolate it as a universal production guarantee or external independent validation.

---

## 19. Why browser runtime is being tested

The validated reference model is too large to simply commit into the repository or bundle naively into GitHub Pages.

A paid inference backend is undesirable because the project aims to remain low/no-cost.

The current engineering hypothesis is therefore:

- keep GitHub Pages static;
- retrieve and rank the Top-20 using the existing production engine;
- optionally download/run a quantized Qwen reranker client-side;
- rerank those same 20 documents;
- fall back to production order when AI is unavailable.

Before doing that in production, the quantized browser runtime must be checked against the already validated reference model.

---

## 20. Current branch and browser-parity experiment

Current branch:

`integration/qwen3-reranker-v1`

Branch base:

`e99a8d221d176a4b5ec179aa318084a7e0e23b24`

Browser-parity preregistration commit:

`fa80a64cdffef9cb960ae6de0243b4168d4b8a15`

Preregistration file:

`benchmark/qwen3/browser/qwen3-browser-parity-v1.preregistered.json`

Manifest-record commit:

`5dac599...`

Pinned Transformers.js dependency commit:

`14cf2bc2144a7f29cc6917b2f4c9553d8b35105b`

Dependency:

`@huggingface/transformers@4.3.0`

Current tests after dependency installation:

167 passing, 0 failing.

---

## 21. Browser candidate

Model:

`onnx-community/Qwen3-Reranker-0.6B-ONNX`

Pinned revision:

`9995c50e2310679108a55f5ccd16ba8be9f17c20`

Artifact:

`onnx/model_q4.onnx`

dtype:

`q4`

Quantization:

4-bit MatMulNBits, block size 32.

Primary target:

WebGPU

WASM is not the primary parity runtime.

The model weights must never be committed to this repository.

The installed npm package may include Node and web ONNX runtime dependencies, but the parity experiment must ensure it is testing the intended browser/WebGPU path rather than accidentally validating `onnxruntime-node`.

---

## 22. Browser parity preregistration

Primary gate:

**25/25 queries must have exactly the same Top-10 record membership as the validated reference Qwen ranking.**

This gate was chosen because the fresh human ranking validation identifies Top-10 relevance by membership.

If every Top-10 membership is identical, the previously measured +0.156 ΔP@10 transfers exactly to the browser candidate on this holdout, regardless of within-Top-10 ordering.

Secondary metrics are diagnostic only:

- exact Top-10 order equality;
- Top-10 overlap per query;
- full Top-20 rank correlation;
- raw-score Spearman;
- raw-score Pearson;
- maximum absolute score difference;
- mean absolute score difference.

No threshold tuning.

No score blending.

No retrieval changes.

No candidate-pool changes.

No parity-dataset retuning.

---

## 23. Browser parity prompt contract

The browser runner must semantically mirror the Python reference adapter.

System prefix:

`<|im_start|>system\nJudge whether the Document meets the requirements based on the Query and the Instruct provided. Note that the answer can only be "yes" or "no".<|im_end|>\n<|im_start|>user\n`

User/content format:

`<Instruct>: {instruction}[newline-if-needed]<Query>: {query}\n<Document>: {document}`

System suffix:

`<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n`

Document text format must mirror `build_document_text()` in `scripts/benchmark/qwen3/adapter.py`:

- Title
- Authors, if any
- Year, if present
- Document language, if present
- Abstract or `[unavailable]`

Max total length:

4096 tokens.

The content part must be truncated so the exact prefix and suffix still fit.

Tokenizer padding side:

left.

Scoring tokens:

- `no`
- `yes`

Score:

`softmax([no_logit, yes_logit])[1]`

---

## 24. Browser parity dataset and reference

Use only the frozen fresh ranking dataset:

`benchmark/qwen3/ranking/validation/datasets/qwen3-ranking-holdout-v1.jsonl`

SHA:

`99745f88c232d50d8b6715d6062beae556a71c364623916b9c41239076d56f17`

Rows:

500

Queries:

25

Reference raw scores:

`benchmark/qwen3/ranking/validation/scores/qwen3-ranking-holdout-v1.raw.jsonl`

Reference SHA:

`a463a8473cd9a2d465e6368849a341e6fbba1923ddea9d8fe785da92a10cdbd3`

Reference A/B information already exists in:

`benchmark/qwen3/ranking/validation/runs/qwen3-ranking-holdout-v1-ab.jsonl`

Do not use human labels while generating browser scores.

Do not use the final human judgments to tune browser behavior.

---

## 25. Current next engineering task

The next task after this context handoff is to build a **plain-text / JSONL browser parity runner**, not a web adjudication UI.

Desired outputs should include:

- browser raw score JSONL for all 500 pairs;
- runtime metadata;
- model/revision/runtime fingerprints;
- ranking comparison report;
- Top-10 membership parity for all 25 queries;
- secondary score/rank metrics;
- SHA-256 fingerprints for generated artifacts;
- resumability if feasible, because initial model download/inference may be expensive.

No production source changes are required yet.

The runner should fail loudly if:

- dataset hash mismatches;
- instruction hash mismatches;
- model/revision differs;
- wrong runtime/device is used;
- score is non-finite;
- output is incomplete;
- an attempt is made to overwrite a completed frozen output without explicit intent.

---

## 26. Browser parity failure policy

If browser q4 produces any Top-10 membership difference:

- parity FAILS;
- do not claim the validated +0.156 applies directly;
- do not tune on the same parity set;
- freeze the browser outputs;
- construct a blind audit of newly changed Top-10 memberships between browser and validated reference;
- adjudicate those changes;
- calculate a browser-specific human delta;
- only then decide whether production integration is justified.

If 25/25 memberships match:

- the fresh holdout's exact ΔP@10 transfers for that dataset;
- proceed to product integration design;
- still preserve production fallback;
- still do not claim external independent validation.

---

## 27. Product integration concept after parity

Intended architecture:

```text
browser search
   |
   v
existing production retrieval + deterministic ranking
   |
   v
Top-20
   |
   +---- if browser AI unavailable ----> existing production order
   |
   v
optional Qwen q4 WebGPU rerank
   |
   v
sort by raw Qwen score DESC
tie -> original production rank ASC
   |
   v
display reranked results
```

Important product questions that remain unresolved until parity succeeds:

- whether the initial ~model-size download is acceptable UX;
- browser compatibility and WebGPU detection;
- caching model assets;
- user-visible opt-in or automatic behavior;
- progress indicator;
- mobile memory/performance;
- fallback behavior;
- whether reranking should occur only after enough results are present;
- whether AI reranking should be disabled on low-resource devices.

Do not solve these by changing the validated ranking policy before parity is known.

---

## 28. Git and artifact discipline

The project relies heavily on frozen experimental artifacts.

Rules:

- never use `git add .`;
- stage explicit paths only;
- do not delete unrelated untracked files;
- do not rewrite old frozen JSON/JSONL/Markdown merely for formatting;
- do not regenerate frozen scores;
- do not normalize line endings of frozen artifacts;
- preserve exact hashes;
- use new versioned files for successor experiments;
- do not silently amend old freeze commits.

Known untracked/manual artifacts to preserve:

```text
benchmark/interdisciplinary-conjunction-candidate-audit-v1.manual.jsonl
benchmark/interdisciplinary-conjunction-candidate-audit-v1.manual.txt
benchmark/interdisciplinary-conjunction-v1-holdout-audit.manual.jsonl
benchmark/interdisciplinary-conjunction-v1-holdout-audit.manual.txt
benchmark/multilingual-ab-delta-audit-v1.manual.txt
benchmark/multilingual-ab-manual-HAB020-HAB068.jsonl
benchmark/qwen3/ranking/audit/qwen3-ranking-v1-delta-audit.manual.txt
benchmark/qwen3/validation/qwen3-reranker-v1-holdout.manual.txt
benchmark/ranking-v21-changes.json
benchmark/ranking-v21-changes.md
benchmark/ranking-v21-development.json
benchmark/ranking-v21-development.md
benchmark/ranking-v22-development.json
benchmark/ranking-v22-development.md
benchmark/ranking-v23-development.json
benchmark/ranking-v23-development.md
```

Old stashes also exist and should not be blindly applied.

---

## 29. User workflow preferences relevant to coding agents

The user prefers:

- exact terminal commands;
- small, copy/paste-safe command blocks;
- explicit file paths;
- no `git add .`;
- checkpoints before risky work;
- preservation of existing files;
- clear separation between experimental and production work;
- plain text/log audit blocks instead of custom web pages;
- concise but technically precise explanations.

When asking the user to run a command, state the expected result when practical.

Do not ask the user to repeat information that is already encoded in this repository context.

---

## 30. Definition of evidence terms

Use these terms carefully:

### Development
Used to design/select behavior. Results can motivate but do not establish independent validation.

### Fresh internal validation
New queries and preregistered procedure within the same project/team. Stronger than development, but not externally independent.

### External independent validation
Not yet achieved for Qwen ranking.

### Exact paired ΔP@10
Difference in P@10 inferred exactly from complete human adjudication of the A/B Top-10 symmetric difference, because shared members cancel.

### Absolute P@10
Requires labels for the shared Top-10 members too. Not identified by the Qwen ranking delta audits.

### AI silver
Automated relevance labels. Not human gold.

### Human audit/adjudication
Human relevance review of a sample or changed-membership set. Do not automatically call it a gold standard.

---

## 31. Useful current commands

Run full tests:

```bash
npm test
```

Inspect branch/status:

```bash
git status --short
git branch --show-current
git log -5 --oneline
```

Current branch should be:

`integration/qwen3-reranker-v1`

Installed browser runtime:

`@huggingface/transformers@4.3.0`

Do not run broad install-script approvals merely to make unrelated native Node runtime packages execute. The current parity target is browser/WebGPU.

---

## 32. Current known-good state

At the point this context was authored:

- fresh Qwen ranking holdout is closed and frozen;
- exact paired ΔP@10 = +0.156 on the fresh internal ranking holdout;
- browser parity experiment is preregistered;
- Transformers.js 4.3.0 is pinned;
- model weights have not been committed;
- no production AI behavior has been enabled;
- the next task is implementing the browser/WebGPU parity runner;
- production ranking remains unchanged.

The dependency commit immediately before this context handoff is:

`14cf2bc2144a7f29cc6917b2f4c9553d8b35105b`

Any later work should inspect `git log` and treat newer commits as authoritative while preserving all frozen hashes and methodological boundaries above.
