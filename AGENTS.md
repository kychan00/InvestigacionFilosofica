# AGENTS.md

## Project identity

This repository is **Investigación Filosófica**, an academic philosophy search engine and research project.

- Repository: `kychan00/InvestigacionFilosofica`
- Production site: `https://kychan00.github.io/InvestigacionFilosofica/`
- Typical local path: `~/filosofia/web`
- This repository is **not** `~/Developer/philosophia`. Never mix the two projects.
- Current integration branch: `integration/qwen3-reranker-v1`
- Current branch lineage starts from the frozen fresh Qwen3 ranking validation and is now preparing a browser-runtime parity experiment.

Before substantial work, read `docs/CODEX_PROJECT_CONTEXT.md`. It contains the experiment history, frozen artifacts, hashes, methodology boundaries, and current next step.

## What the product does

The production application is a browser/GitHub-Pages academic philosophy search engine. It federates results from multiple academic/library sources, normalizes and deduplicates records, parses multilingual philosophy queries, expands them when appropriate, and applies a deterministic production ranking.

Important product constraints:

- GitHub Pages is static hosting.
- There is no project-owned production database.
- There is no project-owned user search history, credentials store, or cookie-backed account system.
- Search is primarily browser-side.
- Production retrieval/ranking must continue to work if experimental AI reranking is unavailable.
- Do not silently replace the production ranker with an unvalidated AI path.

## Main production sources

The search engine has integrations/snapshots for sources including:

- OpenAlex
- Crossref
- Internet Archive
- Biblioteca UdeG / institutional material
- CUCSH philosophy journals, including Protrepsis and Quadripartita Ratio

The CUCSH work added metadata extraction/search support so local philosophy journal material participates in the federated search.

## Production ranking

The historical baseline score is conceptually:

`total = Q*.28 + P*.30 + D*.20 + S*.10 + B*.08 + I*.04 - penalty`

where the components are the project's existing query/philosophy/discipline/source/bibliographic/institutional signals.

Ranking v2 added small heuristics such as:

- original-query title coverage
- CUCSH prior
- Internet Archive prior
- conditional Crossref penalty

A later production change added the moderate interdisciplinary conjunction adjustment:

- explicit philosophy-area + external-domain evidence in title+abstract: +2
- area-only: -2
- domain-only: 0
- neither, with abstract: -1
- neither, without abstract: 0

The current production behavior lineage is based on commit `bb9689da2016ca26a08359e8655eca7a5b771937`.

**Do not casually edit `src/core/rank.js`, the multilingual parser/expander, or the conjunction behavior while working on Qwen integration.** The Qwen validation deliberately used the existing production Top-20 pool and changed only its order.

## Testing and completion rules

Run:

```bash
npm test
```

after JavaScript/Node changes and before presenting work as complete.

At the beginning of risky or experiment-sensitive work, inspect:

```bash
git status --short
git branch --show-current
git log -5 --oneline
```

Do not use `git add .`.

Stage only explicitly intended files. Preserve existing unrelated untracked files.

When a benchmark artifact is described as frozen, do not regenerate, rewrite, normalize, reformat, or replace it unless the task explicitly requires creating a successor artifact. Frozen SHA-256 values are part of the experiment contract.

## Git hygiene

Never accidentally stage, delete, or rewrite the user's old exploratory/manual files. Known persistent untracked files include:

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

There are also old stashes. Do not blindly pop them:

- old human judge UI before AI silver standard
- local package before AI benchmark sync

## Benchmark terminology

Be precise about evidence labels.

- `benchmark/judgments.jsonl` is reserved for future genuine human labels.
- The historical automated relevance set is **AI-assisted / silver standard / AI-judged**. Never call it human gold.
- A later 100-item blinded human audit is a **human audit/adjudication**, not a validated human-gold dataset.
- Qwen development labels derived from historical human adjudication are development data.
- The fresh Qwen classifier holdout and fresh ranking holdout are internal validation sets, not external independent validation.

Never upgrade claims beyond what the artifacts identify.

## Frozen Qwen3 model contract

Reference model:

