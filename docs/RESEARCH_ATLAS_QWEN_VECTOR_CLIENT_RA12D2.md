# RA12-D2 — transporte cacheado y autenticado de vectores Qwen

RA12-D2 consume las ubicaciones de RA12-D1 y recupera vectores documentales de 1,024 bytes desde Qwen V4 o desde el overlay C5-C. Sigue siendo una fase experimental: **no crea `semantic-neighbor`, no modifica SearchResponse, ranking, UI ni el runtime del Atlas**.

## Pins

### V4 / C3

- Digest-tree OID: `1a4e16c65a3285182d2cea875aea015e9435b105`
- Root SHA-256: `38067b5876de5f53abe5c7431b8618464d3fe711058a70fdde700fce7c50d961`
- Source vector revision: `5a4a195085de54bf607a6c4397092ffb32716dcc`
- 451,823 documentos; 256 clusters; 1,024 dimensiones; tiles de 64 digests.

### Overlay / C5-C

- Overlay OID: `c74f0067ba665c23b09a0a79fa83651b00c0e53e`
- Manifest SHA: `e76848f2876370b9682d8b906b8704371a331cd0ff2cae4a9fe0bb11a4216166`
- Index SHA: `8e2d1dc520c3c8f4d8bc85ec402ae6ec900e6cd3220a90f710debd3987c3bc90`
- Digest SHA: `1c9a1bb51ef6162d96468f9b990a62a9fae31370140d5d705c1aeefda4f5d491`
- Identity lookup SHA: `8cc87603b049538a1af36aba0b73d3f868f98c136b6832b1a5279896895383c8`
- Vector payload SHA: `88596081fb50f6dd4a47cbca24b711982a4beca3ed991555588b71ddc4abe89f`
- 207 documentos; 1,024 dimensiones.

## Cadena V4

Para una ubicación `cluster + ordinal`:

1. autenticar el root C3 completo por SHA;
2. autenticar una sola vez el índice del cluster;
3. autenticar sólo el tile de digests que contiene el ordinal mediante HTTP 206 + `Content-Range` + SHA;
4. derivar el SHA individual del vector;
5. pedir exactamente 1,024 bytes del shard V4 mediante HTTP 206;
6. comparar SHA del slice.

El cliente cachea:
- root C3;
- índice por cluster;
- tile de digests por cluster/tile;
- vector verificado por cluster/ordinal.

Un segundo acceso al mismo vector no produce requests adicionales. Otro ordinal dentro del mismo tile reutiliza root, índice y tile y sólo descarga el nuevo slice de 1 KB.

## Cadena overlay

La primera recuperación autentica una sola vez:

- manifest;
- index;
- digest array;
- identity lookup.

Cada ordinal debe concordar entre lookup y digest array. Después sólo se descarga el slice de 1,024 bytes de `vectors.i8` mediante HTTP 206 y se verifica contra su digest.

El contexto y cada vector quedan cacheados.

## Límites

- No se descarga Qwen.
- No se usa FAISS.
- No se consulta OpenAlex live.
- No se infiere identidad por título, abstract o cosine.
- No se interpreta cosine como cita, influencia o dependencia.
- No se añade ninguna arista semántica.
- RA11 sigue siendo el comportamiento del Atlas actual.
- D2 no está importado por `research-atlas-live.js`.

## Gates

El PR ejecuta:

1. pruebas sintéticas fail-closed;
2. regresión completa;
3. smoke real Node contra B3/C3/C5-C;
4. smoke Chromium desde origen local para repetir la ruta que usará el navegador y comprobar CORS/Range;
5. RA8 product gate existente por el patrón `src/core/research-atlas-*.js`.

Sólo después de D2 se podrá construir RA12-D3: comparar vectores autenticados entre los WorkNodes ya presentes y agregar `semantic-neighbor`, dejando RA11 como fallback únicamente para pares/obras sin vector.
