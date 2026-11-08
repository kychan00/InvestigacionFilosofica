# RA12-C1 — Transporte puntual de vectores Qwen3 V4 por HTTP Range

**Estado:** laboratorio de verificación independiente. **No disponible aún en la búsqueda ni en el Atlas de producción.**  
**Base:** `main@9f9680d411c4ba527f1e5be32d3cb709ee80cd98`, PR #219 (RA12-B3) fusionado.

## Por qué existe esta fase

RA12-B2 comprobó la correspondencia única de **451,823 Work IDs** con los vectores Qwen3 Browser Static V4, sin colisiones, y generó un lookup de 5,965,263 bytes comprimidos. RA12-B3 preparó una **publicación manual protegida** de ese lookup en Hugging Face. La fusión de RA12-B3 **no demuestra** que se haya ejecutado `workflow_dispatch`, ni implica que ya tengamos OID de publicación. Para RA12-C1 no necesitamos el lookup publicado: se verifica por separado el acceso directo a los archivos originales V4, que sí cuentan con revisión HF congelada.

La exigencia para el producto es mayor que «el servidor entiende Range»: debe ser capaz de recuperar **sólo 1,024 bytes int8** por documento desde un navegador abierto en `https://kychan00.github.io`, con autenticidad e identidad de bytes demostrables.

## Experimento preregistrado

El contrato de prueba se encuentra en `benchmark/research-atlas/v12/ra12c1-transport-policy.json`.

1. En un runner de GitHub Actions, verificar el hash exacto del manifest V4 publicado.
2. Seleccionar determinísticamente los **dos shards más pequeños** de los 256 clusters V4: menos de 2 MB de lectura total del lado del runner.
3. Descargar esos dos archivos completos, comparar **SHA-256 con el manifest V4**, y extraer los vectores int8 de ordinal 0, medio y último de cada uno, seis vectores totales.
4. Guardar sólo las coordenadas exactas y **hashes SHA-256 individuales** de los seis slices de 1,024 bytes, no el contenido binario ni credenciales.
5. Abrir en Chromium la **página pública real de Investigación Filosófica** (origen `https://kychan00.github.io`) y ejecutar el código experimental local sin publicar JavaScript nuevo en Pages.
6. Solicitar cada fragmento con `Range: bytes=start-end` contra una URL HF **anclada al commit V4**, no `resolve/main`; seguir redirecciones normales del navegador.
7. Aceptar únicamente `206 Partial Content`, `Content-Range: bytes start-end/total` **visible desde JavaScript**, sin codificación gzip ni multipart, y exactamente **1,024 bytes**.
8. Comparar el hash del slice de navegador con el hash obtenido del **shard completo validado**. Un hash de shard en el manifest por sí solo **no** autoriza afirmar integridad de una respuesta parcial.
9. Para tres parejas fijas, comparar coseno de bytes int8 renormalizados con un cálculo Python de referencia sobre los bytes fuente reales, tolerancia absoluta máxima `1e-12`.
10. Guardar un JSON con estado real **pass/blocked/integrity-failed**, bytes aceptados y motivos. Los resultados `blocked` (por CORS, Range ausente o 200) **no aprueban** el transporte; demuestran que el lector falla de manera segura.

**Coste presupuestado para la prueba:** seis solicitudes HTTP Range, máximo **6,144 bytes aceptados** por el lector; dos shards completos comprobados en el runner, máximo **2,000,000 bytes**. La transferencia real del navegador podría ser mayor si CDN/origen usa buffering; 6,144 bytes es el **límite de aceptación de la aplicación**, no una medición de red. Las latencias y el tamaño remoto de respuesta son variables externas y se registran sin inventar cifras.

## Archivos nuevos

- `src/core/research-atlas-qwen-vector-range.js`: funciones puras `vectorByteRange`, `parseExactContentRange`, `cosineInt8` y cliente opcional `fetchVerifiedVectorRange`. **No importado por el Atlas**, no activa ni modifica SearchResponse, UI, fuentes, identidad o ranking.
- `tests/research-atlas-qwen-vector-range.test.mjs`: contratos de offsets, 206/Content-Range, desbordamientos, respuestas 200, errores CORS, hash incorrecto, señal de aborto y normalización del coseno.
- `scripts/research-atlas/probe_ra12_v4_vector_source.py`: prueba de bytes **reales**, deriva referencias desde shards autenticados.
- `scripts/qa/research-atlas-vector-range-smoke.mjs`: Chromium desde origen Pages, inyectando **el mismo lector** experimental local que prueban los tests.
- `.github/workflows/research-atlas-ra12c1.yml`: pruebas unitarias + referencia real + navegador + no-regresión + artifact.
- `benchmark/research-atlas/v12/ra12c1-transport-policy.json`: gate y presupuesto declarados antes de conocer el resultado remoto.

## Interpretación y estados

| Resultado | Qué demuestra | Decisión |
| --- | --- | --- |
| `pass` | Los seis slices responden 206 exacto, CORS permite observar Content-Range, SHA individual coincide con la fuente completa verificada y pasan tres cosenos | Puede diseñarse RA12-C2/RA12-D, **no habilitar todavía** |
| `blocked` | CDN ignora Range, ofrece 200, CORS falla, no expone Content-Range, responde incompleto o el navegador no alcanza el sitio | Conservar RA11; investigar alternativa de tiles pequeños versionados, **no descargar shards gigantes** |
| `integrity-failed` | Un cuerpo de 1,024 bytes no coincide con el hash del origen anclado | Falla CI, investigar integridad y no activar |
| CI verde mientras `browserGate=blocked` | El rechazo fue seguro, **NO** la capacidad de Range | No anunciar 206 como verificado |

El script de experimento se activa **sólo** en Actions; no se llama desde `js/research-atlas-embed.js` ni desde la pestaña Atlas. Las dos fuentes de evidencia son complementarias: `reference.json` demuestra qué bytes debería devolver V4; `browser-report.json` demuestra qué devuelve un navegador desde Pages.

### Privacidad y semántica

No se entrenan modelos, no se extraen correos ni datos personales, no se descarga Qwen3 al navegador, no se hace otra consulta de búsqueda y no se crean conexiones de autoría ni causalidad. `cosineInt8` mide proximidad de vectores documentales ya computados; nunca prueba citas, influencias, afinidad de escuela, colaboración o coincidencia de identidad personal.

## Pendientes para una futura activación

- Confirmar el OID **real** de RA12-B3 después de la publicación manual, e incluirlo en el contrato del lector de lookup.
- Si Range funciona, crear/manifiesto inmutable de SHA por vector o por tile verificado: la prueba con seis vectores **no** autoriza saltarse la verificación de los demás 451,823.
- Si Range no funciona en la CDN, diseñar RA12-C2 con tiles pequeños creados offline a partir de los mismos shards int8 y manifest de hashes, sin descargar 256 clusters en cada búsqueda.
- Medir cobertura efectiva del lookup **sobre SearchResponses federados reales** de 5,20,50 obras, incluidos DOI-first y fuentes no OpenAlex, evitando afirmar «100% de búsqueda».
- Medir solicitudes, bytes transferidos reales, caché, latencias p50/p95, cancelación en cambio de búsqueda, red lenta móvil y budget.
- Sólo después abrir RA12-D para generar aristas `semantic-neighbor` con evidencia y fallback RA11 y validar RA8/RA9/RA11.
