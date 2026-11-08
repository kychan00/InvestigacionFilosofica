# RA12-B2 — Evidencia real del lookup Qwen3 Browser Static V4

**Alcance:** pipeline reproducible de verificación de la fuente real y construcción de un lookup **temporal y no publicado**. No cambia el Atlas principal ni la búsqueda, ni obliga a descargar el modelo de 1.2 GB. No hace publicación a Hugging Face y no modifica el índice de tesis.

**Base exacta:** `main@7a838a1932c6c656e1fcc03ec97ac3cb6a53a801`, PR #217 fusionado.

## Objetivo y criterio epistémico

La fase RA12-B ya creó el generador de correspondencias de **OpenAlex Work ID → vector_id → cluster + ordinal**. RA12-B2 debe distinguir tres niveles de verificación:

1. **Estructura del builder (comprobada por tests sintéticos):** no demuestra la cobertura ni la calidad de joins con material público.
2. **Corpus real HF V4 (este workflow):** descarga exactamente los metadatos comprimidos y arrays ID declarados en el manifest, verifica SHA-256 por fichero y construye un lookup real con conteos de nulos, IDs inválidos, colisiones y UUIDs OpenAlex elegibles.
3. **Cobertura de SearchResponse real (pendiente):** una unión del lookup con 5/20/50 resultados reales de consultas federadas, incluyendo fuentes DOI-first y no OpenAlex, que debe medirse aparte antes de habilitarlo.

No se permite informar la tasa de 2 o 3 como si fueran la misma métrica.

## Camino de ejecución

`.github/workflows/research-atlas-ra12b2.yml` dispara el análisis con cada PR que modifique esta fase:

- Compilar y probar scripts Python y tests sintéticos JS.
- Descargar **3 páginas reales** metadata V4 mediante URL anclada al commit HF, comprobar SHA de cada fichero y publicar muestra de formato de IDs.
- Si la muestra pasa, descargar exactamente los **883 metadata pages gzip + 256 ID arrays u32** de los 256 clusters. El volumen total esperado es aprox. **166 MB**. No descargar `*.vectors.i8`, centroids, FAISS ni modelo.
- Invocar `build_ra12_vector_lookup.py` **sin** `--fetch-missing`: el build sólo puede operar sobre caché cuyos activos fueron verificados.
- Validar por segunda implementación **cada Work ID** y su vectorId, cluster y ordinal contra las páginas y arrays originales; verificar todos los hashes y orden de las particiones.
- Reconstruir otra vez y comprobar directorios byte-idénticos.
- Publicar en el **artifact temporal de GitHub Actions** los JSON de auditoría y el lookup derivado; **no** publicarlo todavía en HF ni integrarlo en producción.

El job debe mostrar en `GITHUB_STEP_SUMMARY` los conteos reales y estados. Su falla no se interpretará como ausencia de contenido filosófico: puede señalar 403/429, CORS, fallo de red o un problema de esquema que requiere corrección.

## Archivos

- `scripts/research-atlas/prefetch_ra12_v4_assets.py`: descarga explícita concurrente y limitada, reintentos acotados, verificación mediante `verified_file()` existente.
- `scripts/research-atlas/validate_ra12_vector_lookup.py`: **reconstrucción independiente** de identidades y posiciones a partir de fuentes para rechazar particiones forjadas, omisiones, duplicados o reubicaciones incorrectas.
- `tests/research-atlas-vector-lookup-audit.test.mjs`: fixtures sintéticos de audit, tamper SHA y prueba de que el prefetch no incluye vectores ni pesos.
- `.github/workflows/research-atlas-ra12b2.yml`: infraestructura de prueba de fuente real, ejecución automática y artefactos.
- `artifacts/research-atlas-ra12b2`: salida **del workflow**, no commiteada en el repo.

## Invariantes

- HF revision **inmutable**: `5a4a195085de54bf607a6c4397092ffb32716dcc`.
- SHA-256 de manifest origen: `0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa`.
- Fuentes completas: 451,823 documentos; 256 arrays ID (1,807,292 bytes); 883 gzip (164,097,919 bytes).
- Particiones por primer byte del hash SHA256 del OpenAlex ID normalizado, con hashes y cardinalidades verificadas, sin inferencia por similitud textual.
- Contradicción de IDs o un Work ID con más de un vector ⇒ **fail-closed**.
- `lookup-manifest.json` deberá conservar `productionEnabled: false` y `status: generated-unpublished`.
- Ningún archivo fuente ni destino se envía a GitHub Pages; el artifact de CI expira a los 30 días.
- El build NO usa el entrenamiento, modelo remoto o API OpenAlex y NO necesita el índice FAISS perdido.
- No añadir aristas `semantic-neighbor` hasta RA12-C/D con coseno documental verificado e integridad suficiente.

## Reproducción local del mismo gate

```bash
python3 scripts/research-atlas/prefetch_ra12_v4_assets.py \
  --manifest benchmark/semantic-retrieval/browser-static-v4/artifact-manifest.json \
  --artifact-root "$HOME/.cache/investigacion-filosofica/qwen-v4" \
  --workers 8 --attempts 5 \
  --report /tmp/ra12b2-prefetch.json

python3 scripts/research-atlas/build_ra12_vector_lookup.py \
  --manifest benchmark/semantic-retrieval/browser-static-v4/artifact-manifest.json \
  --artifact-root "$HOME/.cache/investigacion-filosofica/qwen-v4" \
  --output /tmp/ra12b2-lookup

python3 scripts/research-atlas/validate_ra12_vector_lookup.py \
  --manifest benchmark/semantic-retrieval/browser-static-v4/artifact-manifest.json \
  --artifact-root "$HOME/.cache/investigacion-filosofica/qwen-v4" \
  --lookup /tmp/ra12b2-lookup \
  --report /tmp/ra12b2-validation.json
```

## Semáforo de publicación

**El código de esta fase NO equivale por sí mismo a un corpus real validado.** Registrar explícitamente resultados de GitHub Actions antes de declarar que la prueba real ha pasado. Incluso si pasa:

- [ ] registrar fecha / run / commit y SHA del artifact completo;
- [ ] verificar cobertura de IDs en SearchResponse reales 5/20/50 y no sólo sobre el universo de metadatos;
- [ ] decidir tamaño de particiones, ubicación y revisión HF para una publicación duradera;
- [ ] hacer RA12-C para HTTP Range 206/CORS o tiles, integridad del vector individual y costes de descarga;
- [ ] diseñar RA12-D de integración progresiva y fallback RA11.

Hasta entonces, la experiencia pública permanece **RA11 — título + abstract, con fallback title-only**.
