---
type: evaluation-protocol
area: semantic-retrieval
status: blind-judgment-pending
updated: 2026-10-09
---

# Semantic Retrieval · Reranker bounded V1

## Propósito

Evaluar descriptivamente si el reranker Qwen3 fijado mejora el orden de
resultados recuperados por el índice semántico completo V3.3, sin cambiar el
pool, usar labels durante inferencia o tocar producción.

## Diseño congelado

- cinco consultas internas preexistentes;
- 12 candidatos semánticos recuperados una sola vez por consulta;
- A: primeros diez por similitud semántica;
- B: mismo pool de doce ordenado por el reranker y truncado a diez;
- 60 pares consulta-documento puntuados en Apple MPS, batch 1;
- empates del reranker conservan el orden semántico;
- sin búsqueda lexical, filtros, blending, threshold ni tuning.

El runner y el protocolo se congelaron antes de inferencia en
`385cf12476cc7fc030cfdb5e1b5b15a93fa4b494`.

## Ejecución

La ejecución única terminó en 153,818 segundos. Produjo cinco filas A/B
internas y una unión ciega de 59 ítems únicos. No se utilizaron juicios humanos
durante retrieval o inferencia.

El paquete ciego quedó congelado en
`0dbd6e6a36b66ed94ecc283f2c03fe9bcdb2cf35`, con SHA-256
`53c68d09804c87d7764c8c4ca1698fb1c0898d12a41f98f4d0103ba841bfbcb4`.
Excluye condición, rango, scores y provenance de membresía. Los campos de
juicio permanecen vacíos.

El artefacto A/B interno tiene SHA-256
`2787efeb33c301ea3c83081fafffd3622073f01ad08e9f97f6b43eb0525c276a`
y no debe compartirse con quien juzgue relevancia.

## Juicio pendiente

Cada ítem recibe relevancia 0–3 o abstención justificada. Después de congelar
los 59 juicios se calculará:

- métrica primaria: macro `ΔnDCG@10`, B menos A;
- métricas descriptivas: `ΔP@10`, `ΔP@5`, cambios por consulta, cobertura y
  abstenciones;
- observación separada de duplicados bibliográficos aparentes.

Cinco consultas no autorizan significancia estadística ni promoción automática.
El A/B permanece oculto hasta congelar juicios.

## Canonicalidad

Los artefactos canónicos pertenecen a
`benchmark/semantic-retrieval/reranker-bounded-v1/` y al árbol ignorado de
artefactos del worktree de código. Esta nota conserva la interpretación
metodológica y no es input ejecutable.
