# T2BE — Maestría en Conservación del Patrimonio Edificado · Program Authority V35

## Decisión

**INCLUDE bajo `humanities-only`.**

Autoridad:

`program:udg:mae-conservacion-patrimonio-edificado-historica`

Nombre:

**Maestría en Conservación del Patrimonio Edificado**

Unidad:

**CUAAD**

Obras observadas:

**5 tesis**

Años válidos:

**2006–2014**

La autoridad histórica permanece separada de la Maestría en Ciencias de la Arquitectura.

---

## 1. Identidad histórica

RIUdeG conserva cinco tesis cuyo grado fue registrado como:

`Maestría en Conservación del Patrimonio Edificado`

La denominación standalone se conserva como autoridad propia porque el repositorio institucional la registra explícitamente y no se debe convertir retrospectivamente en un alias de la oferta vigente.

Ejemplo institucional:

https://www.riudg.udg.mx/handle/20.500.12104/73084?mode=full

T2BE conserva:

`possibleSuccessorRef = program:udg:mae-ciencias-arquitectura`

pero **no crea alias** entre ambas autoridades.

---

## 2. Lineage institucional

CUAAD documenta:

- creación de la Maestría en Ciencias de la Arquitectura en 1995;
- modificación en 1999 con varias orientaciones;
- entre ellas, Conservación del Patrimonio Edificado;
- reapertura en 2003 con sólo dos orientaciones:
  - Historia de la Arquitectura Mexicana;
  - Conservación del Patrimonio Edificado.

Fuente:

https://cuaad.udg.mx/?q=oferta%2Fposgrados%2Fmaestrias%2Fmca%2Fantecedentes-historicos

La oferta vigente mantiene Conservación del Patrimonio Edificado como una de las dos líneas principales del programa.

Fuentes:

- https://ww1.udg.mx/es/oferta-academica/posgrados/maestrias/maestria-en-ciencias-de-la-arquitectura
- https://cuaad.udg.mx/sites/default/files/convocatoria_mca_2026_informacion.pdf

---

## 3. Evidencia humanística específica

La decisión V35 no se deriva del término “patrimonio” ni de la pertenencia a CUAAD.

### 3.1 Adscripción

Documentación institucional de CUAAD ubica la coordinación de la Maestría en Ciencias de la Arquitectura dentro de la:

**División de Artes y Humanidades**.

Fuente:

https://cuaad.udg.mx/sites/default/files/directorio_ext_0_0_0_0.pdf

La revista institucional **Historia y Conservación del Patrimonio Edificado**, editada a través de la Maestría en Ciencias de la Arquitectura, también declara su adscripción a la División de Artes y Humanidades.

### 3.2 Orientación de investigación

La UdeG identifica el programa como maestría de investigación y establece como líneas:

- Historia de la Arquitectura Mexicana;
- Conservación del Patrimonio Edificado.

Sus objetivos incluyen investigación crítico-teórica sobre el espacio habitable y construido, además de conservación y restauración patrimonial.

### 3.3 Plan de estudios

La orientación en Conservación del Patrimonio Edificado integra:

- Arqueología;
- Historia y Teoría de la Conservación I;
- Historia y Teoría de la Conservación II;
- Metodología de la Conservación;
- Análisis de Documentos Históricos;
- Barroco;
- Historia de la Arquitectura en Guadalajara;
- Neoclásico;
- Seminario de Arte Medieval;
- Semiótica.

También contiene talleres, conservación de materiales, técnicas y procedimientos de conservación y restauración.

Fuente:

https://cuaad.udg.mx/oferta/maestrias/mca/plan-de-estudios

La existencia de componentes técnico-restaurativos no elimina la identidad humanística de la autoridad histórica específica: el objeto de estudio es patrimonio cultural construido, articulado mediante historia, teoría, arqueología, análisis documental y crítica.

---

## 4. Relación con V32

T2AZ/V32 resolvió:

`program:udg:mae-historia-arquitectura-mexicana-historica → INCLUDE`

por la identidad histórica específica de esa autoridad.

T2BE aplica el mismo principio de granularidad:

- no se clasifica toda la Maestría en Ciencias de la Arquitectura como Humanidades;
- se resuelve únicamente la autoridad histórica específica de Conservación del Patrimonio Edificado.

La autoridad base:

`program:udg:mae-ciencias-arquitectura`

permanece:

`REVIEW`

con **112 obras**.

Motivo:

la autoridad base reúne orientaciones heterogéneas y registros sin orientación explícita, incluyendo historia, conservación, edificación, urbanismo, arte/comunicación y teoría/crítica.

---

## 5. Corpus exacto

El frozen corpus contiene cinco obras con la denominación standalone:

- 5 CUAAD;
- 5 Metadata Confidence `unassessed`;
- 5 authority applicability `allowed`;
- 0 blocked;
- 4 fechas válidas;
- 1 fecha sin valor utilizable;
- años válidos 2006–2014.

Variantes:

- `Maestría En Conservación Del Patrimonio Edificado`: 4;
- `Maestría En Conservacion Del Patrimonio Edificado`: 1.

T2BE no usa los títulos ni abstracts de estas tesis para decidir admission.

---

## 6. Movimiento esperado

V34/T2BD:

- INCLUDE: 474;
- REVIEW: 646;
- QUARANTINE: 18,964;
- EXCLUDE: 7,490;
- REJECT_SOURCE: 2.

Movimiento V35:

`REVIEW → INCLUDE: 5`

Resultado esperado:

- INCLUDE: **479**;
- REVIEW: **641**;
- QUARANTINE: **18,964**;
- EXCLUDE: **7,490**;
- REJECT_SOURCE: **2**;
- total: **27,576**.

---

## 7. Program Curation Queue esperada

Después de resolver esta autoridad:

- humanities action programs: **40**;
- humanities action works: **489**;
- DCTS permanece en work-level review:
  - 1 programa;
  - 152 tesis.

La diferencia adicional de una obra frente al conteo histórico T2BD proviene de:

`Doctorado en Antropología Social`

La obra `thesis:work:00016567` tiene:

- `institutionRaw = El Colegio de Michoacán A.C.`;
- `admissionStatus = exclude`;
- `admissionExplanationCodes = external-institution`.

La cola actual reproyectada la omite correctamente de `humanitiesActionItems`. No se fuerza su regreso para conservar un conteo histórico.

Siguiente autoridad programática:

**Maestría en Investigación Educativa**

- normalized key: `maestria en investigacion educativa`;
- works: **34**.

---

## 8. Invariantes

T2BE debe demostrar:

1. exactamente 5 obras bajo la autoridad histórica;
2. las 5 pasan a INCLUDE;
3. 0 blockers;
4. las 112 obras de Ciencias de la Arquitectura siguen REVIEW;
5. las 4 obras históricas de Historia de la Arquitectura Mexicana siguen INCLUDE;
6. no se crea alias entre la autoridad histórica y Ciencias de la Arquitectura;
7. `possibleSuccessorRef` permanece;
8. Scope Policy sigue V4;
9. Metadata Confidence sigue V4;
10. DCTS sigue en work-level review con 152 obras.

---

## 9. Principio resultante

La clasificación administrativa general:

`Arte, Arquitectura y Diseño`

no basta para excluir una autoridad cuya identidad programática específica y documentación institucional muestran una formación histórico-patrimonial adscrita a Artes y Humanidades.

A la inversa, el INCLUDE de esta autoridad específica **no se propaga** a toda la familia arquitectónica.

La unidad de decisión permanece:

**AcademicProgramAuthority + evidencia institucional específica.**
