---
type: evaluation-protocol
area: semantic-retrieval
status: complete-descriptive
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
Excluye condición, rango, scores y provenance de membresía.

El artefacto A/B interno tiene SHA-256
`2787efeb33c301ea3c83081fafffd3622073f01ad08e9f97f6b43eb0525c276a`
y no debe compartirse con quien juzgue relevancia.

## Juicio y unblinding

El retorno humano conservó las 59 filas, su orden, IDs y contenido documental.
Los 59 juicios 0–3 quedaron completos, sin abstenciones, y se congelaron antes
de abrir A/B en `10a280221c346fe4301294abba73845a0f9393cd`. Su SHA-256 es
`cc7fbd39d9ace255918d81581f59b1ab96d1c3688ff3e7b5e0e904c1a3f81f0e`.

El analizador y sus reglas se congelaron después del juicio pero antes del
unblinding en `9235d54c541ff8b62d9b02b9849a70ffe843e689`. Fijó ganancia
`2^relevancia - 1`, descuento logarítmico, IDCG sobre la unión ciega Top 10 y
umbral binario de relevancia en 2. Luego se ejecutó una sola vez.

## Resultado descriptivo

El resultado canónico quedó congelado en
`1d457e580029334c5bb63fbb9cacffe599eb7d62`; `analysis.json` tiene SHA-256
`f21d7c6b5c9b55477a8519de8ed2d04c07a0c21b2fa8b75ec2ab81f3678e6cf2`.
Un recálculo independiente reprodujo los efectos:

- macro `ΔnDCG@10` B−A: `−0,001608360268`;
- macro `ΔP@10` B−A: `+0,02`;
- macro `ΔP@5` B−A: `0,0`;
- dos consultas mejoraron y dos empeoraron en nDCG; una quedó igual;
- dos grupos de títulos exactamente iguales tras normalización quedaron
  registrados como observación de calidad de datos.

La mejora direccional primaria no se observó. El pequeño aumento en P@10 no
compensa ese resultado ni constituye evidencia suficiente para promover el
reranker. Cinco consultas no autorizan significancia estadística, tuning ni
cambio automático de producción.

## Canonicalidad

Los artefactos canónicos pertenecen a
`benchmark/semantic-retrieval/reranker-bounded-v1/` y al árbol ignorado de
artefactos del worktree de código. Esta nota conserva la interpretación
metodológica y no es input ejecutable.
