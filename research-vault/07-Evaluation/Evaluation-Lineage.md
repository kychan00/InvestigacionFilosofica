---
type: lineage
area: evaluation
updated: 2026-09-28
---

# Linaje de evaluación

## Secuencia

Human benchmark → Qwen3 calibration → fresh scorer holdout → ranking development → fresh ranking holdout → 1024-token development check → browser q8 feasibility/parity → browser q8 human holdout v1 → post-hoc mechanism analysis → confirmatory holdout v2.

## Desarrollo inicial

La calibración inicial estudió la relación entre los scores Qwen y los juicios humanos. Estos datos son desarrollo.

→ [[Source-Reports/reports/qwen3-reranker-v1.calibration]]

## Holdout del scorer

El umbral aprendido en desarrollo se congeló antes de probarse en un conjunto nuevo.

→ [[Source-Reports/validation/reports/qwen3-reranker-v1-holdout-v1.validation]]

## Ranking development

La pregunta cambió de clasificación a ranking: si Qwen puede mejorar el orden dentro del mismo Top 20 recuperado por producción.

→ [[Source-Reports/ranking/reports/qwen3-ranking-v1-human-delta]]

## Holdout de ranking

Se evaluó el reranking puro sobre consultas nuevas manteniendo el mismo pool.

→ [[Source-Reports/ranking/validation/reports/qwen3-ranking-holdout-v1-human-delta]]

## Browser q8

La implementación cuantizada del navegador se evaluó separadamente porque cuantización y runtime podían modificar el ranking.

→ [[Source-Reports/browser/q8-human-holdout/reports/qwen3-browser-q8-human-holdout-v1-human-delta]]

## Confirmación browser-q8 v2

Los resultados del primer browser holdout motivaron tres hipótesis preregistradas que se probaron en un segundo holdout fresco. El experimento ya está cerrado: H1 recibió apoyo direccional; H2 y H3 no. La mejora binaria descriptiva global no elimina el carácter mixto del resultado ni autoriza un cambio automático de producción.

→ [[Qwen3-Browser-Q8-Confirmatory-v2]]

→ [[Source-Reports/browser/q8-confirmatory-holdout-v2/reports/qwen3-browser-q8-confirmatory-holdout-v2-human-delta]]

## Siguiente nivel de evidencia

El candidato permanece research-only. Una eventual promoción requiere evidencia externa independiente, con nuevas consultas o marco de muestreo, adjudicador independiente y preregistración congelada antes de retrieval.

El primer hito de planificación externa quedó congelado en el repositorio canónico como paquete ciego y anónimo de incorporación. No era una preregistración y mantuvo bloqueados retrieval, inferencia, auditoría y juicio mientras se confirmaban las condiciones de colaboración.

El intake posterior confirmó el rol exclusivamente adjudicador, la independencia, cuatro idiomas y un techo aproximado de 250 pares. El diseño de capacidad propone 12 consultas, unión completa de Top 10 y 10 repeticiones ciegas. Este hito continúa en estado de borrador: la fuente pública de preguntas, las reglas de selección y traducción y el análisis exacto aún deben congelarse antes de adquirir consultas o ejecutar el estudio.

→ [[Qwen3-External-Validation-Protocol]]
