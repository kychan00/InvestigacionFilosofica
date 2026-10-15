---
type: architecture-gate
area: semantic-retrieval
status: frozen-pass
updated: 2026-10-14
---

# Browser Semantic Product Gate V1

## Pregunta

¿La ruta [[Browser-Semantic-Static-V4]] funciona desde la página pública sin
depender del Mac anfitrión, y cuál es su costo real de primera carga, caché y
memoria antes de hacerla visible como opción ordinaria?

## Límite epistemológico

Este es un gate de ingeniería y experiencia de producto, no una evaluación de
relevancia filosófica. La ejecución midió un solo Mac, Chrome 155, un adaptador
Apple `metal-3` y una conexión no controlada. Por tanto, el resultado no prueba
compatibilidad general entre navegadores o dispositivos.

La preregistración, el runner, el JSON de resultado, el log, los hashes y la
metadata permanecen canónicos en
`benchmark/semantic-retrieval/browser-product-gate-v1/` del repositorio. Esta
nota conserva sólo la interpretación.

## Diseño congelado

La secuencia se fijó antes de medir:

1. consulta fría con perfil temporal nuevo;
2. repetición exacta en la misma sesión;
3. recarga con el mismo perfil y una consulta distinta.

Los gates exigieron WebGPU no-fallback, finalización `browser-static-v4`, cero
POST de respaldo al servicio semántico, coincidencia exacta de los 36 resultados
renderizados, revisión inmutable del corpus y menor transferencia tras recarga.

## Resultado

Los siete gates pasaron.

| Fase | Tiempo | Transferencia codificada | Pico JS heap muestreado |
| --- | ---: | ---: | ---: |
| Primera consulta fría | 194,611 s | 1.297.598.732 bytes | 1.365.499.026 bytes |
| Repetición en sesión | 1,305 s | 0 bytes | 202.171.156 bytes |
| Recarga, consulta nueva | 49,956 s | 80.163.169 bytes | 1.760.821.597 bytes |

El perfil temporal alcanzó 1.575.182.336 bytes al terminar y fue eliminado. El
adaptador fue Apple `metal-3`, no fallback. Los 36 IDs conservaron exactamente
el orden V4 y no hubo llamada de búsqueda al Mac/Tailscale.

## Decisión

La independencia técnica del Mac queda demostrada para este entorno, pero el
costo frío sigue siendo demasiado alto para un comportamiento implícito. El
modo continúa apagado por defecto.

El paso permitido se implementó como una tercera opción visible,
`En este navegador · beta`, con consentimiento explícito e informado antes de
activar el modo: aproximadamente 1,3 GB en la primera ejecución, alrededor de
1,5 GB de almacenamiento temporal/caché en esta medición, necesidad de WebGPU y
fallback preservado. La búsqueda tradicional continúa seleccionada por defecto.
Después se requiere una matriz de compatibilidad prospectiva en más
dispositivos; este gate no la sustituye.

## Rollout público

El opt-in informado se fusionó mediante el PR 16 en
`97de6057004388a73b428415f7c39b1b39bb2443`. El workflow de GitHub Pages
`38660085085` aprobó 81/81 pruebas, auditó los bundles y desplegó la página.
La verificación posterior confirmó que los `index.html` y `js/app.js` públicos
coincidían byte por byte con `main`.

La activación sólo hace un preflight del adaptador WebGPU; no descarga el modelo
hasta la primera búsqueda. Rechaza ausencia de WebGPU y adaptadores fallback.
El URL histórico `?semantic=browser-v4` se conserva para reproducibilidad. El
modo público funciona sin que el Mac anfitrión permanezca encendido.

Una revisión visual posterior detectó que el workspace vacío se superponía al
consentimiento y podía cortar sus acciones. La corrección se fusionó mediante
el PR 17 en `c19f6bba94586ecc854dce3d7dc2b0b370a2d165`: el workspace permanece
oculto hasta la primera búsqueda, el hero crece con el panel, las tres cifras
se presentan como métricas y el modo browser aparece como pendiente antes de
la aceptación. El workflow `38663237030` pasó 81/81 pruebas y el frontend
público fue verificado en escritorio y móvil sin overflow horizontal.

## Integridad

- runner congelado: `cac004c585d167311a32bbe6c64c1b940d5b649c`;
- resultado congelado: `044bfca`;
- preregistración SHA-256:
  `0520c1e40ba8ea45178c0593126af7092fa95df4e857e7edf143026b2704bbf7`;
- resultado SHA-256:
  `8601b54520af8f94a5ea1d63a38eff1aacc4fdf0c08a911ca191a0b531cc0a99`;
- log SHA-256:
  `336887a75f2f2f0ff1bb0ce8a49e96602bc3d2780534ed0d3a7d956d549fd365`.

## No cambia

- retrieval y ranking congelados;
- `src/core/rank.js`;
- scores o artefactos V4;
- reranker;
- conclusiones de las evaluaciones humanas Qwen3;
- búsqueda federada predeterminada.
