# Thesis Humanities — Social Sciences Outside-Scope Closure Audit V1

## Estado

**T2T — Social Sciences Outside-Scope Closure Audit V1**

T2T congela como contrato ejecutable el cierre programático de:

`scope:social-sciences`

después de Program Authority V13.

No agrega nuevas decisiones de admisión.

No cambia:

- AcademicProgramAuthority;
- InstitutionAuthority;
- Scope Boundary Matrix;
- Boundary Closure REVIEW;
- harvesting;
- UI.

Su única función es comprobar que el cierre de Ciencias Sociales siga siendo
verdadero.

---

## 1. Baseline de cierre

Fila:

`scope:social-sciences`

Estado:

`outside-scope`

Programas:

- Doctorado en Ciencias Sociales — 217 — EXCLUDE;
- Maestría en Ciencias Sociales — 60 — EXCLUDE.

Totales:

- filas bajo contrato: **1**;
- programKeys: **2**;
- autoridades confirmadas: **2**;
- tesis curadas por autoridad: **277**;
- admissionStates: **2 EXCLUDE**.

---

## 2. Razón para un contrato por fila

Scope Boundary Matrix contiene tres filas `outside-scope`:

- Ciencias Sociales;
- Política / Relaciones Internacionales / Desarrollo Social;
- Ciudad / Territorio / Sustentabilidad.

Sólo la primera está programáticamente resuelta.

Por eso T2T **no** audita todas las filas outside-scope en bloque.

El contrato enumera explícitamente:

`scope:social-sciences`

y deja las otras dos fuera hasta que tengan sus propias autoridades y sus
propios cierres.

Esto evita una falsa declaración de cierre global.

---

## 3. Contrato

Archivo:

`scripts/thesis/config/outside-scope-social-sciences-closure-v1.json`

El contrato congela:

### Fila

`scope:social-sciences`

### Doctorado

- normalizedKey: `doctorado en ciencias sociales`;
- programRef: `program:udg:doc-ciencias-sociales`;
- admissionState: `exclude`;
- authorityObservedCount: **217**.

### Maestría

- normalizedKey: `maestria en ciencias sociales`;
- programRef: `program:udg:mae-ciencias-sociales`;
- admissionState: `exclude`;
- authorityObservedCount: **60**.

### Totales

- expectedRows: **1**;
- expectedProgramKeys: **2**;
- expectedAuthorityObservedWorks: **277**;
- expectedAdmissionStates:
  - exclude: **2**.

Regla:

`any-change-reopens-outside-scope-curation`

---

## 4. Audit genérico outside-scope

Script:

`scripts/thesis/audit_outside_scope_closure_v1.py`

El script es genérico respecto del contrato.

No codifica el nombre de Ciencias Sociales en la lógica.

Eso permite que futuras fases creen contratos separados para:

- Política / Relaciones Internacionales / Desarrollo Social;
- Ciudad / Territorio / Sustentabilidad.

Cada cierre puede evolucionar de manera independiente.

---

## 5. Qué reabre Ciencias Sociales

El estado pasa de:

`closed`

a:

`open`

si ocurre cualquiera de estos casos:

1. desaparece `scope:social-sciences`;
2. la fila deja de ser `outside-scope`;
3. cambia el orden o conjunto de sus programKeys;
4. aparece una tercera clave programática;
5. una clave deja de resolver a AcademicProgramAuthority;
6. cambia el programRef esperado;
7. Doctorado deja de tener observedCount 217;
8. Maestría deja de tener observedCount 60;
9. una autoridad deja de ser EXCLUDE;
10. Scope Matrix proyecta una autoridad distinta al registry;
11. cambia la policyRevision sin actualizar el contrato;
12. cambia targetScope;
13. se rompe `scope-matrix-does-not-change-admission`.

CI debe fallar cuando:

`closureState = open`

---

## 6. Full inventory frente a sample

El audit separa:

### authorityObservedWorks

Representa el inventario curado almacenado en AcademicProgramAuthority.

Baseline contractual:

**277**

### sampleObservedWorks

