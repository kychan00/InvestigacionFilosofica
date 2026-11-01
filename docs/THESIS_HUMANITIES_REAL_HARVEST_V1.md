# Tesis Humanidades UdeG — Real Corpus Harvest V1

## Estado

**T2B — harvester real reproducible, PR apilado sobre T2A.**

Este trabajo depende de:

- PR #72 — Canonical Corpus Core.

Mientras #72 no esté fusionado, T2B debe revisarse como PR apilado sobre la rama de T2A. No debe fusionarse directamente a `main`.

---

## 1. Propósito

T2B convierte los adaptadores y contratos de T2A en una cosecha reproducible de fuentes públicas reales.

Objetivos:

1. paginar RIUdeG mediante OAI-PMH `ListRecords` + `DIM`;
2. enumerar UDGVirtual mediante el browse ligado a la colección;
3. obtener las fichas JSPUI individuales de UDGVirtual;
4. producir SourceRecord;
5. construir corpus canónico mediante T2A;
6. registrar CoverageLedger;
7. inventariar programas, unidades e instituciones observados;
8. conservar tombstones OAI;
9. producir artefactos comprimidos y hashes;
10. separar claramente validación de PR y cosecha completa.

---

## 2. Principio operativo

Una cosecha completa **no se ejecuta en cada push**.

### Pull request

El workflow utiliza una muestra real acotada:

- hasta 100 registros activos RIUdeG;
- máximo 2 páginas OAI;
- enumeración completa de handles UDGVirtual;
- hasta 10 fichas UDGVirtual;
- sin PDFs.

Esto permite comprobar cambios contra las fuentes sin cargar innecesariamente los repositorios institucionales.

### Workflow dispatch — sample

Permite repetir una validación similar bajo demanda.

### Workflow dispatch — full

Ejecuta:

- RIUdeG hasta agotar el resumption token;
- UDGVirtual hasta agotar la colección;
- las 147 fichas UDGVirtual observadas en T1;
- reconciliación estricta;
- artefactos completos.

La opción `full` falla si:

- RIUdeG no termina en `exhausted`;
- UDGVirtual no enumera exactamente el total declarado;
- existe cualquier fallo individual de ficha UDGVirtual.

---

## 3. RIUdeG

Endpoint:

`https://riudg.udg.mx/oai/request`

Set:

`com_20.500.12104_9`

Formato:

`dim`

Pipeline:

    ListRecords
        │
        ├── record activo
        │      ↓
        │   DIM SourceRecord
        │
        ├── header status=deleted
        │      ↓
        │   tombstone
        │
        └── resumptionToken
               ↓
            siguiente página

No se realiza un `GetRecord` por cada tesis.

La escala esperada de una cosecha completa es del orden de cientos de páginas OAI, no decenas de miles de peticiones.

---

## 4. Resumption tokens

Cada página conserva en el log de harvest:

- cursor;
- completeListSize;
- estado HTTP;
- bytes transferidos;
- duración;
- número de intento.

La siguiente petición usa exclusivamente:

`verb=ListRecords&resumptionToken=...`

No vuelve a adjuntar `metadataPrefix` ni `set`, conforme al contrato OAI-PMH.

---

## 5. Incremental

El CLI admite:

- `--riudg-from`;
- `--riudg-until`.

Se envían únicamente en la primera petición de una secuencia.

Como RIUdeG declara:

`deletedRecord=transient`

un incremental futuro no sustituye las reconciliaciones completas periódicas.

T2B registra tombstones, pero la política de aplicación contra un snapshot previo debe conservar el ledger y la evidencia de fuente.

---

## 6. Tombstones

Un header OAI con:

`status="deleted"`

no se intenta parsear como DIM.

Se conserva en:

`riudg-tombstones.jsonl.gz`

con:

- provider;
- providerRecordId;
- datestamp;
- setSpecs;
- status.

No se borra automáticamente una obra canónica únicamente porque aparece un tombstone aislado. La reconciliación de snapshots posteriores deberá decidir la transición.

---

## 7. UDGVirtual

Enumerador canónico:

`/jspui/handle/123456789/6/browse?type=title&rpp=100&sort_by=1&order=ASC`

Se pagina con:

`offset=0, 100, ...`

La enumeración:

- filtra handles estructurales de repositorio/colección;
- deduplica IDs;
- conserva total declarado;
- se detiene cuando una página contiene menos de `rpp` items.

Después se solicita cada:

`/jspui/handle/123456789/<item>`

y se entrega a T2A para extraer `DC.*`.

---

## 8. Reconciliación UDGVirtual

Para modo `full`:

    total declarado == handles únicos enumerados
                   AND
    fallos de fichas == 0

Si cualquiera falla, el workflow termina con error aunque se haya producido un artefacto parcial.

Esto evita promover silenciosamente un corpus truncado.

---

## 9. Retries y cortesía

El harvester:

- identifica su User-Agent;
- utiliza timeout;
- reintenta 429/500/502/503/504;
- respeta `Retry-After` numérico cuando existe;
- utiliza backoff exponencial;
- introduce pausa entre páginas/items;
- limita el backoff;
- nunca descarga PDFs.

La pausa por defecto es 0.35 s.

El PR utiliza 0.25 s con una muestra pequeña.

---

## 10. SourceRecord

Los registros reales pasan por los mismos adaptadores de T2A.

Por tanto, la cosecha no contiene un segundo modelo bibliográfico paralelo.

Cada SourceRecord conserva:

- proveedor;
- ID del proveedor;
- URL;
- datestamp OAI cuando existe;
- setSpecs;
- rawFields;
- payloadHash;
- normalizationVersion.

