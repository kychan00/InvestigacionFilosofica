# Tesis Humanidades UdeG — Boundary Closure Audit V4

## Estado

**Policy V4 / T2AY.**

Este contrato conserva cerrada la superficie pendiente de `boundary-review`
después de resolver Doctorado en Educación como `EXCLUDE` bajo
`humanities-only`.

## Contrato vigente

Archivo:

`scripts/thesis/config/boundary-closure-contract-v4.json`

Valores:

- policyRevision: `2026-11-02.v4`;
- targetScope: `humanities-only`;
- boundary rows: **3**;
- program keys: **4**;
- authorities confirmed: **4**;
- authorityObservedWorks: **191**;
- admission states: **REVIEW = 4**.

## Qué salió de la frontera

`Doctorado en Educación`

Antes:

- Scope Policy V3: `boundary-review`;
- Program Authority V8: `REVIEW`;
- 73 tesis.

Ahora:

- Program Authority V31: `EXCLUDE`;
- 73 tesis fuera del corpus `humanities-only`;
- las obras permanecen preservadas en el inventario.

La evidencia institucional específica define el programa alrededor de
investigación educativa / ciencias de la educación y explicita la convergencia
de Ciencias Sociales y Humanidades. Bajo un alcance estrictamente humanístico,
esa identidad interdisciplinaria no basta para INCLUDE.

## Fronteras que permanecen abiertas

### Investigación educativa / cognición

- Maestría en Investigación Educativa — 34;
- Doctorado en Cognición y Aprendizaje — 4.

Subtotal: **38**.

### Estudios de Género

- Maestría en Estudios de Género — 1.

Subtotal: **1**.

### Ciudad, Territorio y Sustentabilidad

- Doctorado en Ciudad, Territorio y Sustentabilidad — 152.

Subtotal: **152**.

Total:

**191 tesis**.

## Regla

El contrato se reabre si cambia cualquiera de estos elementos:

- número de filas boundary-review;
- conjunto de program keys;
- autoridad de alguno de los cuatro programas;
- estado REVIEW de esas autoridades;
- observedCount agregado;
- policyRevision;
- correspondencia entre Scope Matrix y AcademicProgramAuthority.

Programas resueltos como `EXCLUDE` no forman parte del contrato abierto aunque
pertenezcan a una familia interdisciplinaria cuya fila continúe en
`boundary-review`.

## Historial

- V1: contrato original;
- V2: 331 tesis, incluida Comunicación;
- V3: 264 tesis, Comunicación resuelta fuera de alcance;
- V4: **191 tesis**, Doctorado en Educación resuelto fuera de alcance.
