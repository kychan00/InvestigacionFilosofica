---
type: architecture
area: semantic-retrieval
status: public-alpha
updated: 2026-10-09
---

# API semántica pública

## Hito

La recuperación semántica sobre el corpus propio ya tiene una alfa pública gratuita:

`https://filosofia-semantic.tail829c9b.ts.net`

La URL expone FastAPI desde el Mac del proyecto mediante Tailscale Funnel. No modifica el ranking productivo, `src/core/rank.js`, el retrieval federado existente ni los artefactos experimentales congelados.

## Ruta operativa

```text
cliente HTTPS
→ Tailscale Funnel
→ FastAPI local
→ Qwen3-Embedding-0.6B en Apple MPS
→ FAISS + SQLite/FTS
→ resultados del corpus propio
```

El índice contiene 451.823 documentos y usa los artefactos completos V3.3 ya validados. Los pesos permanecen fuera del repositorio.

## Decisiones de seguridad y coste

- el reranker permanece desactivado por defecto;
- una petición no puede habilitarlo si el servidor fue iniciado sin esa capacidad;
- cada IP puede iniciar hasta diez búsquedas por ventana de diez minutos;
- sólo se admite una búsqueda inferencial simultánea;
- el exceso de cuota o concurrencia recibe HTTP 429 antes de ejecutar inferencia;
- CORS permite la futura integración desde GitHub Pages;
- no se contrató ni activó infraestructura pagada.

## Persistencia

Dos LaunchAgents de usuario mantienen el daemon de Tailscale y la API. Ambos se reinician ante fallos y vuelven a arrancar al iniciar sesión. El hostname, el estado de Tailscale y la configuración de Funnel sobrevivieron una prueba de reinicio de los dos procesos.

La disponibilidad de esta alfa depende de que el Mac esté encendido, con la sesión del usuario iniciada, conectado a internet y sin suspensión. Por ello la URL es pública y estable, pero todavía no representa un servicio cloud con SLA.

## Validación

El smoke remoto confirmó:

- `GET /health` exitoso;
- búsqueda semántica real sobre el índice completo;
- resultados con `reranker_enabled = false` y `rerank_score = null`, incluso cuando el cliente solicitó reranking;
- preflight CORS válido desde `https://kychan00.github.io`;
- recuperación correcta después de reiniciar los servicios.

La implementación de endurecimiento quedó fijada en el commit de código `33fe90abf0d78186c77a8e7cd17bbacc11ad8893`. La documentación y los recibos canónicos de la publicación quedaron fijados en `92535591f05169aaad68b0feb2d45f4ac357ecdc`, bajo `benchmark/semantic-retrieval/public-serving-v1/` y `docs/SEMANTIC_PUBLIC_SERVING.md`.

## Integración pública

El frontend público consume ya la API mediante una opción `Semántica · alfa`. La búsqueda tradicional sigue siendo el valor inicial y el fallback automático. Durante una consulta semántica se muestra tiempo transcurrido y estado activo; un fallo de red, HTTP 429, HTTP 503 o indisponibilidad del Mac cambia al motor federado e informa el respaldo.

La integración quedó aislada en `83405c7`, se trasladó sin el backend a una rama limpia de producción y llegó a `main` mediante el merge `5453c4c1fdd7625c721ce71e8d5c307289e3036a`. El workflow `37985827954` aprobó 72 pruebas, el build DuckDB, la auditoría del bundle browser-q8 y el despliegue GitHub Pages.

La interfaz fuerza `enable_reranker = false`, distingue similitud semántica de relevancia humana y no ofrece filtros de citas o acceso abierto cuando esos metadatos faltan. `src/core/rank.js` y la ruta federada no cambiaron.

El indicador operacional se añadió después mediante PR 13 y merge `68eb2a223e53e87f8bea72239f1f943b6d7b36ed`. El workflow `37987230177` aprobó 74 pruebas, ambos builds y el despliegue.

Al abrir la página —y al recuperar foco después de un intervalo— la interfaz consulta `GET /health` con un timeout acotado. Esa ruta no está sujeta a la cuota de búsquedas, no carga Qwen3 ni ejecuta inferencia. Un `status = ready` válido muestra `Semántica disponible` y el conteo real del índice; un fallo muestra `Semántica no disponible` sin inutilizar la búsqueda tradicional.

El mismo indicador distingue:

- motor seleccionado antes de buscar;
- motor activo mientras trabaja;
- motor finalmente usado al completar;
- respaldo tradicional automático cuando una petición semántica falla.

El chequeo es sólo informativo y no sustituye el fallback de la petición: el Mac puede dormir o perder red después de responder `/health`.

## Smoke de uso real

El smoke pequeño de uso real ya fue ejecutado y congelado. Las cinco consultas internas recibieron HTTP 200, produjeron 50 resultados Top 10, no activaron el reranker y no necesitaron fallback. Sobre el servicio ya caliente, la latencia fue de 0,733 a 6,184 segundos, con mediana de 1,501 segundos y media de 2,561 segundos.

El resultado es `PASS_WITH_DATA_QUALITY_FINDINGS`, no una validación humana de relevancia. Se observó un título vacío, duplicados o casi duplicados, mojibake, HTML literal y un caso visible de deriva temática. La primera ejecución se detuvo correctamente al encontrar el título vacío y fue preservada; el contrato del runner se corrigió para registrar esa carencia sin inventar metadata y se congeló antes de la ejecución completa. Véase [[Public-Semantic-Smoke-V1]].

## Siguiente límite

Priorizar higiene de metadata y deduplicación a nivel de obra sin utilizar estos resultados como labels de tuning. La relevancia debe evaluarse después en un protocolo separado y explícito. También sigue pendiente observar disponibilidad bajo suspensión y reanudación del Mac antes de ampliar el rollout o buscar otro host gratuito.

## Canonicalidad

El código, los hashes, los smokes y la configuración ejecutable permanecen en el worktree de ingeniería. Esta nota es únicamente la capa conceptual, arquitectónica e histórica de Obsidian.
