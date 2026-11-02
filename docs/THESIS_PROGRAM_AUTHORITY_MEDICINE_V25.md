# T2AN — Medicina / Médico Cirujano y Partero · Program Authority V25

## Decisión

Se registra una sola AcademicProgramAuthority para las formas:

- `Licenciatura en Medicina`
- `Licenciatura en Médico Cirujano y Partero`
- `Médico Cirujano y Partero`
- `Carrera de Médico Cirujano y Partero`

Program ref:

`program:udg:lic-medico-cirujano-partero`

Canonical name:

`Licenciatura en Médico Cirujano y Partero`

Admission:

`EXCLUDE`

Registry revision:

`2026-11-02.v25`

## Por qué es una sola autoridad

Esta decisión no se basa en similitud léxica.

La Universidad de Guadalajara publica evidencia institucional directa de equivalencia nominal.

### CUCS

La guía de inducción vigente enumera:

`LICENCIATURA EN MEDICINA (MÉDICO CIRUJANO Y PARTERO)`

Fuente:

`https://www.cucs.udg.mx/guiasinduccion/index.php`

La construcción institucional pone ambos nombres sobre el mismo programa.

### CUSur

El material institucional de la carrera presenta simultáneamente:

`MEDICINA — MÉDICO CIRUJANO Y PARTERO`

y describe:

`Esta Licenciatura en Medicina...`

Fuente:

`https://www.cusur.udg.mx/es/sites/default/files/adjuntos/triptico_mcp.pdf`

Por tanto `Licenciatura en Medicina` no se trata como un programa predecessor separado.

### Enciclopedia UdeG

La biografía institucional de Rodrigo Ramos Zúñiga documenta que en 1980 ingresó a la Facultad de Medicina para cursar:

`la licenciatura de Medicina`

y se tituló en 1985 como:

`médico cirujano y partero`

Fuente:

`https://enciclopedia.udg.mx/biografias/ramos-zuniga-rodrigo`

Esto conecta el lenguaje histórico presente en el corpus con el título profesional de Médico Cirujano y Partero en el mismo trayecto formativo.

### Continuidad histórica CUCS

CUCS declara que la carrera de Medicina mantiene continuidad histórica desde la tradición médica de la Universidad hasta el programa actual de Médico Cirujano y Partero.

Fuente:

`https://www.cucs.udg.mx/noticias/archivos-de-noticias/rector-general-recibe-placa-que-acredita-carrera-de-medicina`

## Scope disciplinario

La Guía de Carreras UdeG clasifica explícitamente:

`Médico Cirujano y Partero`

en:

`Área de Conocimiento: Ciencias de la Salud`

Fuente:

`https://guiadecarreras.udg.mx/index.php/node/206`

El programa forma médicos para:

- prevención;
- atención primaria;
- salud;
- investigación;
- práctica médica;
- equilibrio biopsicosocial.

La formación incluye componentes humanísticos y éticos, pero eso no convierte la identidad programática en Humanidades.

Bajo:

`targetScope = humanities-only`

la autoridad corresponde a:

`EXCLUDE`

## Precedencia de evidencia

La decisión usa:

1. identidad explícita del programa en UdeG;
2. equivalencia nominal publicada por UdeG;
3. clasificación programática explícita en Ciencias de la Salud;
4. continuidad institucional.

No usa:

- títulos de tesis;
- keywords;
- abstract;
- similitud semántica;
- pertenencia a CUCS por sí sola.

## Full inventory

Artifact congelado:

`13099541204`

Canonical works:

**27,576**

Canonical SHA-256:

`65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`

Las dos formas de nombre observadas suman:

**1,533 works**

### Licenciatura en Medicina

**1,383**

### Licenciatura en Médico Cirujano y Partero

**150**

No se cuentan como programas distintos.

## Metadata integrity

### Licenciatura en Medicina

T2AK/T2AL/T2AM ya aislaron:

- structural conflicts: **9**
- authorityApplicability blocked: **9**

Esos 9 quedan protegidos antes de V25.

### Licenciatura en Médico Cirujano y Partero

Full audit derivado del mismo frozen corpus:

- works: **150**
- accession `2015-09-09`: **150**
- valid year observations: **141**
- visible years: **1973–1998**
- exact-title cross-program warnings: **13**
- exact-title + same-author structural conflicts: **0**

Los 13 title-only matches no autorizan bloqueo ni reasignación.

`same title != same work`

sin coincidencia de autoría.

Por tanto no existe una regla item-level adicional para esos 150 records.

## Impacto esperado de V25

Authority aggregate:

**1,533**

Blocked:

**9**

Authority applicable:

**1,524**

Projected:

- EXCLUDE: **1,524**
- QUARANTINE: **9**

### Raw group: Licenciatura en Medicina

- works: 1,383
- blocked: 9
- applicable: 1,374
- EXCLUDE: 1,374
- QUARANTINE: 9

Como conserva blocked records, debe permanecer visible:

- queueState = `metadata-review`
- curationLane = `metadata-confidence-review`

### Raw group: Licenciatura en Médico Cirujano y Partero

- works: 150
- blocked: 0
- applicable: 150
- EXCLUDE: 150

Al quedar completamente fuera de scope y sin blocked records, no necesita permanecer en la curation queue después de la reproyección.

## Interacción con Program Metadata Evidence Confidence V2

V25 no tiene precedencia sobre metadata confidence.

Orden:

`SourceRecord → Metadata Confidence → Program Authority applicability → Admission`

Para los 9 structural conflicts:

`V25 EXCLUDE + conflicted/blocked → QUARANTINE`

Para los otros records:

`V25 EXCLUDE + unassessed/allowed → EXCLUDE`

`unassessed` sigue sin significar `trusted`.

## Tests

T2AN prueba:

1. `LICENCIATURA EN MEDICINA` resuelve a V25;
2. `LICENCIATURA EN MÉDICO CIRUJANO Y PARTERO` resuelve a la misma V25;
3. `Médico Cirujano y Partero` resuelve a la misma autoridad;
4. structural-conflict Medicine → QUARANTINE;
5. Medicine no bloqueado → EXCLUDE;
6. MCP no bloqueado → EXCLUDE;
7. cambiar el título no altera la decisión.

## Full contract

Config:

`scripts/thesis/config/medicine-program-authority-v25-baseline-v1.json`

El contrato congela:

- authority identity;
- ambos raw groups;
- 1,533 observed works;
- 9 blocked;
- 1,524 authority applicable;
- 1,524 EXCLUDE;
- 9 QUARANTINE;
- Queue metadata-review para el raw group Medicina.

## Invariantes

T2AN no modifica:

- Program Metadata Evidence Confidence V2;
- Institution Authority V2;
- Scope Policy V2;
- Boundary Closure V2;
- T2T;
- T2Y.

No crea una autoridad histórica artificial para `Licenciatura en Medicina`, porque la evidencia oficial demuestra equivalencia nominal dentro de la misma línea programática.

## Resultado metodológico

T2AN separa tres preguntas:

### ¿Los dos nombres representan la misma línea programática?

Sí.

### ¿La línea pertenece a Humanities-only?

No. → EXCLUDE.

### ¿Podemos aplicar esa autoridad a todos los records etiquetados con esos nombres?

No.

Los 9 structural conflicts conocidos continúan bloqueados y en QUARANTINE.
