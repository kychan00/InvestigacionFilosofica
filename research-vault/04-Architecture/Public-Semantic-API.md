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

## Siguiente límite

La API existe, pero el frontend público aún no la consume. El siguiente paso es integrar un modo semántico explícito, mostrar progreso durante la espera y conservar la búsqueda actual como fallback. La observación del alfa debe preceder cualquier promoción más amplia.

## Canonicalidad

El código, los hashes, los smokes y la configuración ejecutable permanecen en el worktree de ingeniería. Esta nota es únicamente la capa conceptual, arquitectónica e histórica de Obsidian.
