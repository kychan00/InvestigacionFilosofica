---
type: protocol
status: draft
area: evaluation
candidate: qwen3-browser-q8-1024
updated: 2026-09-28
---

# Qwen3 · Protocolo de validación externa independiente

## Propósito

Definir la siguiente fuente legítima de evidencia para el candidato browser-q8 después del resultado mixto de [[Qwen3-Browser-Q8-Confirmatory-v2]].

Este documento es un protocolo conceptual y de gobernanza, no una preregistración ejecutable ni autorización para iniciar recolección. La preregistración canónica futura deberá vivir en `benchmark/qwen3/` y congelarse antes de recuperar candidatos.

## Decisión de entrada

El gate post-resultado mantiene el candidato como **research-only** y ordena **no cambiar producción**.

- Decision artifact SHA-256: `7024ceded4fd4203988b244b16d49413da047645a4347973aab37327881265e2`
- Decision freeze commit: `c3e36e042407e9c465d76976a915eb556339b097`
- Resultado que fija: H1 apoyada; H2 y H3 no apoyadas.

La futura validación no puede reinterpretar ni borrar ese resultado.

## Qué significa independencia

La validación sólo contará como externa independiente si satisface simultáneamente:

1. Las consultas o el marco de muestreo provienen de una persona, institución o corpus que no diseñó los holdouts Qwen3 anteriores.
2. Al menos una persona adjudicadora no participó en la selección de consultas, desarrollo del reranker ni adjudicaciones previas.
3. La identidad A/B, rangos, scores, proveedor y procedencia permanecen ocultos hasta congelar todos los juicios.
4. El candidato browser-q8 se reutiliza byte por byte, sin tuning basado en los holdouts observados.
5. Recuperación, runtime, queries, métricas, exclusiones, análisis y reglas de decisión se preregistran antes de recuperar documentos.

Usar al mismo investigador con una nueva lista creada a partir de los resultados observados sería otra validación interna, no validación externa.

## Candidato que puede evaluarse

- Modelo, revisión, q8, prompt, `max_length=1024`, WebGPU y tie-break deben permanecer congelados.
- A conserva el ranking de producción que esté explícitamente fijado al iniciar el nuevo estudio.
- B reordena exactamente el mismo Top 20 mediante raw score browser-q8 descendente.
- No se permite threshold, blending, cambio de pool ni inferencia con labels humanos.
- Si producción cambia antes del estudio, la nueva base debe registrarse como un experimento distinto; no se debe presentar como continuación byte-idéntica del v2.

## Marco de consultas

El conjunto debe ser nuevo respecto de development, holdouts internos y confirmatory v2. Debe derivarse de un marco externo trazable, por ejemplo:

- necesidades reales anonimizadas aportadas por investigadores externos;
- programas de cursos o bibliografías que no se usaron para construir el benchmark;
- un muestreo documentado de catálogos, agendas o preguntas de investigación externas.

Antes de congelar el set se deben comprobar colisiones exactas, variantes traducidas y solapamiento semántico de familias con todos los benchmarks previos.

El balance provisional recomendado conserva cinco idiomas y separa philosopher-concept, work e interdisciplinary-challenge. El número final de consultas y familias debe fijarse mediante una justificación de precisión o potencia antes de la recuperación, no por conveniencia posterior.

## Juicio humano

Para superar la limitación del symmetric-difference audit, la validación externa debería adjudicar la **unión completa de los Top 10 de A y B**, incluidos los elementos compartidos. Así podrá identificar:

- P@10 absoluto de A;
- P@10 absoluto de B;
- ΔP@10 pareado;
- cambios de centralidad 3;
- acuerdo entre jueces, si participan dos o más.

Se mantiene la escala de [[Judgment-Protocol]]: 0 irrelevante, 1 relacionado insuficiente, 2 relevante, 3 central.

La hoja pública debe usar IDs ciegos y excluir condition, rank, scores, IDs internos, proveedor, DOI y procedencia de recuperación. Cualquier consulta externa durante la adjudicación debe quedar registrada mediante una política común.

## Análisis que debe preregistrarse

La futura preregistración deberá decidir antes de recuperar:

- estimando primario y población principal;
- denominador y tratamiento de queries sin cambios;
- intervalo de incertidumbre o prueba pareada, si se hará inferencia formal;
- análisis overall, por intención, familia e idioma;
- métrica de centralidad 3;
- manejo de desacuerdos y datos faltantes;
- criterio de promoción, no inferioridad o rechazo;
- política para análisis exploratorios y multiplicidad.

El resultado confirmatorio v2 sugiere vigilar especialmente que una mejora binaria no oculte pérdida de documentos centrales, pero esa vigilancia futura debe formularse prospectivamente y no presentarse como hipótesis original del v2.

## Gate de producto futuro

Una eventual promoción sólo podrá considerarse si una preregistración nueva define y satisface criterios suficientes de:

1. mejora de relevancia humana;
2. ausencia de regresiones críticas por intención o idioma;
3. preservación o mejora de centralidad;
4. estabilidad operativa WebGPU;
5. fallback seguro al ranking determinista;
6. costo y latencia aceptables;
7. trazabilidad y posibilidad de desactivación.

Ningún criterio se considera satisfecho por este borrador.

## Prohibiciones

- No usar los 212 labels confirmatorios para tuning.
- No elegir nuevas consultas buscando maximizar el efecto observado.
- No alterar H2/H3 retroactivamente.
- No llamar “externa” a una evaluación sin fuente y juez independientes.
- No desplegar el reranker mientras este gate permanezca en estado research-only.
- No crear una UI de evaluación que exponga información A/B durante el juicio.

## Estado operativo

Puede avanzarse sin riesgo en:

- identificar posibles marcos de muestreo externos;
- preparar instrucciones y acuerdos de adjudicación;
- diseñar el esquema de preregistración;
- estimar esfuerzo, costo y tamaño de muestra.

No debe iniciarse retrieval, inferencia, A/B ni juicio hasta contar con:

- propietario externo del marco de consultas;
- adjudicador independiente confirmado;
- preregistración ejecutable completa y congelada;
- decisión explícita sobre tamaño de muestra e inferencia.

## Relacionado

- [[Qwen3-Browser-Q8-Confirmatory-v2]]
- [[Judgment-Protocol]]
- [[Evaluation-Lineage]]
- [[Qwen3-Reranker-Laboratory]]
