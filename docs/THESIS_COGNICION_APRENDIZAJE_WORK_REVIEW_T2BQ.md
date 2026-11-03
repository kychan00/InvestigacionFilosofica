# T2BQ — Doctorado en Cognición y Aprendizaje · Work-level Review

## Estado

**Fase no admisiva.** T2BQ no cambia Program Authority, Scope Policy, Metadata Confidence ni la admisión de ninguna tesis.

Programa:

`program:udg:doc-cognicion-aprendizaje`

Estado vigente:

- Program Authority: `2026-11-03.v44`
- admissionState: `REVIEW`
- Scope Policy: `2026-11-02.v5`
- Metadata Confidence: `2026-11-02.v5`
- obras observadas: **4**, todas RIUdeG / CUCSH / 2022.

La fase conserva la conclusión de la auditoría V10 y cambia únicamente la **superficie de curaduría**: la decisión programática binaria está agotada y las cuatro obras pasan a revisión por fuente primaria.

---

## 1. Evidencia institucional directa

La Universidad de Guadalajara define el Doctorado en Cognición y Aprendizaje como un programa de investigación interdisciplinario.

Fuentes primarias:

- https://www.cucsh.udg.mx/doctorados/doctorado-en-cognicion-y-aprendizaje
- https://www.udg.mx/oferta-academica/doctorado-en-cognicion-y-aprendizaje
- https://www.cucsh.udg.mx/sites/default/files/2026-01/convocatoria-2026-2029-version-acualizada-1.pdf

La convocatoria 2026–2029 mantiene dos líneas estructurales:

1. **Procesos cognoscitivos**, con psicología, educación y neurociencias, además de razonamiento, aprendizaje comprensivo, interpretación y formación de juicios.
2. **Cognición, culturas y sociedad**, que estudia la cognición como fenómeno contextualizado por marcos culturales y estructuras sociales, incluyendo sistemas simbólicos, prácticas comunitarias y narrativas culturales.

El plan de estudios combina fundamentos biopsicosociales, procesos cognitivos, teorías del aprendizaje, metodología, estadística, análisis de datos, argumentación escrita y formación interdisciplinaria.

---

## 2. Interpretación editorial

La nueva evidencia **no invalida V10**.

No existe fundamento suficiente para declarar el programa completo `INCLUDE` bajo humanities-only: psicología, neurociencias, estadística y enfoques biopsicosociales son componentes estructurales.

Tampoco existe fundamento suficiente para declarar el programa completo `EXCLUDE`: cultura, sociedad, sistemas simbólicos, narrativas, interpretación y formación de juicios también son componentes estructurales declarados institucionalmente.

Por tanto:

`program-level-scope-review-exhausted`

La alternativa académicamente más conservadora es resolver las tesis **a nivel de obra**, con fuente primaria y validación humana explícita.

---

## 3. Cuatro obras observadas

Las fichas institucionales sirven para identidad y navegación; **título, abstract y keywords no deciden admisión**.

1. Javier Cruz González — *El conocimiento pedagógico del contenido de los profesores de inglés al inicio de sus prácticas docentes*  
   https://riudg.udg.mx/handle/20.500.12104/92537
2. Jonathan Isaac Flores Ascencio — *Influencia de la formación profesional en ética en la generación de juicios morales consecuencialistas frente a dilemas morales personales*  
   https://riudg.udg.mx/handle/20.500.12104/92536
3. Jorge Hernández Contreras — *La autoeficacia en investigación: trayectoria de fuentes de autoeficacia en investigadores de la Universidad de Guadalajara*  
   https://riudg.udg.mx/handle/20.500.12104/92535
4. Pedro Moreno Badajós — *Prácticas lectoras académicas y estrategias metacognitivas en estudiantes del CULagos de la Universidad de Guadalajara*  
   https://riudg.udg.mx/handle/20.500.12104/92538

RIUdeG muestra PDF para las cuatro obras. T2BQ **no adjudica** esas tesis: sólo las mueve a la cola de revisión primaria.

---

## 4. Política work-level

Se amplía:

`scripts/thesis/config/boundary-work-review-policy-v1.json`

Nueva revisión:

`2026-11-03.boundary-v2`

La autoridad conserva:

- `requiredProgramAdmissionState = review`
- `resolutionMode = work-level-primary-source-adjudication`
- `admissionInvariant = review-until-explicit-work-decision`

Evidencia exigida para una futura decisión por obra:

- tesis oficial completa o front matter suficiente;
- registro institucional específico de la obra cuando exista;
- revisión humana del objeto de investigación, método y encuadre disciplinario.

No bastan por sí solos:

- título;
- abstract;
- keywords;
- similitud semántica;
- embeddings;
- clasificación por modelo;
- unidad académica;
- nombre del programa.

---

## 5. Efecto esperado sobre el corpus full

No hay cambio de admisión:

- INCLUDE: **559**
- REVIEW: **225**
- QUARANTINE: **18,971**
- EXCLUDE: **7,819**
- REJECT_SOURCE: **2**
- total: **27,576**

Sólo cambia la cola:

- Humanities Action: **12/73 → 11/69**
- Evidence HOLD: **5/13**, sin cambios
- Humanities Ready: **7/60 → 6/56**
- Work Review: **1/152 → 2/156**

El Doctorado en Cognición y Aprendizaje deja de bloquear la selección de la siguiente autoridad programática, pero sus cuatro tesis permanecen visibles y en `REVIEW`.

---

## 6. Qué no cambia

- Program Authority no sube a V45.
- Scope Boundary Matrix conserva `boundary-review`.
- Metadata Confidence V5 no cambia.
- No se crean aliases nuevos.
- No se usa el título de las tesis para resolver el alcance.
- No se ejecuta una clasificación semántica o LLM como gate de admisión.
- DCTS mantiene su carril work-level separado.
- Arte y Comunicación mantiene Evidence HOLD.

---

## 7. Siguiente paso

Después de T2BQ hay dos carriles independientes:

1. continuar la siguiente autoridad de `nextHumanitiesReadyAction`;
2. adjudicar las cuatro tesis de Cognición y Aprendizaje mediante lotes de fuente primaria, preservando `REVIEW` cuando la evidencia siga siendo mixta.

No debe volver a discutirse el Doctorado completo como si faltara una decisión programática binaria.
