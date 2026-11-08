# RA12-A — Preflight de lookup Qwen3 documental para el Atlas de Investigación

**Estado:** contrato + auditoría estática; **NO** activación de runtime, **NO** artefactos publicados por RA12.
**Corte de base:** `main@4c581bd7ef8c84fb385c1900efb00be2b85eeace`, RA11 / PR #215.
**Producto:** `InvestigacionFilosofica`, Research Atlas por consulta; no es el Atlas de Tesis.

## 0. Decisión ejecutiva

Para crear vecindad semántica **obra↔obra** desde resultados federados, se reutilizarán los vectores documentales int8 ya publicados en **Qwen3 Browser Static V4**. No se descargará el modelo de embedding (aprox. 1.2 GB) ni se ejecutará una segunda búsqueda. El mecanismo requiere DOS piezas distintas:

1. **Join verificable:** OpenAlex Work ID de un SearchResult → `vector_id` del corpus V4, y `vector_id` → `cluster` + `ordinal` del vector en el shard.
2. **Extracción de bytes acotada:** obtener los 1,024 valores int8 del vector documental específico sin cargar indiscriminadamente grupos enteros.

El repositorio al corte contiene **los insumos para derivar el join offline**, pero no contiene un lookup RA12 publicado y activado. Esto es una **hipótesis de ingeniería respaldada por los formatos**, no una demostración de cobertura de OpenAlex ni de soporte HTTP Range remoto.

La topología **RA11 continúa siendo el fallback funcional** con `title-abstract-tfidf-cosine-v1`; título 2, abstract 1, título solamente si falta abstract, topK 3 y máximo 36 aristas.

## 1. Evidencia inspeccionada en main

| Artefacto | Lo que se observó |
| --- | --- |
| `src/sources/openalex-philosophy.js` | SELECT `work_id` numérico del parquet SEARCH; `normalizeRow()` produce `https://openalex.org/W{work_id}`; `abstract: null`. |
| `src/core/merge-results.js` | `resultIdentityKey()` prioriza DOI y luego OpenAlex; `openalex:w123` es identidad canónica cuando no prevalece DOI. |
| `src/core/research-atlas-assembler.js` | `WorkNode` conserva `abstract` y la identidad heredada. No debe inferirse que su `identity.key` siempre sea OpenAlex. |
| `src/ai/qwen3-browser-static-v4-search.js` | Carga manifiesto, ID-array u32 y vector-array i8 por cluster; metadata por páginas gzip indexadas por `vector_id`. Su flujo normal requiere embedding de consulta y 32 clusters: **no reutilizar esa búsqueda** para recuperar un vector puntual. |
| `scripts/retrieval/build_browser_static_v4_artifacts.py` | SELECT SQLite: `vector_id, id, ..., openalex_id, crossref_id, ...`; guarda metadatos JSONL gzip ordenados por vector_id. Guarda `clusters/cluster-NNN.ids.u32` y `clusters/cluster-NNN.vectors.i8` con la **misma posición de fila**. |
| `scripts/retrieval/validate_browser_static_v4_artifacts.py` | Validación de cardinalidad, secuencia completa de vector_id, integridad de partición en clusters, formatos y ranking congelado. |
| `benchmark/semantic-retrieval/browser-static-v4/artifact-manifest.json` | 451,823 documentos; 1,024 dimensiones; 256 clusters; 883 páginas de 512 filas máximo; int8 L2, escala 127. |
| `benchmark/semantic-retrieval/browser-static-v4/publication.json` | Artefactos V4 publicados e inspeccionados en navegador bajo revisión HF inmutable. No activó producción. |
| `benchmark/research-atlas/v11/work-first-policy.json` | Work-first: semantic-neighbor opcional; text similarity siempre disponible. |

**No se inspeccionaron bytes reales de una página HF en esta fase.** Que el builder escriba un campo `openalex_id` no demuestra todavía su tasa de no-nulos ni su formato real, ni que cada resultado federado pertenezca al V4. Validar con muestra real antes de construir.

