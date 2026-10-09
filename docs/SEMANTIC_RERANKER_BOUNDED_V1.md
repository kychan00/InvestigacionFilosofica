# Bounded full-index reranker comparison V1

**Preregistered local date:** 2026-10-09

**Status:** frozen before reranker inference

## Question

Does the pinned `Qwen3-Reranker-0.6B` improve the ordering of a small,
pre-existing internal query set when it receives an identical semantic
candidate pool from the complete V3.3 index?

This is an engineering evaluation, not a production promotion gate.

## Frozen inputs

- Query set: `benchmark/semantic-retrieval/queries-v1.jsonl`.
- Query count: 5.
- Query-set SHA-256:
  `595da8eae92f48c0b05e88ff02256085590aa7e2bf41a4a919499aaaa8df3b16`.
- Index build: `20261009T135455Z`.
- FAISS SHA-256:
  `31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68`.
- Metadata SHA-256:
  `e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0`.
- Embedding model:
  `Qwen/Qwen3-Embedding-0.6B@97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`.
- Reranker:
  `Qwen/Qwen3-Reranker-0.6B@e61197ed45024b0ed8a2d74b80b4d909f1255473`.
- Device: Apple MPS.
- Reranker batch size: 1.

## Fixed comparison

For each query, retrieve exactly 12 semantic candidates once.

- Condition A: the first 10 candidates in semantic-score order.
- Condition B: the same 12-candidate pool ordered by the frozen reranker, then
  truncated to 10.
- Reranker score ties preserve semantic order.
- No lexical candidates, filters, score blending, threshold or candidate-pool
  changes are permitted.
- No labels are available to retrieval or inference.
- No query, prompt, model, index or parameter may be changed after scores are
  observed.

This requires exactly 60 query-document reranker scores. The 12-candidate pool
is a prospective cost bound, not a value selected from outcomes.

## Blind human package

After inference, construct the per-query union of A Top 10 and B Top 10. Sort
items by a deterministic hash unrelated to either rank. The human package must
contain query and bibliographic content only. It must exclude:

- condition;
- semantic or reranker rank;
- semantic, lexical or reranker score;
- membership provenance;
- aggregate results.

The reviewer assigns graded relevance `0–3`, or a justified abstention when the
available title/abstract is insufficient. Review happens only after the blank
package is frozen.

## Metrics after judgments freeze

Primary metric: macro mean difference in `nDCG@10`, B minus A, using graded
relevance 0–3.

Secondary descriptive metrics:

- macro difference in `P@10`, where relevant means grade at least 2;
- macro difference in `P@5` under the same threshold;
- per-query rank changes;
- coverage and abstention count;
- duplicate-looking records as a separately reported data-quality observation.

No significance claim is preregistered for five queries. The result is
descriptive and cannot change production automatically.

## Stop conditions

Stop without accepting outputs if any frozen hash or model contract differs, a
query yields fewer than 12 candidates, A/B candidate pools differ, a score is
non-finite, an output already exists, or inference leaves Apple MPS.

Model weights remain in the external Hugging Face cache and are never committed
to the repository.
