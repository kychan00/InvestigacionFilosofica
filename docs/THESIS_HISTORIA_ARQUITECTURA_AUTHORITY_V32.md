# T2AZ — Maestría en Historia de la Arquitectura Mexicana · Program Authority V32

## Decisión

**INCLUDE bajo `humanities-only`.**

Autoridad:

`program:udg:mae-historia-arquitectura-mexicana-historica`

Nombre:

`Maestría en Historia de la Arquitectura Mexicana`

Unidad:

`CUAAD`

Obras observadas:

**4 tesis**

Años:

**2004–2009**

---

## 1. Evidencia administrativa

Control Escolar de la Universidad de Guadalajara mantiene una clave propia:

`261508 — Maestría en Historia de la Arquitectura Mexicana`

La clave aparece separada de:

- Maestría en Historia;
- Maestría en Historia de México;
- Maestría en Ciencias de la Arquitectura;
- otras maestrías arquitectónicas.

Eso permite conservar esta autoridad histórica como entidad administrativa
específica y evita fusionarla por similitud nominal.

Fuentes:

- https://escolar.udg.mx/sites/default/files/Claves_Carrera_de_Mstrias_2_0.pdf
- https://escolar.udg.mx/sites/default/files/Maestrias.pdf

---

## 2. Evidencia de lineage

CUAAD documenta que la Maestría en Ciencias de la Arquitectura fue creada en
1995 y modificada en 1999 con varias orientaciones, incluida:

`Historia de la Arquitectura Mexicana`

En la reapertura de 2003 permanecieron dos orientaciones:

- Historia de la Arquitectura Mexicana;
- Conservación del Patrimonio Edificado.

La convocatoria 2026 mantiene ambas líneas.

Fuentes:

- https://cuaad.udg.mx/?q=oferta%2Fposgrados%2Fmaestrias%2Fmca%2Fantecedentes-historicos
- https://cuaad.udg.mx/sites/default/files/convocatoria_mca_2026_informacion.pdf

La autoridad histórica conserva:

`possibleSuccessorRef = program:udg:mae-ciencias-arquitectura`

pero V32 **no fusiona** ambas autoridades.

---

## 3. Por qué INCLUDE

La identidad de la autoridad histórica es específicamente:

`Historia de la Arquitectura Mexicana`

La orientación institucional vigente está compuesta por formación en:

- historia de la arquitectura prehispánica;
- arquitectura mexicana de los siglos XVI, XVII, XVIII, XIX y XX;
- tratadistas;
- análisis de edificios;
- centros históricos;
- datación de estilos y corrientes;
- arquitectura vernácula;
- análisis de documentos históricos;
- barroco;
- arte medieval;
- semiótica.

Fuente:

- https://cuaad.udg.mx/oferta/maestrias/mca/plan-de-estudios

La pertenencia a CUAAD o al área administrativa Arte, Arquitectura y Diseño no
prevalece sobre esta identidad programática específica de historia.

---

## 4. Corpus exacto

El frozen corpus contiene cuatro obras con:

`programRaw = Maestría En Historia De La Arquitectura Mexicana`

Todas:

- CUAAD;
- Metadata Confidence permitido;
- sin bloqueos;
- fechas válidas.

Años:

- 2004;
- 2005;
- 2008;
- 2009.

RIUdeG conserva además el grado exacto en registros individuales.

Ejemplo:

- https://www.riudg.udg.mx/handle/20.500.12104/73111?mode=full

---

## 5. Separación respecto a Ciencias de la Arquitectura

V32 **no cambia**:

`program:udg:mae-ciencias-arquitectura`

Permanece:

`REVIEW`

Obras observadas:

**112**

Motivo: la autoridad base mezcla:

- Historia de la Arquitectura Mexicana;
- Conservación del Patrimonio Edificado;
- Edificación Arquitectónica;
- Urbanismo y Desarrollo;
- Arte y Comunicación;
- Teoría y Crítica;
- registros sin orientación explícita.

No se propaga un INCLUDE de la orientación histórica al programa completo.

También permanece REVIEW:

`program:udg:mae-conservacion-patrimonio-edificado-historica`

con **5 tesis**.

---

## 6. Proyección global V32

V31:

- INCLUDE: 429;
- REVIEW: 691;
- QUARANTINE: 18,964;
- EXCLUDE: 7,490;
- REJECT_SOURCE: 2.

Movimiento:

`REVIEW → INCLUDE: 4`

V32:

- INCLUDE: **433**;
- REVIEW: **687**;
- QUARANTINE: **18,964**;
- EXCLUDE: **7,490**;
- REJECT_SOURCE: **2**.

Total:

**27,576**.

---

## 7. Scope Matrix

Scope Policy permanece:

`2026-11-02.v4`

No se agrega una fila nueva porque esta autoridad no formaba parte del contrato
de boundary-review de la Scope Matrix. La decisión se resuelve directamente en
AcademicProgramAuthority.

Boundary Closure continúa:

- 3 filas;
- 4 programas;
- 191 tesis REVIEW.

---

## 8. Guardrails

T2AZ debe demostrar:

- exactamente 4 tesis bajo la autoridad histórica;
- 0 bloqueos Metadata Confidence V4;
- 4 INCLUDE;
- 112 obras de Ciencias de la Arquitectura siguen REVIEW;
- 5 obras históricas de Conservación siguen REVIEW;
- Scope Policy V4 permanece estable;
- V25–V31 mantienen su significado histórico.

---

## 9. Resultado

Program Authority:

`2026-11-02.v32`

T2AZ resuelve una autoridad histórica genuinamente humanística sin convertir
toda la familia arquitectónica en Humanidades.
