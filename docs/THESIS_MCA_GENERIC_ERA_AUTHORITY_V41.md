# T2BK — MCA genérica / etapa institucional segura / Program Authority V41 + Metadata Confidence V5

## Regla de alcance

El corpus objetivo es **exclusivamente Humanidades**.

Por ello, una etiqueta genérica como:

`Maestría en Ciencias de la Arquitectura`

no puede heredar automáticamente la admisión de una orientación concreta si el registro no permite situarlo en una etapa institucional donde todas las orientaciones posibles estén dentro del target.

No se usa el título, abstract, keywords, embeddings, similitud semántica ni el tema de la tesis para reconstruir una orientación faltante.

## Evidencia institucional

CUAAD documenta tres momentos relevantes:

1. creación de la MCA en 1995;
2. modificación de 1999 con varias orientaciones, entre ellas Historia de la Arquitectura Mexicana, Conservación del Patrimonio Edificado, Teoría y Crítica, Edificación Arquitectónica, Urbanismo y Desarrollo, Arte y Comunicación y Administración de Procesos;
3. reapertura en 2003 ofertando **sólo dos orientaciones**:
   - Historia de la Arquitectura Mexicana;
   - Conservación del Patrimonio Edificado.

Además, la actualización con efecto desde **2006 B** suprimió las demás orientaciones.

Fuente:

- https://cuaad.udg.mx/oferta/maestrias/mca/antecedentes-historicos

La presentación vigente confirma que el programa opera con dos terminales/orientaciones, cada una con su propio programa y un tronco común:

- Conservación del Patrimonio Edificado;
- Historia de la Arquitectura Mexicana.

Fuente:

- https://cuaad.udg.mx/node/21768

Ambas orientaciones ya fueron resueltas INCLUDE por autoridad programática separada en V37 y V40.

## Full inventory V40: etiqueta genérica

El corpus contiene **34 obras** cuya etiqueta de grado no especifica orientación:

- `Maestría En Ciencias De La Arquitectura`: **22**;
- `MAESTRIA EN CIENCIAS DE LA ARQUITECTURA`: **12**.

CUAAD: **34**.

Antes de V41:

- admission: **34 REVIEW**;
- Metadata Confidence: **34 unassessed**;
- authority applicability: **34 allowed**.

Calidad de fecha:

- valid: **29**;
- suspicious: **1**;
- unknown: **4**.

Entre las 29 fechas válidas:

- **27** pertenecen a 2008–2021;
- **2** pertenecen a 1998 y 2001.

La fecha sospechosa es `0000`.

## Decisión V41

### Cohorte institucional segura

Las **27 obras** con fecha válida entre 2008 y 2021 pueden aplicar la autoridad INCLUDE porque, para ese periodo, UdeG había suprimido las demás orientaciones y la MCA operaba únicamente con las dos orientaciones ya aceptadas en Humanidades.

Resultado:

`27 REVIEW → INCLUDE`

Esta inferencia es institucional y temporal, no temática.

### Cohorte no resoluble

Siete obras no cumplen el estándar:

- 2 con fecha válida anterior a 2003;
- 4 sin fecha emitida;
- 1 con `0000`.

En esos casos la etiqueta genérica no permite saber si pertenecían a Historia/Conservación o a alguna de las orientaciones históricas heterogéneas.

Metadata Confidence V5 bloquea exactamente esos siete `providerRecordId`:

- `oai:riudg.udg.mx:20.500.12104/46363`
- `oai:riudg.udg.mx:20.500.12104/46367`
- `oai:riudg.udg.mx:20.500.12104/46368`
- `oai:riudg.udg.mx:20.500.12104/73101`
- `oai:riudg.udg.mx:20.500.12104/73104`
- `oai:riudg.udg.mx:20.500.12104/73107`
- `oai:riudg.udg.mx:20.500.12104/73110`

Resultado:

`7 REVIEW → QUARANTINE`

Rule:

`riudg-mca-generic-orientation-period-unresolved-v1`

Confidence:

`low-trust / blocked`

## Separación de orientaciones históricas restantes

Para que el INCLUDE de la MCA genérica no se propague a programas que ya no forman parte de la configuración actual, V41 separa cuatro autoridades REVIEW:

- Arte y Comunicación: **13**;
- Urbanismo y Desarrollo: **8**;
- Edificación Arquitectónica: **5**;
- Teoría y Crítica de la Arquitectura: **1**.

Total:

**27 REVIEW**.

Estas autoridades deberán resolverse individualmente. Ninguna queda INCLUDE por parentesco con la MCA actual.

## Delta esperado

Desde V40:

- INCLUDE: **+27**;
- REVIEW: **−34**;
- QUARANTINE: **+7**.

Global V41:

- INCLUDE: **559**;
- REVIEW: **254**;
- QUARANTINE: **18,971**;
- EXCLUDE: **7,790**;
- REJECT_SOURCE: **2**;
- total: **27,576**.

## Metadata Confidence V5

Delta sobre V4:

- low-trust: **453 → 460**;
- unassessed: **27,091 → 27,084**;
- conflicted: **32** sin cambio;
- blocked: **485 → 492**;
- allowed: **27,091 → 27,084**.

Metadata Confidence sigue sin crear Program Authority: sólo impide aplicar una autoridad donde la metadata item-level no alcanza el estándar.

## Program Curation Queue

La etiqueta genérica MCA permanece visible, pero pasa a:

- queueState: `metadata-review`;
- curationLane: `metadata-confidence-review`;
- blockedWorks: **7**.

Por tanto deja de impulsar `humanitiesActionItems`.

Esperado:

- humanitiesActionQueueItems: **22**;
- humanitiesActionWorks: **102**;
- workReviewQueueItems: **1**;
- workReviewWorks: **152**.

Siguiente acción de Humanidades:

**Maestría en Ciencias de la Arquitectura, Orientación Arte y Comunicación**

Primer normalized key:

`maestria en arquitectura orientacion arte y comunicacion`

Works: **7**.

## Políticas preservadas

- Program Authority: `2026-11-02.v41`;
- Scope Policy: `2026-11-02.v5`;
- Metadata Confidence: `2026-11-02.v5`;
- DCTS Work Review: `2026-11-02.urban-v1`.

Boundary Closure debe permanecer:

- 3 rows;
- 3 program keys;
- 157 authority works;
- 3 REVIEW;
- 0 violations.

## Guardrails

1. Sólo Humanidades.
2. No usar contenido temático de tesis para reconstruir orientación.
3. No incluir registros genéricos pre-2003 o no fechables.
4. `0000` sigue siendo sentinel/fecha sospechosa.
5. No propagar INCLUDE a las orientaciones históricas restantes.
6. No fuzzy aliases.
7. No modificar Scope Policy V5.
8. No alterar DCTS.