## 2. Linaje inmutable

- Hugging Face dataset: `CristianPelayo/openalex-philosophy`.
- V4 revision: `5a4a195085de54bf607a6c4397092ffb32716dcc`.
- Base path: `semantic-retrieval/v3.3/browser-static-v4/20261010-v4`.
- V4 manifest SHA-256: `0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa`.
- Source FAISS SHA-256 reportado por manifest: `31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68`.
- Source metadata SQLite SHA-256 reportado: `e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0`.
- Modelo base: `Qwen/Qwen3-Embedding-0.6B` revision `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`.
- Modelo browser de consultas, **NO requerido para este join**: `onnx-community/Qwen3-Embedding-0.6B-ONNX` revision `c25a394dd583836952667c12f008335071b3f43d`.
- SEARCH normal de OpenAlex Philosophy: `09c329326ed24ccf986c4b4c47c9794f055516dc`, fichero `v3.2/philosophy-corpus-v3-2-search.parquet`.
- **V4 y SEARCH tienen revisiones distintas**. Requieren join explícito, no equivalencia asumida de posición o número de filas.

La URL de assets es la `base_url` ya versionada en `publication.json`. No crear URL de un lookup inexistente ni sustituirla silenciosamente por `resolve/main`.

## 3. Inventario estático y coste de lectura

| Recurso | Composición / observación |
| --- | --- |
| ID arrays | 256 × `clusters/cluster-NNN.ids.u32`, u32 little-endian; conteo agregado 451,823 × 4 = **1,807,292 bytes**. |
| Vector arrays | 256 × `clusters/cluster-NNN.vectors.i8`; 451,823 × 1,024 = **462,666,752 bytes** (sin IDs). |
| Clusters | 256, tamaños entre 244 y 6,472 documentos. Máximo de vector-array individual **6,627,328 bytes**, sin ID-array. |
| Metadata pages | 883 gzip JSONL, 512 filas máximo; payload comprimido agregado declarado **164,097,919 bytes**. |
| Vector metadata lookup | `floor(vector_id / 512)` sirve para vector_id→página, **NO** para OpenAlex ID→vector_id. |
| Manifest | SHA + tamaños por cada asset. Las copias descargadas se validan contra ello. |
| Cold model | `1,200,510,818 bytes`, **innecesarios** para comparar vectores de documentos ya precalculados. |

**Riesgo principal:** descargar un shard entero por cada obra puede transferir decenas de MB en consultas de 20–50 obras repartidas entre clusters. Tampoco deben cargarse los 32 clusters de `BrowserStaticV4Search.search()` para este fin. El proyecto no autorizará activar esa estrategia por defecto sin medir red, latencia y memoria.

## 4. Contrato lógico de identidad

Entrada: obras del **SearchResponse federado ya unificado**, no una consulta independiente.

Normalización candidata:

~~~text
https://openalex.org/W12345
openalex:W12345
openalex:w12345
W12345
  → openalex:W12345  (forma externa estricta de join)
~~~

- La fuente del ID debe constar en `openalexId` / `openalex_id` / URI canónica OpenAlex / `sourceRecord` acreditado. Aceptar sólo un ID estructurado explícito, bajo el patrón `W[0-9]+`; no deducirlo por título, palabras clave, abstract, DOI, autor, posición de ranking o similitud textual.
- **No sustituir** `resultIdentityKey()` ni reescribir `WorkNode.id`. Si `identity.key` es `doi:...`, puede aún existir un OpenAlex ID como alias bibliográfico confirmado; sólo usar ese alias probado.
- Rechazar IDs ambiguos o contradicciones entre registros de proveedor, sin elegir silenciosamente un ganador.
- `openalex_id` del metadata V4 puede ser nulo, duplicado o tener formato distinto: medirlo. Todo caso no inequívoco lleva a fallback RA11.
- El `vector_id` es entero secuencial del corpus V4, **no es el OpenAlex Work ID**. No convertir uno en otro aritméticamente.
- Ningún join puede fusionar dos WorkNodes por sí mismo. El índice sólo aporta un atributo auxiliar y su procedencia.

