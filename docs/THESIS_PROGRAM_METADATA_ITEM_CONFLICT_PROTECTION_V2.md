# T2AM — Item-level Program Metadata Conflict Protection V2

> Historical note · policy V3: T2AM congeló la primera protección item-level de 18 records. T2AO amplía el mismo mecanismo a 22 records y la policy ejecutable pasa a `2026-11-02.v3`, sin cambiar el schema ni la semántica del matcher.

## Objetivo

T2AL congeló 9 pares estructuralmente conflictivos alrededor de `Licenciatura en Medicina`.

Esos 9 pares representan:

- 9 records observados bajo Medicina;
- 9 contrapartes bajo otros programas;
- 18 source records únicos.

T2AM convierte esa evidencia en protección ejecutable dentro de Program Metadata Evidence Confidence **antes** de crear Program Authority V25.

## Principio

Un conflicto estructural significa:

`same normalized title + same normalized thesis-authors + different programRaw`

No demuestra cuál etiqueta es correcta.

Por eso la protección debe ser:

- item-level;
- simétrica;
- independiente del programa;
- anterior a cualquier autoridad futura.

## Policy revision

Config:

`scripts/thesis/config/program-metadata-evidence-confidence-v1.json`

Schema del archivo se mantiene:

`thesis-program-metadata-evidence-confidence-v1`

Policy revision nueva:

`2026-11-02.v2`

El schema no cambia porque la semántica general sigue siendo la misma: evaluar evidencia de metadata antes de aplicar Program Authority.

## Nuevo confidence state

### conflicted

Existe evidencia reproducible de que el mismo trabajo/autores aparece bajo etiquetas programáticas incompatibles.

Resultado:

`authorityApplicability = blocked`

`conflicted` es más específico que `low-trust`.

- `low-trust` describe un cohort cuya provenance es débil.
- `conflicted` identifica un source record exacto con conflicto estructural conocido.

## Nuevo matcher genérico

V2 añade:

`providerRecordIds`

a los matchers soportados.

Los matchers disponibles quedan:

- providers;
- providerRecordIds;
- programKeys;
- accessionDays;
- allFieldsPresent;
- allFieldsMissing.

No existe:

`if medicine`

ni:

`if psychology`

en el motor.

## Nueva regla

Rule id:

`riudg-structural-program-metadata-conflicts-v1`

Priority:

`200`

Match:

- provider = `riudg`;
- providerRecordId pertenece al set congelado de 18 source records.

Result:

- confidenceState = `conflicted`;
- authorityApplicability = `blocked`;
- reasonCode = `structural-cross-program-metadata-conflict`.

La regla legacy de Psicología mantiene priority 100.

Por eso:

`item-level structural conflict > broader legacy cohort rule`

## Simetría

Los 18 records se bloquean, no sólo los 9 Medicine records.

Distribución:

### Medicina
9 records

### Psicología
6 records

### Odontología
2 records

### Medicina Veterinaria Zootecnista
1 record

Esto evita afirmar implícitamente que una contraparte es correcta sólo porque el conflicto fue descubierto desde Medicina.

## Interacción con Psicología

Los 6 records de Psicología ya pertenecían al cohort legacy low-trust.

Antes:

- low-trust: 6
- blocked: 6

Después:

- conflicted: 6
- blocked: 6

Por tanto Psicología conserva:

**460 blocked works**

pero cambia su composición full a:

- low-trust: **454**
- conflicted: **6**
- unassessed: **25**

Total:

**485**

V24 continúa sin poder aplicarse a los 460 blocked records.

## Nuevos bloqueos

Los otros 12 records no estaban bloqueados previamente:

- Medicina: 9
- Odontología: 2
- Medicina Veterinaria Zootecnista: 1

Por tanto:

- blocked antes: **460**
- blocked después: **472**

Incremento neto:

**12**

## Full baseline

Fuente congelada:

- artifact: `13099541204`
- canonical works: **27,576**
- canonical SHA-256:
  `65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`

Expected confidence states:

- conflicted: **18**
- low-trust: **454**
- unassessed: **27,104**

Total:

**27,576**

Expected authority applicability:

- blocked: **472**
- allowed: **27,104**

## Full Queue expectations

### Psicología

Count:

**485**

- low-trust: 454
- conflicted: 6
- unassessed: 25
- blocked: 460
- allowed: 25

Queue:

`metadata-review / metadata-confidence-review`

### Medicina

Count:

**1,383**

- conflicted: 9
- unassessed: 1,374
- blocked: 9
- allowed: 1,374

Queue:

`metadata-review / metadata-confidence-review`

### Odontología

Count:

**195**

- conflicted: 2
- unassessed: 193
- blocked: 2
- allowed: 193

Queue:

`metadata-review / metadata-confidence-review`

### Medicina Veterinaria Zootecnista

Count:

**1,340**

- conflicted: 1
- unassessed: 1,339
- blocked: 1
- allowed: 1,339

Queue:

`metadata-review / metadata-confidence-review`

## Admission impact

T2AM no crea Program Authority para:

- Medicina;
- Odontología;
- Medicina Veterinaria Zootecnista.

Por tanto esos records ya eran QUARANTINE por programa unresolved y siguen en QUARANTINE.

La diferencia es futura:

si V25 o cualquier autoridad posterior aparece, los records conflicted ya no podrán recibir automáticamente:

- INCLUDE;
- REVIEW;
- EXCLUDE.

Para Psicología, V24 ya existe; los 6 conflicted siguen QUARANTINE igual que antes porque su applicability permanece blocked.

## Coverage

Coverage conserva `programMetadataEvidence`.

Cuando una autoridad exista y la obra esté blocked:

`program-authority-blocked-by-metadata-confidence`

debe prevalecer sobre el admissionState de Program Authority.

## Queue

Cualquier program group con al menos un blocked record entra en:

`queueState = metadata-review`

y:

`curationLane = metadata-confidence-review`

aunque:

- no tenga autoridad todavía;
- la autoridad exista como INCLUDE;
- exista como REVIEW;
- exista como EXCLUDE.

Esto vuelve visible el riesgo antes de crear V25.

## Tests

T2AM agrega cobertura para:

1. providerRecordId exacto → `conflicted / blocked`;
2. una contraparte de Psicología structural-conflict gana sobre la regla legacy low-trust;
3. un Medicine record no listado sigue `unassessed / allowed`;
4. evidence output conserva el providerRecordId;
5. policy loader acepta `conflicted` y el matcher `providerRecordIds`.

## Invariantes

T2AM no modifica:

- Program Authority V24;
- Institution Authority V2;
- Scope Policy V2;
- Admission Gate ordering;
- Boundary Closure V2;
- T2T;
- T2Y.

Tampoco crea V25.

## Qué sigue

Con T2AM merged ya será seguro investigar la autoridad institucional de:

`Licenciatura en Medicina`

porque cualquier futura V25 quedará automáticamente bloqueada para los 9 Medicine records que forman parte de los pares estructurales conocidos.

La investigación de V25 deberá decidir scope con evidencia programática oficial UdeG, no por los títulos de las tesis.
