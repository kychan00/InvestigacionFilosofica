---
type: architecture-gate
area: retrieval
status: passed
updated: 2026-10-09
---

# Índice semántico completo V3.3

## Resultado

`PASS` para la construcción y validación local del índice completo, todavía
fuera de producción.

El índice contiene 451.823 vectores de 1.024 dimensiones y el mismo número de
filas en metadata SQLite y FTS. Usa `IndexIDMap2(IndexFlatIP)` con producto
interno sobre vectores normalizados L2.

## Artefactos

| Artefacto | Tamaño | SHA-256 |
| --- | ---: | --- |
| `semantic.faiss` | 1,7 GiB | `31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68` |
| `documents.sqlite3` | 2,4 GiB | `e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0` |
| `manifest.json` | 762 bytes | `cbe7e326c6687b50c734f1f19223da8de3673115ab46d11e2124ebcd30aa36c8` |

El build activo es `20261009T135455Z`. Los outputs canónicos permanecen en el
worktree de código bajo `artifacts/semantic-retrieval/full-v3.3-index/`; esta
nota no es un input ejecutable.

## Validación

- `PRAGMA integrity_check` devolvió `ok`.
- Los IDs vectoriales son únicos y continuos de 0 a 451.822.
- Hay 451.823 IDs documentales distintos.
- FAISS, metadata y FTS tienen exactamente 451.823 entradas.
- Un vector fuente real recuperó su propio ID en Top 1 con similitud aproximada
  de 1,0 y resolvió la fila bibliográfica correcta.
- Los 402 shards de entrada fueron expulsados nuevamente después del build y
  sus placeholders canónicos conservan cero bloques locales.

## Smoke funcional

Las cinco consultas internas existentes se ejecutaron una vez en modo semántico
y una vez en modo híbrido, sin reranker ni labels humanos. Los primeros
resultados fueron directamente pertinentes para Quine, Kant, Wittgenstein,
Frege y la teoría marxiana del valor, con resultados en español, inglés y
portugués.

Esto demuestra funcionamiento, no calidad humana suficiente. También apareció
una señal descriptiva de registros bibliográficos aparentemente duplicados con
IDs OpenAlex distintos; debe tratarse mediante un protocolo prospectivo y no
mediante tuning retrospectivo.

La API local respondió HTTP 200 en `/health` y en búsqueda semántica filtrada,
con reranker desactivado, y después se detuvo.

## Límite actual

El índice no está desplegado ni conectado al frontend. Faltan evaluación humana
congelada, comparación acotada con el reranker, decisión de serving HTTPS y un
plan de almacenamiento para el bundle activo de aproximadamente 4,1 GiB.

La construcción del índice no cambia el ranking público ni autoriza por sí sola
una integración de producción.
