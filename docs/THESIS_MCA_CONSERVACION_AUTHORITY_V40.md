# T2BJ — MCA / Orientación en Conservación del Patrimonio Edificado / Program Authority V40

## Decisión

T2BJ separa una autoridad granular para:

`program:udg:mae-ciencias-arquitectura-conservacion-patrimonio-edificado`

y resuelve:

`REVIEW → INCLUDE`

para **35 obras** que nombran explícitamente la orientación Conservación del Patrimonio Edificado.

La autoridad base:

`program:udg:mae-ciencias-arquitectura`

permanece `REVIEW`.

La decisión es programática y no depende del título, abstract, keywords, embeddings, similitud semántica o contenido temático de ninguna tesis.

## Identidad institucional y granularidad

CUAAD documenta que la Maestría en Ciencias de la Arquitectura fue creada en 1995 y modificada en 1999 para operar con orientaciones, con efecto retroactivo a 1995 B. Conservación del Patrimonio Edificado fue una de esas orientaciones.

En 2003 se reabrió la maestría únicamente con dos orientaciones:

- Historia de la Arquitectura Mexicana;
- Conservación del Patrimonio Edificado.

La propia presentación vigente indica que ambas son **terminales u orientaciones**, desarrolladas desde un tronco común, **cada una con su propio programa**.

Fuentes:

- https://cuaad.udg.mx/?q=oferta%2Fposgrados%2Fmaestrias%2Fmca%2Fantecedentes-historicos
- https://cuaad.udg.mx/node/21768
- https://ww1.udg.mx/es/oferta-academica/posgrados/maestrias/maestria-en-ciencias-de-la-arquitectura

Este criterio es simétrico con V37, que ya separó la orientación Historia de la Arquitectura Mexicana.

## Evidencia curricular

La convocatoria MCA 2026–2028 identifica de forma explícita las dos orientaciones y asigna a Conservación del Patrimonio Edificado un trayecto especializante propio.

La orientación incluye:

- Arqueología;
- Historia y Teoría de la Conservación I;
- Historia y Teoría de la Conservación II;
- Metodología de la Conservación;
- Talleres de Proyectos de Conservación;
- Talleres de Conservación Urbana;
- Conservación de Materiales;
- Técnicas y Procedimientos de Conservación;
- Restauración de Edificios;
- Taller de Proyectos de Restauración.

El plan permite además optativas como:

- Análisis de Documentos Históricos;
- Barroco;
- Historia de la Arquitectura en Guadalajara;
- Neoclásico;
- Arte Medieval;
- Semiótica.

Fuentes:

- https://cuaad.udg.mx/oferta/maestrias/mca/plan-de-estudios
- https://cuaad.udg.mx/sites/default/files/convocatoria_mca_2026_informacion.pdf

El perfil de ingreso contempla historiadores y profesionales de ciencias sociales y humanidades, con interés en historia, arquitectura y conservación patrimonial. El perfil de egreso forma investigadores para proyectos de conservación, restauración patrimonial e historia de la arquitectura.

Fuentes:

- https://cuaad.udg.mx/index.php/oferta/maestrias/mca/perfil-de-ingreso
- https://cuaad.udg.mx/index.php/oferta/maestrias/mca/perfil-de-egreso

## Relación con V35

V35 resolvió como autoridad histórica separada:

`Maestría en Conservación del Patrimonio Edificado`

con **5 obras INCLUDE**.

V40 **no la fusiona** con la orientación MCA. Los dos nombres coexisten en el corpus y conservan autoridades distintas.

La existencia del linaje temático/institucional no convierte una etiqueta en alias de la otra.

## Full inventory V39

Dentro de la autoridad base MCA se detectaron **35 obras** cuyas etiquetas de grado nombran explícitamente Conservación del Patrimonio Edificado.

- CUAAD: **35**;
- RIUdeG: **35**;
- Metadata Confidence: **35 unassessed**;
- authority applicability: **35 allowed**;
- blockers: **0**;
- admission anterior: **35 REVIEW**;
- Tesis de Maestría: **35**.

Fechas:

- valid: **31**;
- suspicious: **1**;
- unknown: **3**;
- rango válido: **1998–2015**.

El valor sospechoso es `0000`; no se interpreta como fecha histórica.

Las 35 obras se distribuyen en **14 variantes crudas exactas** y **10 normalized keys**. Todas las variantes trasladadas nombran explícitamente Conservación del Patrimonio Edificado; no hay fuzzy matching.

## Base MCA después del split

La autoridad base pasa de:

- 96 obras REVIEW

a:

- **61 obras REVIEW**.

Permanecen en la autoridad base:

- 34 obras sin orientación explícita;
- Arte y Comunicación;
- Urbanismo y Desarrollo;
- Edificación Arquitectónica;
- Teoría y Crítica de la Arquitectura.

No se decide ninguna de esas líneas mediante el resultado de Conservación.

## Delta V40

`REVIEW → INCLUDE: 35`

Proyección global:

- INCLUDE: **532**;
- REVIEW: **288**;
- QUARANTINE: **18,964**;
- EXCLUDE: **7,790**;
- REJECT_SOURCE: **2**;
- total: **27,576**.

## Humanities Action Queue esperada

Las 35 obras de Conservación ocupaban **10 normalized groups** de la cola actionable. V40 debe retirarlos todos.

Esperado:

- humanitiesActionQueueItems: **23**;
- humanitiesActionWorks: **136**;
- workReviewQueueItems: **1**;
- workReviewWorks: **152**.

Siguiente acción:

**Maestría en Ciencias de la Arquitectura**

- normalized key: `maestria en ciencias de la arquitectura`;
- works: **34**.

## Políticas preservadas

- Program Authority: `2026-11-02.v40`;
- Scope Policy: `2026-11-02.v5`;
- Metadata Confidence: `2026-11-02.v4`;
- DCTS Work Review: `2026-11-02.urban-v1`.

Boundary Closure V5 debe permanecer:

- 3 rows;
- 3 program keys;
- 157 authority works;
- 3 REVIEW;
- 0 violations.

## Guardrails

1. No usar títulos de tesis para justificar INCLUDE.
2. No fusionar la autoridad histórica standalone con la orientación MCA.
3. No propagar INCLUDE a la autoridad base.
4. No propagar INCLUDE a Arte y Comunicación, Urbanismo, Edificación o Teoría/Crítica.
5. No usar fuzzy aliases.
6. No modificar Scope Policy V5.
7. No modificar Metadata Confidence V4.
8. Mantener `0000` como fecha sospechosa.
