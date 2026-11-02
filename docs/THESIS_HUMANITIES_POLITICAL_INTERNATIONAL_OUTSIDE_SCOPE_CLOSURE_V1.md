# Thesis Humanities — Political / International / Development Outside-Scope Closure Audit V1

## Estado

**T2Y — Political / International / Development Outside-Scope Closure Audit V1**

T2Y congela como contrato ejecutable el cierre programático de:

`scope:political-international-development`

después de Program Authority V17.

No agrega nuevas decisiones de admisión.

No modifica:

- AcademicProgramAuthority;
- InstitutionAuthority;
- Scope Boundary Matrix;
- Boundary Closure REVIEW;
- Social Sciences Outside-Scope Closure;
- harvesting;
- UI.

---

## 1. Baseline contractual

Fila:

`scope:political-international-development`

Estado:

`outside-scope`

Programas:

- Maestría en Ciencia Política — 51 — EXCLUDE;
- Maestría en Gestión y Desarrollo Social — 106 — EXCLUDE;
- Licenciatura en Relaciones Internacionales — 48 — EXCLUDE;
- Maestría en Global Politics and Transpacific Studies — 7 — EXCLUDE.

Totales:

- filas bajo contrato: **1**;
- programKeys: **4**;
- autoridades confirmadas: **4**;
- tesis curadas por autoridad: **212**;
- admissionStates: **4 EXCLUDE**.

---

## 2. Contrato

Archivo:

`scripts/thesis/config/outside-scope-political-international-development-closure-v1.json`

El contrato congela por programa:

### Ciencia Política

- key: `maestria en ciencia politica`;
- programRef: `program:udg:mae-ciencia-politica`;
- state: `exclude`;
- full inventory: **51**.

### Gestión y Desarrollo Social

- key: `maestria en gestion y desarrollo social`;
- programRef: `program:udg:mae-gestion-desarrollo-social`;
- state: `exclude`;
- full inventory: **106**.

### Relaciones Internacionales

- key: `licenciatura en relaciones internacionales`;
- programRef: `program:udg:lic-relaciones-internacionales`;
- state: `exclude`;
- full inventory: **48**.

### Global Politics and Transpacific Studies

- key: `maestria en global politics and transpacific studies`;
- programRef: `program:udg:mae-global-politics-transpacific`;
- state: `exclude`;
- full inventory: **7**.

Totales:

- expectedRows: **1**;
- expectedProgramKeys: **4**;
- expectedAuthorityObservedWorks: **212**;
- expectedAdmissionStates:
  - exclude: **4**.

Regla:

`any-change-reopens-outside-scope-curation`

---

## 3. Audit reutilizado

T2Y reutiliza:

`scripts/thesis/audit_outside_scope_closure_v1.py`

No duplica lógica.

La misma implementación recibe un contrato distinto y escribe en un directorio
separado.

Esto mantiene cierres independientes:

- Social Sciences;
- Political / International / Development.

---

## 4. Qué reabre T2Y

El cierre pasa a:

`open`

si ocurre cualquiera de estos casos:

1. desaparece la fila;
2. deja de ser `outside-scope`;
3. cambia el orden o conjunto de programKeys;
4. aparece una quinta clave;
5. falta una autoridad;
6. cambia un programRef;
7. cambia 51, 106, 48 o 7;
8. una autoridad deja de ser EXCLUDE;
9. Scope Matrix proyecta otra autoridad;
10. cambia policyRevision;
11. cambia targetScope;
12. se rompe `scope-matrix-does-not-change-admission`.

---

## 5. Full inventory vs sample

`authorityObservedWorks = 212`

representa el full inventory curado guardado en AcademicProgramAuthority.

`sampleObservedWorks`

representa únicamente la presencia de esos programas dentro del harvest de
muestra del PR.

Un sample vacío no reabre el cierre.

Esto impide confundir:

- autoridad programática;
- cobertura circunstancial del sample.

---

## 6. Aislamiento respecto de otros cierres

T2Y no debe depender de:

`scope:social-sciences`

ni de:

`scope:urban-territory-sustainability`

La suite modifica deliberadamente ambas filas y comprueba que el cierre
político permanezca cerrado.

La independencia es intencional.

---

## 7. Salida

Directorio:

`artifacts/thesis-political-international-closure/`

Archivos:

- `outside-scope-closure-audit.json`;
- `outside-scope-closure-audit.md`.

El JSON debe contener:

- closureId = `political-international-development-v1`;
- closureState;
- Program Authority revision;
- Institution Authority revision;
- métricas reales;
- métricas esperadas;
- detalle de los cuatro programas;
- sample counts;
- violations.

---

## 8. Invariantes esperadas

Con Program Authority V17:

`closureState = closed`

Métricas:

- contractRows = **1**;
- contractProgramKeys = **4**;
- confirmedAuthorities = **4**;
- authorityObservedWorks = **212**;
- admissionStates = `{ exclude: 4 }`;
- violations = **0**.

---

## 9. Casos de prueba

La suite verifica:

- baseline cerrado en 212;
- sample vacío sigue cerrado;
- nueva programKey reabre;
- autoridad faltante reabre;
- drift de programRef reabre;
- 212 → 213 reabre;
- EXCLUDE → REVIEW reabre;
- drift en Social Sciences no afecta T2Y;
- drift en Urban / Territory no afecta T2Y;
- el audit no muta inputs.

---

## 10. Relación con T2Q y T2T

### T2Q

Continúa congelando:

- 179 tesis;
- 5 REVIEW.

### T2T

Continúa congelando:

- 277 tesis;
- 2 EXCLUDE.

### T2Y

Agrega:

- 212 tesis;
- 4 EXCLUDE.

Los tres contratos deben coexistir sin interferirse.

---

## 11. Workflow

`thesis-real-harvest.yml` debe ejecutar:

1. Scope Boundary Matrix;
2. T2Q;
3. T2T;
4. **T2Y**;
5. upload de artifacts.

T2Y exige:

- schema correcto;
- closureId correcto;
- closureState = closed;
- 1 fila;
- 4 programKeys;
- 4 autoridades;
- 212 obras curadas;
- 4 EXCLUDE;
- 0 violaciones.

---

## 12. Siguiente fase

Después de T2Y, quedan contractualmente cerradas dos de las tres familias
outside-scope:

- Ciencias Sociales — 277;
- Política / Relaciones Internacionales / Desarrollo Social — 212.

La última fila pendiente es:

`scope:urban-territory-sustainability`

Full inventory documentado:

**152 tesis**

Siguiente fase recomendada:

**T2Z — Doctorado en Ciudad, Territorio y Sustentabilidad / Program Authority V18**

La decisión debe investigarse de forma independiente antes de cualquier cierre
contractual.
