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

**External validation:** realizada y cerrada; dirección pareada positiva exactamente identificada, pero gate formal inconcluso por una abstención primaria y sin p-value.

## Estado confirmatorio

El confirmatory holdout browser-q8 v2 produjo evidencia mixta. La dirección positiva de H1 se replicó, pero el contraste H2 y la centralidad H3 no. Esto favorece conservar la separación entre laboratorio y producción: el resultado es informativo sobre el candidato, pero insuficiente para convertirlo automáticamente en política de ranking.

El candidato permanece research-only. [[Qwen3-External-Validation-Protocol]] registra el gate externo ya ejecutado y cerrado; una nueva evidencia admisible requiere una réplica prospectiva, no tuning adicional sobre los holdouts o labels observados.

La integración de ingeniería posterior está documentada en [[Qwen3-Browser-Q8-Opt-in-Prototype]]. Es un modo manual oculto y reversible para estudiar factibilidad, no una promoción del candidato ni un cambio del ranking por defecto.

→ [[Evaluation-Lineage]]
