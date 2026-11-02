# T2AJ — Licenciatura en Psicología / Program Authority V24

## Decisión

`Licenciatura en Psicología`

se registra como:

`AcademicProgramAuthority = EXCLUDE`

para el corpus:

`targetScope = humanities-only`

Registry revision:

`2026-11-02.v24`

Program ref:

`program:udg:lic-psicologia`

## Por qué EXCLUDE

La decisión no se basa en el nombre del Centro Universitario.

La evidencia programática oficial de la Universidad de Guadalajara clasifica explícitamente la Licenciatura en Psicología en el área de conocimiento:

`Ciencias de la Salud`

La Guía de Carreras UdeG la ofrece en CUCS y diversos centros multitemáticos.

La oferta institucional general de la Universidad también incluye la Licenciatura en Psicología dentro de Ciencias de la Salud.

CUCS describe sus programas de pregrado, incluyendo Psicología, como parte del conjunto de programas orientados a las Ciencias de la Salud.

## Contenido curricular

El plan de estudios muestra una formación amplia y multidimensional.

Incluye, entre otras áreas:

- psicología clínica;
- salud mental;
- neuropsicología;
- psicodiagnóstico;
- bases psicobiológicas;
- psicología de la salud;
- psicología social;
- psicología educativa;
- epistemología;
- fundamentos filosóficos de la psicología;
- metodología cuantitativa y cualitativa.

Los componentes filosóficos, epistemológicos, educativos y sociales son sustantivos, pero operan dentro de una identidad profesional e institucional que UdeG clasifica explícitamente como Ciencias de la Salud.

Bajo un corpus estrictamente Humanities-only, esa interdisciplinariedad no es suficiente para INCLUDE ni genera una frontera comparable a un programa cuya propia clasificación institucional sea Humanidades/Ciencias Sociales y Humanidades.

## Evidencia institucional

Fuentes principales:

1. Guía de Carreras UdeG — Licenciatura en Psicología  
   `https://guiadecarreras.udg.mx/oferta_academica/licenciatura-en-psicologia`

2. UdeG — Ciencias de la Salud  
   `https://www.udg.mx/es/oferta-academica/ciencias-salud`

3. CUCS — Nuestro Centro  
   `https://www.cucs.udg.mx/node/65`

4. CUCS — Reseña Histórica  
   `https://www.cucs.udg.mx/node/1837`

5. CUCosta — Plan de Estudios de Psicología  
   `https://www.cuc.udg.mx/psicologia/plan-de-estudios`

6. CUAltos — Licenciatura en Psicología  
   `https://cualtos.udg.mx/index.php/oferta-academica/licenciatura-psicologia`

## Historia institucional

CUCS documenta la fundación de la Escuela de Psicología el 2 de septiembre de 1975.

Otra documentación institucional del propio CUCS sitúa la aprobación universitaria en 1974 y el inicio formal de la primera generación en 1975.

Por eso las fechas 1929, 1944 y 1971 observadas dentro del raw group `Licenciatura en Psicología` no pueden utilizarse como historia académica válida del programa.

T2AG ya las identificó como anomalías estructurales.

## Interacción con T2AG / T2AH / T2AI

Este punto es esencial.

El full inventory observa:

**485**

registros con el nombre normalizado:

`licenciatura en psicologia`

Pero esos 485 no tienen la misma calidad de metadata.

T2AH separó:

### Legacy migration cohort

**460**

- confidenceState = `low-trust`
- authorityApplicability = `blocked`

### Post-migration cohort

**25**

- confidenceState = `unassessed`
- authorityApplicability = `allowed`

`unassessed` no significa `trusted`.

## Resultado correcto de V24

V24 no significa:

`485 → EXCLUDE`

Significa:

### 460 legacy low-trust

`EXCLUDE authority + blocked metadata → QUARANTINE`

Explanation:

`program-authority-blocked-by-metadata-confidence`

### 25 no bloqueados

`EXCLUDE authority + allowed applicability → EXCLUDE`

Explanation:

`non-humanities-program`

Por tanto el impacto full esperado es:

- QUARANTINE: **460**
- EXCLUDE: **25**

## Queue

El grupo completo debe seguir visible en curación humana porque contiene obras bloqueadas.

Expected:

- queueState = `metadata-review`
- curationLane = `metadata-confidence-review`
- count = **485**
- blockedWorks = **460**
- authority = `program:udg:lic-psicologia`
- authority.admissionState = `exclude`

La existencia de V24 no debe sacar el grupo de la Queue.

## Full baseline

Contrato:

`scripts/thesis/config/psychology-program-authority-v24-baseline-v1.json`

Fuente congelada:

- artifact full: `13099541204`
- canonical SHA-256:
  `65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`

Expected:

- observedWorks = 485
- blockedWorks = 460
- authorityApplicableWorks = 25
- projectedAdmissionStatuses:
  - exclude = 25
  - quarantine = 460

## Precedencia

La decisión respeta la política existente:

1. explicit Program Authority;
2. program-specific institutional evidence;
3. department/division;
4. center-level classification;
5. lexical/topic evidence never decides.

Aquí existe evidencia programática explícita: la propia Guía de Carreras UdeG clasifica Psicología como Ciencias de la Salud.

No se decide por:

- títulos de tesis;
- keywords;
- similitud semántica;
- presencia de palabras como filosofía, cultura, educación o sociedad;
- pertenencia a CUCS por sí sola.

## Invariantes

V24 no modifica:

- Institution Authority V2;
- Scope Policy V2;
- Program Metadata Evidence Confidence V1;
- Boundary Closure V2;
- T2T;
- T2Y.

La capa de metadata confidence sigue teniendo precedencia operativa sobre la aplicación de Program Authority a registros individuales.

## Resultado metodológico

Con V24 se separan finalmente dos preguntas que antes estaban mezcladas:

**¿La Licenciatura en Psicología pertenece al scope Humanities-only?**

No. → EXCLUDE.

**¿Podemos confiar en que cada registro etiquetado como Psicología realmente pertenece a ese programa?**

No. → 460 siguen bloqueados y en QUARANTINE.

Esta separación evita usar una decisión disciplinaria correcta para amplificar metadata fuente contaminado.
