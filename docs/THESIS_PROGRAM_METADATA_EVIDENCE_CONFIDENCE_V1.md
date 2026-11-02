# T2AI — Program Metadata Evidence Confidence Layer V1

> Historical note · policy V4: este documento conserva la arquitectura T2AI/V1. La policy ejecutable vigente es `2026-11-02.v4`; protege item-level 32 source records estructuralmente conflicted. Véanse `THESIS_PROGRAM_METADATA_INTEGRITY_VETERINARY_V3.md` y `THESIS_PROGRAM_METADATA_INTEGRITY_AGRONOMY_V4.md`.

## Problema arquitectónico

T2AG demostró que `dc.degree.name` puede contener metadata programático contaminado.

T2AH demostró que la contaminación de Psicología no está distribuida uniformemente: **460 de 485** registros forman un cohort legado de baja confianza, mientras 25 tienen metadata posterior más rico.

Hasta ahora el gate hacía:

`programRaw → AcademicProgramAuthority → admission`

Eso es insuficiente.

Si mañana se creara una autoridad legítima para Psicología, el gate aplicaría esa autoridad a los **485** registros por igual, incluyendo los 460 cuyo `programRaw` no es suficientemente confiable.

## Nueva arquitectura

T2AI introduce:

`SourceRecord → ProgramMetadataEvidenceConfidence → AcademicProgramAuthority applicability → Admission Gate`

La autoridad y la confianza son conceptos separados:

- **AcademicProgramAuthority** responde qué es un programa institucionalmente.
- **ProgramMetadataEvidenceConfidence** responde si el metadata de un registro concreto es suficientemente confiable para que esa autoridad se aplique automáticamente.

Una autoridad puede estar correctamente investigada y, aun así, quedar **bloqueada para un registro concreto**.

## Regla central

`metadata-confidence-does-not-create-program-authority`

La capa de confianza:

- no crea programas;
- no decide Humanidades;
- no convierte títulos o keywords en evidencia de admisión;
- no sustituye Institution Authority;
- no modifica Scope Matrix;
- no cambia la decisión disciplinaria de un programa.

Sólo controla:

`authorityApplicability`

## Estados V1

### unassessed

No existe una regla explícita de baja confianza.

Por compatibilidad con el pipeline existente:

`authorityApplicability = allowed`

Esto **no significa trusted**.

### low-trust

Existe evidencia estructural reproducible de que el metadata programático del registro no debe activar automáticamente una autoridad.

`authorityApplicability = blocked`

### sufficient

Estado reservado para evidencia explícita futura.

T2AI no utiliza `sufficient` para Psicología.

## Política ejecutable

Config:

`scripts/thesis/config/program-metadata-evidence-confidence-v1.json`

Policy revision:

`2026-11-02.v1`

El motor es genérico.

Los matchers V1 admiten:

- provider;
- normalized program key;
- accession day;
- campos requeridos presentes;
- campos requeridos ausentes.

No existe ningún:

`if psychology`

en el código del motor.

La primera regla declarativa es:

`riudg-psychology-legacy-migration-2015-09-09`

Match:

- provider = RIUdeG;
- program key = `licenciatura en psicologia`;
- accession day = `2015-09-09`;
- falta `dc.date.issued`;
- falta `dc.description.abstract`.

Resultado:

- confidenceState = `low-trust`
- authorityApplicability = `blocked`

La regla está en config porque T2AG/T2AH produjeron evidencia reproducible para ese cohort.

## Admission Gate

Si:

1. Institution Authority confirma UdeG;
2. AcademicProgramAuthority confirma el programa;
3. la autoridad tiene INCLUDE / REVIEW / EXCLUDE;
4. pero ProgramMetadataEvidence dice `blocked`;

entonces el resultado es:

`QUARANTINE`

con:

`program-authority-blocked-by-metadata-confidence`

El bloqueo ocurre antes de aplicar INCLUDE, REVIEW o EXCLUDE.

Esto es importante: metadata dudoso tampoco puede utilizarse para excluir automáticamente.

## Program Coverage Audit

Coverage respeta el mismo bloqueo.

Un snapshot nuevo conserva:

`programMetadataEvidence`

y la reproyección utiliza esa evidencia antes de aplicar Program Authority.

Snapshots históricos que todavía no contienen esta capa se consideran:

`unassessed / allowed`

para evitar reinterpretar retroactivamente evidencia que el snapshot nunca capturó.

Los nuevos full inventories deben volver a generarse con T2AI antes de utilizar confianza programática como contrato.

## Program Curation Queue

Un programa con obras bloqueadas por metadata no desaparece de la Queue aunque ya exista una autoridad.

Nuevo estado:

`metadata-review`

Nuevo carril:

`metadata-confidence-review`

Ese carril tiene precedencia sobre `scope-review`.

La Queue expone:

- confidence states;
- authority applicability;
- blocked works;
- evidence needs.

Esto evita el fallo arquitectónico:

`authority exists ⇒ program disappears from human review`

cuando algunos registros no pueden usar esa autoridad.

## Psicología bajo T2AI

La autoridad para Psicología **sigue sin existir**.

Program Authority permanece:

`2026-11-01.v23`

Sobre el full baseline congelado de 27,576 obras:

- 460 registros coinciden con la regla low-trust;
- 25 quedan `unassessed`;
- las 460 low-trust siguen en QUARANTINE porque todavía no existe autoridad para Psicología;
- el grupo debe aparecer en Queue como `metadata-review`;
- blockedWorks = **460**.

Muy importante:

Los 25 `unassessed` **no son 25 tesis confirmadas**.

Sólo no están bloqueados por esta regla concreta.

## Prueba de futuro

Los tests agregan una autoridad sintética INCLUDE.

Con metadata low-trust:

`confirmed authority + blocked evidence → QUARANTINE`

Con metadata unassessed:

`confirmed authority + allowed applicability → INCLUDE`

La misma lógica se prueba en:

- canonical corpus;
- Program Coverage Audit;
- Program Curation Queue.

Así T2AI prueba el comportamiento que necesitaremos antes de crear Program Authority V24, sin crear todavía esa autoridad.

## Full baseline

Config:

`scripts/thesis/config/program-metadata-evidence-confidence-baseline-v1.json`

Fuente histórica utilizada para congelar la regla:

- full artifact: `13099541204`
- canonical corpus SHA-256:
  `65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`

Expected:

- rule matches: **460**
- queueState: `metadata-review`
- curationLane: `metadata-confidence-review`

Un futuro full harvest que deje de cumplir ese baseline debe reabrir revisión en lugar de actualizar silenciosamente los números.

## Invariantes

T2AI no modifica:

- Program Authority V23;
- Institution Authority V2;
- Scope Policy V2;
- Boundary Closure V2;
- T2T;
- T2Y.

Tampoco crea V24.

## Qué sigue

Después de T2AI ya existe el mecanismo seguro para investigar una autoridad de Psicología sin que esa autoridad contamine automáticamente el cohort legado.

El siguiente paso debe ser investigar **la identidad institucional y disciplinaria de la Licenciatura en Psicología** con fuentes oficiales UdeG.

Sólo entonces podrá decidirse si Program Authority V24 corresponde a:

- INCLUDE;
- REVIEW;
- EXCLUDE.

Y cualquiera que sea el resultado, los **460 low-trust** permanecerán bloqueados hasta contar con evidencia programática item-level suficientemente confiable.
