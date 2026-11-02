# Thesis Humanities Boundary Closure Audit V2

## Estado

**T2AA — Urban / Territory Scope Policy Reconciliation V2**

T2AA actualiza el cierre `boundary-review` después de AcademicProgramAuthority
V18 y de la reclasificación de:

`scope:urban-territory-sustainability`

desde:

`outside-scope`

hacia:

`boundary-review`.

El cierre V1 se conserva como baseline histórico de 179 tesis.

---

## 1. Cambio de política

Scope Policy V1 contenía tres filas boundary-review:

- Comunicación;
- Educación / Cognición;
- Estudios de Género.

Después de V18, la evidencia institucional del Doctorado en Ciudad, Territorio
y Sustentabilidad demuestra una frontera real entre Humanidades y
Arquitectura/Urbanismo.

Scope Policy V2 agrega una cuarta fila:

- Ciudad / Territorio / Sustentabilidad.

---

## 2. Contrato V2

Archivo:

`scripts/thesis/config/boundary-closure-contract-v2.json`

Baseline:

- boundary rows: **4**;
- programKeys: **6**;
- confirmed authorities: **6**;
- authorityObservedWorks: **331**;
- admissionStates: **6 REVIEW**.

Descomposición:

- Maestría en Comunicación — 67;
- Doctorado en Educación — 73;
- Maestría en Investigación Educativa — 34;
- Doctorado en Cognición y Aprendizaje — 4;
- Maestría en Estudios de Género — 1;
- Doctorado en Ciudad, Territorio y Sustentabilidad — 152.

Total:

**331**

---

## 3. Por qué se conserva Contract V1

`boundary-closure-contract-v1.json`

permanece en el repositorio como snapshot histórico del cierre anterior:

- 3 filas;
- 5 programKeys;
- 179 tesis;
- 5 REVIEW.

No se reescribe.

El audit usa V2 por defecto desde T2AA.

Esto permite reconstruir la evolución de la política sin perder el baseline
anterior.

---

## 4. Policy Revision

Scope Matrix cambia de:

`2026-11-01.v1`

a:

`2026-11-01.v2`.

Los contratos activos de:

- Social Sciences;
- Political / International / Development

actualizan únicamente su `policyRevision` a V2.

Sus invariantes permanecen:

### Social Sciences

- 277;
- 2 EXCLUDE.

### Political / International / Development

- 212;
- 4 EXCLUDE.

---

## 5. Precedencia

T2AA formaliza:

`AcademicProgramAuthority > Scope Boundary prior`

V18 no se degrada a EXCLUDE para hacer encajar la matriz.

La matriz se corrige para reflejar la evidencia programática.

La decisión de admisión continúa perteneciendo a AcademicProgramAuthority.

---

## 6. Nueva distribución de Scope Matrix

### boundary-review

- Comunicación — 67;
- Educación / Cognición — 111;
- Estudios de Género — 1;
- Ciudad / Territorio / Sustentabilidad — 152.

Total:

**331**

### outside-scope

- Ciencias Sociales — 277;
- Política / Relaciones / Desarrollo — 212.

Total:

**489**

Total general:

**820**

---

## 7. Queue

Ciudad / Territorio / Sustentabilidad permanece:

- authority: confirmed;
- admissionState: REVIEW;
- queueState: review;
- curationLane: scope-review.

La reclasificación de Scope Matrix no cambia esa admisión.

---

## 8. CI

Boundary Closure Audit debe exigir:

- policyRevision = `2026-11-01.v2`;
- boundaryRows = **4**;
- boundaryProgramKeys = **6**;
- confirmedAuthorities = **6**;
- authorityObservedWorks = **331**;
- admissionStates = `{ review: 6 }`;
- violations = **0**.

El artifact debe proyectar la fila urbana como:

- boundaryState = `boundary-review`;
- programRef = `program:udg:doc-ciudad-territorio-sustentabilidad`;
- admissionState = `review`.

---

## 9. Cierres independientes

T2AA no modifica los cierres outside-scope:

### T2T

- 277;
- 2 EXCLUDE;
- closed.

### T2Y

- 212;
- 4 EXCLUDE;
- closed.

Sólo cambia el cierre boundary-review de V1 a V2.

---

## 10. Consecuencia

Después de T2AA, las 820 tesis de Scope Boundary Matrix quedan
programáticamente reconciliadas:

- **331** en boundary-review;
- **489** en outside-scope.

No quedan filas con una autoridad confirmada que contradiga su estado de scope.

La siguiente fase ya puede abandonar la reconciliación de familias y volver al
backlog general de Program Curation / unresolved evidence.
