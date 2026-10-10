---
type: validation
area: semantic-retrieval
status: integrated-default-off-public-disabled
updated: 2026-10-10
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

En el momento de esta validación la capa permanecía desconectada de la API y
del frontend. La conexión API local posterior está documentada por separado;
producción, retrieval y `src/core/rank.js` no cambiaron.

## Gate corpus-wide completado

La auditoría prevista se completó en [[Semantic-Corpus-Identity-Audit-V1]]:
451.823 registros, 9.266 grupos exactos, 21.351 miembros y validación
independiente sin conflictos de autor o contenido. Este snapshot no contiene
DOI, por lo que una futura incorporación de DOI exige repetir su control
material y no sólo confiar en las pruebas sintéticas.

Ese gate separado se completó en [[Semantic-Presentation-API-Integration-V1]]:
la API exige doble opt-in y el smoke local preservó provenance, scores y orden.
La capacidad permanece apagada en el daemon público; la validación no autoriza
por sí sola su despliegue.
