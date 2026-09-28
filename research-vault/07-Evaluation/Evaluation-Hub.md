---
type: hub
area: evaluation
project: InvestigacionFilosofica
updated: 2026-09-28
---

# Evaluación, jueces y Qwen3

Esta sección reconstruye la historia experimental con la que se ha evaluado el motor de Investigación Filosófica.

Los archivos de `Source-Reports/` son snapshots de los artefactos Markdown originales tomados del commit `78297bb10f51687108f4e030a3352a477892f759`.

## Mapa

- [[Judgment-Protocol]]
- [[Evaluation-Lineage]]
- [[Qwen3-Reranker-Laboratory]]
- [[Qwen3-Browser-Q8-Confirmatory-v2]]

## Informes originales

- [[Source-Reports/README|Qwen3 reranking laboratory]]
- [[Source-Reports/reports/qwen3-reranker-v1.calibration|Calibración inicial]]
- [[Source-Reports/validation/reports/qwen3-reranker-v1-holdout-v1.validation|Holdout del scorer]]
- [[Source-Reports/ranking/reports/qwen3-ranking-v1-human-delta|Ranking development · juicio humano]]
- [[Source-Reports/ranking/reports/qwen3-ranking-v1-movement|Ranking development · movimiento]]
- [[Source-Reports/ranking/validation/reports/qwen3-ranking-holdout-v1-human-delta|Ranking holdout · juicio humano]]
- [[Source-Reports/ranking/validation/reports/qwen3-ranking-holdout-v1-movement|Ranking holdout · movimiento]]
- [[Source-Reports/browser/q8-human-holdout/reports/qwen3-browser-q8-human-holdout-v1-human-delta|Browser q8 holdout v1]]
- [[Source-Reports/ranking/1024-development/reports/qwen3-ranking-1024-development-v1.report|1024 tokens]]
- [[Source-Reports/ranking/512-development/reports/qwen3-ranking-512-development-v1.report|512 tokens]]
- [[Source-Reports/EXPERIMENT_LOG|Bitácora experimental completa]]

## Distinción epistemológica

**Juicio humano:** adjudicación independiente de relevancia.

**AI silver histórico:** etiquetas automáticas auxiliares; no sustituyen al gold humano.

**Qwen3 scorer/reranker:** señal continua utilizada para ordenar documentos; no constituye por sí misma el juicio final.

## Principio

> Separar recuperación, puntuación del modelo, construcción de condiciones y juicio humano permite saber qué componente está produciendo el efecto observado.
