---
type: concept
area: evaluation
updated: 2026-09-28
---

# Qwen3 Reranker Laboratory

El laboratorio Qwen3 está deliberadamente separado del ranking de producción.

Su función es comprobar si una señal neural multilingüe puede mejorar el orden de los resultados sin contaminar recuperación ni juicio humano.

## Flujo

Retrieval de producción → pool congelado → dataset limpio → Qwen raw score → ranking experimental → muestra ciega → juicio humano → análisis.

## Invariantes

- Los labels humanos no entran al reranker.
- Rank, score de producción, proveedor y condición A/B no entran al modelo.
- Los raw scores se congelan antes del análisis.
- A y B utilizan exactamente el mismo pool candidato.
- Un holdout observado no vuelve a tratarse como validación fresca.
- Movimiento estructural no equivale a mejora de calidad.

## Niveles epistemológicos

**Development:** exploración, calibración y formulación de hipótesis.

**Fresh internal validation:** evaluación posterior al congelamiento del candidato o hipótesis.

**External validation:** todavía no realizada.

## Estado confirmatorio

El confirmatory holdout browser-q8 v2 produjo evidencia mixta. La dirección positiva de H1 se replicó, pero el contraste H2 y la centralidad H3 no. Esto favorece conservar la separación entre laboratorio y producción: el resultado es informativo sobre el candidato, pero insuficiente para convertirlo automáticamente en política de ranking.

→ [[Evaluation-Lineage]]
