---
type: architecture-gate
area: retrieval
status: passed
updated: 2026-10-09
---

# Archivo de embeddings en iCloud

## Decisión

`PASS` para archivar shards cerrados del build local sin contratar cómputo ni
almacenamiento adicional.

Qwen3 sigue ejecutándose localmente sobre Apple MPS. iCloud funciona sólo como
archivo verificable de los shards terminados: no es la base activa, no ejecuta
FAISS y no almacena los pesos de los modelos.

## Contrato de seguridad

Por cada archivo, el runner:

1. calcula su SHA-256 local;
2. mueve el shard cerrado al árbol configurado de iCloud;
3. espera confirmación de subida completa, sin subida activa ni conflictos;
4. verifica el SHA-256 en iCloud;
5. expulsa únicamente la copia local mediante
   `FileManager.evictUbiquitousItem`;
6. solicita una descarga nueva mediante
   `FileManager.startDownloadingUbiquitousItem`;
7. vuelve a comparar el SHA-256;
8. expulsa otra vez la copia local ya verificada.

No se usa borrado ordinario sobre el destino de iCloud, porque eso eliminaría
también la copia remota. El runner rechaza rutas relativas inseguras, enlaces
simbólicos, contenido conflictivo y estados de subida no confirmados.

`manifest.json` y `state.sqlite3` permanecen localmente como estado reanudable;
se archivan además copias verificadas. Sólo los shards terminados se retiran del
directorio local de trabajo.

## Gate real de 100 documentos

El 2026-10-06 se procesaron los primeros cien documentos elegibles del V3.3 con
`Qwen/Qwen3-Embedding-0.6B`, Apple MPS, dimensión 1.024 y batch 1. La inferencia
terminó en 46,00 segundos y produjo cuatro shards, manifest y estado SQLite.

| Medida | Resultado |
| --- | ---: |
| Documentos | 100 |
| Shards Parquet | 4 |
| Archivos verificados | 6 |
| Tamaño lógico total | 892.051 bytes |
| Bloques locales tras expulsión final | 0 |

Los seis archivos aprobaron subida, expulsión, descarga nueva y comparación
exacta de hashes. El runner incremental volvió a abrir el estado, confirmó cien
documentos sin cambios y no regeneró embeddings.

Hashes completos, tamaños, comandos y contratos ejecutables permanecen en
`docs/ICLOUD_EMBEDDING_ARCHIVE.md` del worktree de código.

## Build completo V3.3

El build protegido terminó el 2026-10-09 con los contratos fijados del corpus
V3.3 y `Qwen3-Embedding-0.6B`: 451.823 documentos, 402 shards Parquet ordenados
y 451.823 filas tanto en SQLite como en el manifest. Los 402 recibos coinciden
con el conjunto del manifest y el directorio canónico de iCloud contiene
exactamente 402 placeholders con cero bloques locales asignados.

El estado SQLite archivado tiene SHA-256
`79302121abbd35c54136b2cc8d238a562e8964b5737bdd77a935f2aca3401af1`.
El último shard cubre los IDs vectoriales 450.626–451.822 y tiene SHA-256
`d5414b7857246dba55cde84899e2c75c98f6177eb9b8032a9dca08c13d6e3256`.
La validación final confirmó hashes de ida y vuelta, expulsión local, conteos,
orden y correspondencia exacta entre manifest, recibos y placeholders.

Un duplicado creado durante una recuperación manual por web quedó fuera del
namespace canónico, conservado bajo `recovery-unreferenced/` y sin referencia
desde manifest, recibos o estado reanudable. No forma parte del corpus ni puede
entrar a la indexación.

El gate separado del índice completo aprobó después de esta etapa; véase
[[Full-Semantic-Index-V3.3]]. Los 402 shards se expulsaron nuevamente tras la
construcción y ocupan cero bloques locales. Ni la terminación de embeddings ni
la del índice autorizan por sí solas serving, integración del frontend o
cambios de producción.

## Canonicalidad

Esta nota documenta la decisión arquitectónica. El código, pruebas, recibos,
hashes y futuros outputs canónicos pertenecen al worktree de código. iCloud no
reemplaza el repositorio ni convierte sus copias en inputs científicos
canónicos.
