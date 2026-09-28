# Qwen3 ranking holdout v1 — human Top-10 delta

> Fresh internal validation on 25 preregistered multilingual queries. Human judgments were frozen while A/B identity remained hidden; the A/B mapping was reconstructed deterministically only for this analysis.

## Exact Top-10 effect

- A-only relevant: 27/80
- B-only relevant: 66/80
- Net relevant gain in B: +39
- Exact ΔP@10 (B − A): +0.156
- Queries improved / worsened / tied: 17 / 0 / 8
- Ordinal relevance total, A-only → B-only: 104 → 194 (Δ +90)

Absolute human P@10 is not identified because the 170 shared Top-10 query-document slots were deliberately not adjudicated. Those shared slots cancel exactly in B − A, so ΔP@10 is exact.

## By language

| Group | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| de | 5 | +12 | +0.240 | 4 | 0 | 1 |
| en | 5 | +2 | +0.040 | 2 | 0 | 3 |
| es | 5 | +6 | +0.120 | 4 | 0 | 1 |
| fr | 5 | +10 | +0.200 | 4 | 0 | 1 |
| pt | 5 | +9 | +0.180 | 3 | 0 | 2 |

## By intent

| Group | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| philosopher-concept | 10 | +11 | +0.110 | 7 | 0 | 3 |
| work | 5 | +9 | +0.180 | 2 | 0 | 3 |
| interdisciplinary-challenge | 10 | +19 | +0.190 | 8 | 0 | 2 |

## By family

| Group | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| nietzsche-eternal-recurrence | 5 | +9 | +0.180 | 5 | 0 | 0 |
| aquinas-natural-law | 5 | +2 | +0.040 | 2 | 0 | 3 |
| plato-republic | 5 | +9 | +0.180 | 2 | 0 | 3 |
| feminist-epistemology-science | 5 | +14 | +0.280 | 4 | 0 | 1 |
| philosophy-language-linguistics | 5 | +5 | +0.100 | 4 | 0 | 1 |

## Interpretation boundary

- This is a fresh internal validation set, distinct from the 50 ranking-development queries and the earlier classifier holdout.
- It evaluates pure Qwen raw-score reranking of the same frozen production Top-20 candidate pool for each query.
- No threshold, score blending, retrieval expansion, candidate-pool change, or holdout-label tuning is involved.
- The result is not external independent validation.
- Absolute P@10, P@5, MRR, and nDCG are not identified by this symmetric-difference audit.

