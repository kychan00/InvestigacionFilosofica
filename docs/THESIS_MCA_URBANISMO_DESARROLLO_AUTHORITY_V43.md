# T2BO — MCA / orientación histórica Urbanismo y Desarrollo · Program Authority V43

## Alcance y pregunta

El buscador de tesis UdeG admite únicamente programas de **Humanidades**, cualquiera que
sea el nivel académico. Esta fase decide **sólo** la orientación histórica de
*Maestría en Ciencias de la Arquitectura, Urbanismo y Desarrollo*.
No se infiere admisión por centro universitario, títulos o palabras clave de tesis.

## Identidad institucional de la orientación

1. **Dictamen original de creación y reforma**. El [Dictamen I/2015/756 UdeG
   (antecedentes, foja 1)](https://cuaad.udg.mx/sites/default/files/adjuntos/dictamen_mca.pdf)
   reproduce el dato de creación del programa MCA por el dictamen
   **021/20689 del 15 de diciembre de 1995**, con orientaciones que incluyen
   **Urbanismo y Desarrollo**, desde **1996 A**. También registra la reforma
   **I/99/722 del 3 de marzo de 1999** con dicha orientación.
   El [historial oficial de CUAAD](https://cuaad.udg.mx/?q=oferta%2Fposgrados%2Fmaestrias%2Fmca%2Fantecedentes-historicos)
   señala que, en la reapertura de 2003, sólo se ofertaron Historia de la Arquitectura
   Mexicana y Conservación del Patrimonio Edificado y que se suprimieron las demás
   orientaciones en la modificación para **2006 B**.
2. **Cuarto Informe de Actividades 1998–1999** de UdeG
   ([anexo 3.b, oferta de posgrado](https://cgpe.udg.mx/sites/default/files/adjuntos/4_informe_1998-1999.pdf)).
   La tabla muestra **Ciencias de la Arquitectura** como maestría y
   **Urbanismo y Desarrollo** bajo la columna **Áreas terminales** del CUAAD.
   Es evidencia directa de pertenencia al programa MCA, no de una maestría
   independiente ni de una orientación de Humanidades.
   El anexo sobre investigación del CUAAD documenta por separado
   investigación en **planeamiento, políticas de ordenamiento urbano,
   urbanización, infraestructura, reservas y ordenamiento ecológico**.
   Estos son antecedentes **contextuales del centro**: no se presentan
   como si fueran el plan curricular específico de la orientación.
3. **Control Escolar UdeG**,
   [Catálogo de Carreras de Maestrías, número 55](https://escolar.udg.mx/sites/default/files/adjuntos/claves_carrera_de_mstrias_2_0.pdf):
   identidad formal exacta
   «Maestría en Ciencias de la Arquitectura Orientación en Urbanismo y Desarrollo»,
   **clave DGP 511598**.

## Distinción crítica de programas homónimos

CUAAD también registra otra **Maestría en Urbanismo y Desarrollo** como
**programa educativo independiente** de MCA
([ProDES/PIFI 2006–2007](https://cgpe.udg.mx/sites/default/files/1_prodes_cuaad_1.pdf)).
Aunque ambas pertenecen a un campo urbanístico, no se conoce aquí
equivalencia jurídica entre sus claves, cohortes y planes de estudio.
Esta auditoría **no crea un alias entre ambas**, ni equipara la posterior
Maestría en Urbanismo y Territorio con la orientación histórica.

## Interpretación y decisión de scope

**Distinguimos evidencia de interpretación.** La evidencia primaria demuestra
identidad MCA, especialidad formal en urbanismo, años de vigencia y
organización institucional. La inferencia disciplinaria de la revisión
es que una **orientación de urbanismo, desarrollo y ordenamiento territorial
dentro de Ciencias de la Arquitectura** corresponde ante todo a un campo
aplicado de planeación y desarrollo de ciudad, fuera del núcleo estricto
de Historia, Filosofía, Letras, Antropología, Lingüística y estudios
culturales que delimita `humanities-only`.

La presencia posible de investigación histórica, social, cultural o filosófica
en tesis de urbanismo no reetiqueta la **autoridad programática completa**,
ni autoriza usar títulos/resúmenes de tesis como puerta de admisión.
Frente a la orientación **Historia de la Arquitectura Mexicana** o
**Teoría y Crítica de la Arquitectura**, Urbanismo y Desarrollo cuenta
con una identidad administrativa y disciplinaria distinta.

**Decisión propuesta V43:** cambiar sólo
`program:udg:mae-ciencias-arquitectura-urbanismo-desarrollo`:
**8 REVIEW → EXCLUDE**, sobre sus alias exactos observados,
CUAAD, **2000–2006**.

El full congelado verificó **tres variantes textuales y tres claves
normalizadas**, todos los registros con `authorityApplicability=allowed`:

- `Maestría En Arquitectura; Orientacion Urbanismo Y Desarrollo`: **6**;
- `Maestría En Arquitectura, Orientacion En Urbanismo Y Desarrollo`: **1**;
- `Maestría En Ciencias De La Arquitectura, Orientación Urbanismo Y Desarrollo`: **1**.

No se incorporan otros nombres de Urbanismo o Arquitectura por semejanza.
Las frecuencias se prueban en V43 como contrato exacto.


Esta decisión no afirma haber recuperado el plan completo original
I/99/722 con materias y anexos; el fundamento es la especialidad
identificada directamente por documentos oficiales, la adscripción
a Ciencias de la Arquitectura y la disciplina que designa.

## Preservaciones y seguridad

- **Arte y Comunicación**: 13 obras siguen REVIEW con HOLD documental
  T2BL/T2BM; no se reabre por similitud histórica.
- **Teoría y Crítica de la Arquitectura**: 1 obra permanece REVIEW.
- **Edificación Arquitectónica** y las demás orientaciones conservan
  sus propias autoridades.
- **Historia de la Arquitectura Mexicana** / **Conservación del Patrimonio
  Edificado** mantienen sus admisiones ya validadas.
- **MCA genérica 2006 B+**, Maestría independiente en Urbanismo y Desarrollo,
  y actual Maestría en Urbanismo y Territorio, sin cambios.
- **Scope Policy V5**, **Metadata Confidence V5** y **DCTS work-level 1/152**:
  sin cambios.

## Contrato full proyectado

Corte V42: **559 INCLUDE · 238 REVIEW · 18,971 QUARANTINE ·
7,806 EXCLUDE · 2 REJECT_SOURCE = 27,576**.

Propuesta V43 condicionada a CI full:
**559 INCLUDE · 230 REVIEW · 18,971 QUARANTINE ·
7,814 EXCLUDE · 2 REJECT_SOURCE = 27,576**.

La cola Humanidades pasaría de 18 grupos / 86 obras a
**15 grupos / 78 obras**; espera T2BL 5 grupos / 13;
cola lista **10 grupos / 65**. Estos valores son hipótesis
del contrato hasta verificar el full congelado de 27,576 tesis.

El baseline y las pruebas automatizadas deben demostrar
`8/8` authority applicability, distribución de alias,
años, ausencia de interferencias con orientaciones vecinas y
ausencia de variaciones en las políticas o total de corpus.

## Continuidad

El nuevo `nextHumanitiesReadyAction`, observado tras V43, apunta a la
**orientación histórica Edificación Arquitectónica** de la MCA:
`program:udg:mae-ciencias-arquitectura-edificacion-arquitectonica`.
Primer grupo: **2 tesis**, en REVIEW; autoridad completa: **5**.
Su decisión necesita una auditoría propia, sin heredar la exclusión de Urbanismo.
