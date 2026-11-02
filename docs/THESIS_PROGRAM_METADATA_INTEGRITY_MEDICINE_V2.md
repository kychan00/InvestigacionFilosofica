# T2AK — General Program Metadata Integrity Audit V2 + Medicina

## Por qué existe esta fase

Después de cerrar Program Authority V24 para Psicología, la cola full vuelve a ordenar los programas unresolved por impacto.

El grupo unresolved más grande es:

`Licenciatura en Medicina`

con:

**1,383 obras**

Crear inmediatamente una Program Authority V25 sería metodológicamente incorrecto.

El full inventory muestra que casi todo el grupo pertenece al mismo lote legacy de RIUdeG y contiene conflictos exactos con otros programas.

T2AK introduce primero un audit de integridad **genérico**, sin reutilizar supuestos específicos de Psicología.

## Problema con el audit V1

El audit anterior fue construido para Psicología y contiene supuestos que no deben universalizarse:

- utiliza `foundationYear`;
- considera obras anteriores a la fundación como señal fuerte;
- incluye patrones de títulos médicos/dentales específicamente diseñados para detectar contaminación dentro de Psicología;
- sus textos de salida hablan explícitamente de Psychology.

Medicina tiene una historia institucional distinta y no puede analizarse con esos supuestos.

Por eso V1 permanece congelado para reproducibilidad histórica y T2AK añade V2.

## Audit V2

Nuevo:

`scripts/thesis/audit_program_metadata_integrity_v2.py`

Schema:

`thesis-program-metadata-integrity-audit-v2`

Decision constraint:

`metadata-integrity-audit-does-not-change-admission`

La auditoría sólo utiliza señales estructurales genéricas.

### Structural conflict

Un registro target tiene:

- exactamente el mismo título normalizado;
- exactamente el mismo conjunto de thesis-authors normalizados;
- pero aparece también bajo otro `programRaw`.

Esto demuestra un conflicto de metadata programático de fuente.

No demuestra cuál de las etiquetas es la correcta.

### Cross-program title warning

El título exacto aparece en otro programa, pero el autor no coincide.

Es warning solamente.

### No detected conflict

La auditoría no encontró ninguna de esas dos señales.

Esto **no significa** que el programa haya sido confirmado.

## Lo que V2 no usa

Nunca decide integridad con:

- palabras del título;
- abstract;
- keywords;
- similitud semántica;
- disciplina aparente;
- nombre del centro.

Tampoco reasigna automáticamente una obra.

## Full baseline — Licenciatura en Medicina

Fuente:

- artifact full: `13099541204`
- corpus: **27,576**
- canonical SHA-256:
  `65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`

Observed:

**1,383**

Provider:

- RIUdeG: **1,383**

Academic unit:

- CUCS: **1,383**

Raw `dc.degree.name`:

- `LICENCIATURA EN MEDICINA`: **1,383**

Source/program agreement:

- agree: **1,383**
- disagree: **0**

Por tanto, igual que en Psicología, el parser local no está inventando el nombre: el conflicto ya está presente en la metadata fuente.

## Accession provenance

- 2015-09-09: **1,381**
- 2015-10-01: **1**
- 2020-01-12: **1**

El cohort legacy representa:

**1,381 / 1,383**

Pero esta proporción **no autoriza** a marcar todo el cohort como low-trust.

## Metadata richness

Full:

- `dc.date.submitted`: **1,337**
- `dc.date.issued`: **1**
- abstract: **1**

Legacy 2015-09-09:

- works: **1,381**
- submitted: **1,336**
- issued: **0**
- abstract: **0**

Other accession days:

- works: **2**
- submitted: **1**
- issued: **1**
- abstract: **1**

## Conflictos estructurales

Exact-title cross-program conflicts:

**82**

Exact-title + same-author conflicts:

**9**

Los 9 conflictos estructurales se distribuyen contra:

- Licenciatura en Psicología: **6**
- Licenciatura en Odontología: **2**
- Licenciatura en Medicina Veterinaria Zootecnista: **1**

Todos los:

- 82 title conflicts;
- 9 title+author structural conflicts;

están dentro del cohort legacy del 2015-09-09.

Fuera del cohort:

- title conflicts: **0**
- structural conflicts: **0**

## Ejemplos de conflictos fuertes

Entre los casos observados aparecen títulos/autorías idénticos bajo Medicina y otros programas.

Ejemplos incluyen pares contra:

- Psicología;
- Odontología;
- Medicina Veterinaria Zootecnista.

Estos ejemplos se conservan en el artifact audit para inspección item-level.

No se usa el contenido conceptual del título para decidir cuál etiqueta es correcta.

## Collection context

Las 1,383 obras de Medicina están en:

`col_20.500.12104_20978`

La colección contiene:

**2,253 registros**

y **16** claves normalizadas distintas de degree program, incluyendo:

- Medicina: 1,383
- Psicología: 455
- Odontología: 195
- Médico Cirujano y Partero: 150
- Enfermería: 30
- Cirujano Dentista: 13
- otros

Por tanto:

`collection membership != program identity`

## Clasificación V2

Full Medicine:

- structural-conflict: **9**
- warning-only: **73**
- no-detected-conflict: **1,301**

Legacy cohort:

- structural-conflict: **9**
- warning-only: **73**
- no-detected-conflict: **1,299**

Other cohort:

- structural-conflict: **0**
- warning-only: **0**
- no-detected-conflict: **2**

## Conclusión

`source-program-metadata-conflict-confirmed`

Esto significa:

La metadata fuente contiene al menos algunos registros cuyo program label no puede ser simultáneamente correcto bajo dos programas diferentes para la misma obra y autor.

No significa:

- que los 1,381 legacy sean incorrectos;
- que los 1,301 sin conflicto estén confirmados como Medicina;
- que la etiqueta alternativa sea correcta;
- que deba crearse Program Authority V25;
- que todo el cohort deba marcarse low-trust.

## Authority decision

`HOLD`

V25 no se crea en T2AK.

## Qué sigue

El siguiente paso debe ser una partición item-level conservadora:

1. aislar los 9 structural conflicts;
2. investigar los 73 title-warning records cuando exista evidencia adicional;
3. verificar si el resto del cohort puede utilizar program evidence de manera segura;
4. sólo después investigar la autoridad institucional de Licenciatura en Medicina.

## Invariantes

T2AK no modifica:

- Program Authority V24;
- Institution Authority V2;
- Scope Policy V2;
- Program Metadata Evidence Confidence V1;
- Admission Gate;
- Boundary Closure V2;
- T2T;
- T2Y.

El audit V1 de Psicología tampoco se reescribe: permanece congelado para reproducibilidad.
