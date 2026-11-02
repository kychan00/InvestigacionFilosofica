# Thesis Humanities Boundary Closure Audit V1

## Estado

**T2Q — Boundary Closure Audit V1**

T2Q convierte el cierre programático de las fronteras
`boundary-review` en una invariante ejecutable por CI.

No agrega nuevas decisiones de admisión.

No cambia:

- AcademicProgramAuthority;
- InstitutionAuthority;
- Scope Boundary Matrix;
- harvesting;
- UI.

Su función es detectar si un cierre ya revisado deja de ser verdadero.

---

## 1. Baseline de cierre

Después de Program Authority V11, las filas
`boundary-review` contienen:

### Comunicación

- Maestría en Comunicación — 67 — REVIEW.

### Educación / Cognición

- Doctorado en Educación — 73 — REVIEW;
- Maestría en Investigación Educativa — 34 — REVIEW;
- Doctorado en Cognición y Aprendizaje — 4 — REVIEW.

### Estudios de Género

- Maestría en Estudios de Género — 1 — REVIEW.

Totales de cierre:

- filas boundary-review: **3**;
- claves programáticas: **5**;
- autoridades confirmadas: **5**;
- tesis curadas por autoridad: **179**;
- estados de admisión: **5 REVIEW**.

---

## 2. Por qué hace falta un audit separado

Scope Boundary Matrix responde:

`¿qué programas pertenecen a una frontera disciplinaria?`

AcademicProgramAuthority responde:

`¿qué decisión programática explícita tiene cada programa?`

Boundary Closure Audit responde:

`¿sigue siendo cierto el cierre que ya revisamos?`

Son responsabilidades distintas.

El audit no debe inferir nuevas disciplinas.

Debe fallar cuando una modificación futura invalida un cierre previamente
aceptado.

---

## 3. Contrato de cierre

Archivo:

`scripts/thesis/config/boundary-closure-contract-v1.json`

Contrato V1:

- targetScope: `humanities-only`;
- boundaryState: `boundary-review`;
- decisionConstraint:
  `scope-matrix-does-not-change-admission`;
- expectedBoundaryRows: **3**;
- expectedProgramKeys: **5**;
- expectedAuthorityObservedWorks: **179**;
- expectedAdmissionStates:
  - REVIEW: **5**;
- closureRule:
  `any-change-reopens-boundary-curation`.

Este contrato es deliberadamente estricto.

Si cambia de forma legítima la realidad curada, el contrato debe actualizarse
en una fase explícita.

---

## 4. Regla de reapertura

El cierre vuelve a:

`open`

si ocurre cualquiera de estos casos:

1. aparece una nueva fila `boundary-review`;
2. aparece una nueva programKey dentro de una fila de frontera;
3. una clave de frontera deja de resolver a AcademicProgramAuthority;
4. el Scope Boundary report deja de proyectar la misma autoridad;
5. cambia el número curado de tesis de frontera;
6. cambia la distribución de estados de admisión;
7. se rompe la restricción que impide a Scope Matrix cambiar admisión;
8. cambia el target scope `humanities-only`.

CI debe fallar cuando:

`closureState = open`

---

## 5. Full inventory frente a harvest de muestra

T2Q distingue dos métricas.

### authorityObservedWorks

Representa los conteos curados del full inventory almacenados en las
autoridades programáticas.

Baseline:

**179**

Esta métrica sí forma parte del contrato.

### sampleObservedWorks

Representa únicamente las obras de esas claves que aparecen en el harvest de
muestra del PR.

Puede ser:

- 0;
- 1;
- cualquier subconjunto menor.

No es una violación que el sample no contenga las 179 obras.

El sample sólo sirve para verificar que el pipeline y la proyección funcionan
con datos reales.

---

## 6. Nueva salida

El workflow genera:

- `boundary-closure-audit.json`;
- `boundary-closure-audit.md`.

Directorio:

`artifacts/thesis-boundary-closure/`

El JSON contiene:

- closureState;
- policyRevision;
- Program Authority revision;
- Institution Authority revision;
- métricas reales;
- métricas esperadas;
- detalle de cada programKey;
- violations;
- claves ausentes del sample.

---

## 7. Invariantes V1

Con el estado esperado:

`closureState = closed`

deben cumplirse:

- boundaryRows = 3;
- boundaryProgramKeys = 5;
- confirmedAuthorities = 5;
- authorityObservedWorks = 179;
- admissionStates = { review: 5 };
- violations = 0.

El audit no exige:

`sampleObservedWorks = 179`

porque el workflow de PR usa harvest de muestra.

---

## 8. Casos de prueba

La suite cubre:

### Cierre real

La configuración y Program Authority V11 producen:

`closed`

con 179 tesis curadas.

### Nueva clave

Agregar una nueva programKey a una fila boundary-review sin autoridad produce:

- boundary-program-key-count-mismatch;
- unresolved-program-authority;
- closureState = open.

### Autoridad faltante

Eliminar una de las cinco autoridades produce:

- unresolved-program-authority;
- boundary-admission-state-mismatch;
- boundary-observed-works-mismatch;
- closureState = open.

### Drift del inventario

Cambiar 67 → 68 tesis en Comunicación produce:

- authorityObservedWorks = 180;
- boundary-observed-works-mismatch;
- closureState = open.

### Drift de admisión

Cambiar Comunicación de REVIEW → INCLUDE sin actualizar contrato produce:

- boundary-admission-state-mismatch;
- closureState = open.

### Drift del Scope report

Si el Scope report proyecta una autoridad distinta a la registrada:

- scope-report-authority-mismatch;
- closureState = open.

### Sample vacío

Un harvest de muestra sin ninguna de las cinco fronteras sigue produciendo:

`closed`

si el cierre programático permanece íntegro.

---

## 9. Relación con Scope Boundary Matrix

El audit reutiliza:

`scope-boundary-matrix.json`

como representación generada.

Pero la fuente normativa continúa separada:

- Scope config define las filas;
- Program Authority define admisión;
- Closure contract congela el cierre revisado;
- Closure audit verifica consistencia.

Ninguno reemplaza al otro.

---

## 10. Política de cambios futuros

Si aparece una nueva programKey de frontera:

1. CI falla;
2. la frontera queda reabierta;
3. se investiga la identidad institucional;
4. se crea o actualiza AcademicProgramAuthority;
5. se actualiza el contrato de cierre;
6. se documenta la nueva cifra;
7. CI vuelve a cerrar.

Esto impide que una nueva tesis o un nuevo nombre programático entre
silenciosamente en una frontera ya declarada cerrada.

---

## 11. Siguiente decisión después de T2Q

T2Q no decide todavía qué hacer con las 179 tesis REVIEW a nivel individual.

Después del cierre automático hay dos rutas legítimas:

### Ruta A — REVIEW Item Policy

Diseñar una política explícita para decidir si trabajos individuales dentro de
programas interdisciplinarios pueden entrar al corpus por evidencia documental
más granular.

### Ruta B — Outside-Scope Authorities

Continuar con las **641 tesis** de filas `outside-scope`, programa por
programa, para reemplazar QUARANTINE por EXCLUDE sólo donde exista autoridad
programática suficiente.

La decisión entre A y B debe tomarse después de que T2Q esté mergeado y estable.
