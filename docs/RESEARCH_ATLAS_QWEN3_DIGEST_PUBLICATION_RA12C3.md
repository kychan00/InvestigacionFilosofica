# RA12-C3 — Publicar árbol SHA-256 de Qwen3 V4 y comprobarlo desde el navegador

**Producto:** Research Atlas dinámico de Investigación Filosófica. No es Atlas de Tesis.  
**Base:** `main@95c7ae170f89bc7a40255ca7f4bdf8ecb19a7a01`, RA12-C2 PR #221 fusionado.  
**Estado del PR:** preflight de publicación, lector experimental y pruebas; **NO se publica nada en HF al fusionar**.

## Objetivo

RA12-C2 verificó **451,823 vectores documentales Qwen3 V4** contra 256 shards originales de Hugging Face y generó un árbol de **7,186 tiles** de 64 SHA-256, de los que el usuario necesita recuperar aproximadamente 2 KB para verificar cada vector de 1,024 bytes. La auditoría completa se preservó como un artifact de Actions, pero el artifact expira.

RA12-C3 deja lista una publicación **inmutable, separada y protegida** de los archivos de integridad en el dataset propio del usuario. La publicación real requiere autorización manual y debe devolver un **OID HF**, nunca darla por hecha por un merge o un CI verde.

## Fuente y destino congelados

- Dataset: `CristianPelayo/openalex-philosophy`.
- V4 original: `5a4a195085de54bf607a6c4397092ffb32716dcc`; SHA manifest V4 `0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa`.
- RA12-C2 run de evidencia: `42495212950`, job `128775980313`, artifact `13623491225`.
- ZIP Actions exacto: **14,413,416 bytes**, SHA256 `88472853e93caa3bacdd635757143095a7aeeac2c096f51143859169837022c7`.
- Root manifest SHA256: `38067b5876de5f53abe5c7431b8618464d3fe711058a70fdde700fce7c50d961`.
- Inventario esperado: 256 binarios de hashes (14,458,336 bytes), 256 índices JSON (1,281,101 bytes), un root manifest y una procedencia de release. **514 archivos**.
- Prefijo HF reservado: `research-atlas/qwen3-document-digests/v1/ra12c2-run42495212950`.

La configuración fija está en `benchmark/research-atlas/v12/ra12c3-digest-publication-candidate.json`.

## Qué hace CI en cada PR

1. Ejecuta pruebas Python y JavaScript sin contacto a HF y la suite completa del proyecto.
2. Descarga mediante la API GitHub el ZIP auténtico, verifica tamaño y SHA; rechaza rutas de extracción peligrosas, duplicados, symlinks y material ajeno.
3. Verifica el SHA inmutable del root y la procedencia RA12-C2 (`source-prefetch.json`, `independent-audit.json`).
4. Comprueba los 256 índices, 256 archivos de hashes, todos los SHA, 7,186 tiles y offsets de 64 vectores por bloque, sin confiar en el nombre del artifact.
5. Extrae un directorio mínimo que **no contiene los 462 MB originales de vectores**, ni el modelo de 1.2 GB, ni el FAISS.
6. Conserva `preflight.json` con status `verified-unpublished` y `runtimeEnabled=false`.

**Un PR que pasa CI no publica nada**. El workflow únicamente intenta publicar si su evento es `workflow_dispatch`, nunca con `pull_request`.

## Publicación sólo con autorización explícita

Después del merge, entre al repositorio GitHub → **Actions** → **Research Atlas RA12-C3 · authenticated digest release and browser gate** → **Run workflow** en `main`.

El campo `confirm_publish` requiere exactamente:

```text
PUBLICAR_RA12C3_DIGESTS
```

Esto escribe en su dataset de Hugging Face; se necesita el secret **`HF_TOKEN`** en GitHub Actions, con permisos sobre ese dataset. **No escriba ni comparta el token en el chat.** No se ha confirmado que el secret esté configurado y no se publicará automáticamente desde esta conversación.

Si el prefijo ya existe, el script rechaza sobreescribirlo. Si el ZIP original o el root SHA cambian, detiene la publicación. Si la carga procede, vuelve a consultar el dataset por el **commit OID inmutable** y verifica todos los hashes de los **514 archivos** remotos. Sólo ese informe `hf-publication.json` con `status=published-and-remotely-verified` representa publicación confirmada.

## Cadena de integridad comprobada en navegador (tras publicar)

El módulo experimental `src/core/research-atlas-qwen-digest-proof.js`, **no importado por producción**, implementa:

```text
OID de Hugging Face + SHA del root fijado independientemente
       ↓ GET raíz con hash verificado
Índice cluster-NNN.json → SHA desde raíz
       ↓ GET índice con hash verificado
Digest binario → Range 206 de hasta 2,048 bytes
       ↓ hash del tile SHA desde índice
Hash SHA-256 del vector individual (32 bytes)
       ↓ Range 206 de 1,024 bytes al shard V4 original
Vector documental → SHA coincide con el digest verificado
```

El cliente rechaza URL no anclada a un OID hexadecimal, JSON adulterado, offsets incorrectos, SHA inválido, ausencia de `Content-Range`, servidor que ignora Range, cuerpos excedidos, errores CORS, respuestas tardías o vectores incompletos.

`scripts/qa/research-atlas-digest-chain-smoke.mjs` abre un Chromium **desde el origen real de GitHub Pages** e inyecta el código experimental local, sin desplegarlo al sitio. Tras recibir el reporte de publicación HF, prueba tres rutas reales dentro del V4: cluster **220 ordinal 0**, cluster **208 ordinal 260**, cluster **10 ordinal 6471**. El browser valida todos los eslabones. Si falla, registra `blocked` y el workflow no aprueba el gate de disponibilidad del nuevo recurso, aunque el upload de HF pueda haber ocurrido.

## Qué NO demuestra todavía

- No se ha probado Range de los **digest arrays derivados**: su HTTP 206/CORS se medirá sólo tras la publicación, no se infiere de RA12-C1.
- Un SHA por cada vector demuestra **integridad de bytes**, no la calidad semántica ni que sean verdaderas citas, influencia filosófica o identidad de autores.
- La cobertura de **451,823 / 451,823** corresponde al corpus Qwen3 V4, **no** al SearchResponse federado completo. Sigue pendiente el benchmark estratificado de búsquedas reales 5/20/50, DOI-first y fuentes externas.
- Los costos RA12-C2 para 5/20/50 eran modelados sobre posiciones V4, no latencias ni transferencias reales desde móvil/escritorio.
- RA12-B3 también requería publicación manual del **lookup OpenAlex → vectorId**; aún se necesita verificar su OID y estado antes de habilitar el Atlas semántico.
- No se activan aristas `semantic-neighbor`, consultas extra ni modelo de embedding del navegador en este PR; RA11 continúa siendo el fallback.

## Siguiente gate

Tras confirmar el OID HF y la prueba real de integridad, ejecutar RA12-C4: benchmark de cohortes SearchResponse reales (5/20/50), medir bytes efectivos, p50/p95, caché, solicitudes y límites móvil; diseñar activación **opt-in** de Qwen3 documental con la evidencia del vector y fallback RA11. El cambio de pestaña **nunca** debe lanzar una nueva búsqueda.
