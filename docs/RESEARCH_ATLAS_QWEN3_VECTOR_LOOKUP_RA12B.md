# RA12-B — Lookup offline OpenAlex → vector Qwen3 V4

**Estado:** script de generación y pruebas unitarias; **no se ha construido ni publicado el lookup real**.

Base: `main@0035820473f675c8f860f63ae2ad26a9416ccc6a`, merge RA12-A / PR #216.

## Decisión

Usar exclusivamente los metadatos y las listas de IDs de **Browser Static V4** para derivar, sin regenerar ningún embedding:

```text
V4 metadata JSONL gzip           V4 cluster IDs u32
(vector_id, openalex_id, id)      (vector_id en orden ordinal)
            │                       │
            └───────────┬───────────┘
                        ▼
         Work ID → vector_id → cluster, ordinal
                        ▼
          256 particiones por SHA-256 del Work ID
```

El resultado no reordena ni fusiona WorkNodes, no modifica SearchResponse, no ejecuta FAISS y no descarga los ~1.2 GB de pesos Qwen3. Los archivos de vectores int8 también permanecen donde están; su recuperación será tema de RA12-C.

## Contratos e insumos congelados

- HF: `CristianPelayo/openalex-philosophy`.
- Revisión V4: `5a4a195085de54bf607a6c4397092ffb32716dcc`.
- Ruta: `semantic-retrieval/v3.3/browser-static-v4/20261010-v4`.
- Manifiesto origen SHA256: `0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa`.
- **451,823** documentos y vectores de **1,024** dimensiones, distribuidos entre **256** clusters.
- Metadatos: **883** páginas gzip JSONL, **164,097,919 bytes** comprimidos.
- Listas de IDs de clusters: **1,807,292 bytes** agregados de enteros u32.
- La fuente `scripts/retrieval/build_browser_static_v4_artifacts.py` escribe `vector_id` y `openalex_id`; y al escribir cada cluster conserva alineadas la lista `ids.u32` y las filas `vectors.i8`.

El nuevo script `scripts/research-atlas/build_ra12_vector_lookup.py` utiliza **sólo Python 3 estándar**; verifica tamaños, SHA-256, rangos, cardinalidades, exclusividad de vector ID por cluster y orden secuencial de las páginas. El hash del manifiesto local debe coincidir exactamente con el fijado por la publicación V4.

## Cómo auditar metadatos reales (modo muestreo)

```bash
python3 scripts/research-atlas/build_ra12_vector_lookup.py \
  --manifest benchmark/semantic-retrieval/browser-static-v4/artifact-manifest.json \
  --artifact-root "$HOME/.cache/investigacion-filosofica/qwen-v4" \
  --sample-pages 3 \
  --fetch-missing
```

- `--fetch-missing` debe indicarse expresamente: sin él, el script **no hace llamadas de red** y falla si faltan archivos.
- Descarga únicamente los assets faltantes desde la URL HF **fijada al commit V4**, nunca desde `main`, y comprueba el SHA y tamaño de cada asset descargado.
- Una muestra de 3 páginas no mide todo el corpus ni la cobertura real del SearchResponse: **no extrapolar** sin evidencia.
- No genera ni publica index ni introduce cambios en producción.

## Construcción offline completa

```bash
python3 scripts/research-atlas/build_ra12_vector_lookup.py \
  --manifest benchmark/semantic-retrieval/browser-static-v4/artifact-manifest.json \
  --artifact-root "$HOME/.cache/investigacion-filosofica/qwen-v4" \
  --output "$HOME/.cache/investigacion-filosofica/ra12b-lookup-v1" \
  --fetch-missing
```

Si no hay caché previa, el script solicita aproximadamente **166 MB** entre 883 metadatos gzip y 256 archivos de IDs u32. No solicita vectores int8 ni pesos del modelo. Descarga una vez en el entorno **offline de construcción**, no en cada consulta del usuario.

### Salida prevista

```text
ra12b-lookup-v1/
  lookup-manifest.json
  lookup/
    part-000.jsonl.gz
    ...
    part-255.jsonl.gz
```

Cada línea de un shard comprimido representa **[Work ID normalizado, vectorId, cluster, ordinal]**. Ejemplo puramente ilustrativo:

```json
["W12345",9876,37,142]
```

