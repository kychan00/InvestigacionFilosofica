# Public semantic operational smoke v1

**Status:** `PASS_WITH_DATA_QUALITY_FINDINGS`

This receipt captures the five pre-existing internal benchmark queries against
the public semantic API. It validates availability, latency and response
contracts. It is not a human relevance evaluation and did not use labels,
reranking, tuning or production changes.

## Frozen runner and execution

- Initial runner freeze: `3110941b81ce3756807434b16bbd5c551d5aa9bc`.
- The initial capture stopped on query 2 because rank 3 had a stable ID and
  score but an empty title. That attempt is preserved unchanged in
  `../public-smoke-v1-failed-attempt-1/`.
- A separate diagnostic request confirmed the exact missing-title record:
  `openalex-W6994251083`.
- The corrected runner was frozen in
  `e4f253d4bbbf3b63b2d2276262cc05615b751621`. It records and counts an empty
  source title rather than rejecting it or inventing bibliographic text.
- Completed capture: 2026-10-09T22:56:17Z to 2026-10-09T22:56:31Z.
- Query order: `sem-v1-001` through `sem-v1-005` exactly as stored in
  `../queries-v1.jsonl`.
- Concurrency: 1.
- Retries: 0 in each official capture attempt.
- Requested results: Top 10.
- Reranker: disabled.

## Operational result

- Public health: `ready`.
- Indexed documents: 451,823.
- Successful queries: 5/5.
- Captured result rows: 50.
- HTTP status: 200 for every query.
- Fallbacks: 0; this runner calls the semantic API directly.
- Latency: minimum 0.733176 s, median 1.501462 s, mean 2.5608638 s,
  maximum 6.183507 s.
- Missing titles: 1/50.
- Rerank scores: 50/50 null.

The completed timing is a warm-service observation. The stopped first attempt
observed 17.373391 s for its first query, but it was not a controlled cold-start
measurement and must not be reported as one.

Independent checks confirmed five ordered query rows, ten unique IDs per
query, descending semantic scores, no reranking, no fallback flag, matching
hashes and the runner commit recorded in metadata.

## Post-hoc, non-adjudicated observations

These observations are data-quality triage, not relevance labels or a formal
ranking judgment:

- the first Quine query returned three distinct OpenAlex IDs with essentially
  the same title and abstract at ranks 1–3;
- repeated or near-repeated titles also appear in the Wittgenstein and Frege
  result sets;
- one Kant result has an empty title but a substantive French abstract;
- one Portuguese Wittgenstein title and abstract contain visible mojibake;
- another Wittgenstein title contains literal HTML markup;
- the Frege query includes a rank-2 result whose title and abstract discuss
  Husserl and Heidegger rather than Frege, which is clear topical drift worth
  examining in a future relevance audit.

The first results for Quine, Kant, Wittgenstein and Marx visibly contain the
requested concepts in their titles or abstracts. This plausibility check does
not establish precision, nDCG or human relevance.

## Files

- `health.json`: exact normalized health response.
- `results.jsonl`: five query receipts with full Top 10 API responses.
- `summary.json`: aggregate operational result.
- `metadata.json`: lineage, execution contract and SHA-256 hashes.
- `run.log`: timestamped execution log.

## Decision

The public semantic route passes the bounded operational smoke. Before a
formal relevance evaluation or broader promotion, prioritize metadata hygiene
and work-level deduplication. Do not tune the embedding model from this smoke.
