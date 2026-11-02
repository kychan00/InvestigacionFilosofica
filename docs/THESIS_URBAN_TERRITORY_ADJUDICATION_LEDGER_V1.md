# T2BD — Doctorado en Ciudad, Territorio y Sustentabilidad · Adjudication Ledger V1

## Estado

**Fase no admisiva.**

T2BD no cambia Program Authority, Scope Policy, Metadata Confidence ni la admisión de ninguna obra.

La fase continúa el contrato de T2BC y separa definitivamente dos superficies distintas:

1. **Program Curation Queue** — decide qué autoridad programática estudiar después.
2. **Work Review Queue / Adjudication Ledger** — conserva obras de programas REVIEW cuya decisión programática ya está agotada y que requieren evidencia por obra.

El Doctorado en Ciudad, Territorio y Sustentabilidad deja de bloquear la primera superficie y permanece íntegramente visible en la segunda.

---

## 1. Estado de autoridad

Programa:

`program:udg:doc-ciudad-territorio-sustentabilidad`

AcademicProgramAuthority:

`REVIEW`

Registry:

`2026-11-02.v34`

Scope Policy:

`2026-11-02.v4`

Metadata Confidence:

`2026-11-02.v4`

Work Review Policy:

`2026-11-02.urban-v1`

T2BD no modifica ninguno de esos valores.

---

## 2. Separación de colas

Antes de T2BD, un Program Authority REVIEW aparecía siempre en:

`curationLane = scope-review`

y por tanto también en:

`humanitiesActionItems`.

Ese comportamiento era correcto mientras faltaba una decisión programática.

Después de T2BC ya existe una conclusión explícita:

`program-level-scope-review-exhausted`

Por tanto, volver a poner el mismo programa como siguiente autoridad produciría un bucle de curaduría.

T2BD incorpora la política work-level al Program Curation Queue.

Para este doctorado:

`curationLane = work-level-review`

El programa:

- sigue en `items`;
- sigue con `queueState = review`;
- sigue representando 152 tesis;
- sale de `humanitiesActionItems`;
- aparece en `workReviewItems`.

Esto no cambia admisión.

---

## 3. Efecto esperado sobre la cola full

Baseline post-T2BC:

- humanities action programs: **43**;
- humanities action works: **647**;
- primer target: Doctorado en Ciudad, Territorio y Sustentabilidad — **152**.

T2BD esperado:

- humanities action programs: **42**;
- humanities action works: **495**;
- work-level review programs: **1**;
- work-level review works: **152**.

Siguiente autoridad programática:

**Maestría en Conservación del Patrimonio Edificado**

- normalized key: `maestria en conservacion del patrimonio edificado`;
- works: **5**.

La cola por obra del DCTS continúa separadamente.

---

## 4. Primer ledger

Batch:

`urban-territory-001`

Archivo:

`scripts/thesis/config/urban-territory-adjudication-batch-001-v1.json`

El lote contiene **7 obras** cuyo estado de acceso a la fuente primaria fue comprobado individualmente en RIUdeG.

### Obras

1. `thesis:work:00002168`
   - handle: `20.500.12104/20543`
   - fichero: `DCUAAD00001.pdf`
   - acceso: restringido.

2. `thesis:work:00002169`
   - handle: `20.500.12104/20544`
   - fichero: `DCUAAD00002.pdf`
   - acceso: restringido.

3. `thesis:work:00020181`
   - handle: `20.500.12104/73118`
   - fichero: `DCUAAD00003.pdf`
   - acceso: restringido.

4. `thesis:work:00020186`
   - handle: `20.500.12104/73123`
   - fichero: `DCUAAD00016.pdf`
   - acceso: restringido.

5. `thesis:work:00020187`
   - handle: `20.500.12104/73124`
   - fichero: `DCUAAD00017.pdf`
   - acceso: restringido.

6. `thesis:work:00020189`
   - handle: `20.500.12104/73126`
   - fichero: `DCUAAD00019.pdf`
   - acceso: restringido.

