---
type: experiment
status: active
area: evaluation
model: qwen3-reranker-0.6b
runtime: browser-webgpu-q8
updated: 2026-09-28
---

# Qwen3 Browser q8 · Confirmatory Holdout v2

## Pregunta

Este experimento comprueba en datos frescos hipótesis surgidas después del primer holdout browser-q8.

No autoriza por sí mismo un cambio de producción.

## Diseño congelado

- 30 consultas.
- 6 familias semánticas.
- 5 idiomas.
- 10 philosopher-concept.
- 10 work.
- 10 interdisciplinary-challenge.
- Top 20 de producción congelado.
- 600 pares query-document.
- Mismo pool para A y B.

### A

Orden original de producción.

### B

Mismos 20 documentos ordenados por `browser_q8_raw_score` descendente.

Empates exactos: production rank original ascendente.

Sin threshold, blending ni cambios del pool.

## Hipótesis

**H1:** ΔP@10 interdisciplinario > 0.

**H2:** ΔP@10 interdisciplinario > ΔP@10 work.

**H3:** delta de documentos con relevancia 3 en Top 10 interdisciplinario > 0.

Philosopher-concept es descriptivo y no direccional.

## Estado

- Preregistration: ✓
- 30-query set: ✓
- Production Top-20 pool: ✓
- 600-pair dataset: ✓
- Browser q8 raw scores: ✓
- A/B builder: ✓ congelado
- A/B artifact: ✓ congelado
- Blind-audit builder: ✓ congelado
- Blind audit sample: ✓ congelada, 212 ítems
- Human adjudication: pendiente
- Unblinding: pendiente
- H1/H2/H3 analysis: pendiente

## Artefactos congelados

- Production pool SHA: `122a9414377c10e4805639e5022cce926130efd17e82111abd4756d5be33f9f8`
- Dataset SHA: `87270e16257135c133db8b395c8a65eb6197d681ded54bd68426f1c4a8666fdd`
- Browser q8 scores SHA: `ea8f06baf5144ff109b05ae9b9b690d9b25cf7cb7a12ae2dbbdeb38943aed6f1`
- Score freeze commit: `0d85099abf5c4d5e78b4de61019b324d3242b525`
- A/B builder freeze commit: `78297bb10f51687108f4e030a3352a477892f759`
- A/B artifact SHA: `98d7943dc6af9590ccf4360e63f7b00e8f1c1364b4ba8a0a5ef64d77f3b2043c`
- A/B metadata SHA: `f803b3adfb86186dea82f2fa3e43872147226d0d831d6a0f6ae4965f37c927ef`
- A/B artifact freeze commit: `96ade78cd3a18a0baf37eeb21ab495ae41f83a95`
- Blind-audit builder freeze commit: `16cb6e06e6e5ec5e0c522b3f5f52e12d3777e9a3`
- Blind sample SHA: `ac02b495b7aef8dcdb84da6fed90206a788c859c7acac4dca58610fd6409bc7f`
- Blind sample metadata SHA: `5cc4a587a3835c40556dcc2ef8314a774ab9a0ecf0765d53030a9aeb07b43e5c`
- Blind worksheet SHA: `74f4f3ae131bc7eebb817334e9ab51ae500ebf1f13673c6223f83630b54d6ee1`
- Blind sample freeze commit: `2b86091cbbbd9d7191eb0b358dc7dfc6585644a5`

## A/B preflight congelado

- Pairs: **600**
- A/B rows: **1200**
- Top-10 changed pairs: **212**
- Blind audit candidates: **212**
- Mean absolute rank shift: **5.103333**
- Maximum rank shift: **19**
- Equal-score pairs: **8**
- Predicted A/B SHA: `98d7943dc6af9590ccf4360e63f7b00e8f1c1364b4ba8a0a5ef64d77f3b2043c`

Estos datos describen movimiento estructural. Todavía no muestran que B sea mejor que A.

## Muestra ciega congelada

La muestra contiene los 212 pares query-document de la diferencia simétrica entre los Top 10 de A y B, identificados públicamente como `Q8C001`–`Q8C212`.

Los registros para adjudicación ocultan condición, rangos, scores, IDs internos y procedencia de recuperación. No existe un mapa privado preadjudicación. La reconstrucción de A/B sólo está permitida después de completar y congelar los 212 juicios.

Los artefactos científicos canónicos permanecen en `benchmark/qwen3/browser/q8-confirmatory-holdout-v2/`. Esta nota es una capa conceptual y de navegación; no sustituye esos archivos ni sus hashes.

## Próximo límite

1. Adjudicar `Q8C001`–`Q8C212` en escala 0–3 sin conocer A/B.
2. Verificar completitud y congelar los juicios.
3. Sólo entonces reconstruir procedencia A/B.
4. Ejecutar el análisis congelado de H1/H2/H3.

Hasta congelar los juicios no se debe abrir ni producir una correspondencia entre `audit_id`, condición, rango o score.

## Relacionado

- [[Judgment-Protocol]]
- [[Evaluation-Lineage]]
- [[Source-Reports/browser/q8-human-holdout/reports/qwen3-browser-q8-human-holdout-v1-human-delta]]
- [[Source-Reports/EXPERIMENT_LOG]]
