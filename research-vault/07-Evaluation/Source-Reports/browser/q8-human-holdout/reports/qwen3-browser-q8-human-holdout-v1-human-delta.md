# Qwen3 browser q8 human holdout v1 — human Top-10 delta

> Fresh internal validation on 25 preregistered multilingual queries. Human judgments were frozen while A/B identity remained hidden; the A/B mapping was reconstructed deterministically only for this analysis.

## Exact Top-10 effect

- A-only relevant: 65/96
- B-only relevant: 71/96
- Net relevant gain in B: +6
- Exact ΔP@10 (B − A): +0.024
- Queries improved / worsened / tied: 9 / 4 / 12
- Ordinal relevance total, A-only → B-only: 191 → 216 (Δ +25)

Absolute human P@10 is not identified because the 154 shared Top-10 query-document slots were deliberately not adjudicated. Those shared slots cancel exactly in B − A, so ΔP@10 is exact.

## By language

| Group | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| de | 5 | +5 | +0.100 | 4 | 0 | 1 |
| en | 5 | -6 | -0.120 | 0 | 2 | 3 |
| es | 5 | +4 | +0.080 | 2 | 0 | 3 |
| fr | 5 | +3 | +0.060 | 2 | 1 | 2 |
| pt | 5 | 0 | 0.000 | 1 | 1 | 3 |

## By intent

| Group | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| philosopher-concept | 10 | -1 | -0.010 | 4 | 2 | 4 |
| work | 5 | -3 | -0.060 | 1 | 2 | 2 |
| interdisciplinary-challenge | 10 | +10 | +0.100 | 4 | 0 | 6 |

## By family

| Group | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| kierkegaard-despair | 5 | -4 | -0.080 | 1 | 2 | 2 |
| merleau-ponty-perception | 5 | +3 | +0.060 | 3 | 0 | 2 |
| hobbes-leviathan | 5 | -3 | -0.060 | 1 | 2 | 2 |
| ethics-artificial-intelligence | 5 | 0 | 0.000 | 0 | 0 | 5 |
| philosophy-biology-evolution | 5 | +10 | +0.200 | 4 | 0 | 1 |

## Interpretation boundary

- This is a fresh internal validation set, distinct from the 50 ranking-development queries and the earlier classifier holdout.
- It evaluates pure browser q8 raw-score reranking of the same frozen production Top-20 candidate pool for each query.
- No threshold, score blending, retrieval expansion, candidate-pool change, or holdout-label tuning is involved.
- The result is not external independent validation.
- Absolute P@10, P@5, MRR, and nDCG are not identified by this symmetric-difference audit.

