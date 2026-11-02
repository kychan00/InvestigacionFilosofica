# Tesis Humanidades UdeG — Boundary Closure Audit V3

## Estado

**Policy V3 / T2AW.**

Este contrato conserva cerrada la superficie pendiente de `boundary-review`
después de resolver Maestría en Comunicación como `outside-scope / EXCLUDE`.

## Contrato vigente

Archivo:

`scripts/thesis/config/boundary-closure-contract-v3.json`

Valores:

- policyRevision: `2026-11-02.v3`;
- targetScope: `humanities-only`;
- boundary rows: **3**;
- program keys: **5**;
- authorities confirmed: **5**;
- authorityObservedWorks: **264**;
- admission states: **REVIEW = 5**.

## Qué salió de la frontera

`Maestría en Comunicación`

Antes:

- Scope Policy V2: `boundary-review`;
- Program Authority V7: `REVIEW`;
- 67 tesis.

Ahora:

- Scope Policy V3: `outside-scope`;
- Program Authority V29: `EXCLUDE`;
- las 67 tesis se preservan en el inventario, pero quedan fuera del corpus
  `humanities-only`.

La evidencia decisiva es programática y vigente: la convocatoria 2026 integra
enfoques teóricos y metodológicos de las Ciencias Sociales, y los objetivos
oficiales sitúan la investigación en Ciencias Sociales y Ciencias de la
Comunicación.

## Fronteras que permanecen abiertas

### Educación / investigación educativa / cognición

- Doctorado en Educación — 73;
- Maestría en Investigación Educativa — 34;
- Doctorado en Cognición y Aprendizaje — 4.

Subtotal: **111**.

### Estudios de Género

- Maestría en Estudios de Género — 1.

Subtotal: **1**.

### Ciudad, Territorio y Sustentabilidad

- Doctorado en Ciudad, Territorio y Sustentabilidad — 152.

Subtotal: **152**.

Total:

**264 tesis**.

## Regla

El contrato se reabre si cambia cualquiera de estos elementos:

- número de filas boundary-review;
- conjunto de program keys;
- autoridad de alguno de los cinco programas;
- estado REVIEW de esas autoridades;
- observedCount agregado;
- policyRevision;
- correspondencia entre Scope Matrix y AcademicProgramAuthority.

Programas ya resueltos como `outside-scope / EXCLUDE` no forman parte del
contrato boundary-review.

## Historial

- V1: contrato original;
- V2: 331 tesis, incluida Comunicación;
- V3: 264 tesis, Comunicación resuelta fuera de alcance.
