# Qwen3 reranking laboratory

This directory contains the experimental artifacts for `qwen3-reranker-v1`.

The laboratory is deliberately separated from production ranking. Its first job is to measure whether a multilingual neural reranker can improve relevance judgments and Top-K ordering without contaminating the existing retrieval and ranking pipeline.

## Frozen baseline

- Production base commit: `bb9689da2016ca26a08359e8655eca7a5b771937`
- Experimental branch: `evaluation/qwen3-reranker-v1`
- Production ranking remains unchanged during model evaluation.

## Architecture boundaries

The experiment is split into components with one responsibility each:

1. `dataset` builds clean query-document pairs.
2. `model-adapter` formats inputs and obtains raw Qwen scores.
3. `inference-engine` owns batching, device selection, checkpointing and cache reuse.
4. `score-store` freezes immutable raw model scores.
5. `calibration` compares raw scores with already-existing human judgments.
6. `ranking-lab` consumes frozen scores to simulate ranking profiles; it must not invoke the model.
7. `validation` creates a fresh blind holdout after a candidate profile is frozen.
8. `reporting` renders JSON/Markdown summaries without changing scores or judgments.

The direction of data flow is one-way:

```text
frozen dataset
    -> model adapter / inference
    -> immutable raw scores
    -> calibration + ranking lab
    -> frozen candidate
    -> fresh blind human validation
```

## Invariants

- Human labels are never passed to the reranker.
- Current rank, current score, provider, retrieval provenance, A/B condition and conjunction diagnostics are never part of the model input.
- Raw Qwen scores are immutable. Calibration never rewrites them.
- Changing ranking weights must not require rerunning Qwen.
- Changing the model revision, instruction or query/document content invalidates the corresponding inference cache key.
- Development data may be used for calibration and tuning, but not later described as fresh validation.
- A fresh holdout must be created only after the candidate ranking profile is frozen.
- Historical `ai-silver-*`, human audits and conjunction-v1 artifacts are preserved and never overwritten.

## Data tiers

```text
RAW
  Exact model output tied to model revision + instruction + input hash.

CALIBRATED
  A derived interpretation of RAW scores against human labels.

RANKING
  Simulated ranking profiles that consume RAW/CALIBRATED scores.
```

These tiers must remain distinct on disk.

## Layout

```text
benchmark/qwen3/
  README.md
  configs/
    qwen3-reranker-v1.experiment.json
    qwen3-reranker-v1.instruction.txt
  datasets/       # added when datasets are frozen
  scores/         # added when inference begins
  simulations/    # added by ranking-lab
  audits/         # fresh blind validation only
  reports/        # generated analyses

scripts/benchmark/
  core/
    hashing.mjs
  qwen3/
    contracts.mjs
    # adapter/inference/dataset/calibration components follow in later phases
  ranking-lab/    # added when ranking simulations begin
  validation/     # reusable blind-audit tooling follows later
```

## Model candidate

The initial candidate is pinned to:

- model: `Qwen/Qwen3-Reranker-0.6B`
- revision: `e61197ed45024b0ed8a2d74b80b4d909f1255473`
- task: multilingual text ranking

The exact instruction is stored separately and hashed in the experiment manifest. Do not edit it after inference starts; create a new experiment id instead.
