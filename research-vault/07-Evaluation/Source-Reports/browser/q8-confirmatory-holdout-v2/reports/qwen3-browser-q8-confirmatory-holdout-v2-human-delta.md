# Qwen3 browser q8 confirmatory holdout v2 — human Top-10 delta

> Fresh confirmatory internal validation on 30 preregistered multilingual queries. Human judgments were frozen before deterministic A/B reconstruction.

## Preregistered hypotheses

- H1 — ΔP@10 interdisciplinary: +0.060 — **directionally-supported**
- H2 — interdisciplinary minus work ΔP@10: -0.010 — **not-directionally-supported**
- H3 — Δcentral-3@10 interdisciplinary: -0.010 — **not-directionally-supported**

These are directional sign checks under the frozen support rules. No formal significance threshold or power claim was preregistered.

## Overall exact Top-10 effect

- A-only relevant: 61/106
- B-only relevant: 82/106
- Net relevant gain in B: +21
- Exact ΔP@10 (B − A): +0.070
- A-only central-3: 42/106
- B-only central-3: 52/106
- Exact Δcentral-3@10 (B − A): +0.033
- Queries improved / worsened / tied: 12 / 1 / 17
- Ordinal relevance total, A-only → B-only: 192 → 237 (Δ +45)

Absolute human P@10 is not identified because the 194 shared Top-10 query-document slots were not adjudicated. They cancel exactly in B − A, so the reported deltas are exact.

## By intent

| Group | Queries | Net relevant | ΔP@10 | Net central-3 | Δcentral-3@10 | Improved | Worse | Tied |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| interdisciplinary-challenge | 10 | +6 | +0.060 | -1 | -0.010 | 3 | 0 | 7 |
| philosopher-concept | 10 | +8 | +0.080 | +7 | +0.070 | 5 | 0 | 5 |
| work | 10 | +7 | +0.070 | +4 | +0.040 | 4 | 1 | 5 |

## By language

| Group | Queries | Net relevant | ΔP@10 | Net central-3 | Δcentral-3@10 | Improved | Worse | Tied |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| de | 6 | +4 | +0.067 | +4 | +0.067 | 3 | 0 | 3 |
| en | 6 | 0 | 0.000 | -1 | -0.017 | 1 | 1 | 4 |
| es | 6 | +8 | +0.133 | +3 | +0.050 | 3 | 0 | 3 |
| fr | 6 | +7 | +0.117 | +1 | +0.017 | 3 | 0 | 3 |
| pt | 6 | +2 | +0.033 | +3 | +0.050 | 2 | 0 | 4 |

## By family

| Group | Queries | Net relevant | ΔP@10 | Net central-3 | Δcentral-3@10 | Improved | Worse | Tied |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| arendt-human-condition | 5 | +5 | +0.100 | 0 | 0.000 | 3 | 1 | 1 |
| beauvoir-second-sex | 5 | +2 | +0.040 | +4 | +0.080 | 1 | 0 | 4 |
| bergson-duration | 5 | +4 | +0.080 | +1 | +0.020 | 2 | 0 | 3 |
| environmental-ethics-climate-change | 5 | +1 | +0.020 | -1 | -0.020 | 1 | 0 | 4 |
| foucault-biopower | 5 | +4 | +0.080 | +6 | +0.120 | 3 | 0 | 2 |
| philosophy-mathematics-set-theory | 5 | +5 | +0.100 | 0 | 0.000 | 2 | 0 | 3 |

## Interpretation boundary

- This is a fresh confirmatory internal validation, not independent external validation.
- A is frozen production order; B is pure browser-q8 raw-score reranking of the identical frozen Top-20 membership.
- No threshold, score blending, retrieval expansion, pool change, holdout-label tuning, or post-hoc hypothesis redefinition occurred.
- The preregistered decision rule checks directional signs only; it does not establish statistical significance.
- Absolute P@10, P@5, MRR, and nDCG are not identified by this symmetric-difference audit.
- This result does not authorize a production ranking change.
