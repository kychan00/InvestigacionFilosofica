# Semantic reranker bounded V1

This directory contains the frozen human-facing package for the bounded
full-index semantic/reranker comparison preregistered in
`docs/SEMANTIC_RERANKER_BOUNDED_V1.md`.

## Shareable with a reviewer

- `blind-audit.jsonl`
- `REVIEWER_INSTRUCTIONS.md`
- the judgment instructions in the preregistration

The 59 audit rows contain no condition, rank, score or membership provenance.
Judgment fields are blank.

## Frozen human return

- `human-judgments.jsonl` is the exact byte-for-byte blind return.
- `human-judgments-metadata.json` records its hash and the blind validation.

The return was frozen before the internal A/B artifact was opened for analysis.

## Analysis contract

`scripts/retrieval/analyze_bounded_reranker_ab.py` is frozen before unblinding.
It verifies the exact A/B and judgment hashes, refuses to overwrite an existing
result, and uses these fixed definitions:

- nDCG gain `2^relevance - 1` and logarithmic rank discount;
- IDCG from the ten strongest graded judgments in each query's A/B Top-10
  union;
- binary relevance at grade 2 or 3 for P@10 and P@5;
- paired macro differences reported as B minus A;
- a query is excluded from a metric only if an abstention is required by that
  metric.

Results are descriptive for five queries and do not authorize a production
change.

## Frozen result

The exact result is in `analysis.json`; `analysis-metadata.json` records its
hash and independent recalculation.

- Primary macro ΔnDCG@10 (B−A): `-0.001608360268`.
- Secondary macro ΔP@10 (B−A): `+0.02`.
- Secondary macro ΔP@5 (B−A): `0.0`.
- Coverage: 5 queries, 59 completed judgments, 0 abstentions.
- Data-quality observation: 2 exact-normalized-title duplicate-looking groups.

The primary directional improvement was not observed. The small secondary
changes are descriptive only; no significance claim or production promotion is
supported by this five-query bounded evaluation.

## Internal provenance

- `freeze-metadata.json` records the hashes and completed execution contract.
- `runtime-metadata.json` is the exact runner-produced metadata.
- The A/B artifact remains outside Git under the ignored artifacts tree. Its
  SHA-256 is recorded, but its contents must not be shown to the reviewer until
  judgments are frozen.

No file in this directory changes production or authorizes deployment.
