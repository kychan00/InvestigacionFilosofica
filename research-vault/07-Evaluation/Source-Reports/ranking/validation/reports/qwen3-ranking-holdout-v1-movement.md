# Qwen3 ranking holdout v1 — structural movement

> Fresh internal ranking validation on the exact same frozen Top-20 pool. No relevance labels are used in this structural stage.

- Queries: 25
- Documents per query: 20
- Query-document pairs: 500
- A/B rows: 1000
- Queries with Top-5 membership change: 23
- Top-5 changed memberships: 112
- Queries with Top-10 membership change: 24
- Top-10 changed memberships: 160
- Blind human audit candidates: 160
- Mean absolute rank shift: 4.636
- Maximum absolute rank shift: 17
- Documents staying at the same rank: 41
- Within-query equal-score pairs: 13

## Boundaries

- A is the original production order.
- B sorts the same 20 documents by Qwen raw score descending.
- Exact score ties preserve original production rank.
- No threshold, blending, labels, retrieval change, or production code change is used.
- Structural movement alone is not evidence of quality; the changed Top-10 documents must be judged independently and blind to A/B.

