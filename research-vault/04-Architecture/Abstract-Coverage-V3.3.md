---
type: architecture-gate
area: retrieval
status: passed
updated: 2026-10-06
---

# Cobertura de abstracts V3.3

## Decisión

`PASS`

El corpus V3.3 enriquecido y su smoke con modelos reales aprobaron los gates
previos al build masivo de embeddings. Esta decisión autoriza científicamente
el trabajo offline; no cambia producción, retrieval ni el ranking existente.

## Contrato publicado

- dataset: `CristianPelayo/openalex-philosophy`;
- revisión: `1c59478b679f5836ef6e8dce28b2d725d04f8e02`;
- archivo: `v3.3/philosophy-corpus-v3-3-full.parquet`;
- SHA-256 del Parquet:
  `e01658d196516988b7f62efe2d4aa502a440b063cb0d1fa4b1d15fd99aaa2b47`;
- filas: 822.445;
- elegibilidad: `CORE` o `PROBABLE`, excluyendo `LOW_QUALITY` y `PARATEXT`.

Todos los archivos V3.3 y su linaje fueron publicados en un único commit de
Hugging Face. Los tamaños y hashes LFS remotos coinciden con los artefactos
locales validados.

## Captura API congelada

La decisión prospectiva adoptó la ruta API timestamped descrita en
[[Abstract-Enrichment-V3.3-Preflight]]. La captura recorrió una sola vez los
244.353 targets en 2.444 lotes consecutivos de hasta cien IDs:

| Medida | Resultado |
| --- | ---: |
| IDs solicitados | 244.353 |
| IDs devueltos | 230.038 |
| Abstracts reconstruibles | 82.905 |
| Sin abstract o ID ausente | 161.448 |
| Estados HTTP | sólo 200 |

Se preservaron respuestas crudas, lotes normalizados, metadata y hashes. El
JSONL de captura tiene SHA-256
`960e2d3dbeba746fb85219662b308e317a27c2a8165284212cb04a80802be1ac`;
el archivo comprimido de lotes tiene SHA-256
`e0faffebe4dcab5c9152047c516126964c488f303892f5663a1e08d7fd45dbcc`.
La validación independiente confirmó orden, membresía, conteos, hashes y
ausencia de credenciales persistidas.

## Invariantes del corpus

El builder partió del V3.2 fijado y sólo llenó celdas `abstract` vacías para los
82.905 IDs capturados. La verificación independiente confirmó:

- esquema Arrow idéntico;
- orden y número de filas idénticos;
- igualdad exacta de todas las columnas distintas de `abstract`;
- preservación de todos los abstracts preexistentes;
- exactamente 82.905 abstracts añadidos;
- 161.448 documentos elegibles todavía sin abstract.

## Cobertura

| Medida | V3.2 | V3.3 |
| --- | ---: | ---: |
| Elegibles | 451.823 | 451.823 |
| Con abstract | 207.470 | 290.375 |
| Sin abstract | 244.353 | 161.448 |
| Cobertura | 45,918% | 64,267% |
| Abstract ≥ 200 caracteres | 200.265 | 279.535 |

El 96,267% de los abstracts no vacíos tiene al menos 200 caracteres. La muestra
manual no encontró corrupción sistemática de la reconstrucción por índice
invertido. Persisten textos cortos, previews, avisos y registros de calidad
fuente desigual; no se generaron ni imputaron textos para ocultarlo.

## Smoke real V3.3

Se procesaron los primeros veinte documentos elegibles con los contratos
fijados de `Qwen3-Embedding-0.6B` y `Qwen3-Reranker-0.6B`:

- 20/20 embeddings de 1.024 dimensiones en Apple MPS;
- 19/20 documentos con abstract no vacío;
- índice `IndexIDMap2(IndexFlatIP)` validado;
- *Imaginative blocks and impossibility: an essay in modal psychology* quedó
  primero para la consulta sobre imaginación y posibilidad metafísica;
- `semantic_score = 0.573335587978363`;
- el reranker lo mantuvo primero con raw score `3.5400562286376953`;
- `/health` y `POST /api/search/semantic` respondieron HTTP 200.

El batch de embeddings 16 agotó el límite MPS de 9,07 GiB antes de escribir un
shard. La repetición válida usó batch 1 en un directorio nuevo, sin cambiar
texto, modelo, revisión, dimensión ni instrucción. Esto fija una restricción
operativa, no un ajuste de relevancia.

## Límite siguiente

El build completo todavía no comenzó. El equipo local sólo tenía 7,5 GiB
libres; el bundle de 451.823 documentos debe alojar vectores, metadata repetida,
estado SQLite, índice y una copia publicable. Debe ejecutarse con almacenamiento
externo o adicional y conservar todos los contratos fijados.

## Canonicalidad

Esta nota es interpretación metodológica e histórica. El reporte, scripts,
tests, hashes y artefactos canónicos permanecen en el worktree de código, en
particular `docs/ABSTRACT_COVERAGE_V3_3.md` y
`docs/SEMANTIC_RETRIEVAL_SMOKE_V3_3.md`.

