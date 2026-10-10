---
type: validation
area: semantic-retrieval
status: public-deployed
updated: 2026-10-10
---

# Integración API de higiene de presentación semántica V1

## Decisión

La transformación validada en [[Semantic-Presentation-Hygiene-V1]] ya está
conectada a la API semántica, pero permanece desactivada en el daemon público.
La integración exige dos autorizaciones independientes:

- el servidor debe declarar `ENABLE_PRESENTATION_HYGIENE=true`;
- la petición debe enviar `enable_presentation_hygiene=true`.

Ninguna de las dos señales puede habilitar la función por sí sola. Si la
petición omite el flag o lo envía como falso, los objetos de resultado se
conservan exactamente como antes.

## Límites de la transformación

La higiene se aplica sólo después de retrieval y del reranker opcional. Recibe
la ventana ya devuelta y no hace overfetch, no cambia candidatos, no reordena,
no mezcla scores, no aprende thresholds y no llama a ningún modelo.

Cuando está habilitada:

- HTML y títulos vacíos se corrigen sólo en campos `display`;
- únicamente la identidad exacta puede colapsarse;
- la identidad probable nunca se colapsa;
- el primer resultado fuente sigue siendo el representante;
- todos los IDs, rangos y scores miembros quedan en provenance;
- un fallo de la transformación devuelve la lista original y marca fallback.

## Implementación congelada

El contrato prospectivo quedó congelado en `2ec41cb`. La implementación,
pruebas y runner acotado quedaron congelados en `30722c1`. La suite Python
completa aprobó 53/53 pruebas.

No se modificaron producción, retrieval, `src/core/rank.js`, el frontend, el
daemon público, artefactos experimentales congelados ni pesos.

## Smoke local

El resultado quedó congelado en `4b06d71`. Usó el índice
`20261009T135455Z` de 451.823 documentos y ejecutó dos peticiones locales sobre
la misma ventana Top 10 para la consulta sobre Quine y compromiso ontológico:

- sin flag de petición: diez objetos originales intactos;
- con doble opt-in: nueve representantes;
- un colapso exacto entre `openalex-W2211243423` y
  `openalex-W7069018285`;
- los diez IDs originales reaparecen al desplegar provenance y conservan su
  orden;
- todos los scores se preservan;
- reranker desactivado y fallback presentacional no utilizado.

La validación independiente reprodujo los mapeos de IDs y scores. Hashes
canónicos:

- `responses.json`: `e0bb3e22819e55ceb7321cbc04206d500275861abcab9a50fb020af1eb2b560d`;
- `summary.json`: `50b58d83050a12a50bb47f1f7173c3c706b6d3dfe027059b3472b927b542ee39`;
- `run.log`: `7b69c2fc3631ff9b8d1ed60d823d97ea7fc71c70e4428a2a943e15fa91d840ff`.

Los artefactos ejecutables canónicos permanecen en
`benchmark/semantic-retrieval/presentation-api-smoke-v1/` del worktree
semántico. Esta nota sólo conserva su interpretación arquitectónica.

## Estado y próximo límite

El gate local pasa. Esto demuestra compatibilidad, conservación y fallback;
no demuestra mejora de relevancia ni autoriza un cambio de ranking.

La decisión operacional posterior quedó completada y documentada en
[[Semantic-Presentation-Public-Rollout-V1]]. El daemon y la ruta semántica del
frontend ya usan el doble opt-in; la búsqueda federada permanece como default.