- Model: `Qwen/Qwen3-Reranker-0.6B`
- Revision: `e61197ed45024b0ed8a2d74b80b4d909f1255473`
- Instruction SHA-256: `5693a9a1377e10eb952d327aeec5c05cbbf040989feb786910b42e17cbf271a7`
- Max length: 4096
- Scoring: yes/no next-token logits, softmax probability of `yes`
- Python scoring version: `qwen3-yes-no-softmax-v1-mps-singleton`

Exact instruction lives at:

`benchmark/qwen3/configs/qwen3-reranker-v1.instruction.txt`

Do not edit that instruction during parity or production-integration work. Any instruction change is a new model/scoring experiment.

The validated Python adapter is:

`scripts/benchmark/qwen3/adapter.py`

Its prompt formatting, document formatting, truncation, yes/no token scoring, and max length define the reference semantics.

## Qwen development result

On 50 historical development queries, pure Qwen reranking of the same frozen production Top-20 pool produced an exact human paired:

- ΔP@10 = +0.060
- 15 queries improved
- 4 worsened
- 31 tied

This was development evidence only.

Frozen development human-delta report commit:

`d12ba5c`

## Fresh Qwen ranking validation

A fresh ranking holdout was preregistered with 25 new queries: 5 semantic families × 5 languages (es/en/de/fr/pt).

Families:

1. Nietzsche — eternal recurrence
2. Aquinas — natural law
3. Plato — Republic
4. feminist epistemology in science
5. philosophy of language in linguistics

Intent balance:

- 10 philosopher-concept
- 5 work
- 10 interdisciplinary-challenge

Policy:

- retrieve production Top-20
- freeze it
- run Qwen on exactly those 20
- B = raw Qwen score descending
- production rank is tie-breaker
- no threshold
- no score blending
- no retrieval expansion from Qwen
- no pool change
- no tuning using holdout labels

Frozen key artifacts:

- production pool commit: `9c1bf8b`
- dataset commit: `212a197`
- raw-score commit: `833ef9b`
- A/B commit: `10afea1`
- blind-audit sample commit: `0ffceb0`
- human-judgment freeze commit: `18479e5`
- final human-delta report freeze commit: `ad180f6ebb4f78196f71355a48d1673cb60ebda4`
- validation close commit: `e99a8d221d176a4b5ec179aa318084a7e0e23b24`

Frozen fresh validation result:

- 25 queries
- 24 changed Top-10 membership
- 1 unchanged Top-10
- 80 A-only changed entries
- 80 B-only changed entries
- A-only relevant: 27/80
- B-only relevant: 66/80
- net relevant gain: +39
- exact paired ΔP@10: **+0.156**
- improved/worsened/tied queries: **17 / 0 / 8**
- ordinal relevance: 104 → 194, Δ +90
- absolute P@10 is **not identified**
- P@5, MRR, and nDCG are **not identified** by this delta-only human audit

Report SHA-256:

- JSON: `c503b06280ebc7e1ea98fbb2c2d680469c2639de72a9649834e310a272abb92c`
- Markdown: `44ef58c5553312e0b563200dca8488b6739b3cb743b2fef7600109de3aedef4d`

Interpretation: the fresh internal validation supports continued production-integration engineering, but it is not external independent validation and does not by itself authorize an arbitrary production AI implementation.

## Current task: browser parity before production

The project is now evaluating whether the validated reranker can run client-side so GitHub Pages can remain static and no paid server is required.

Current branch:

`integration/qwen3-reranker-v1`

Pinned JS runtime dependency:

- `@huggingface/transformers@4.3.0`
- dependency commit: `14cf2bc2144a7f29cc6917b2f4c9553d8b35105b`

Preregistered browser candidate:

- Model: `onnx-community/Qwen3-Reranker-0.6B-ONNX`
- Revision: `9995c50e2310679108a55f5ccd16ba8be9f17c20`
- Artifact: `onnx/model_q4.onnx`
- dtype: q4
- primary runtime/device: WebGPU
- model weights must **not** be committed to this repository

Preregistration:

