# T2CA — DCTS · Primary-source access batch 002

## Estado

**Fase no admisiva · evidencia primaria lista para revisión.**

T2CA continúa T2BD sin modificar AcademicProgramAuthority ni la admisión de ninguna obra.

El Doctorado en Ciudad, Territorio y Sustentabilidad continúa:

`program:udg:doc-ciudad-territorio-sustentabilidad → REVIEW`

y sus **152 obras permanecen REVIEW**.

## Objetivo

T2BD dejó el batch `urban-territory-001` bloqueado porque sus siete PDFs oficiales aparecen como `Restricted Access`.

T2CA no reabre ese lote. En su lugar selecciona un nuevo batch cuyos registros institucionales actuales sí exponen la tesis oficial mediante `View/Open`.

La selección se limita a comprobar **disponibilidad de fuente primaria**. No convierte título, abstract ni metadata en decisión disciplinaria.

## Batch 002

Batch:

`urban-territory-002`

Contiene dos obras:

### `thesis:work:00024461`

- Handle: `20.500.12104/84204`
- Autor: Ariel García Núñez
- Título: *Mecanismos sociales en el hábitat popular latinoamericano. Metateoría, teoría y explicación.*
- Fichero oficial: `DCUAAD10072FT.pdf`
- Tamaño informado por RIUdeG: 3.72 MB
- RIUdeG muestra: `View/Open`
- el visor oficial abre sin solicitar contraseña durante la auditoría de acceso.

### `thesis:work:00024462`

- Handle: `20.500.12104/84205`
- Autor: Susana Gutiérrez Luna
- Título: *El borde fronterizo como espacio público. Caso de estudio: Ciudad Juárez y El Paso, Tx.*
- Fichero oficial: `DCUAAD10073FT.pdf`
- Tamaño informado por RIUdeG: 11.87 MB
- RIUdeG muestra: `View/Open`
- el visor oficial abre sin solicitar contraseña durante la auditoría de acceso.

Fuentes institucionales:

- https://www.riudg.udg.mx/handle/20.500.12104/84204
- https://www.riudg.udg.mx/handle/20.500.12104/84205

## Caso excluido del batch

Se auditó también:

`thesis:work:00024463`

Handle:

`20.500.12104/84206`

La ficha RIUdeG muestra `DCUAAD10074FT.pdf` como `View/Open`, pero el visor oficial solicita contraseña.

Por ello T2CA **no** lo registra como `available` y no lo incorpora al batch 002.

Este caso confirma que el texto `View/Open` de la ficha no se toma por sí solo como prueba suficiente de revisabilidad.

## Estado de adjudicación

Las dos obras del batch se registran como:

`primarySourceAccess = available`

pero todavía:

`candidateDecision = null`

El builder deriva:

`adjudicationState = candidate-evidence-ready`

Esto significa únicamente:

> existe una fuente primaria institucional accesible que puede ser revisada en una fase posterior.

No significa INCLUDE, EXCLUDE ni siquiera una candidata disciplinaria.

## Restricción epistemológica

T2CA no decide por:

- título;
- abstract;
- keywords;
- similitud semántica;
- embedding;
- clasificación de modelo;
- pertenencia a CUAAD;
- nombre del programa.

La decisión futura requiere revisión del texto oficial y juicio humano sobre:

- objeto de investigación;
- método;
- encuadre disciplinario;
- estructura argumentativa;
- fuentes y aparato conceptual.

## Conteos

El effective corpus publicado en T2BZ permanece:

- 561 INCLUDE;
- 193 REVIEW;
- 18,971 QUARANTINE;
- 7,849 EXCLUDE;
- 2 REJECT_SOURCE;
- 27,576 total.

Work Review permanece:

- 4 programas observados;
- 180 obras pendientes;
- 1 obra ya resuelta explícitamente.

DCTS permanece:

- 152 obras;
- 152 REVIEW;
- 152 pendientes de decisión primaria.

El batch 002 sólo mejora el **estado de disponibilidad de evidencia** para dos de ellas.

## Próximo paso

La fase posterior debe revisar el full text oficial de las dos obras y registrar, para cada una por separado:

1. hash SHA-256 del PDF;
2. número de páginas;
3. objeto de investigación;
4. método;
5. marco conceptual/disciplinario;
6. racional explícito;
7. una de:
   - `include-candidate`;
   - `exclude-candidate`;
   - `retain-review`.

Hasta entonces no se solicita ningún cambio de admission.