Representa sólo las tesis de esos programas presentes en el harvest de muestra
del PR.

Puede ser:

- 0;
- 1;
- cualquier subconjunto menor.

Un sample vacío no abre el cierre.

Esto mantiene separadas:

- validación estructural de autoridad;
- cobertura circunstancial del harvest de muestra.

---

## 7. Salida

Directorio:

`artifacts/thesis-outside-scope-closure/`

Archivos:

- `outside-scope-closure-audit.json`;
- `outside-scope-closure-audit.md`.

El JSON contiene:

- closureId;
- closureState;
- Program Authority revision;
- Institution Authority revision;
- targetScope;
- boundaryState;
- decisionConstraint;
- métricas reales;
- métricas esperadas;
- detalle de cada autoridad;
- sample counts;
- violations.

---

## 8. Invariantes esperadas

Con V13:

`closureState = closed`

debe cumplir:

- contractRows = **1**;
- contractProgramKeys = **2**;
- confirmedAuthorities = **2**;
- authorityObservedWorks = **277**;
- admissionStates = `{ exclude: 2 }`;
- violations = **0**.

---

## 9. Casos de prueba

La suite nueva verifica:

### Baseline

La configuración real cierra en:

- 1 fila;
- 2 claves;
- 277 tesis;
- 2 EXCLUDE.

### Sample vacío

Si el harvest no trae ninguna tesis de estos programas:

`sampleObservedWorks = 0`

pero:

`closureState = closed`.

### Nueva programKey

Agregar:

`especialidad en ciencias sociales`

a la fila reabre el cierre.

### Autoridad faltante

Eliminar la autoridad de la Maestría reabre el cierre.

### Drift de programRef

Cambiar el ID de autoridad de la Maestría sin actualizar el contrato reabre el
cierre.

### Drift de inventario

Cambiar:

`217 → 218`

produce:

- program-observed-count-mismatch;
- closure-observed-works-mismatch;
- 278 obras observadas;
- closureState = open.

### Drift de admisión

Cambiar:

`EXCLUDE → REVIEW`

reabre el cierre.

### Drift del report

Si Scope Matrix proyecta una autoridad distinta al registry:

`scope-report-authority-mismatch`

y el cierre se abre.

### Cambios en otra fila outside-scope

Agregar una clave pendiente a:

`scope:urban-territory-sustainability`

**no** debe abrir Ciencias Sociales.

Cada cierre es independiente.

### No-mutación

El audit no modifica:

- report;
- registry;
- scope config;
- contract.

---

## 10. Relación con Boundary Closure REVIEW

T2Q continúa verificando:

- 3 filas boundary-review;
- 5 programKeys;
- 179 tesis;
- 5 REVIEW.

T2T verifica únicamente:

- 1 fila outside-scope;
- 2 programKeys;
- 277 tesis;
- 2 EXCLUDE.

Son contratos separados.

Cerrar una familia outside-scope no puede alterar el cierre REVIEW.

---

## 11. Workflow

`thesis-real-harvest.yml` debe ejecutar en este orden:

1. harvest;
2. Queue;
3. Coverage Audit;
4. Scope Boundary Matrix;
5. Boundary Closure REVIEW;
6. **Outside-Scope Closure — Social Sciences**;
7. upload artifacts.

El paso nuevo debe exigir:

- schema correcto;
- closureId = `social-sciences-v1`;
- closureState = `closed`;
- contractRows = 1;
- contractProgramKeys = 2;
- confirmedAuthorities = 2;
- authorityObservedWorks = 277;
- admissionStates = `{ exclude: 2 }`;
- violations = 0.

---

## 12. Siguiente fase

Después de T2T, Ciencias Sociales puede considerarse:

`programmatically closed`

La siguiente familia de Scope Boundary Matrix es:

`scope:political-international-development`

Full inventory documentado:

**212 tesis**

La siguiente fase debe volver a ser programática:

- identificar cada programKey;
- investigar su identidad institucional;
- resolverla de forma independiente;
- sólo después crear un contrato de cierre de esa fila.
