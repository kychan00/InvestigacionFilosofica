---
type: rollout
area: semantic-retrieval
status: public-validated
updated: 2026-10-10
---

# Despliegue público de higiene de presentación semántica V1

## Resultado

La higiene de presentación está activa en la ruta pública
`Semántica · alfa`. La búsqueda federada continúa seleccionada por defecto y
el reranker continúa bloqueado en el servidor.

El despliegue conserva el doble opt-in:

- el LaunchAgent público declara `ENABLE_PRESENTATION_HYGIENE=true`;
- el navegador envía `enable_presentation_hygiene=true` sólo al usar la ruta
  semántica explícita.

Una petición que omita el flag sigue recibiendo la lista fuente sin
transformación. La identidad probable nunca se colapsa.

## Backend público

El runner y el contrato de despliegue se congelaron en `43268b1` antes de
activar el daemon. El smoke público ejecutó exactamente dos búsquedas sobre la
misma ventana Top 10 de Quine:

- default-off: diez resultados fuente intactos;
- doble opt-in: nueve representantes;
- único grupo exacto: `openalex-W2211243423` y
  `openalex-W7069018285`;
- los diez IDs, el orden y todos los scores se reconstruyeron desde
  provenance;
- no hubo fallback presentacional ni reranker.

Los resultados quedaron congelados en `1f50348`. Hashes canónicos:

- `health.json`: `21db7fe6012066f4801914c5bac46e4e84f0f69fc70e0e3ec7b413baf77296a8`;
- `responses.json`: `1e6b108f78e12bc4fe0cc3d6a36008f365a4843f9a7618c501f70ccd95be749f`;
- `summary.json`: `f2a0ada68e78cea9af5f9dcfed66a38ea06d77de5d9e10848964be7646fe1a9b`;
- `run.log`: `fba4446ef5d01f0d40350efc09d2acd0716ff09e172a7a7aaa6cd70cb51dae61`.

La fuente canónica está en
`benchmark/semantic-retrieval/public-presentation-smoke-v1/` del worktree
semántico.

## Frontend público

El cliente llegó a producción mediante PR 14 y merge
`02f445ba1e7f4ddd4a0c54ae37ca01e9b0c7e3db`. Consume los campos `display`,
conserva en memoria todos los IDs y scores del grupo exacto y muestra la
leyenda `registros equivalentes` sin confundir identidad exacta con similitud
probable.

La suite frontend aprobó 75/75 pruebas. El workflow de GitHub Pages
`38054638384` aprobó test y deploy. La inspección de los assets públicos
confirmó el flag de petición, la normalización de provenance y las leyendas de
agrupación sin ejecutar otra inferencia.

## Interpretación

Este rollout mejora limpieza y legibilidad de la presentación; no es evidencia
de mayor relevancia, no modifica candidatos, ranking ni scores y no cambia
`src/core/rank.js`. El fallback semántico hacia la búsqueda federada permanece
vigente si la API pública falla.

## Rollback

Eliminar `ENABLE_PRESENTATION_HYGIENE` del LaunchAgent y reiniciar el daemon
desactiva la capacidad aunque el navegador continúe solicitándola. El servidor
volverá a entregar los resultados fuente sin colapso.
