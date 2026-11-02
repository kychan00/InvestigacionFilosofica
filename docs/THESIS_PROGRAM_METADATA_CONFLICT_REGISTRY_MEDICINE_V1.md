# T2AL — Medicine Item-level Program Metadata Conflict Registry V1

## Objetivo

T2AK confirmó que el full inventory contiene **9 conflictos estructurales** dentro del grupo observado como:

`Licenciatura en Medicina`

T2AL no intenta decidir cuál etiqueta es correcta.

Su objetivo es aislar esos conflictos a nivel de registro y congelar ambos lados de cada ambigüedad antes de investigar Program Authority V25.

## Regla de inclusión en el registry

Un par entra únicamente cuando existe:

- mismo título normalizado;
- mismo conjunto normalizado de thesis-authors;
- diferente `programRaw`.

Esta es exactamente la definición de `structural-conflict` de T2AK.

No se utilizan:

- keywords;
- abstract;
- similitud semántica;
- disciplina aparente;
- nombre del centro;
- contenido conceptual del título.

## Por qué se registran ambos lados

Un conflicto estructural demuestra:

`una misma obra + misma autoría aparece bajo dos etiquetas programáticas distintas`

Pero no demuestra cuál etiqueta es correcta.

Por eso T2AL registra:

- el record observado bajo Medicina;
- el record contraparte bajo el otro programa.

No sería metodológicamente válido bloquear sólo Medicina y tratar automáticamente la contraparte como correcta.

## Estado operativo

Decision constraint:

`conflict-registry-does-not-change-admission`

Authority decision:

`HOLD`

Application state:

`recommendation-only`

Cada par recomienda para una fase futura:

- `recommendedConfidenceState = conflicted`
- `recommendedAuthorityApplicability = blocked`

Pero T2AL **no modifica todavía**:

- Program Metadata Evidence Confidence;
- Admission Gate;
- Program Authority;
- estado de una obra.

## Identificadores estables

El registry no depende del número ordinal de la obra dentro del corpus.

Cada `pairId` se deriva mediante SHA-256 truncado sobre los dos:

`providerRecordId`

de RIUdeG, ordenados lexicográficamente.

Ejemplo:

`oai:riudg.udg.mx:20.500.12104/33028`

Por tanto el par sigue siendo identificable aunque cambie el orden del corpus.

También se conservan:

- sourceRecordId;
- providerRecordId;
- handle;
- workId actual;
- programRaw;
- normalized program key;
- academic unit;
- date;
- accession day.

## Full baseline

Fuente:

- full artifact: `13099541204`
- canonical corpus: **27,576**
- SHA-256:
  `65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`

Expected:

- conflictPairs: **9**
- targetStructuralWorks: **9**
- alternateWorks: **9**
- uniqueWorks: **18**
- uniqueSourceRecords: **18**

Alternate labels:

- Psicología: **6**
- Odontología: **2**
- Medicina Veterinaria Zootecnista: **1**

Todos los pares tienen:

`target accession day = 2015-09-09`

y:

`alternate accession day = 2015-09-09`

## Pares congelados

### Medicina ↔ Psicología

1. `32360 ↔ 33719`
2. `33028 ↔ 33923`
3. `33043 ↔ 33681`
4. `33843 ↔ 32769`
5. `33975 ↔ 33046`
6. `34103 ↔ 33068`

### Medicina ↔ Odontología

7. `33107 ↔ 33570`
8. `33759 ↔ 34016`

### Medicina ↔ Medicina Veterinaria Zootecnista

9. `34005 ↔ 21932`

Los números anteriores son handles RIUdeG abreviados.

## Simetría con Psicología

Seis contrapartes pertenecen a Psicología.

Esos records ya están dentro del cohort legacy que T2AI bloquea por baja confianza.

T2AL no reescribe esa política.

El registry sólo establece que, conceptualmente, la ambigüedad pertenece a **ambos records** y debe poder proteger también el lado Medicina cuando llegue V25.

Las contrapartes de Odontología y Medicina Veterinaria tampoco se reclasifican en esta fase.

## Artifact

Nuevo builder:

`scripts/thesis/build_program_metadata_conflict_registry_v1.py`

Outputs:

- `program-metadata-conflict-registry.json`
- `program-metadata-conflict-registry.md`

Input:

1. T2AK integrity audit;
2. canonical corpus;
3. source records.

El builder vuelve a comprobar el mismo título/autoría contra el corpus en lugar de confiar ciegamente en una lista manual.

## Full contract

Config:

`scripts/thesis/config/medicine-program-metadata-conflict-registry-baseline-v1.json`

El contrato congela:

- métricas;
- los 9 stable pair IDs;
- provider record IDs;
- handles;
- alternate program keys.

Así un cambio futuro en cualquiera de esos 9 pares requiere revisión explícita.

## Qué no significa el registry

No significa que:

- Medicina sea la etiqueta incorrecta;
- Psicología/Odontología/Veterinaria sean automáticamente correctas;
- las otras 1,374 observaciones de Medicina estén confirmadas;
- debamos bloquear las 1,381 legacy en bloque;
- V25 pueda crearse ya sin investigar la autoridad institucional.

## Próximo paso

Después de T2AL ya podremos investigar Program Authority V25 de Medicina con una separación limpia:

- 9 target records con conflicto estructural conocido;
- 73 title warnings aún no estructurales;
- 1,301 sin conflicto detectado.

Si V25 llega a crearse, una fase posterior deberá convertir los 9 pares estructurales en una política item-level de `authorityApplicability=blocked` antes de permitir que V25 actúe sobre ellos.

## Invariantes

T2AL no modifica:

- Program Authority V24;
- Institution Authority V2;
- Scope Policy V2;
- Program Metadata Evidence Confidence V1;
- Admission Gate;
- Boundary Closure V2;
- T2T;
- T2Y.
