# T2AH — Psychology Program Metadata Provenance Cohort V1

## Objetivo

T2AG demostró que las **485** obras etiquetadas como Licenciatura en Psicología no pueden tratarse como un bloque programático confiable.

T2AH responde la siguiente pregunta:

> ¿La contaminación está distribuida uniformemente o puede localizarse en un cohort de procedencia concreto?

La respuesta del full inventory es clara: existe una separación muy fuerte por provenance.

Esta fase sigue siendo **no admisiva**.

`decisionConstraint = provenance-does-not-change-admission`

No se crea Program Authority V24.

## Hallazgo principal

De las **485** obras:

### Legacy migration cohort

Accession day:

`2015-09-09`

Works:

**460**

Representa **94.8%** del grupo observado.

Metadata:

- `dc.date.issued`: **0/460**
- abstract: **0/460**
- `dc.date.submitted`: **445/460**
- año válido: **443/460**

Y concentra **todas las anomalías estructurales conocidas** de T2AG:

- pre-1975: **3/3**
- exact-title cross-program conflicts: **46/46**
- exact-title + same-author conflicts: **8/8**
- narrow title-domain warnings: **44/44**
- high-confidence anomalies: **11/11**
- warning-only: **66/66**

Estado de provenance:

`low-trust-review`

Esto **no** significa que las 460 obras sean falsas ni que pertenezcan a otro programa.

Significa que ese cohort no puede utilizar `dc.degree.name` como evidencia suficiente para aplicar automáticamente una futura autoridad programática.

### Post-migration cohort

Works:

**25**

Metadata:

- `dc.date.issued`: **24/25**
- abstract: **24/25**
- `dc.date.submitted`: **0/25**
- año válido: **24/25**

En las pruebas estrechas actuales:

- pre-1975: 0
- exact-title conflicts: 0
- title + same-author conflicts: 0
- title-domain warnings: 0
- high-confidence anomalies: 0
- warning-only: 0
- no-detected-contradiction: 25

Estado:

`higher-context-review`

Muy importante:

`higher-context-review != trusted`

T2AH no afirma que esas 25 obras estén confirmadas como Psicología.

Sólo demuestra que tienen metadata fuente más rica y no presentan las contradicciones detectadas en el lote legado.

## Interpretación de procedencia

El día 9 de septiembre de 2015 no es una fecha académica.

Es un evento de accession/migración de RIUdeG.

En el full snapshot existen miles de registros incorporados ese mismo día, por lo que la señal no puede utilizarse sola para decidir disciplina.

Su valor aparece en combinación con las propiedades específicas del grupo Psicología:

- 460/485 en ese cohort;
- ausencia total de abstracts;
- ausencia total de `dc.date.issued`;
- concentración total de contradicciones conocidas;
- títulos/autorías duplicados bajo otros programas;
- registros anteriores a la existencia de la carrera.

Por eso se modela como provenance de baja confianza, no como clasificación disciplinaria.

## Implicación arquitectónica

Después de T2AH ya no es metodológicamente suficiente hacer:

`programRaw -> AcademicProgramAuthority -> admission`

para Psicología.

Antes de Program Authority V24 se necesita que una futura capa pueda expresar, al menos:

`programRaw + programEvidenceConfidence -> authority applicability`

La recomendación ejecutable de esta fase es:

`do-not-apply-program-authority-unconditionally`

## Implementación

Nuevo script:

`scripts/thesis/audit_program_metadata_provenance_v1.py`

Baseline:

`scripts/thesis/config/psychology-metadata-provenance-baseline-v1.json`

Tests:

`tests/test_thesis_program_metadata_provenance_audit.py`

Artifact:

`artifacts/thesis-program-metadata-provenance/`

Salidas:

- `program-metadata-provenance-cohort.json`
- `program-metadata-provenance-cohort.md`

## Full baseline

Fuente:

- artifact: `13099541204`
- corpus: **27,576 works**
- canonical SHA-256:
  `65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`

## Gobernanza

T2AH no modifica:

- Program Authority V23;
- Institution Authority V2;
- Scope Policy V2;
- Admission Gate;
- Queue semantics;
- Boundary Closure V2;
- T2T;
- T2Y.

La autoridad para Psicología permanece:

`HOLD`

## Siguiente fase recomendada

Después de T2AH, el siguiente problema ya no es identificar más anomalías.

Es introducir una **Program Metadata Evidence Confidence Layer** que pueda impedir que una futura autoridad programática se aplique a registros cuyo metadata programático está marcado como low-trust.

Esa capa debe diseñarse genéricamente y no como un `if psychology` escondido en el código.

Sólo después tendría sentido investigar y crear Program Authority V24.