Salida propuesta **offline**, versionada:

~~~json
{
  "openalexWorkId": "W12345",
  "vectorId": 9876,
  "cluster": 37,
  "ordinal": 142,
  "datasetRevision": "5a4a195085de54bf607a6c4397092ffb32716dcc"
}
~~~

Es un **ejemplo de forma del contrato, no un registro real**.

Invariantes: `vectorId` en `[0,451822]`; `cluster` en `[0,255]`; `ordinal` en `[0, cluster.count-1]`; `cluster.ids[ordinal] === vectorId`; un Work ID no debe mapear a varios vector IDs salvo política explícita de ambigüedad fail-closed; un vector_id no puede aparecer en dos clusters.

## 5. Derivación offline recomendada (RA12-B, NO ejecutada)

1. Descargar **una sola vez en job offline** los 883 metadata pages V4, con verificación de hashes de cada fichero. No repetir esta descarga en navegador por consulta.
2. Emitir `vector_id → openalex_id` desde campos explícitos, contabilizando nulos y valores inválidos. Para cualquier relación con SEARCH, hacer un benchmark estratificado con IDs reales de resultados federados.
3. Descargar los 256 `ids.u32` (aprox. 1.81 MB agregados) y derivar `vector_id → {cluster,ordinal}`. Validar 451,823 IDs únicos completos y forma correcta.
4. Unir las tablas sin necesidad del FAISS maestro ni de recalcular embeddings. Este procedimiento **no equivale** a la construcción del Related Work full index prohibido por RA10.
5. Detectar colisiones, duplicados, ambigüedad, nulos y discrepancias de revisión. Ninguna colisión silenciosa. Conservar conteos y ejemplos no sensibles en reportes.
6. Serializar un lookup **pequeño y particionado** (por prefijo/hash normalizado) para resolver sólo Work IDs activos; guardar esquema, revision, SHAs, source manifest hash, cardinalidad y metodología de partición.
7. Confirmar publicación inmutable del lookup en HF bajo ruta nueva versionada, **sin inferir que ya está publicado**; capturar commit OID, listado de archivos, bytes, hashes y validador remoto.
8. No subir modelo, copias de embeddings o archivos masivos a GitHub. El índice de identidad puede subirse con controles de tamaño, sin información privada.

## 6. Extracción documental (diseño RA12-C; gate aún ABIERTO)

Los shards V4 existen, pero exponen archivos binarios completos por cluster, no un endpoint de vector individual.

**Alternativa prioritaria a verificar:** HTTP Range contra el **asset exacto** versionado, ya que el offset calculable es:

~~~text
startByte = ordinal * 1024
endByte   = startByte + 1024 - 1
~~~

Sólo considerarla viable si una prueba real de navegador (origen GitHub Pages → HF, con CORS y redirecciones) confirma simultáneamente:

- respuesta **206 Partial Content** y `Content-Range` preciso;
- cuerpo exactamente **1,024 bytes**; no aceptar una respuesta `200` con el shard completo;
- integridad/orden respecto del vector del shard y validación del asset con hash;
- políticas de Cache-Control y límites de peticiones compatibles con producción;
- comportamiento ante servidor que ignora Range, caídas, 403/429, timeouts o `AbortSignal`.

**OJO de seguridad:** la verificación SHA-256 del shard completo en un manifest **no prueba por sí sola** la integridad criptográfica de un slice HTTP Range. Antes de afirmar integridad de slices hay que verificar el shard completo, construir un manifest de hashes por bloque o emplear otro mecanismo autenticado. Toda arista exige un nivel de evidencia coherente con lo efectivamente verificado.

**Si Range/CORS falla:** no publicar un mecanismo que descargue indiscriminadamente shards en cada toggle. Evaluar tiles pequeños **derivados** de los mismos vectores V4, con inventario/checksums, sin regenerar ni reentrenar embeddings; medir primero el compromiso de duplicación de almacenamiento, cache y tamaño. Alternativamente, aplicar un presupuesto estricto de shards completos con fallback RA11 y un requisito de opt-in si supera el costo de red. Ninguna ruta se activa sin gate.

