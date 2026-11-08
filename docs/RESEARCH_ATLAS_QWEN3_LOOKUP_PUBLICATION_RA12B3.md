# RA12-B3 — Publicación inmutable del lookup documental OpenAlex → Qwen3 V4

**Fase:** RA12-B3 — paquete de publicación + auditoría del artefacto real.  
**Estado en este PR:** preflight automático; publicación en Hugging Face **manual y protegida**.  
**Base:** `main@e95a8eeafddcfbc05081f197036cc43f9afaaa8a` (PR #218 fusionado).

## Objetivo

Preservar el lookup **ya generado y auditado** de 451,823 obras del corpus `CristianPelayo/openalex-philosophy` (Qwen3 Browser Static V4) en el dataset propio del usuario, con revisión HF inmutable y verificación posterior **por archivo**. Esto no añade todavía vectores al Atlas, no descarga el modelo de ~1.2 GB, no activa nuevas aristas ni genera una segunda búsqueda.

**No volver a descargar 166 MB ni ejecutar FAISS** para publicar: reutilizar el artefacto de GitHub Actions RA12-B2 completo, verificando el ZIP por SHA-256 y sus 256 particiones. El artefacto de Actions es temporal; por eso se necesita una publicación duradera en HF.

## 1. Fuente exacta

El workflow RA12-B2 se ejecutó dos veces correctamente. Esta fase fija el artefacto de la **última ejecución íntegra sobre el commit de RA12-B2**:

- PR auditado: `#218`; merged en `e95a8eeafddcfbc05081f197036cc43f9afaaa8a`.
- Run: `42439871082`; job `128606591062`.
- Head probado: `2647a848ce094e1614de28c13c2f1a4b03ba8e62`.
- Artifact ID: `13600754669`.
- Nombre: `research-atlas-ra12b2-real-v4-evidence`.
- ZIP SHA-256 registrado por GitHub Actions: `8671489af3ac9b587c0efa47d59d07da7f16d7f7c5b4f72a44f9b0306c9cba01`.
- Bytes ZIP: `6,019,233`.
- V4 revisión HF origen: `5a4a195085de54bf607a6c4397092ffb32716dcc`.
- V4 manifest SHA256: `0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa`.
- Fuente validada: `451,823` Work IDs únicos, cero colisiones, `256` particiones, `5,965,263` bytes comprimidos.

El pin está en `benchmark/research-atlas/v12/lookup-publication-candidate.json`. No aceptar un artifact ambiguo, la rama mutable `main` de HF ni un ZIP cuyo SHA difiera.

## 2. Preparación (sin escribir en HF)

`scripts/research-atlas/prepare_ra12_lookup_release.py`:

1. Verifica el ZIP exacto por tamaño y SHA.
2. Rechaza miembros extra, duplicados, rutas `../`, symlinks y ZIP descomprimido excesivo.
3. Contrasta el lookup con `validation.json` y `full-prefetch.json` (auditoría real RA12-B2).
4. Verifica los 256 hashes y tamaños declarados, descomprime las 451,823 líneas, comprueba Work ID normalizado, unicidad y partición por SHA.
5. Verifica `vector_id` en rango y `cluster + ordinal` dentro de los límites del manifiesto V4. La correspondencia exacta con los archivos fuente u32 **ya fue probada independientemente en RA12-B2**.
6. Genera sólo `lookup-manifest.json`, `lookup/part-NNN.jsonl.gz` y `release-provenance.json`.
7. La procedencia del paquete incluye que **no es aún evidencia de publicación**; el publisher la valida aparte.

Esto forma un paquete de aproximadamente 6 MB, **sin vectores/documentos completos**.

### Ejecución

En GitHub Actions, el workflow `.github/workflows/research-atlas-ra12b3.yml` descarga automáticamente el artifact de la API GitHub, hace el preflight y conserva el reporte. En PRs **nunca** escribe en HF.

## 3. Publicación bajo aprobación manual

Después de fusionar RA12-B3, el usuario puede abrir el repositorio → **Actions** → **Research Atlas RA12-B3 · immutable Qwen3 lookup publication** → **Run workflow**, seleccionar `main`, y capturar exactamente:

```text
PUBLICAR_RA12B3_LOOKUP
```

El workflow sólo invoca el publisher al recibir `workflow_dispatch`, nunca con `pull_request`. Necesita secret de GitHub Actions **`HF_TOKEN`**, configurado con permisos de escritura sobre el dataset del usuario. **No compartir el token por el chat ni registrarlo en logs**. No se ha comprobado que este secret exista: si falta, la publicación se detendrá.

Target inmutable de contenido:

```text
CristianPelayo/openalex-philosophy
  /research-atlas/qwen3-document-lookup/v1/ra12b2-run42439871082/
```

El publisher (`scripts/research-atlas/publish_ra12_lookup_to_hf.py`):

- falla si el prefijo ya existe para impedir sobrescrituras silenciosas;
- exige un paquete real (`syntheticFixture=false`), fuente y SHA esperados;
- sube 258 ficheros (256 particiones, manifest, provenance) al dataset HF;
- obtiene `commitOid` (no basta una rama mutable);
- contrasta el inventario remoto exacto y vuelve a descargar **cada** archivo usando ese OID, comparando SHA-256 de forma independiente;
- guarda `artifacts/research-atlas-ra12b3/hf-publication.json` con revision, URL inmutable y veredicto;
- **no habilita** el Atlas: `atlasRuntimeEnabled=false`.

### Distinción de estados

- PR CI pass = el artifact real está empaquetado/verificado y el código de publicación se puede revisar.
- Workflow dispatch + secret + upload + 258 hashes correctos = lookup realmente publicado, con OID propio.
- Publicado en HF ≠ recuperación de vectores ni aristas Qwen3 activas en el Atlas; eso corresponde a RA12-C/D.

## 4. Reglas, riesgos y fallback

- **No exponer el HF_TOKEN**. Debe residir sólo en Secrets de GitHub Actions.
- No publicar si el ZIP, V4 manifest, conteos, hashes o schema difieren de la referencia congelada.
- Si el artifact caduca antes de la aprobación, hay que volver a ejecutar RA12-B2 y **versionar un nuevo pin de artifact ID, tamaño y SHA**. No usar la etiqueta del artifact como sustituto de prueba.
- Si el target existe, falla sin sobreescribir; para reeditar se necesita nueva ruta versionada y nuevo PR.
- Todos los resultados del CI de RA12-B2 están documentados en `benchmark/research-atlas/v12/real-v4-lookup-audit.json`. El registro original apunta a una ejecución previa del mismo corpus y está preservado como evidencia histórica; RA12-B3 fija la última ejecución.
- RA12-C sigue teniendo que probar HTTP Range (206, Content-Range, CORS, bytes recibidos, integridad individual) o generar tiles verificados. No se publica nada de vectores hasta pasar ese gate.
- La cobertura del **SearchResponse completo** por proveedor/consulta 5/20/50 todavía no está medida; el 100 % sólo corresponde al corpus V4.

## 5. Validación y avance

Pruebas sintéticas: `python -m unittest discover -s tests -p 'test_ra12_lookup_release.py' -v`, ejecutadas en CI. El job comprueba también el artifact **real** con todos los registros. La aprobación manual es una operación separada que se audita por el `hf-publication.json` resultante.

**Próxima fase:** RA12-C, medición experimental de recuperación puntual de 1,024 bytes por obra con soporte 206/CORS y garantía criptográfica de la procedencia de cada slice, o tiles pequeños versionados si Range falla. Sólo entonces el Atlas podrá generar `semantic-neighbor` sin cargar megabytes por vector.
