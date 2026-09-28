---
type: hub
area: evaluation
project: InvestigacionFilosofica
updated: 2026-09-28
---

# Evaluación, jueces y Qwen3

Esta sección reconstruye la historia experimental con la que se ha evaluado el motor de Investigación Filosófica.

Los archivos históricos iniciales de `Source-Reports/` son snapshots tomados del commit `78297bb10f51687108f4e030a3352a477892f759`. El reporte confirmatorio v2 se añadió como snapshot del resultado congelado en `2dd25cdbe3e005b8561041047932a9a4b0100465`. En todos los casos, la fuente canónica permanece en `benchmark/qwen3/` del worktree experimental.

## Mapa

- [[Judgment-Protocol]]
- [[Evaluation-Lineage]]
- [[Qwen3-Reranker-Laboratory]]
- [[Qwen3-Browser-Q8-Confirmatory-v2]]
- [[Qwen3-External-Validation-Protocol]]

## Informes originales

- [[Source-Reports/README|Qwen3 reranking laboratory]]
- [[Source-Reports/reports/qwen3-reranker-v1.calibration|Calibración inicial]]
- [[Source-Reports/validation/reports/qwen3-reranker-v1-holdout-v1.validation|Holdout del scorer]]
- [[Source-Reports/ranking/reports/qwen3-ranking-v1-human-delta|Ranking development · juicio humano]]
- [[Source-Reports/ranking/reports/qwen3-ranking-v1-movement|Ranking development · movimiento]]
- [[Source-Reports/ranking/validation/reports/qwen3-ranking-holdout-v1-human-delta|Ranking holdout · juicio humano]]
- [[Source-Reports/ranking/validation/reports/qwen3-ranking-holdout-v1-movement|Ranking holdout · movimiento]]
- [[Source-Reports/browser/q8-human-holdout/reports/qwen3-browser-q8-human-holdout-v1-human-delta|Browser q8 holdout v1]]
- [[Source-Reports/browser/q8-confirmatory-holdout-v2/reports/qwen3-browser-q8-confirmatory-holdout-v2-human-delta|Browser q8 confirmatory holdout v2]]
- [[Source-Reports/ranking/1024-development/reports/qwen3-ranking-1024-development-v1.report|1024 tokens]]
- [[Source-Reports/ranking/512-development/reports/qwen3-ranking-512-development-v1.report|512 tokens]]
- [[Source-Reports/EXPERIMENT_LOG|Bitácora experimental completa]]

## Distinción epistemológica

**Juicio humano:** adjudicación independiente de relevancia.

**AI silver histórico:** etiquetas automáticas auxiliares; no sustituyen al gold humano.

**Qwen3 scorer/reranker:** señal continua utilizada para ordenar documentos; no constituye por sí misma el juicio final.

## Principio

> Separar recuperación, puntuación del modelo, construcción de condiciones y juicio humano permite saber qué componente está produciendo el efecto observado.

El confirmatory holdout v2 está cerrado: H1 recibió apoyo direccional, H2 y H3 no. El resultado mixto no autoriza por sí mismo cambios de ranking en producción.

El gate posterior conserva browser-q8 como candidato research-only. La siguiente evidencia admisible requiere el protocolo de validación externa independiente. El profesor externo ya confirmó independencia, rol exclusivamente adjudicador, cuatro idiomas y capacidad para aproximadamente 200–250 pares. Existe un diseño provisional de 12 consultas y hasta 250 filas ciegas.

La ruta API del marco público quedó preservada como historia output-free y fue retirada después del `throttle_violation` registrado en `bdbfad4175bf2e15ab22fe44231f71f0d6903c7c`. La sustitución prospectiva utiliza el snapshot semanal oficial de Stack Exchange Data Explorer y conserva la elegibilidad y privacidad sustantivas. Tras congelar SQL, contrato y normalizador, la ejecución única produjo 9.846 preguntas elegibles. El snapshot JSONL sanitizado y su metadata quedaron congelados en `fea8553`, con SHA-256 `3dc7ce68a91f7fbc5d46550a12d61d438a84c40528ad859ee1e743d2ef222374` y `454af13ddc5c8d712f2f6da9817c61424b60ef2b64b05dc3a79c0bd3aea77965`, respectivamente. La adquisición no clasificó ni seleccionó consultas y no ejecutó traducción, retrieval, inferencia o juicio. El siguiente límite es congelar el clasificador de intención sobre esos campos públicos; selección, traducciones y preregistración siguen pendientes.
