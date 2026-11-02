# T2BC — Doctorado en Ciudad, Territorio y Sustentabilidad · Work Review Queue V1

## Estado

**REVIEW conservado · fase no admisiva.**

T2BC no cambia AcademicProgramAuthority, Scope Policy, Metadata Confidence ni la admisión de ninguna tesis.

El problema resuelto es otro: la revisión **a nivel de programa** ya llegó a su límite metodológico. La evidencia institucional confirma una frontera real entre Humanidades, Arquitectura/Urbanismo, estudios territoriales y sustentabilidad; por ello las 152 tesis no pueden resolverse correctamente mediante un único cambio de Program Authority.

La fase crea una cola auditable para una futura adjudicación **por obra**, basada en fuente primaria e intervención humana.

---

## 1. Autoridad vigente

Programa:

`program:udg:doc-ciudad-territorio-sustentabilidad`

Nombre:

**Doctorado en Ciudad, Territorio y Sustentabilidad**

AcademicProgramAuthority:

`REVIEW`

Registry:

`2026-11-02.v34`

Scope:

`scope:urban-territory-sustainability → boundary-review`

Scope Policy:

`2026-11-02.v4`

Metadata Confidence:

`2026-11-02.v4`

T2BC no modifica ninguno de esos estados.

---

## 2. Por qué REVIEW sigue siendo correcto

La evidencia institucional actual sigue mostrando una identidad interdisciplinaria.

La Universidad de Guadalajara define tres líneas:

1. Teorías de la ciudad y la arquitectura.
2. Territorio, movilidad y espacio público.
3. Hábitat, ordenación territorial-urbana y sustentabilidad.

La página institucional describe el objetivo como formación para investigación, estudio e intervención urbana-territorial y señala explícitamente investigación científico-técnica, planeamiento, diseño urbano, procesos sociales y desarrollo sustentable.

A la vez, el programa admite perfiles de Historia y Antropología junto con Arquitectura, Urbanismo, Sociología, Economía, Ingeniería, Geografía y Administración Pública, y conserva contenidos de análisis crítico, teoría, cultura, identidad, espacio público, poder, comunidad y procesos sociales.

Fuentes oficiales:

- https://www.udg.mx/oferta-academica/posgrados/doctorados/doctorado-en-ciudad-territorio-y-sustentabilidad
- https://inciudades.cuaad.udg.mx/estructura-curricular
- https://mpegpau.cuaad.udg.mx/informacion-general/mision--vision
- https://dcts.cuaad.udg.mx/images/dcts/CONVOCATORIAS/Convocatoria%202026.pdf

La conclusión programática se mantiene:

`program-level-scope-review-exhausted`

Eso **no** significa INCLUDE ni EXCLUDE.

---

## 3. Inventario full

Sobre el snapshot full de 27,576 obras:

- obras del programa: **152**;
- admission proyectado: **152 REVIEW**;
- CUAAD: **152**;
- Metadata Confidence: **152 unassessed**;
- authority applicability: **152 allowed**;
- blocked: **0**;
- handle persistente: **152**;
- contribuciones disponibles: **152**;
- abstract disponible: **147**;
- abstract faltante: **5**;
- keywords disponibles: **73**;
- fecha válida: **86**;
- fecha sospechosa: **66**;
- valor sentinel sospechoso: `1969-12-31`;
- años válidos: **2000–2021**.

Los 66 valores `1969-12-31` no se utilizan para historia del programa ni para priorizar decisiones.

---

## 4. Regla central de T2BC

Las reglas base del proyecto establecen que no son evidencia suficiente de admisión:

- palabras del título;
- keywords;
- abstract;
- similitud semántica;
- embeddings;
- modelos de lenguaje;
- clasificación temática automática.

T2BC preserva esa regla.

Por ello el nuevo expediente por obra **no copia el contenido del abstract ni las keywords como base de decisión**. Sólo registra su disponibilidad como contexto auxiliar para un revisor.

---

## 5. Evidencia requerida para una futura decisión por obra

Una obra sólo podrá abandonar REVIEW mediante una decisión explícita posterior que documente fuente primaria y revisión humana.

El contrato V1 exige como base:

1. tesis oficial / full text / front matter institucional;
2. registro institucional específico de la obra cuando exista;
3. revisión humana del objeto de investigación, método y encuadre disciplinario.

Título, abstract y keywords pueden ayudar a localizar o priorizar, pero no bastan.

Los estados de trabajo previstos son:

- `pending-primary-source-review`;
- `include-candidate`;
- `exclude-candidate`;
- `retain-review`.

T2BC sólo produce el primero.

---

## 6. Nueva política

Archivo:

`scripts/thesis/config/boundary-work-review-policy-v1.json`

Policy revision:

`2026-11-02.urban-v1`

Decision constraint:

`boundary-work-review-does-not-change-admission`

Admission invariant:

`review-until-explicit-work-decision`

La política es reusable para otros programas REVIEW si posteriormente se documenta que su resolución adecuada también debe pasar a nivel de obra.

---

## 7. Generador

Archivo:

`scripts/thesis/build_boundary_work_review_queue_v1.py`

El generador:

- reproyecta la autoridad vigente sobre evidencia congelada;
- selecciona únicamente obras del Program Authority configurado;
- conserva el estado de admisión vigente;
- registra availability de evidencia auxiliar;
- conserva handle y source refs para ir a la fuente primaria;
- crea un item pendiente por cada obra;
- no genera scores humanísticos;
- no usa embeddings;
- no invoca modelos;
- no genera decisiones automáticas;
- no cambia admission.

Outputs:

- `boundary-work-review-queue.json`;
- `boundary-work-review-queue.csv`;
- `boundary-work-review-queue.md`.

---

## 8. Contrato cuantitativo

Baseline:

`scripts/thesis/config/urban-territory-work-review-baseline-v1.json`

Resultado esperado:

- 152 work items;
- 152 REVIEW;
- 152 pending primary-source review;
- 0 automatic admission decisions;
- 0 admission changes;
- 0 blocked;
- 152 allowed;
- 152 unassessed;
- 152 CUAAD;
- 147 abstracts disponibles;
- 73 con keywords;
- 152 handles;
- 86 fechas válidas;
- 66 fechas sospechosas.

---

## 9. Qué cambia y qué no

### Cambia

Se crea una superficie explícita para continuar la revisión sin volver a discutir indefinidamente la misma autoridad programática.

### No cambia

- Program Authority sigue REVIEW.
- Scope Policy sigue V4.
- Metadata Confidence sigue V4.
- Las 152 obras siguen REVIEW.
- Ninguna obra se vuelve INCLUDE.
- Ninguna obra se vuelve EXCLUDE.
- No se crean aliases.
- No se crea nueva identidad programática.
- No se utiliza semántica como admisión.

---

## 10. Siguiente fase

Después de T2BC, la continuación correcta ya no es preguntar otra vez si el Doctorado completo es Humanidades.

La siguiente fase debe trabajar sobre la cola por obra y definir un **ledger de adjudicación primaria**, en lotes auditables, manteniendo:

- fuente institucional identificable;
- racional por obra;
- reviewer explícito;
- ninguna decisión basada sólo en title/abstract/keywords/model;
- posibilidad de conservar REVIEW cuando la evidencia siga siendo mixta.

Sólo después de esa adjudicación podrá cambiar el estado de una obra individual.
