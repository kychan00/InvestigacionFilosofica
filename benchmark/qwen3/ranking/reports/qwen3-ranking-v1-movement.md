# Qwen3 ranking v1 — structural movement

> Development-only structural comparison on the exact same frozen Top-20 pool. This report does not use relevance labels and therefore does not claim a quality improvement.

- Queries: 50
- Documents per query: 20
- Query-document pairs: 1000
- A/B rows: 2000
- Queries with Top-5 membership change: 50
- Top-5 changed query-document memberships: 270
- Queries with Top-10 membership change: 50
- Top-10 changed query-document memberships: 352
- Blind human audit candidates (Top-10 symmetric difference): 352
- Mean absolute rank shift: 4.724
- Maximum absolute rank shift: 18
- Documents staying at the same rank: 98
- Within-query equal-score pairs: 51

## Boundaries

- A is the original production order from the frozen pool.
- B sorts the same 20 documents by Qwen raw score descending.
- Exact Qwen-score ties preserve original production rank.
- No threshold, score blend, relevance label, new retrieval, or production code change is used.
- Structural movement alone is not evidence that B is better; relevance must be judged independently and blind to condition.