7. `thesis:work:00020190`
   - handle: `20.500.12104/73127`
   - fichero: `DCUAAD00020.pdf`
   - acceso: restringido.

Fuentes institucionales:

- https://www.riudg.udg.mx/handle/20.500.12104/20543
- https://www.riudg.udg.mx/handle/20.500.12104/20544
- https://www.riudg.udg.mx/handle/20.500.12104/73118
- https://riudg.udg.mx/handle/20.500.12104/73123
- https://riudg.udg.mx/handle/20.500.12104/73124
- https://www.riudg.udg.mx/handle/20.500.12104/73126
- https://www.riudg.udg.mx/handle/20.500.12104/73127

---

## 5. Qué significa “restringido”

La ficha institucional es evidencia de:

- identidad de la obra;
- autor;
- programa;
- unidad;
- existencia del PDF;
- estado de acceso.

No basta para adjudicar el contenido disciplinario cuando el contrato exige revisión de fuente primaria.

Por tanto, para las 7 obras:

`adjudicationState = blocked-primary-source-access`

`candidateDecision = null`

`humanValidationStatus = required`

`admissionChangeRequested = false`

---

## 6. Por qué no se usan los abstracts para resolver el lote

Algunas fichas RIUdeG publican abstract.

T2BC ya estableció que:

- título;
- abstract;
- keywords;
- similitud semántica;
- embeddings;
- clasificación por modelos

son evidencia auxiliar y **no** fundamento suficiente de admisión.

T2BD preserva esa regla.

Un resumen puede ayudar al revisor a localizar el problema de investigación, pero no reemplaza:

- lectura de tesis / front matter;
- encuadre disciplinario;
- método;
- fuentes;
- estructura argumentativa;
- validación humana explícita.

---

## 7. Builder del ledger

Archivo:

`scripts/thesis/build_boundary_adjudication_ledger_v1.py`

Inputs:

- Work Review Queue T2BC;
- batch config.

Outputs:

- `adjudication-ledger.json`;
- `adjudication-ledger.csv`;
- `adjudication-ledger.md`.

El builder valida:

- que cada work exista en la Work Review Queue;
- que siga en REVIEW;
- que siga `pending-primary-source-review`;
- que el handle coincida;
- que un primary source restringido no genere candidato;
- que toda entrada requiera validación humana;
- que ningún cambio de admission sea solicitado.

---

## 8. Program Curation Queue

T2BD modifica:

`scripts/thesis/build_program_curation_queue_v1.py`

Nueva lane:

`work-level-review`

Nueva salida:

`workReviewItems`

Nuevas métricas:

- `workReviewQueueItems`;
- `workReviewWorks`.

Regla:

`humanitiesActionItems`

sigue siendo la única superficie para elegir la siguiente autoridad programática.

`workReviewItems`

es una superficie distinta para continuar adjudicación por obra.

---

## 9. Invariantes

T2BD exige:

1. DCTS permanece Program Authority REVIEW.
2. Las 152 obras permanecen REVIEW.
3. El programa no vuelve a ser el siguiente target de autoridad.
4. Las 152 obras permanecen visibles en work-level review.
5. Batch 001 contiene 7 obras.
6. Las 7 tienen primary source restringido.
7. Candidate decisions = 0.
8. Human validation completada = 0.
9. Admission changes = 0.
10. Scope Policy sigue V4.
11. Metadata Confidence sigue V4.
12. Conteos globales de admisión no cambian.

---

## 10. Siguiente paso

Después de T2BD hay dos líneas independientes de trabajo:

### Autoridad programática

Continuar con:

**Maestría en Conservación del Patrimonio Edificado — 5 obras.**

### Adjudicación DCTS

Conseguir fuente primaria para las obras bloqueadas o seleccionar un siguiente batch cuya tesis oficial sea accesible.

Cuando una fuente primaria esté disponible, el ledger podrá pasar una obra a:

- `candidate-evidence-ready`;
- después a una decisión candidata;
- y sólo tras validación humana explícita podrá proponerse una mutación de admission.

No se realizará una mutación silenciosa desde REVIEW.
