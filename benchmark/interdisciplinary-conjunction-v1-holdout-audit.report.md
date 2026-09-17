# Interdisciplinary conjunction v1 · fresh holdout human audit

Human adjudication of all 56 changed Top-10 query-document pairs from the preregistered same-pool holdout. Relevance threshold is >=2. Shared Top-10 documents cancel, so the paired ΔP@10 below is exact for this frozen run.

> Fresh internal holdout with one human adjudicator. This is stronger evidence than the tuning set, but it is not independent external validation and should not be reused to tune conjunction-v1 weights.

## Summary

- judged changed pairs: 56
- judgments with comments: 56/56
- distribution: {"0":2,"1":19,"2":8,"3":27}
- A-only / B-only: 28/28
- A-only relevant: 15
- B-only relevant: 20
- net relevant positions: +5
- exact paired ΔP@10: +0.025
- ordinal relevance A/B: 54/62
- ordinal Δ: +8
- binary improved/worsened/tied queries: 5/2/13
- ordinal improved/worsened/tied queries: 6/4/10

## By family

| family | queries | A rel | B rel | net | ΔP@10 | ordinal Δ |
|---|---:|---:|---:|---:|---:|---:|
| ethics-medicine | 5 | 6 | 7 | +1 | +0.02 | +1 |
| aesthetics-psychology | 5 | 4 | 8 | +4 | +0.08 | +7 |
| philosophy-technology-education | 5 | 3 | 4 | +1 | +0.02 | +1 |
| political-philosophy-economics | 5 | 2 | 1 | -1 | -0.02 | -1 |

## By language

| language | queries | A rel | B rel | net | ΔP@10 | ordinal Δ |
|---|---:|---:|---:|---:|---:|---:|
| es | 4 | 0 | 2 | +2 | +0.05 | +4 |
| en | 4 | 5 | 5 | +0 | +0 | +0 |
| de | 4 | 4 | 3 | -1 | -0.025 | -3 |
| fr | 4 | 2 | 3 | +1 | +0.025 | +3 |
| pt | 4 | 4 | 7 | +3 | +0.075 | +4 |

## Per query

| query | lang | changed pairs | A rel | B rel | net | ΔP@10 | ordinal Δ |
|---|---|---:|---:|---:|---:|---:|---:|
| cv-es-01 · ética en medicina | es | 0 | 0 | 0 | +0 | +0 | +0 |
| cv-en-01 · ethics in medicine | en | 0 | 0 | 0 | +0 | +0 | +0 |
| cv-de-01 · Ethik in der Medizin | de | 2 | 1 | 1 | +0 | +0 | +0 |
| cv-fr-01 · éthique en médecine | fr | 2 | 1 | 1 | +0 | +0 | +0 |
| cv-pt-01 · ética em medicina | pt | 10 | 4 | 5 | +1 | +0.1 | +1 |
| cv-es-02 · estética en psicología | es | 4 | 0 | 2 | +2 | +0.2 | +3 |
| cv-en-02 · aesthetics in psychology | en | 4 | 2 | 1 | -1 | -0.1 | -2 |
| cv-de-02 · Ästhetik in der Psychologie | de | 2 | 1 | 1 | +0 | +0 | +0 |
| cv-fr-02 · esthétique en psychologie | fr | 6 | 1 | 2 | +1 | +0.1 | +3 |
| cv-pt-02 · estética em psicologia | pt | 4 | 0 | 2 | +2 | +0.2 | +3 |
| cv-es-03 · filosofía de la tecnología en educación | es | 0 | 0 | 0 | +0 | +0 | +0 |
| cv-en-03 · philosophy of technology in education | en | 6 | 2 | 3 | +1 | +0.1 | +3 |
| cv-de-03 · Technikphilosophie in der Bildung | de | 6 | 1 | 1 | +0 | +0 | -2 |
| cv-fr-03 · philosophie de la technologie en éducation | fr | 0 | 0 | 0 | +0 | +0 | +0 |
| cv-pt-03 · filosofia da tecnologia em educação | pt | 0 | 0 | 0 | +0 | +0 | +0 |
| cv-es-04 · filosofía política en economía | es | 2 | 0 | 0 | +0 | +0 | +1 |
| cv-en-04 · political philosophy in economics | en | 2 | 1 | 1 | +0 | +0 | -1 |
| cv-de-04 · politische Philosophie in der Ökonomie | de | 2 | 1 | 0 | -1 | -0.1 | -1 |
| cv-fr-04 · philosophie politique en économie | fr | 0 | 0 | 0 | +0 | +0 | +0 |
| cv-pt-04 · filosofia política em economia | pt | 4 | 0 | 0 | +0 | +0 | +0 |

## Interpretation boundary

The exact paired ΔP@10 applies to the frozen 20-query same-pool holdout only. It does not provide absolute P@10 because unchanged Top-10 documents were intentionally not relabeled, and it is not an external population estimate. The holdout queries and labels must not be used to retune conjunction-v1 if this result is to remain validation evidence.
