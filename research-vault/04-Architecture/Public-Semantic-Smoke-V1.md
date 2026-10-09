---
type: validation
area: semantic-retrieval
status: pass-with-data-quality-findings
updated: 2026-10-09
---

# Smoke público semántico V1

## Pregunta operacional

¿La alfa pública puede ejecutar de forma reproducible las cinco consultas internas congeladas contra el índice completo, devolver Top 10 y mantener desactivados tanto el fallback como el reranker?

Este smoke no pregunta todavía si cada documento es humanamente relevante. La similitud del modelo no se trata como etiqueta ni como probabilidad de relevancia.

## Contrato

- endpoint: `https://filosofia-semantic.tail829c9b.ts.net/api/search/semantic`;
- cinco consultas congeladas de `queries-v1.jsonl`;
- diez resultados por consulta;
- ejecución secuencial, concurrencia 1;
- cero reintentos;
- `enable_reranker = false`;
- outputs JSON, JSONL y log, sin UI experimental.

El runner quedó congelado en `3110941`. La primera ejecución se detuvo al encontrar un documento con ID estable y abstract sustantivo, pero título vacío. El intento parcial fue preservado sin reintento oficial. El contrato se corrigió en `e4f253d` para contar y registrar títulos vacíos, sin rechazarlos ni inventar metadata, y sólo entonces se realizó la captura completa.

## Resultado

Estado: `PASS_WITH_DATA_QUALITY_FINDINGS`.

- salud: `ready`, 451.823 documentos;
- consultas completas: 5/5;
- respuestas HTTP 200: 5/5;
- resultados conservados: 50;
- fallback de frontend: 0;
- reranker usado: 0;
- `rerank_score` no nulo: 0;
- títulos vacíos: 1;
- latencia mínima: 0,733 s;
- latencia mediana: 1,501 s;
- latencia media: 2,561 s;
- latencia máxima: 6,184 s.

Las latencias pertenecen a un servicio caliente. Los 17,373 s de la primera consulta del intento detenido no constituyen una medición controlada de cold start y no se mezclan con el resumen final.

## Hallazgos de calidad

La inspección descriptiva, sin adjudicación humana, encontró:

- un resultado sin título, pero con ID OpenAlex y abstract francés;
- documentos distintos con título y abstract iguales o casi iguales;
- mojibake en un resultado en portugués;
- HTML literal en un título;
- deriva temática visible en la consulta sobre Frege: un resultado centrado en Husserl y Heidegger.

Estos hallazgos justifican trabajo prospectivo de higiene de metadata y deduplicación a nivel de obra. No deben convertirse retrospectivamente en labels, tuning ni una afirmación de precisión del ranking.

## Evidencia canónica

La fuente ejecutable permanece en el worktree de ingeniería:

- commit de artefactos y reporte: `60bf895`;
- `benchmark/semantic-retrieval/public-smoke-v1/`;
- `benchmark/semantic-retrieval/public-smoke-v1-failed-attempt-1/`;
- SHA-256 de resultados: `ad2f581a1c5714721b088ff24c716876c86bdba6b531abc6200349875cf0490e`;
- SHA-256 del resumen: `466338b820f12b2c4016f7b98807ce999852adb3e9da999622e9cfc7dbf6eff8`.

Esta nota sólo conserva interpretación conceptual e histórica. No es un input ejecutable.

## Siguiente gate

1. Diseñar una corrección de calidad de metadata y deduplicación que no altere los outputs congelados.
2. Repetir un smoke prospectivo únicamente después de congelar el nuevo contrato.
3. Si se desea medir relevancia, abrir una evaluación humana separada, ciega y explícita.
4. Mantener el reranker fuera de la ruta pública predeterminada.
