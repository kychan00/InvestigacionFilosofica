# RA12-C2 — Árbol de integridad para 451,823 vectores Qwen3 V4

**Estado:** generador, validador independiente y benchmark de costos **offline**, inicialmente no publicado, sin activación en Research Atlas.

## Base y motivación

- RA12-B2 (PR #218): 451,823 Work IDs de OpenAlex con ubicación documental inequívoca en el índice V4; 0 colisiones.
- RA12-B3 (PR #219): el mecanismo de publicación del lookup a HF quedó disponible por autorización manual. **Fusionar código ≠ confirmar que la publicación HF se haya ejecutado**.
- RA12-C1 (PR #220): Chromium desde el origen real de GitHub Pages recuperó 6/6 vectores reales mediante HTTP 206 y Content-Range exacto; cada SHA individual coincidió con un shard origen previamente validado, y tres cosenos cuantizados coincidieron con Python.

RA12-C1 sólo probó seis vectores de dos clusters. **No autoriza confiar en los otros 451,817** ni a suponer que la red devolverá siempre los bytes correctos. RA12-C2 construye una fuente de hashes auténticos para **cada** vector documental sin regenerar embeddings.

## Fuente inmutable y descarga exclusivamente en CI

Dataset: `CristianPelayo/openalex-philosophy`, revisión `5a4a195085de54bf607a6c4397092ffb32716dcc`. Fuente de SHA: `benchmark/semantic-retrieval/browser-static-v4/artifact-manifest.json`, SHA-256 `0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa`.

El workflow `.github/workflows/research-atlas-ra12c2.yml` recupera exactamente **256 archivos binarios int8 ya publicados**, 462,666,752 bytes en total. Cada archivo se valida por SHA-256 contra el manifiesto original V4 antes de derivar cualquier digest. Esta descarga de aproximadamente 463 MB sucede **una sola vez en GitHub Actions**, no cuando el usuario utiliza la página; el pipeline no descarga el modelo Qwen3 ni el FAISS.

Los programas, manifiestos, tests y artefactos no se activan en `index.html`, no modifican ranking ni consultas federadas y no intervienen en el Atlas de Tesis.

## Arquitectura del árbol de hashes

Cada vector del corpus consiste en **1,024 bytes int8**; su SHA-256 ocupa **32 bytes**. En lugar de generar 451,823 archivos independientes:

```text
hash-manifest.json                raíz, SHA fijable después del build
  │
  ├─ cluster 000 → indexes/cluster-000.json (SHA desde raíz)
  │                    ├─ índice de tiles: ordinal 0..63, 64..127...
  │                    └─ hash SHA-256 de cada tile (2 KB máximo)
  │
  └─ cluster 255 → indexes/cluster-255.json
                           │
                           ▼
                digests/cluster-255.sha256.bin
                32 bytes de hash por vector, orden ordinal
                           │
                           ▼
                HTTP Range de 1 tile (~2 KB)
                           │
                           ▼
                SHA-256 del tile desde índice validado
                           │
                           ▼
                hash de los 1,024 bytes del vector
                           │
                           ▼
                fetch Range del vector int8 V4
```

Cada cluster consta de un índice JSON y un fichero binario de hashes. Cada archivo binario concatena los 32 bytes de SHA de sus vectores en el mismo orden ordinal validado en RA12-B2. Los bloques contienen un máximo de 64 digests (2,048 bytes). Los últimos bloques de cada cluster suelen ser más pequeños.

La cadena de autenticación futura requerirá:
1. **SHA fijado del root manifest** (registrado tras ejecución real y publicación inmutable).
2. SHA del índice cluster desde el root.
3. SHA del tile de hashes desde el índice cluster.
4. SHA del vector individual desde el tile validado.
5. HTTP 206 + Content-Range exacto de las solicitudes en navegador para tile y vector.

**Advertencia:** la cadena aún no opera en el navegador; este PR construye y verifica los insumos offline. La publicación de archivos y el uso de URL revisada por OID son fases posteriores. El SHA del root **no puede darse por fijado antes del job real**.

## Invariantes verificables

- 451,823 vectores, 256 clusters, SHA-256 por vector de 1,024 bytes.
- 14,458,336 bytes de digests sin comprimir (451,823 × 32). Índices adicionales, root y JSON no incluidos en esa cifra.
- Conteos y offsets de tiles exactos, sin saltos o solapamientos; secuencia ordinal sin identidad inferida a partir de DOI o título.
- El generador produce siempre el mismo resultado byte por byte, sin timestamp, ruta de caché ni aleatoriedad.
- `validate_ra12_vector_hash_tiles.py` vuelve a abrir todos los shards SHA-validados y **recalcula individualmente cada digest** para detectar errores del builder o corrupción de outputs.
- Si una fuente no pasa hash, falla el trabajo; no se publican árboles parcialmente válidos.
- `publishedToHf=false`, `productionEnabled=false` explícitos en el root.

## Costos de red — simulación, no benchmark del buscador

`budget-model.json` contiene seis escenarios de posiciones **reales existentes dentro del V4**, seleccionadas determinísticamente por cluster: 5/20/50 posiciones agrupadas y dispersas. Se contabilizan los bytes del manifiesto, índices de cluster, tiles de SHA y slices int8, además del número de solicitudes. Se separan costos **fríos** y **calientes** (con los hashes previamente cacheados).

**No son consultas reales del buscador federado** y no reflejan necesariamente cómo se distribuyen los artículos que recupera OpenAlex, Crossref, CUCSH o Internet Archive. Tampoco son cifras de transferencia de red medida: quedan excluidos encabezados HTTP, TLS, CDN, redirecciones, reintentos, caché real, tiempos, p50/p95 y respuestas grandes inesperadas. Cualquier afirmación futura de latencia debe basarse en pruebas separadas con navegador y cohortes reales.

Se distinguen estas magnitudes para que un estimado pequeño no se interprete como costo observado.

## Entregables en este PR

- `scripts/research-atlas/prefetch_ra12_v4_vectors.py` — descarga controlada de los 256 vectores fuente originales y verifica tamaño + SHA.
- `scripts/research-atlas/build_ra12_vector_hash_tiles.py` — produce root, índices, digest binarios de 32 bytes por vector, tiles y escenarios 5/20/50.
- `scripts/research-atlas/validate_ra12_vector_hash_tiles.py` — auditoría independiente de cada vector contra el origen autenticado.
- `tests/test_ra12_vector_hash_tiles.py` — prueba sin red con fixtures pequeños, hashes manipulados, tile parcial, reproducibilidad y semántica de costos.
- `.github/workflows/research-atlas-ra12c2.yml` — ejecuta las pruebas reales, verifica todos los SHA y guarda evidencia temporal de CI.
- `benchmark/research-atlas/v12/ra12c2-digest-contract.json` — contrato declarado antes de medir.

## Próximos gates

1. Ejecutar CI real y guardar la raíz SHA-256, bytes, número de tiles, resultados independientes y número de ejecución.
2. Publicar los digest arrays en una ruta nueva inmutable de HF, previa autorización, sin sobrescribir Qwen3 V4. Registrar el OID y verificar los bytes remotos.
3. Probar desde Chromium Pages la descarga **Range de los digest arrays**, incluido CORS, Content-Range, hashes de tile e índice. El éxito de RA12-C1 contra vectores originales no prueba automáticamente la disponibilidad de los derivados.
4. Resolver y medir cobertura de SearchResponse de **5/20/50 resultados reales**, incluyendo alias OpenAlex en resultados DOI-first y fuentes no OpenAlex.
5. Medir bytes reales, latencias p50/p95, caché y fallbacks bajo presupuestos móvil/escritorio antes de activar `semantic-neighbor`.
6. Preservar RA11 como fallback, mantener WorkNodes e identidad originales, y no exigir una auditoría de personas/autoría para la similitud documental.

Hasta completar esos gates, **no habrá Atlas Qwen3 en producción**. Los 451,823 digests sólo permiten probar procedencia de bytes, no influencia, citas, relaciones causales ni identidad de autores.
