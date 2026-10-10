---
type: architecture
project: InvestigacionFilosofica
updated: 2026-10-10
status: operationally-closed
---

# Runtime durable de recuperación semántica V1

## Decisión

La alfa semántica pública dejó de depender de un worktree administrado por
Codex. El cambio es operacional: no modifica corpus, embeddings, candidatos,
scores, ranking, filtros, presentación ni la decisión de mantener apagado el
reranker.

## Separación material

El servicio local quedó dividido en tres capas permanentes:

1. código fijado al commit `5f05e7c476f383c744e4afc55f3e2fc175e53435`;
2. entorno Python de servicio fuera del checkout;
3. índice V3.3 y metadata bajo almacenamiento local de aplicación.

El LaunchAgent y el proceso en ejecución tienen cero referencias a
`.codex/worktrees`. El manifest de embeddings se materializó como archivo
regular; los shards siguen perteneciendo al archivo externo de iCloud y los
pesos del modelo siguen fuera de Git.

## Identidad preservada

- índice: `20261009T135455Z`;
- documentos: 451.823;
- embedding: `Qwen/Qwen3-Embedding-0.6B`, revisión
  `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`;
- manifest SHA-256:
  `1facaac58b4e4113d9d40ffceeb93ee64f3e35755a701b7dd6433a0b8339af44`;
- FAISS SHA-256:
  `31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68`;
- metadata SHA-256:
  `e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0`.

## Validación

El entorno permanente aprobó imports y salud antes del corte. Después del
reinicio, `/health` local y público conservaron estado `ready`, 451.823
documentos, reranker no disponible y presentación disponible. Una consulta
semántica pública devolvió HTTP 200 y conservó como primer resultado
`openalex-W157960258`, con score `0.7339097261428833`, sin reranker ni fallback
presentacional.

El primer request tras reiniciar puede ser lento por la carga fría de Qwen y
FAISS. Durante esa carga, el límite de una inferencia concurrente responde 429
a intentos adicionales; esto es comportamiento esperado, no una alteración del
ranking.

## Cierre posterior al reinicio

Después de reiniciar completamente el Mac, ambos LaunchAgents se recuperaron
sin reparación manual. Tailscale restauró el Funnel, la salud local y pública
volvió a `ready`, y una consulta semántica pública fría respondió HTTP 200 con
el mismo primer ID y score, reranker apagado y cero fallback presentacional.

El gate operacional de la V1 queda cerrado. La instalación continúa
dependiendo materialmente del Mac encendido, conectado y con sesión iniciada;
esa limitación pertenece al modelo gratuito de hosting y no es un defecto del
runtime durable.

La evidencia ejecutable canónica permanece en el repositorio principal:
`docs/SEMANTIC_DURABLE_RUNTIME_V1.md` y
`benchmark/semantic-retrieval/durable-runtime-v1/summary.json`.

## Relaciones

- [[Semantic-Retrieval-Service]]
- [[Full-Semantic-Index-V3.3]]
- [[Public-Semantic-API]]
- [[Semantic-Presentation-Public-Rollout-V1]]
