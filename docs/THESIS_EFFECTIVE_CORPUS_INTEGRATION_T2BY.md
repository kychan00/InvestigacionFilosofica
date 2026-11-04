# T2BY — Corpus efectivo y reconciliación de colas

## Objetivo

T2BX probó que una decisión work-level aprobada puede activar una obra individual de `REVIEW` a `INCLUDE`. T2BY integra esa capa en una **fuente de verdad efectiva para fases posteriores**, sin reescribir el snapshot congelado ni mutar AcademicProgramAuthority.

Orden de proyección:

1. evidencia congelada de SourceRecord/corpus canónico;
2. Metadata Confidence vigente;
3. Institution/Program Authority vigente;
4. decisiones work-level explícitas, aprobadas y reversibles.

La última capa tiene precedencia únicamente sobre el `workId` exacto autorizado.

## Estado de entrada

- `main@b1d4d646be5772f1e79d6866774ebc49b791b640`;
- Program Authority: `2026-11-03.v47`;
- Scope Policy: `2026-11-02.v5`;
- Metadata Confidence: `2026-11-02.v5`;
- Work Review Policy: `2026-11-03.boundary-v4`;
- Work Admission Decision: `2026-11-03.t2bx-v1`;
- decisión aprobada: `thesis:work:00002062` REVIEW → INCLUDE.

La autoridad `program:udg:mae-estudios-genero` permanece **REVIEW**.

## Builder efectivo

Nuevo archivo:

`scripts/thesis/build_effective_corpus_v1.py`

El builder llama primero a la proyección institucional/programática existente y después aplica `work-admission-decisions-v1.json`.

No modifica:

- el registro programático;
- los SourceRecord;
- el snapshot congelado;
- otras obras del mismo programa;
- ninguna obra sin una decisión explícita.

El resultado incorpora:

- `effectiveCorpusSchemaVersion = thesis-effective-corpus-v1`;
- `effectiveAdmissionRevision = 2026-11-03.t2bx-v1`;
- provenance en la obra activada.

## Conteos efectivos

Baseline programático previo:

- INCLUDE: 560;
- REVIEW: 194;
- QUARANTINE: 18,971;
- EXCLUDE: 7,849;
- REJECT_SOURCE: 2.

Corpus efectivo T2BY:

- INCLUDE: **561**;
- REVIEW: **193**;
- QUARANTINE: 18,971;
- EXCLUDE: 7,849;
- REJECT_SOURCE: 2;
- total: **27,576**.

El único `workId` permitido como diferencia es `thesis:work:00002062`.

## Reconciliación de Work Review Queue

Antes de T2BY la cola work-level describía los cuatro programas de política como 181 obras pendientes. Eso era correcto antes de activar la primera decisión individual.

T2BY distingue ahora:

- obras observadas dentro de programas work-level;
- obras todavía `REVIEW`;
- obras ya resueltas mediante decisión work-level explícita.

Resultado esperado:

- programas cubiertos por la política: 4;
- obras observadas: 181;
- obras pendientes: **180**;
- obras resueltas por decisión explícita: **1**.

La obra de Estudios de Género no vuelve a aparecer como `pending-primary-source-review`.

## Reconciliación de Program Curation Queue

AcademicProgramAuthority de Estudios de Género continúa `REVIEW`, por lo que el programa permanece visible y auditable.

Pero su única obra observada ya está resuelta. Por ello:

- `workReviewItems`: **3 programas / 180 obras pendientes**;
- `workReviewCompletedItems`: **1 programa / 1 obra resuelta**;
- Estudios de Género aparece en la superficie completada;
- DCTS, Cognición y Aprendizaje, y Derechos Humanos permanecen pendientes.

La cola accionable programática no cambia:

- Humanities Action: **5 / 13**;
- Humanities Ready: **0 / 0**;
- Evidence HOLD: **5 / 13**.

No se inventa una nueva autoridad programática porque una obra individual haya sido admitida.

## Compatibilidad histórica

Los workflows históricos que trabajan sobre el snapshot no activado deben conservar sus conteos anteriores.

Las modificaciones en `build_boundary_work_review_queue_v1.py` y `build_program_curation_queue_v1.py` son compatibles hacia atrás:

- un corpus sin `workAdmissionDecision` sigue comportándose como antes;
- sólo un corpus efectivo con provenance explícita puede retirar una obra de pendientes;
- la decisión no puede inferirse del título, abstract, keywords, embedding, LLM o programa.

## Publicación

T2BY produce un corpus efectivo comprimido como artefacto de GitHub Actions, junto con hash y reportes de las colas.

**T2BY no conecta aún ese artefacto a GitHub Pages.**

El workflow de Pages actualmente despliega el contenido del repositorio y adjunta índices de autores remotos; no existe todavía un paso equivalente que descargue y verifique un release del corpus de tesis. Por tanto, un deploy exitoso de `main` después de T2BY no bastaría para afirmar que la búsqueda pública consume estas 561 obras INCLUDE.

La siguiente fase debe decidir y probar el mecanismo de publicación estable —preferentemente un release versionado con manifest/hash, siguiendo el patrón ya usado para índices de autores— antes de modificar el deploy.
