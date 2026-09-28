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

## Confirmación actual

Los resultados del primer browser holdout motivaron hipótesis que ahora se prueban en un segundo holdout fresco.

→ [[Qwen3-Browser-Q8-Confirmatory-v2]]
