# T2CX — Recuperación nominal de títulos de tesis MEF

**Fecha:** 5 de noviembre de 2026  
**Programa:** `program:udg:mae-estudios-filosoficos`  
**Base:** T2CW / PR #188

## Objetivo

T2CX continúa el ledger nominal T2CW sin volver a interpretar el agregado de 45
grados de Control Escolar como 45 tesis. La unidad de investigación sigue siendo
la **persona egresada confirmada**, pero esta fase separa cuatro hechos:

1. identidad de egresado;
2. tema de tesis;
3. título exacto de tesis;
4. identidad institucional work-level / holding físico.

La recuperación de un título exacto no crea por sí sola una ficha pública, un
handle, un SYS Aleph ni un holding.

## Resultado

El ledger T2CX conserva las nueve identidades T2CW y produce:

- **9** egresados nominales;
- **2** títulos exactos de tesis recuperados;
- **0** casos que permanezcan sólo como tema;
- **7** egresados sin título exacto;
- **0** identidades institucionales work-level confirmadas nuevas;
- **0** holdings físicos nuevos;
- **0** fichas públicas nuevas.

La vista pública y Effective Corpus V2 no se modifican.

## Hallazgo nuevo — Joaquín Galindo Castañeda

T2CW sólo podía afirmar que Joaquín Galindo realizó una tesis **sobre argumentos
trascendentales y lógicas modales**, porque el perfil institucional del Instituto
de Investigaciones Filosóficas de la UNAM usa una formulación temática.

T2CX recupera una fuente más precisa: el CV de **Fernando Leal Carretero**,
director de la tesis. Allí se registra explícitamente:

- autor: Joaquín Galindo Castañeda;
- programa: Maestría en Estudios Filosóficos, Universidad de Guadalajara;
- título: **Argumentos transcendentales y lógica modal**;
- presentada y aprobada: **15 de julio de 2013**.

Fuentes:

- https://www.academia.edu/108518083/CVU_Fernando_Leal_octubre_2023
- https://www.filosoficas.unam.mx/sitio/joaquin-galindo

### Regla de transcripción

Se conserva la grafía exacta del CV del director: **transcendentales** y
**lógica modal** en singular. La formulación institucional de UNAM
“Argumentos trascendentales y lógicas modales” permanece como descripción
temática/corroboración, no como sustituto silencioso del título.

### Estado resultante

Joaquín pasa de:

- `thesis-topic-confirmed`

a:

- `exact-title-pending-institutional`.

Esto **no** equivale a `institutional-work-confirmed`, porque aún no se ha
recuperado un registro work-level UdeG, un handle RIUdeG, un SYS Aleph o un
identificador institucional equivalente.

## Ángel Adrián González Delgado

Se conserva el título exacto ya recuperado en T2CW:

**Acercamiento a la Argumentación de Dilemas Morales en la Práctica Médica**

y el año 2010, a partir del CV controlado por el autor:

- https://uan.academia.edu/AngelAdrianGd/CurriculumVitae

La publicación posterior en `Quadripartita Ratio` documenta el linaje del
proyecto, pero no sustituye el título de tesis:

- https://www.quadripartitaratio.cucsh.udg.mx/index.php/QR/article/view/64

Ángel permanece en `exact-title-pending-institutional` hasta obtener identidad
work-level institucional.

## Casos que no se promovieron

### Cicerón Muro Cabral

Su perfil autoral confirma que es Maestro en Estudios Filosóficos y que su tesis
recibió recomendación de publicación. No expone el título exacto.

La evidencia mejora la certeza de que hubo tesis, pero no autoriza inventar el
título ni identificar una publicación posterior como la tesis.

### Dinora Hernández López

El informe institucional CUCSH lista el libro:

**Elementos de filosofía moral negativa: violencia, vulnerabilidad y diferencia**

bajo la dependencia **Maestría en Estudios Filosóficos**.

Sin embargo, la tabla es un inventario de **libros publicados** y no declara que
ese libro sea la tesis de maestría de Dinora. T2CX lo conserva únicamente como
`publicationCandidate`; no lo proyecta a `exactThesisTitle`.

Fuentes:

- https://www.cucsh.udg.mx/profesores/dinora-hernandez-lopez
- https://www.cucsh.udg.mx/sites/default/files/2023-05/cuarto-informe-dr.-juan-manuel-duran-juarez-rector-del-cucsh.pdf

### Laura Aritmética Jaime, Uriel Nuño Gutiérrez, Sofía Gutiérrez Pérez,
### Dorian Hernández Vázquez y María Alejandra Escobar Velázquez

Se conserva la evidencia de grado de T2CW. La búsqueda realizada en T2CX no
recuperó un título exacto suficientemente sustentado. Sus publicaciones, perfiles
temáticos o trabajos posteriores no se convierten en tesis por inferencia.

## Contrato del ledger T2CX

Archivo:

`scripts/thesis/config/mef-thesis-title-recovery-t2cx.json`

Cada registro expone:

- `graduateIdentityConfirmed`
- `graduationYear`
- `thesisTopic`
- `exactThesisTitle`
- `exactTitleEvidence`
- `institutionalWorkIdentityConfirmed`
- `catalogIdentifier`
- `handle`
- `alephSystemNumber`
- `physicalHoldingConfirmed`
- `decision`
- `reviewNotes`

Decisiones permitidas:

- `graduate-only`
- `topic-only`
- `exact-title-pending-institutional`
- `institutional-work-confirmed`
- `physical-holding-confirmed`
- `conflict`
- `unresolved`

## Guards

El validador impide, entre otras cosas:

- convertir los 45 grados agregados en identidades nominales;
- convertir un libro o publicación candidata en título de tesis sin evidencia exacta;
- tratar un título de CV como identidad institucional automática;
- persistir handle, SYS o identificador de catálogo mientras la identidad
  institucional siga sin confirmar;
- afirmar holding físico sin identidad institucional, SYS Aleph y evidencia de holdings;
- almacenar rutas locales, bitstreams o endpoints de descarga;
- crear fichas públicas desde esta fase.

## Siguiente paso

La prioridad deja de ser “adivinar” más títulos y pasa a dos rutas paralelas:

1. buscar **identidad work-level institucional** para Ángel Adrián González
   Delgado y Joaquín Galindo Castañeda en OPAC/Aleph, RIUdeG, informes o
   catálogos UdeG;
2. continuar la recuperación nominal de títulos para los siete egresados que
   permanecen en `graduate-only`.

Sólo una coincidencia con autor + título + programa e identificador institucional
estable podrá promoverse a `institutional-work-confirmed`.
