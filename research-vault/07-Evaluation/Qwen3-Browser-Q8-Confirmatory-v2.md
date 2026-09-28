---
type: experiment
status: complete
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
- Raw human submission: ✓ congelada
- Blind judgment normalizer: ✓ congelado
- Human adjudication: ✓ 212/212, normalizada y congelada
- Post-judgment analyzer: ✓ congelado antes del unblinding
- Unblinding: ✓ ejecutado una vez
- H1/H2/H3 analysis: ✓ congelado
- Production change: ✗ no autorizado

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
- Raw human submission SHA: `a0155e47f37a97f915e84e30d386e59d6f259b6c89d57e6bcb358385927efdce`
- Raw submission metadata SHA: `709a2ac9fa8650e55df4e9221a171665c179c42f11ff09b724388c7056667856`
- Raw submission freeze commit: `56ef2ce2e06f2ed2371b0aad7d16091f33882ac9`
- Blind judgment normalizer freeze commit: `4e83e08d7c7463709091ab6827f4a891bb8d44b9`
- Normalized judgments SHA: `6dd083fc3a430f5dd5a3e7e3b7b61859e2f429edfad966a4097c11c58e516694`
- Normalized judgments metadata SHA: `b39f95f023e5dae949ef788c90e5d946cd8ab2360d33c27fb3d9f1e50594019b`
- Normalized judgments freeze commit: `35f4e2c929159cb78898663498990a65b6ae1a3e`
- Post-judgment analyzer SHA: `d5c2f729f49dc7bb5b6cb8721de8297c55508fc90965a4faf70b6bef3dbe9bc2`
- Post-judgment analyzer freeze commit: `f8fcd5498e27851dab8e21f2db46d76bea7f3b23`
- Human-delta JSON SHA: `6e9356ecad8fffa99e57f052a383a3fca48fd58bd7da40cb33e2d7f2f16ef95a`
- Human-delta Markdown SHA: `7a79f30d9591d9f1adb18787622cd854b0cb25cdc65a70ddf1102436fe0ad2c3`
- Human-delta result freeze commit: `2dd25cdbe3e005b8561041047932a9a4b0100465`

## A/B preflight congelado

- Pairs: **600**
- A/B rows: **1200**
- Top-10 changed pairs: **212**
- Blind audit candidates: **212**
- Mean absolute rank shift: **5.103333**
- Maximum rank shift: **19**
- Equal-score pairs: **8**
- Predicted A/B SHA: `98d7943dc6af9590ccf4360e63f7b00e8f1c1364b4ba8a0a5ef64d77f3b2043c`

Estos datos describían únicamente movimiento estructural antes del juicio. La evaluación humana posterior se documenta abajo.

## Muestra ciega congelada

La muestra contiene los 212 pares query-document de la diferencia simétrica entre los Top 10 de A y B, identificados públicamente como `Q8C001`–`Q8C212`.

Los registros para adjudicación ocultan condición, rangos, scores, IDs internos y procedencia de recuperación. No existe un mapa privado preadjudicación. La reconstrucción de A/B sólo está permitida después de completar y congelar los 212 juicios.

Los artefactos científicos canónicos permanecen en `benchmark/qwen3/browser/q8-confirmatory-holdout-v2/`. Esta nota es una capa conceptual y de navegación; no sustituye esos archivos ni sus hashes.

## Juicios humanos congelados

La persona adjudicadora confirmó que revisó personalmente los 212 ítems. La entrega textual original quedó preservada byte por byte antes de cualquier normalización. Contenía un bloque duplicado `Q8C041`–`Q8C080`: 39 duplicados tenían la misma etiqueta y `Q8C070` presentaba 1/2; la aclaración humana definitiva fijó `Q8C070 = 2`.

El normalizador determinista leyó únicamente la entrega ciega, su metadata y la muestra pública ciega. No leyó el A/B, scores del modelo, scores de producción, rangos, IDs internos ni procedencia de recuperación. Emitió 212 filas mínimas `Q8C001`–`Q8C212` con esta distribución:

- 0: **20**
- 1: **49**
- 2: **49**
- 3: **94**
- Relevantes con umbral preregistrado ≥2: **143**
- No relevantes: **69**

Los dos hashes generados coincidieron exactamente con el preflight y los juicios quedaron congelados antes de cualquier reconstrucción A/B. Esta distribución describía únicamente las etiquetas ciegas; el resultado A/B se produjo después desde un analizador congelado.

## Resultado confirmatorio congelado

| Hipótesis | Estimando congelado | Valor | Resultado direccional |
| --- | --- | ---: | --- |
| H1 | ΔP@10 interdisciplinario | **+0.060** | apoyada |
| H2 | ΔP@10 interdisciplinario − work | **−0.010** | no apoyada |
| H3 | Δcentral-3@10 interdisciplinario | **−0.010** | no apoyada |

H1 replica la dirección positiva preregistrada: B aporta 6 documentos relevantes netos en los 100 lugares Top 10 interdisciplinarios. H2 no se replica porque work obtiene `+0.070`, ligeramente por encima del `+0.060` interdisciplinario. H3 tampoco se replica: en las consultas interdisciplinarias B pierde un documento de relevancia 3 neto sobre 100 lugares.

### Descriptivo global

- A-only relevantes: **61/106**
- B-only relevantes: **82/106**
- Ganancia relevante neta de B: **+21**
- ΔP@10 exacto global: **+0.070**
- A-only central-3: **42/106**
- B-only central-3: **52/106**
- Δcentral-3@10 global: **+0.033333**
- Delta ordinal: **+45** (`192 → 237`)
- Consultas mejoradas / empeoradas / empatadas: **12 / 1 / 17**

Por intención, philosopher-concept fue `+0.080`, work `+0.070` e interdisciplinary-challenge `+0.060` en ΔP@10. Philosopher-concept permanece descriptivo porque no tenía hipótesis direccional preregistrada.

### Lectura metodológica

El resultado es mixto. Hay una mejora binaria global y apoyo direccional para H1, pero no para la superioridad comparativa interdisciplinaria de H2 ni para la centralidad interdisciplinaria de H3. No es correcto resumirlo como una confirmación total del reranker.

Los 194 lugares Top 10 compartidos por condición no fueron adjudicados. Por eso los deltas pareados son exactos, pero no se identifican P@10 absoluto, P@5, MRR ni nDCG. Tampoco se preregistró una prueba de significancia o potencia: “apoyada” significa únicamente que el signo del estimando satisface la regla direccional congelada.

Esta es validación humana interna fresca, no validación externa independiente. No hubo tuning, threshold, blending, cambio de pool ni modificación de producción.

## Cierre y siguiente decisión

El experimento está cerrado como registro científico reproducible. Su siguiente uso legítimo es informar una decisión separada, no reescribir el protocolo observado.

- No cambiar producción automáticamente.
- No ajustar q8 contra este holdout ya observado.
- Si se desea avanzar hacia producto, definir explícitamente una nueva decisión experimental o una validación externa independiente.
- Conservar este branch, hashes, juicios y reportes como evidencia inmutable del resultado mixto.

## Relacionado

- [[Judgment-Protocol]]
- [[Evaluation-Lineage]]
- [[Source-Reports/browser/q8-confirmatory-holdout-v2/reports/qwen3-browser-q8-confirmatory-holdout-v2-human-delta]]
- [[Source-Reports/browser/q8-human-holdout/reports/qwen3-browser-q8-human-holdout-v1-human-delta]]
- [[Source-Reports/EXPERIMENT_LOG]]
