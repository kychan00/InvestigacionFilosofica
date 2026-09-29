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

La ruta API del marco público quedó preservada como historia output-free y fue retirada después del `throttle_violation` registrado en `bdbfad4175bf2e15ab22fe44231f71f0d6903c7c`. La sustitución prospectiva utiliza el snapshot semanal oficial de Stack Exchange Data Explorer y conserva la elegibilidad y privacidad sustantivas. Tras congelar SQL, contrato y normalizador, la ejecución única produjo 9.846 preguntas elegibles. El snapshot JSONL sanitizado y su metadata quedaron congelados en `fea8553`, con SHA-256 `3dc7ce68a91f7fbc5d46550a12d61d438a84c40528ad859ee1e743d2ef222374` y `454af13ddc5c8d712f2f6da9817c61424b60ef2b64b05dc3a79c0bd3aea77965`, respectivamente.

El clasificador de intención se congeló antes de leer filas en `401102e` y su aplicación única quedó congelada en `8b9484c`. Produjo 3.570 candidatos exactos y explicables —1.743 philosopher-concept, 84 work y 1.743 interdisciplinary-challenge— sin calcular selección. Sus hashes canónicos son `b01f07c121007512294a30e4ac59d2c45d3ade787a5a210dc859019a01f30ce0` para JSONL y `9cc891a999612b3e78b0b757128d462bcf92fe6a3cb477ced7dbfa1bba75b3a6` para metadata.

Las reglas de colisión y selección se congelaron antes de aplicarse. El selector corregido `b898d6d98127370321b8c2aa87dbb82c7947c0e7` contrastó 3.570 candidatos contra 150 consultas previas, excluyó 154 candidatos únicos y fijó 12 consultas balanceadas por intención e idioma. La selección quedó congelada en `b8df0db2ddcd55a875e12d030dc77d2ae14e9165`, con hashes `ba03242da8a3e44440b9baf1de5deb3a009af072c3ac122ec640bb55f977b65d` y `75634c79e91569575d244643d1f21fda0b1cd6b9f38d31eb0a3d11ce0d6dfe6d`.

El paquete ciego de nueve traducciones se congeló en `ea7f58e13edf0d0c8b0d248cfa5535eaf0cfd07b`, con hashes `fad140a7ef765147f5fc365a82f184391fc90e81c7a34d39f4dfcddf6abe8f30` y `93e7cc23b4cc4ed55b7c6e8e0780c68812dfae72237b347d0b000089ebfdb4ab`. No contiene provenance experimental, ranking, score, retrieval ni labels.

El retorno humano verificado quedó congelado en `36102cdc2c35fd97dac702fcc7adde581f1fc63b`, con hashes `84ebbd50bc552cc388c74ae934a436c1110ae4943e526f8a19880af04669dbb1` y `54bc94313cbf18f6ac83b5c18cf6a1aa3df9ceeb72bb18ad97d98e190819d66f`. Nueve ítems tienen preparación humana, verificación independiente, roles anónimos distintos, seis checks verdaderos y estado `verified`; no se almacenan nombres reales.

La preregistración ejecutable quedó congelada en `1956bb7e5b4674298bda47306f9edb39ba67aef6`, con query set SHA-256 `2ead8ff5cf611dfe8836ab625d05b293fd0538e9159e663a7822458cb416a5af` y contrato SHA-256 `d75981a5f96a625ece08f94437ff7a3e1fbd2830f1ab0e9f2fd0a5dd88f75a22`. La inferencia formal es sólo global: macro-ΔP@10 sobre 12 consultas y prueba exacta unilateral de 4.096 sign flips. La unión completa permite P@10 absoluto; cualquier abstención única no resuelta vuelve inconcluso el gate. Idioma e intención son descriptivos y ningún resultado cambia producción automáticamente.

El runner productivo headless quedó congelado en `2462f9857a6841bb23dc284c7fb84f365969e405`. El preflight confirmó `src` idéntico a producción, hashes exactos y outputs ausentes. La ejecución única produjo 240 filas —20 por cada consulta— y el pool quedó congelado en `4c0675a`, con SHA-256 `65f57ab021dc3d196ed3026e2785db3694cdc4a060a6668804793fb5132f84b2` y metadata SHA-256 `2ae131641505b566ced896841e8d23847a583b940f42c925141d4c836dea43f9`. No hubo Qwen, labels, sustitución de consultas, inserción manual ni UI interactiva. La carrera de limpieza del perfil temporal ocurrió después de finalizar ambos artefactos y se corrigió en `7f3abd0` sin rerun. El siguiente gate es el dataset limpio de 240 pares; inferencia sigue bloqueada.
