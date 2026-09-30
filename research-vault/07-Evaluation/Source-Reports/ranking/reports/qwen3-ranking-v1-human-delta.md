# Qwen3 ranking v1 — human Top-10 delta

> Development-only human audit on the complete A/B Top-10 symmetric difference. The audit was frozen before A/B provenance was joined back to the judgments.

## Exact Top-10 effect

- A-only relevant: 111/176
- B-only relevant: 141/176
- Net relevant gain in B: +30
- Exact ΔP@10 (B − A): +0.060
- Queries improved / worsened / tied: 15 / 4 / 31
- Ordinal relevance total, A-only → B-only: 316 → 412 (Δ +96)

The absolute human P@10 of A and B is not identified by this delta audit because the 324 shared Top-10 query-document slots were deliberately not adjudicated. Shared slots cancel exactly in B − A, so ΔP@10 is exact.

## By language

| Language | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| de | 10 | -2 | -0.020 | 2 | 3 | 5 |
| en | 10 | -1 | -0.010 | 1 | 1 | 8 |
| es | 10 | +8 | +0.080 | 3 | 0 | 7 |
| fr | 10 | +18 | +0.180 | 6 | 0 | 4 |
| pt | 10 | +7 | +0.070 | 3 | 0 | 7 |

## By intent

| Intent | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| philosopher-concept | 30 | +18 | +0.060 | 10 | 2 | 18 |
| work | 10 | +0 | +0.000 | 0 | 0 | 10 |
| interdisciplinary-challenge | 10 | +12 | +0.120 | 5 | 2 | 3 |

## By family

| Family | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| kant-freedom | 5 | +1 | +0.020 | 1 | 0 | 4 |
| heidegger-being-time | 5 | +0 | +0.000 | 0 | 0 | 5 |
| aristotle-virtue | 5 | +0 | +0.000 | 2 | 1 | 2 |
| husserl-intentionality | 5 | +1 | +0.020 | 1 | 0 | 4 |
| levinas-alterity | 5 | +0 | +0.000 | 1 | 1 | 3 |
| spinoza-substance | 5 | +12 | +0.240 | 3 | 0 | 2 |
| dussel-liberation | 5 | +4 | +0.080 | 2 | 0 | 3 |
| hegel-phenomenology-spirit | 5 | +0 | +0.000 | 0 | 0 | 5 |
| challenge-phenomenology-nursing | 5 | +6 | +0.120 | 2 | 1 | 2 |
| challenge-ontology-compsci | 5 | +6 | +0.120 | 3 | 1 | 1 |

## Interpretation boundary

- These 50 queries are ranking-development queries, not a new independent end-to-end validation set.
- The result evaluates pure Qwen raw-score reranking of the same frozen production Top-20 pool.
- No threshold, score blending, retrieval expansion, or new candidate membership is involved.
- A fresh query validation is still required before treating this as an end-to-end production validation result.