No habrá nuevo endpoint de API de búsqueda, embeddings bajo demanda, uso del modelo de ~1.2 GB ni `api.openalex.org` client-side.

## 7. Semántica del coseno sobre los bytes int8

El builder aplica: `round(clip(normalize_L2(float32), -1, 1) * 127)` a cada dimensión. Para comparar DOS documentos ya recuperados, reconstruir valores `int8/127` y calcular:

~~~text
cosine(u,v) = dot(u,v) / (||u|| * ||v||)
~~~

**Renormalizar** después de cuantizar, o documentar rigurosamente la aproximación. No usar directamente el score `query · int8 / 127` del buscador de V4 como si fuera cosine de dos documentos. Puntajes con norma cero, NaN, menos de 1,024 bytes, revision inconsistente o metadata faltante se rechazan.

Probar contra float32 de referencia (cuando esté disponible) o vectores V4 completos verificables, con tolerancia declarada **antes** del benchmark. No afirmar paridad matemática perfecta por usar el mismo `modelId`.

## 8. Enriquecimiento del Atlas: contrato funcional futuro

~~~text
SearchResponse único
  → WorkNodes canónicos RA11
  → resolver local de OpenAlex IDs explícitos
  → lookup publicado / fijado / cacheado
  → cargar sólo vectores dentro del presupuesto
  → coseno de parejas disponibles
  → semantic-neighbor (evidence derived)
  → layout anchored-force-v1
  → Vista Resultados ⇄ Atlas (misma búsqueda)
~~~

- `semantic-neighbor` sólo para WorkNode↔WorkNode y con `modelId`, `modelRevision`, `metric`, `score` y lineage (datasetRevision, manifest hash, vectorIds, cluster/ordinal, fetch/integrity method).
- Score expresa **proximidad semántica**, no influencia, cita, crítica, tradición, escuela, coautoría ni autoría confirmada.
- No crear parejas duplicadas `semantic-neighbor` + `lexical-neighbor`: al llegar enriquecimiento incremental eliminar/suprimir la arista textual de la misma pareja y preservar evidencia verificable.
- Reusar IDs canónicos, no introducir WorkNodes nuevos por lookup; no reordenar ranking ni cambiar SearchResponse.
- Cuotas topK 3 y máximo 36 aristas bajo la política RA11, con orden estable/tie-break determinista.
- Obra sin OpenAlex ID, sin vector, sobre presupuesto, con fallos de red o inconsistencia → **RA11 TF-IDF/título-only**, sin bloquear búsqueda ni Atlas.
- `js/research-atlas-embed.js` sigue siendo visualizador, **sin fetch ni nuevo search**. La orquestación del enriquecimiento pertenece a una capa externa controlada, después del SearchResponse.
- Respetar cancelación, consultas parciales y prevención de respuestas tardías de sesiones antiguas. Cache por revision y vector ID.
- Evitar re-layout brusco: respetar pinning, posición de QueryNode y `maxExistingDisplacement=0.18`.
- No exigir auditoría humana de Author Authority para este módulo de vectores.

## 9. Gates obligatorios antes de implementación/publish

### RA12-B: cobertura/identity

- [ ] Una muestra **real** de metadata HF V4 y resultados federados permite confirmar el formato de `openalex_id` y la unión real; medir cobertura, ausencias y colisiones.
- [ ] Todas las páginas y `ids.u32` tienen hash/tamaño declarados y no presentan IDs repetidos.
- [ ] Índice derivado completo con OID de build, datos fuente y hashes reproducibles.
- [ ] Cohortes 5/20/50 obras, diferenciadas por proveedor y DOI-priority: porcentaje de OpenAlex IDs presentes, joins correctos y rechazos explicados.
- [ ] JSON pequeño, particionado, con consumo de red y caché medidos, sin procesar 451k registros por búsqueda.

