# T2BZ — Publicación inmutable del corpus efectivo de tesis

## Objetivo

T2BY produjo y validó el corpus efectivo, pero lo dejó únicamente como artifact de GitHub Actions. T2BZ establece el contrato de publicación que convierte ese resultado en un asset versionado, verificable y consumible por GitHub Pages sin modificar la clasificación académica.

T2BZ **no** cambia Program Authority, Scope Policy, Metadata Confidence ni decisiones work-level. La fuente de verdad académica sigue siendo:

- Program Authority `2026-11-03.v47`;
- Scope Policy `2026-11-02.v5`;
- Metadata Confidence `2026-11-02.v5`;
- Work Admission Decisions `2026-11-03.t2bx-v1`.

## Corpus fijado

El contrato publica exactamente 27,576 obras:

- 561 INCLUDE;
- 193 REVIEW;
- 18,971 QUARANTINE;
- 7,849 EXCLUDE;
- 2 REJECT_SOURCE.

La única diferencia respecto de la proyección puramente programática sigue siendo `thesis:work:00002062`, aprobada por decisión work-level explícita. La Maestría en Estudios de Género continúa con Program Authority REVIEW.

## Contrato inmutable

Archivo:

`scripts/thesis/config/effective-corpus-release-t2bz-v1.json`

Fija:

- release tag `thesis-effective-corpus-v1`;
- artifact fuente congelado `13099541204`;
- SHA-256 del canonical corpus fuente;
- revisiones académicas exactas;
- SHA-256 del JSON efectivo;
- SHA-256 del gzip determinista;
- cardinalidad y conteos de admisión;
- work IDs modificados;
- nombres de assets;
- rutas públicas versionadas.

Hashes efectivos fijados:

- JSON: `0a4d24810d90f8e4c748abd0c8f3978afba6561eade46fcbf29f2bda6416b892`;
- gzip determinista: `4e2484482be783bcb004f4a343cfede516806d56d4e56dffa4a6d20cfe3750c3`.

## Release manifest

`scripts/thesis/build_effective_corpus_release_manifest_v1.py` construye `manifest.json` sólo después de verificar:

1. schema de effective corpus;
2. Program Authority revision;
3. Metadata Confidence revision;
4. Work Admission Decision revision;
5. 27,576 works;
6. conteos efectivos exactos;
7. `changedWorkIds` exactos;
8. SHA del JSON;
9. SHA del payload descomprimido;
10. SHA del gzip.

El mismo programa dispone de un modo `verify-release` que verifica una release descargada contra el contrato del repositorio y contra `release-manifest.json`.

## Publicación en `main`

El workflow de Pages adquiere un nuevo job `thesis-corpus-release`.

Ese job:

1. descarga el artifact fuente congelado;
2. verifica el hash del canonical corpus antes de usarlo;
3. reproyecta Metadata Confidence vigente;
4. reconstruye el effective corpus mediante T2BY;
5. comprime de forma determinista (`mtime=0`);
6. verifica todos los hashes y revisiones;
7. crea la release `thesis-effective-corpus-v1` **sólo si no existe**;
8. si ya existe, no la sobrescribe: la descarga y verifica;
9. bloquea el deploy ante cualquier discrepancia.

La release contiene:

- `effective-corpus.json.gz`;
- `effective-corpus.json.sha256`;
- `effective-corpus.json.gz.sha256`;
- `effective-corpus-report.json`;
- `manifest.json`.

No existe ruta de overwrite de una release ya publicada dentro del workflow.

## Integración con Pages

El job `deploy` depende simultáneamente de:

- tests de aplicación;
- verificación/publicación de la release de tesis.

Antes de subir el artifact de Pages, descarga la release exacta, la verifica nuevamente y copia sus assets a:

`data/theses/effective-corpus-v1/`

Rutas públicas previstas después de un merge y deploy exitosos:

- `data/theses/effective-corpus-v1/manifest.json`;
- `data/theses/effective-corpus-v1/effective-corpus.json.gz`.

`release-manifest.json` registra además el tag activo, revisiones, hashes, conteos y rutas públicas.

## Semántica de publicación

Después de mergear T2BZ, sólo se podrá afirmar que el **dataset efectivo está publicado** cuando se verifiquen conjuntamente:

1. merge real en `main`;
2. creación o validación de `thesis-effective-corpus-v1`;
3. hashes de la release;
4. éxito del job `thesis-corpus-release`;
5. éxito de Pages sobre el mismo push;
6. disponibilidad pública de `manifest.json` y `effective-corpus.json.gz`;
7. correspondencia de hashes entre release y ruta pública.

T2BZ no implementa todavía T6 Search V1 ni T7 Atlas UI. Publicar el dataset no equivale a afirmar que ya existe una interfaz pública completa de búsqueda de tesis.

## Fail-closed

Cualquier cambio futuro que altere:

- el corpus fuente;
- Program Authority;
- Metadata Confidence;
- decisiones work-level;
- serialización del effective corpus;
- conteos;
- hashes;

debe romper el gate hasta que exista una nueva revisión y una nueva release explícita. `thesis-effective-corpus-v1` no debe mutarse.
