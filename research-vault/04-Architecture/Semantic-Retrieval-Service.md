---
type: architecture
area: retrieval
status: implementation
updated: 2026-10-09
---

# Servicio de recuperación semántica

## Propósito

Permitir consultas filosóficas en lenguaje natural sobre el corpus académico propio sin exigir coincidencia literal y sin usar un LLM generativo para recorrer la base.

El servicio recupera documentos; no redacta una respuesta filosófica ni sustituye el juicio del investigador.

## Separación arquitectónica

```text
trabajo offline
Hugging Face Parquet
→ normalización documental
→ Qwen3-Embedding-0.6B
→ embeddings persistentes
→ FAISS persistente

tiempo de consulta
consulta
→ embedding de consulta con instrucción filosófica
→ worker persistente FAISS
→ filtros de metadata
→ unión lexical opcional
→ Qwen3-Reranker-0.6B opcional
→ documentos ordenados y trazables
```

Los embeddings de documentos no se recalculan por consulta. Los documentos nuevos reciben embeddings incrementales; el índice tiene además una operación explícita de reconstrucción total.

En macOS, PyTorch/SentenceTransformers y `faiss-cpu` provocaron crashes nativos reproducibles al ejecutar operaciones en el mismo proceso. La frontera de procesos es por ello parte explícita del diseño: el modelo de consulta permanece cargado en el proceso de API y FAISS permanece cargado en un worker local persistente. No se recarga ninguno por consulta.

## Corpus fijado

- repositorio: `CristianPelayo/openalex-philosophy`;
- revisión: `1c59478b679f5836ef6e8dce28b2d725d04f8e02`;
- artefacto: `v3.3/philosophy-corpus-v3-3-full.parquet`;
- elegibilidad: `CORE` o `PROBABLE`, excluyendo `LOW_QUALITY` y `PARATEXT`;
- universo buscable esperado: 451.823 documentos.

El Parquet V3.3 contiene título, abstract, año, idioma, tipo y evidencia clasificatoria. No contiene todavía autores, DOI, revista ni topics completos. La implementación admite esos campos y los conserva cuando una versión posterior los aporte, pero no los inventa. La fila fuente original se preserva y el identificador OpenAlex no se sustituye.

## Modelos fijados

- embeddings: `Qwen/Qwen3-Embedding-0.6B@97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`;
- reranker: `Qwen/Qwen3-Reranker-0.6B@e61197ed45024b0ed8a2d74b80b4d909f1255473`.

La instrucción de retrieval vive en configuración central. Sólo se aplica a la consulta; los documentos se codifican sin instrucción, de acuerdo con el contrato del modelo.

## Trazabilidad

Cada resultado puede conservar:

- `semantic_score`;
- `lexical_score` cuando participa FTS;
- `rerank_score` cuando se habilita reranking;
- metadata bibliográfica original;
- identificadores y URL de origen;
- modelo, revisión y fecha de embedding en los artefactos offline.

FAISS usa producto interno sobre vectores L2-normalizados, equivalente a similitud coseno para este contrato.

## Estado de validación

El pipeline completo pasó una prueba controlada de construcción inicial, búsqueda, caché, filtros y actualización incremental con embeddings deterministas falsos. Las pruebas del producto existente también permanecen verdes.

El 2026-09-30 se completó además un smoke real no productivo con 20 documentos elegibles y los modelos fijados:

- `Qwen3-Embedding-0.6B` generó embeddings de 1024 dimensiones en Apple MPS;
- FAISS recuperó en primer lugar *Imaginative blocks and impossibility: an essay in modal psychology* para una consulta natural sobre imaginación, imposibilidad y psicología modal, con `semantic_score = 0.7154197`;
- `Qwen3-Reranker-0.6B` conservó ese documento en primer lugar con raw score `7.8420315`;
- el artefacto de smoke respondió HTTP 200 en `/health` y `POST /api/search/semantic`, preservando el mismo primer resultado;
- el primer reranking de diez candidatos tardó cerca de tres minutos en esta máquina, latencia no apta todavía para una experiencia interactiva.

Por tanto:

- la cadena real de Fase 1 y el reranker mínimo sí están validados;
- [[Abstract-Coverage-V3.3]] fijó y aprobó el corpus enriquecido: 290.375 de 451.823 documentos elegibles tienen abstract —64,267%— y no cambió ningún valor no abstract;
- el smoke V3.3 real aprobó embedding, FAISS, búsqueda semántica, reranking y API sobre veinte documentos;
- el batch local de embeddings debe ser 1 en este Mac: el valor 16 excedió el límite MPS antes de escribir resultados;
- [[ICloud-Embedding-Archive]] aprobó la ruta gratuita de archivo incremental: cien documentos reales produjeron cuatro shards y seis archivos verificaron subida, expulsión local, descarga y hashes exactos;
- el build completo V3.3 terminó con 451.823 embeddings en 402 shards ordenados; SQLite, manifest, recibos y placeholders coinciden exactamente;
- los 402 shards canónicos ocupan cero bloques locales tras la expulsión final y conservan 2.829.334.705 bytes lógicos en iCloud; manifest y SQLite permanecen como estado reanudable;
- [[Full-Semantic-Index-V3.3]] aprobó: 451.823 vectores, metadata y filas FTS, con IDs continuos, hashes congelados y autoconsistencia Top 1;
- el smoke de corpus completo ejecutó las cinco consultas internas en modos semántico e híbrido, sin reranker ni labels humanos, y la API local respondió HTTP 200;
- [[Semantic-Retrieval-Reranker-Bounded-V1]] congeló una comparación A/B sobre 60 pares y un paquete ciego de 59 ítems; el benchmark humano está preparado pero sus juicios siguen pendientes;
- no se desplegó la API;
- no se conectó el frontend público.

## Próximos gates

1. Completar y congelar los 59 juicios ciegos de relevancia 0–3.
2. Congelar el analizador antes de abrir el mapa A/B y calcular `ΔnDCG@10`.
3. Medir y resolver la latencia de serving del reranker sin cambiar el contrato de ranking.
4. Revisar relevancia, precisión, multilingüismo, duplicados y falsos positivos.
5. Elegir un host HTTPS para la API; GitHub Pages no puede ejecutar FAISS/Python.
6. Sólo después integrar el frontend mediante una bandera o rollout controlado.

## Canonicalidad

El código, configuraciones, pruebas, consultas de benchmark y futuros artefactos pertenecen al worktree de código. Esta nota es una capa conceptual e histórica y no debe utilizarse como input ejecutable.