---

## 11. Canonical corpus

Después de cosechar ambas fuentes:

    source records
        ↓
    build_corpus()
        ↓
    works
    admission decisions
    identity decisions
    workIdRegistry
    metrics

T2B no relaja ninguna puerta de T2A.

Programa desconocido sigue siendo `quarantine`.

Institución externa sigue siendo `exclude`.

Handle compartido con veto institucional sigue sin fusionarse.

---

## 12. CoverageLedger

Archivo:

`coverage-ledger.json`

Incluye:

### RIUdeG

- status;
- stopReason;
- completeListSize;
- records activos;
- tombstones;
- páginas;
- from/until.

### UDGVirtual

- status;
- stopReason;
- total declarado;
- handles enumerados;
- handles seleccionados;
- registros obtenidos;
- fallos;
- páginas browse.

### Corpus

- SourceRecord;
- works;
- works por estado de admisión;
- proveedores;
- calidad de fechas;
- decisiones de identidad.

### Cobertura de campos

Para cada campo presente:

- present;
- total;
- ratio.

Se miden actualmente:

- title;
- date;
- language;
- abstract;
- keywords;
- program;
- programResolved;
- institutionResolved;
- academicUnit;
- persistentIdentifier;
- author;
- director.

---

## 13. Catálogo observado

Archivo:

`observed-authorities.json`

No es todavía una authority registry aprobada.

Es un inventario de observación para curaduría.

Por programa agrupa:

- normalizedKey;
- count;
- variantes crudas;
- programRefs resueltos;
- admissionStatuses;
- providers.

También registra frecuencias de:

- unidades académicas;
- instituciones crudas.

Este archivo será la base para ampliar `AcademicProgramAuthority` de manera auditada.

---

## 14. Artefactos

T2B produce:

- `source-records.jsonl.gz`;
- `riudg-tombstones.jsonl.gz`;
- `canonical-corpus.json.gz`;
- `coverage-ledger.json`;
- `observed-authorities.json`;
- `riudg-pages.json`;
- `udgvirtual-reconciliation.json`;
- `manifest.json`.

Los corpus grandes **no se commitean a Git**.

Se publican primero como artifacts temporales de Actions.

Una fase posterior decidirá el almacenamiento versionado de releases/datasets completos.

---

## 15. Compresión determinista

Los archivos gzip se escriben con:

`mtime=0`

y JSON con orden estable de claves.

Esto evita que el timestamp interno de gzip altere el hash de un contenido idéntico.

Los tests verifican byte por byte la reproducibilidad.

---

## 16. Manifest

`manifest.json` registra:

- schemaVersion;
- mode;
- createdAt;
- builderVersion;
- harvesterVersion;
- programAuthorityRevision;
- metrics;
- coverageLedgerVersion;
- lista de archivos;
- tamaño;
- SHA-256.

El manifest no se incluye a sí mismo al calcular la lista de hashes.

---

## 17. Fixtures offline

### RIUdeG

`riudg-list-records-page.xml`

Prueba en una sola página:

- un registro activo;
- un tombstone;
- cursor;
- completeListSize;
- expirationDate;
- resumption token.

### UDGVirtual

`udgvirtual-browse-page.html`

Prueba:

- handles estructurales;
- tres tesis;
- handle repetido;
- total 147.

El parser debe devolver únicamente:

`1001, 1002, 1003`.

---

## 18. Tests

`tests/test_thesis_real_harvest.py`

Cubre:

- OAI record + tombstone + token;
- filtrado de handles estructurales;
- total declarado UDGVirtual;
- agrupación de variantes de programa;
- CoverageLedger;
- gzip determinista;
- JSONL comprimido reproducible;
- hashes del manifest.

Los tests offline no dependen de la disponibilidad de la UdeG.

---

## 19. Workflow

`.github/workflows/thesis-real-harvest.yml`

Pasos:

1. checkout;
2. Python 3.13;
3. compile;
4. tests offline;
5. harvest real sample o full;
6. validación de reconciliación;
7. upload artifact.

El workflow no necesita credenciales institucionales.

---

## 20. Gates de T2B

### PR/sample

Debe cumplir:

- al menos un registro RIUdeG;
- `completeListSize` presente;
- UDGVirtual enumera 147 handles;
- UDGVirtual declara 147;
- observed catalog válido;
- manifest no vacío.

### Full

Además:

- RIUdeG exhausted;
- UDGVirtual enumerated == reported;
- cero fallos de ficha UDGVirtual.

---

## 21. Dependencia de #72

Este PR nace deliberadamente de:

`feat/thesis-humanities-canonical-corpus-v1-20261101`

porque #72 sigue abierto.

Una vez fusionado #72:

1. se actualiza `main`;
2. se retargetea T2B a `main`;
3. se reconcilia la rama;
4. se vuelve a ejecutar CI;
5. sólo entonces T2B queda listo para merge.

No debe declararse T2B integrado mientras esa secuencia no haya ocurrido.

---

## 22. Criterio de cierre

T2B queda listo para cerrar cuando:

1. tests offline pasan;
2. sample real pasa;
3. se genera CoverageLedger real;
4. se genera catálogo real de programas observados;
5. UDGVirtual reconcilia 147 en sample;
6. manifest tiene hashes válidos;
7. #72 está fusionado;
8. T2B está 0 detrás de main;
9. workflow final pasa sobre el head retargeteado.

La cosecha `full` completa puede ejecutarse inmediatamente después del merge o como gate adicional si el tamaño/tiempo observado en sample lo aconseja.
