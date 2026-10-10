---
type: validation
area: semantic-retrieval
status: heldout-validation-passed-no-production-change
updated: 2026-10-09
---

# Higiene de presentación semántica V1

## Propósito

Probar una transformación presentacional que mejore legibilidad y reduzca duplicados exactos sin reescribir la fuente bibliográfica ni alterar el ranking.

## Contrato

- la metadata fuente se copia sin mutación;
- HTML se elimina sólo de `display.title` y `display.abstract`;
- un título vacío recibe `Sin título` únicamente en la vista;
- sólo `exact_identity` puede colapsarse;
- `probable_same_work` nunca se colapsa;
- el primer resultado conserva representación y score;
- todos los IDs, ranks y scores miembros permanecen en provenance;
- no se usan modelos, labels humanos, thresholds aprendidos ni blending.

El contrato inicial quedó congelado en `c700290`. Una primera ejecución fue rechazada porque sus `source_rank` eran relativos a la ventana 1–5 y no a los rangos originales 11–15. El intento quedó preservado. La corrección de provenance se congeló en `104800c` antes de volver a ejecutar.

## Validación

El held-out usa los rangos 11–15 del benchmark híbrido completo y excluye explícitamente todos los IDs del Top 10 público.

Resultado congelado en `e8c1b94`:

- cinco consultas;
- 25 documentos held-out;
- cero IDs compartidos con el Top 10;
- 25/25 IDs preservados;
- ranks originales 11–15 preservados;
- cero scores modificados;
- cero reordenamientos;
- cero falsos colapsos;
- cero anomalías de presentación en esa ventana.

La ventana fue un caso no-op: no contenía duplicados exactos ni HTML visible. Los caminos positivos de colapso, HTML, título vacío, inmutabilidad y provenance se verificaron con pruebas sintéticas. La suite completa aprobó 44/44 pruebas.

SHA-256 del JSONL presentado:

`8168219296c924c846c0bc7bb367d05c6aaa1be95b792145b9394297c0094651`

Los artefactos canónicos están en `benchmark/semantic-retrieval/presentation-hygiene-heldout-v1/`.

## Interpretación

La transformación es determinista, conserva provenance y no produjo falsos positivos en la muestra held-out pequeña. Esto no prueba todavía seguridad en las 451.823 obras ni calidad de ranking.

La capa permanece desconectada de la API y del frontend. Producción, retrieval y `src/core/rank.js` no cambiaron.

## Siguiente gate

1. Ejecutar una auditoría mucho más amplia sobre metadata del índice completo, sin inferencia.
2. Medir cuántos grupos exactos surgirían y revisar una muestra determinista.
3. Verificar que DOI y contenido exacto no unan ediciones filosóficamente distintas.
4. Sólo entonces decidir si proponer integración opt-in en la API.