### RA12-C: bytes y coseno

- [ ] Pruebas CORS, 206/Range, bytes exactos, reenvíos y abort en navegador real; o plan alternativo documentado.
- [ ] Validación criptográfica adecuada a slices (o shards enteros); no afirmar que un SHA de archivo verifica automáticamente el slice.
- [ ] Coseno cuantizado calibrado, fórmula y tolerancia preregistrada.
- [ ] Evidencia semántica en snapshot válida por `assertResearchAtlasSnapshot`.
- [ ] Falta de dato, error de red o exceso del presupuesto nunca bloquean RA11.
- [ ] No tráfico externo adicional por **cambiar pestaña**, no segunda consulta federada.
- [ ] No descarga del modelo de inferencia de 1.2 GB.

### RA12-D: producto/CI

- [ ] Medir bytes transferidos, p50/p95 latencia, memoria, shards/tile requests, cache hit y errores para 5, 20, 50 obras, desktop y móvil/red lenta.
- [ ] Comparar contra gate RA8 y reejecutar RA9, RA11 y accesibilidad. No aprobar si hay regresión no justificada.
- [ ] Simular orden de proveedores distinto, ausencia de ID, abstract null, fuente no OpenAlex, DOI-first, duplicados y consultas canceladas.
- [ ] Revisar que layout no salte y que inspector diga cuál evidencia es semántica real y cuál textual.
- [ ] Publicación de manifest inmutable, OID, hashes, rollout y rollback antes de habilitar feature flag.

**Estado hoy: todos los checks anteriores son PENDIENTES de ejecución de RA12-B/C/D, salvo la validación estática de contratos realizada por este PR.**

## 10. Descomposición propuesta de entregas

- **RA12-A** (este PR): documento técnico, contrato JSON y test estático; **sin cambios de producción**.
- **RA12-B**: generador offline de lookup y benchmark de cobertura; publicación sólo después de validar bytes y SHA. Puede incluir detector de colisiones y reporte de cobertura.
- **RA12-C**: experimento aislado de extracción puntual (Range o tiles), cálculo coseno, sin conectarlo todavía a `index.html`.
- **RA12-D**: integración progresiva opt-in/por presupuesto con snapshot y product gate, sólo si B y C pasan.
- **RA12-E (si requiere)**: instrumentación y rollout versionado con validación visual remota, sin inferir readiness por CI únicamente.

## 11. Política de no-regresión

- No modificar `rank.js`, `merge-results.js` ni proveedores para mejorar geometría.
- No activar Author Authority o Related Work bloqueados en RA10.
- No escribir en `main`, ni cerrar/mergear PR #214 en este preflight.
- No publicar tokens o logs con credenciales.
- No inferir relación histórica fuerte a partir de cosine.
- No convertir los 451,823 embeddings en 451,823 nodos por consulta.
- Las decisiones sobre presupuesto y protocolo se basarán en una prueba de red **observable**, no en suposiciones sobre HTTP Range de Hugging Face.

## 12. Referencias

- `docs/RESEARCH_ATLAS_WORK_FIRST_RA11.md`
- `docs/RESEARCH_ATLAS_ARCHITECTURE_V1.md`
- `benchmark/research-atlas/v11/work-first-policy.json`
- `benchmark/semantic-retrieval/browser-static-v4/artifact-manifest.json`
- `benchmark/semantic-retrieval/browser-static-v4/publication.json`
- `scripts/retrieval/build_browser_static_v4_artifacts.py`
- `scripts/retrieval/validate_browser_static_v4_artifacts.py`
- `src/ai/qwen3-browser-static-v4-search.js`
- `src/core/browser-semantic-v4.js`
- `src/sources/openalex-philosophy.js`

**Conclusión:** derivar el join es factible según el diseño publicado. **Recuperar vectores con presupuesto razonable aún requiere un experimento de transporte y un plan explícito de integridad.** Ninguna de las dos capacidades se declara ya desplegada.
