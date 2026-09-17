# Interdisciplinary conjunction candidate human audit v1

Development-only human audit of every query-document pair whose Top-10 membership differs between the frozen multilingual B ranking and either tuned conjunction profile. Existing human labels are reused only for identical query-document pairs; unresolved candidates were judged blind to side, rank, score, evidence bucket, and profile membership. Shared Top-10 rows cancel, so paired ΔP@10 is exact for the frozen B pools but is tuning evidence, not independent validation.

> This is development/tuning evidence. Do not reuse these queries or labels as independent validation of the final conjunction ranking change.

## Summary

- candidate query-document pairs: 29
- prior human labels reused: 10
- newly judged blind: 19
- final judgments: 29
- judgments with comments: 29/29

## Profile comparison

| profile | baseline-only rel | profile-only rel | net relevant | exact paired ΔP@10 | ordinal Δ | improved/worsened/tied |
|---|---:|---:|---:|---:|---:|---:|
| conservative | 7 | 8 | +1 | +0.005 | +4 | 3/2/15 |
| moderate | 7 | 10 | +3 | +0.015 | +9 | 4/2/14 |

## conservative

### By family

| family | queries | net relevant | ΔP@10 |
|---|---:|---:|---:|
| ethics-artificial-intelligence | 5 | +0 | +0 |
| epistemology-psychology | 5 | -1 | -0.02 |
| philosophy-science-physics | 5 | +1 | +0.02 |
| logic-linguistics | 5 | +1 | +0.02 |

### By language

| language | queries | net relevant | ΔP@10 |
|---|---:|---:|---:|
| es | 4 | +0 | +0 |
| en | 4 | +0 | +0 |
| de | 4 | +1 | +0.025 |
| fr | 4 | +0 | +0 |
| pt | 4 | +0 | +0 |

### Per query

| query | lang | changed pairs | baseline rel | profile rel | net | ΔP@10 | ordinal Δ |
|---|---|---:|---:|---:|---:|---:|---:|
| val-es-02 · epistemología en psicología | es | 2 | 1 | 1 | +0 | +0 | -1 |
| val-de-02 · Epistemologie in der Psychologie | de | 2 | 0 | 1 | +1 | +0.1 | +2 |
| val-fr-02 · épistémologie en psychologie | fr | 2 | 1 | 0 | -1 | -0.1 | -2 |
| val-pt-02 · epistemologia em psicologia | pt | 4 | 2 | 1 | -1 | -0.1 | -1 |
| val-fr-03 · philosophie des sciences en physique | fr | 2 | 1 | 1 | +0 | +0 | +1 |
| val-pt-03 · filosofia da ciência em física | pt | 2 | 0 | 1 | +1 | +0.1 | +2 |
| val-es-04 · lógica en lingüística | es | 2 | 0 | 0 | +0 | +0 | +0 |
| val-en-04 · logic in linguistics | en | 2 | 1 | 1 | +0 | +0 | +0 |
| val-fr-04 · logique en linguistique | fr | 4 | 1 | 2 | +1 | +0.1 | +3 |
| val-pt-04 · lógica em linguística | pt | 2 | 0 | 0 | +0 | +0 | +0 |

## moderate

### By family

| family | queries | net relevant | ΔP@10 |
|---|---:|---:|---:|
| ethics-artificial-intelligence | 5 | +1 | +0.02 |
| epistemology-psychology | 5 | +0 | +0 |
| philosophy-science-physics | 5 | +1 | +0.02 |
| logic-linguistics | 5 | +1 | +0.02 |

### By language

| language | queries | net relevant | ΔP@10 |
|---|---:|---:|---:|
| es | 4 | +0 | +0 |
| en | 4 | +0 | +0 |
| de | 4 | +2 | +0.05 |
| fr | 4 | +0 | +0 |
| pt | 4 | +1 | +0.025 |

### Per query

| query | lang | changed pairs | baseline rel | profile rel | net | ΔP@10 | ordinal Δ |
|---|---|---:|---:|---:|---:|---:|---:|
| val-pt-01 · ética em inteligência artificial | pt | 2 | 0 | 1 | +1 | +0.1 | +2 |
| val-es-02 · epistemología en psicología | es | 2 | 1 | 1 | +0 | +0 | +0 |
| val-de-02 · Epistemologie in der Psychologie | de | 4 | 0 | 2 | +2 | +0.2 | +4 |
| val-fr-02 · épistémologie en psychologie | fr | 2 | 1 | 0 | -1 | -0.1 | -2 |
| val-pt-02 · epistemologia em psicologia | pt | 4 | 2 | 1 | -1 | -0.1 | -1 |
| val-fr-03 · philosophie des sciences en physique | fr | 2 | 1 | 1 | +0 | +0 | +1 |
| val-pt-03 · filosofia da ciência em física | pt | 2 | 0 | 1 | +1 | +0.1 | +2 |
| val-es-04 · lógica en lingüística | es | 2 | 0 | 0 | +0 | +0 | +0 |
| val-en-04 · logic in linguistics | en | 2 | 1 | 1 | +0 | +0 | +0 |
| val-fr-04 · logique en linguistique | fr | 4 | 1 | 2 | +1 | +0.1 | +3 |
| val-pt-04 · lógica em linguística | pt | 2 | 0 | 0 | +0 | +0 | +0 |
