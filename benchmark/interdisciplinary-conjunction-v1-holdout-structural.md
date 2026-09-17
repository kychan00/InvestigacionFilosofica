# Interdisciplinary conjunction v1 · fresh holdout structural analysis

Structural analysis only. No human relevance labels are used. Conditions A and B came from one live retrieval per query and reranked the same candidate pool during collection; this report verifies the frozen A/B rows, exact score reconstruction for shared rows, and Top-10 membership changes.

> The finalized run preserves A/B Top-20 rows and collection metadata, but not the full candidatePoolIds array that the server validated before saving each query. Same-pool provenance therefore rests on the frozen runner/server contract plus the saved run, not a post-hoc full-pool snapshot.

## Summary

- run: benchmark/runs/interdisciplinary-conjunction-v1-holdout-105f196.jsonl
- runtime commit: 105f196c8364a945bbb2bcff9c842e88f4bd3b47
- preregistration base commit: bb9689d
- queries: 20
- frozen rows: 800
- queries with Top-10 membership change: 14/20
- changed Top-10 query-document pairs: 56
- membership replacements: 28
- A-only / B-only: 28/28
- shared-row score checks: 365
- score reconstruction mismatches: 0
- max score reconstruction error: 0

## By family

| family | queries changed | changed Top-10 pairs |
|---|---:|---:|
| ethics-medicine | 3/5 | 14 |
| aesthetics-psychology | 5/5 | 20 |
| philosophy-technology-education | 2/5 | 12 |
| political-philosophy-economics | 4/5 | 10 |

## By language

| language | queries changed | changed Top-10 pairs |
|---|---:|---:|
| es | 2/4 | 6 |
| en | 3/4 | 12 |
| de | 4/4 | 12 |
| fr | 2/4 | 8 |
| pt | 3/4 | 18 |

## Per query

| query | language | family | rows A/B | changed Top-10 pairs | replacements |
|---|---|---|---:|---:|---:|
| cv-es-01 · ética en medicina | es | ethics-medicine | 20/20 | 0 | 0 |
| cv-en-01 · ethics in medicine | en | ethics-medicine | 20/20 | 0 | 0 |
| cv-de-01 · Ethik in der Medizin | de | ethics-medicine | 20/20 | 2 | 1 |
| cv-fr-01 · éthique en médecine | fr | ethics-medicine | 20/20 | 2 | 1 |
| cv-pt-01 · ética em medicina | pt | ethics-medicine | 20/20 | 10 | 5 |
| cv-es-02 · estética en psicología | es | aesthetics-psychology | 20/20 | 4 | 2 |
| cv-en-02 · aesthetics in psychology | en | aesthetics-psychology | 20/20 | 4 | 2 |
| cv-de-02 · Ästhetik in der Psychologie | de | aesthetics-psychology | 20/20 | 2 | 1 |
| cv-fr-02 · esthétique en psychologie | fr | aesthetics-psychology | 20/20 | 6 | 3 |
| cv-pt-02 · estética em psicologia | pt | aesthetics-psychology | 20/20 | 4 | 2 |
| cv-es-03 · filosofía de la tecnología en educación | es | philosophy-technology-education | 20/20 | 0 | 0 |
| cv-en-03 · philosophy of technology in education | en | philosophy-technology-education | 20/20 | 6 | 3 |
| cv-de-03 · Technikphilosophie in der Bildung | de | philosophy-technology-education | 20/20 | 6 | 3 |
| cv-fr-03 · philosophie de la technologie en éducation | fr | philosophy-technology-education | 20/20 | 0 | 0 |
| cv-pt-03 · filosofia da tecnologia em educação | pt | philosophy-technology-education | 20/20 | 0 | 0 |
| cv-es-04 · filosofía política en economía | es | political-philosophy-economics | 20/20 | 2 | 1 |
| cv-en-04 · political philosophy in economics | en | political-philosophy-economics | 20/20 | 2 | 1 |
| cv-de-04 · politische Philosophie in der Ökonomie | de | political-philosophy-economics | 20/20 | 2 | 1 |
| cv-fr-04 · philosophie politique en économie | fr | political-philosophy-economics | 20/20 | 0 | 0 |
| cv-pt-04 · filosofia política em economia | pt | political-philosophy-economics | 20/20 | 4 | 2 |

## Aggregate conjunction buckets among changed pairs

- A-only buckets: {"area-only":24,"domain-only":3,"neither":1}
- B-only buckets: {"both":22,"domain-only":6}
- conjunction adjustments across all changed pairs: {"0":9,"2":22,"-2":24,"-1":1}

No document titles or side-specific audit items are emitted here, so the next human relevance audit can remain blind to which condition promoted or removed each document.