Se usa el **primer byte del SHA-256 del ID canónico** como partición. Nunca se deduce vectorId de los dígitos del Work ID.

El `lookup-manifest.json` generado contiene revisión y hashes del corpus fuente, conteos de identidad, total de Work IDs elegibles, causas de exclusión, ambigüedades, SHA y bytes de cada partición, así como `productionEnabled=false` y `unresolvedQueryCoverage=true`. No lleva datos privados ni fecha de reloj que impida reproducibilidad. Los gzip se escriben con `mtime=0` y orden estable; el output sólo se crea si su directorio no existe.

## Regla de identidad y rechazo

1. Aceptar `openalex_id` explícito o alias `id` con formato OpenAlex acreditable: `W[0-9]+`, `openalex:W...`, o `https://openalex.org/W...`; sin inferir por DOI, título, abstract, autor o coincidencia textual.
2. Si `openalex_id` está presente y es inválido, no usar silenciosamente el segundo campo como sustituto.
3. Si `openalex_id` e `id` contienen dos IDs OpenAlex distintos, descartar ese registro.
4. Si dos `vector_id` distintos dicen pertenecer al mismo Work ID, descartar **ambas** asignaciones para ese Work ID y contar la colisión.
5. Cada vectorId debe aparecer exactamente en un cluster; su ordinal es la posición dentro de `ids.u32`.
6. Ni el join ni su fallback pueden alterar la identidad `resultIdentityKey()`, que puede priorizar DOI.
7. Las obras sin join permanecen con topología RA11 (TF-IDF título/abstract, o título solamente).

## Qué se probó en este PR

`tests/research-atlas-vector-lookup-builder.test.mjs` utiliza únicamente fixtures **sintéticos** explícitos:

- unión `openalex_id → vector_id → cluster + ordinal` y orden;
- conflicto entre dos identificadores OpenAlex del mismo registro;
- un Work ID duplicado en dos documentos (fail-closed);
- registros sin OpenAlex ID o con campo inválido;
- misma salida **byte por byte** en dos ejecuciones;
- corrupción de archivo detectada por SHA sin producir directorio de publicación;
- rechazo de fixtures pequeños en modo de manifiesto real;
- muestreo etiquetado sin falso claim de cobertura del corpus.

Comando:

```bash
node --test tests/research-atlas-vector-lookup-builder.test.mjs
npm test
```

**Resultado local durante el desarrollo: 5/5 pruebas del nuevo archivo pasaron** con un prototipo equivalente. La ejecución de CI del commit GitHub y la suite completa deben comprobarse por separado.

## Límites — gates todavía no cerrados

| Gate | Estado |
| --- | --- |
| Script de generación con pruebas sintéticas | **Implementado en este PR** |
| Descarga verificada de páginas HF reales | **No verificada desde el entorno de desarrollo** |
| Cobertura de `openalex_id` sobre 451,823 documentos | **Desconocida, hasta ejecutar full build** |
| Cobertura de joins para los SearchResponses reales, incluyendo DOI-first | **Pendiente de benchmark 5/20/50** |
| Lookup remoto inmutable publicado con OID y hashes | **No publicado** |
| HTTP Range/CORS 206 y slices de vectores seguros | **RA12-C pendiente** |
| Aristas `semantic-neighbor` activas en Atlas | **RA12-D pendiente** |
| Auditoría visual y regresión de producto en producción | **Pendiente** |

No confundir un algoritmo local probado con un índice masivo publicado. El generador **no entrega una relación semántica causal, cita, crítica, escuela ni identidad personal**.

## Siguiente entrega

**RA12-B2:** ejecutar muestreo y full build contra metadatos V4 reales, registrar coverage/colisiones, contrastar IDs con SearchResponse real, medir tamaño de lookup, verificar dos construcciones idénticas y decidir publicación inmutable del artefacto. Después, **RA12-C:** experimento aislado de HTTP Range (206/CORS/integridad por bloque) o tiles pequeños, presupuestado por consulta. Nada de esto requiere descargar Qwen3 automáticamente al abrir la vista.

Fuentes: `docs/RESEARCH_ATLAS_QWEN3_VECTOR_LOOKUP_RA12.md`, `benchmark/research-atlas/v12/preflight-contract.json`, `benchmark/semantic-retrieval/browser-static-v4/artifact-manifest.json`, `benchmark/semantic-retrieval/browser-static-v4/publication.json`.
