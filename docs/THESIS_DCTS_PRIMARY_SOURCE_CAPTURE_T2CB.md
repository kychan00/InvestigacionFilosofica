# T2CB — DCTS · Captura reproducible de fuente primaria

## Estado

**Fase de adquisición de evidencia · no admisiva.**

T2CB continúa el batch `urban-territory-002` integrado en T2CA.

No cambia:

- AcademicProgramAuthority;
- Scope Policy;
- Metadata Confidence;
- Work Admission Decisions;
- el estado REVIEW de las 152 obras DCTS;
- los conteos efectivos publicados en `thesis-effective-corpus-v1`.

## Problema

T2CA verificó que dos fichas RIUdeG exponen una tesis oficial mediante `View/Open`:

- `thesis:work:00024461` / handle `84204`;
- `thesis:work:00024462` / handle `84205`.

Eso demuestra disponibilidad institucional, pero todavía no constituye revisión del full text.

T2CB crea una captura reproducible desde GitHub Actions para evitar dos atajos metodológicamente incorrectos:

1. adjudicar basándose sólo en abstract, keywords o tabla de contenido;
2. afirmar que se revisó un PDF cuando únicamente se observó la ficha del repositorio.

## Fetcher

Nuevo script:

`scripts/thesis/fetch_riudg_primary_source_v1.py`

Por cada obra:

1. consulta el visor oficial RIUdeG;
2. prueba rutas de descarga derivadas del handle y del fichero oficial;
3. inspecciona el HTML del visor para descubrir rutas PDF adicionales;
4. sólo acepta una respuesta que tenga magic bytes `%PDF-`;
5. guarda el PDF oficial capturado;
6. calcula SHA-256;
7. obtiene metadatos con `pdfinfo`;
8. extrae texto con `pdftotext -layout`;
9. calcula SHA-256 del texto extraído;
10. registra todas las rutas intentadas.

Un `content-type` o una URL que termine en `.pdf` no bastan: el payload debe ser un PDF real.

## Outputs

Para cada work:

- PDF oficial;
- `capture.json`;
- `fetch-attempts.json`;
- `primary-source.txt`.

Resumen:

- `capture-summary.json`.

## Uso académico

El artifact T2CB será la base de la revisión humana posterior.

T2CB **no** genera automáticamente:

- `include-candidate`;
- `exclude-candidate`;
- `retain-review`.

Después de comprobar la captura, una segunda iteración de la misma fase podrá registrar para cada obra:

- SHA-256 del PDF;
- páginas;
- objeto de investigación;
- método;
- marco conceptual y disciplinario;
- fuentes relevantes;
- racional explícito.

Sólo esa revisión puede alimentar una decisión candidata.

## Fail-closed

Si GitHub Actions no logra obtener un PDF oficial real para cualquiera de las dos obras, el workflow debe fallar después de subir el reporte de intentos.

En ese caso la obra permanece:

`candidate-evidence-ready`

y no se degrada la exigencia epistemológica para hacer pasar CI.
