---
type: architecture
area: retrieval
status: implementation
updated: 2026-09-30
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
- revisión: `09c329326ed24ccf986c4b4c47c9794f055516dc`;
- artefacto: `v3.2/philosophy-corpus-v3-2-full.parquet`;
- elegibilidad: `CORE` o `PROBABLE`, excluyendo `LOW_QUALITY` y `PARATEXT`;
- universo buscable esperado: 451.823 documentos.

El Parquet V3.2 actual contiene título, abstract, año, idioma, tipo y evidencia clasificatoria. No contiene todavía autores, DOI, revista ni topics completos. La implementación admite esos campos y los conserva cuando una versión enriquecida los aporte, pero no los inventa. La fila fuente original se preserva y el identificador OpenAlex no se sustituye.

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
- no existe todavía índice completo;
- no existe todavía benchmark humano de resultados;
- no se desplegó la API;
- no se conectó el frontend público.

## Próximos gates

1. Medir y resolver la latencia de serving del reranker sin cambiar el contrato de ranking.
2. Ejecutar el job offline completo en infraestructura adecuada.
3. Construir y validar el índice completo.
4. Ejecutar el benchmark interno con y sin reranker.
5. Revisar manualmente relevancia, precisión, multilingüismo y falsos positivos.
6. Elegir un host HTTPS para la API; GitHub Pages no puede ejecutar FAISS/Python.
7. Sólo después integrar el frontend mediante una bandera o rollout controlado.

## Canonicalidad

El código, configuraciones, pruebas, consultas de benchmark y futuros artefactos pertenecen al worktree de código. Esta nota es una capa conceptual e histórica y no debe utilizarse como input ejecutable.