`benchmark/qwen3/browser/qwen3-browser-parity-v1.preregistered.json`

Preregistration commit:

`fa80a64cdffef9cb960ae6de0243b4168d4b8a15`

Primary parity gate:

**25/25 frozen queries must have exactly the same Top-10 record membership under browser q4 reranking as under the validated reference Qwen reranking.**

Why membership, not exact order: the frozen human validation identifies P@10 from membership. If all 25 Top-10 memberships are identical, the validated +0.156 ΔP@10 transfers exactly on that holdout even if within-Top-10 order differs.

Secondary parity metrics may include:

- exact Top-10 order equality
- per-query Top-10 overlap
- full Top-20 rank correlation
- raw-score Spearman
- raw-score Pearson
- mean/max absolute score difference

Failure policy:

- if even one query changes Top-10 membership, do not claim full browser parity
- do not tune thresholds/blends on this parity dataset
- freeze browser outputs
- audit only the newly changed Top-10 memberships relative to the validated reference
- quantify a browser-specific human delta before production

## Browser implementation constraints

The browser runner must mirror `scripts/benchmark/qwen3/adapter.py` exactly where semantically possible:

- same instruction bytes
- same document text construction
- same system prefix
- same content format
- same system suffix
- same 4096 max length
- left padding semantics
- yes/no token IDs from tokenizer
- score = softmax([no_logit, yes_logit])[1]

The parity experiment must use the same frozen 500-row dataset:

`benchmark/qwen3/ranking/validation/datasets/qwen3-ranking-holdout-v1.jsonl`

Dataset SHA-256:

`99745f88c232d50d8b6715d6062beae556a71c364623916b9c41239076d56f17`

Reference raw Qwen scores:

`benchmark/qwen3/ranking/validation/scores/qwen3-ranking-holdout-v1.raw.jsonl`

Reference score SHA-256:

`a463a8473cd9a2d465e6368849a341e6fbba1923ddea9d8fe785da92a10cdbd3`

The parity runner should produce text/JSONL artifacts and logs. Do **not** create a browser adjudication page or UI for this experiment unless explicitly requested.

## User workflow preference for experiment audits

For manual audits, prefer plain text/log blocks over web pages.

The user explicitly rejected page-based adjudication for the ranking holdout and preferred blocks such as:

`QRH001-040.log`, `QRH041-080.log`, etc.

Unless asked otherwise, experiment review artifacts should be plain text, JSON, JSONL, or Markdown—not custom localhost pages.

## Production integration rule

Until browser parity is proven and an explicit production integration step is approved:

- do not change production search ranking
- do not change retrieval membership
- do not add AI-dependent behavior to the live GitHub Pages path
- do not make Qwen a hard dependency for search
- preserve a fallback to the current production ranking
- do not commit model weights

## Code review rules

When reviewing changes in this repository, flag:

- edits to frozen benchmark artifacts or their hashes without a new experiment/version
- accidental inclusion of human labels, rank, provider identity, retrieval provenance, or A/B condition in model input
- threshold/blend tuning on validation or parity data
- changes that make Qwen alter retrieval candidate membership
- production AI changes before parity/validation gates are satisfied
- changes that silently remove fallback to production ranking
- accidental staging/deletion of known manual/untracked files
- use of `git add .` in instructions
- claims of absolute P@10, P@5, MRR, or nDCG from a delta-only audit
- calling AI silver “human gold”
- committing model weights or generated caches

## Definition of done for the current browser-parity phase

A parity implementation is not complete until:

1. the preregistered frozen dataset and reference scores are hash-verified;
2. the browser/Q4 model executes with the pinned model/revision/runtime contract;
3. all 500 browser raw scores are finite and saved reproducibly;
4. rankings are constructed per query with raw browser score descending and original production rank as tie-breaker;
5. all 25 Top-10 memberships are compared against the validated reference;
6. secondary parity metrics are reported;
7. outputs are frozen with hashes;
8. `npm test` passes;
9. no production source file is changed unless explicitly authorized.

If 25/25 membership equality is not achieved, stop before production integration and follow the preregistered failure policy.
