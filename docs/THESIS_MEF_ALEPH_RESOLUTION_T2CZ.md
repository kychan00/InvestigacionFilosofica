# T2CZ — Resolución institucional MEF contra Aleph/OPAC vivo

**Fecha:** 5 de noviembre de 2026  
**Programa:** `program:udg:mae-estudios-filosoficos`  
**Base:** T2CY / PR #190

## Objetivo

T2CY recuperó once tesis concluidas de la Maestría en Estudios Filosóficos con
título y fecha explícitos, pero ninguna posee todavía identidad work-level UdeG.

T2CZ reutiliza el contrato Aleph ya validado en T2CM–T2CR para preguntar al OPAC
vivo por esas once identidades. No cambia el corpus, Program Authority ni la
vista pública: produce únicamente un artifact reference-only para adjudicación.

## Contrato Aleph reutilizado

Endpoint de arranque CUCSH:

`http://148.202.248.73/F/?func=find-b-0&local_base=CUCSH`

La sesión Aleph produce una acción dinámica `/F/<session-token>`. T2CZ:

- abre una sesión;
- reutiliza una sola sesión;
- nunca persiste el token;
- nunca persiste la URL dinámica;
- consulta el catálogo colectivo `UDG01`.

Índices:

- `WTI` — título;
- `WAU` — autor;
- `SYS` — número de sistema.

El acceso directo a un registro conocido sigue usando
`func=direct&doc_number=<SYS>`, y los ejemplares físicos se obtienen por
`func=item-global`.

## Umbral de promoción

T2CZ distingue deliberadamente cuatro niveles.

### 1. Candidato de búsqueda

Un título T2CY puede generar uno o varios SYS candidatos. Eso no confirma nada.

### 2. Obra exacta sin programa confirmado

Para `exact-work-program-unresolved` se requiere:

- título exacto;
- autor exacto;
- evidencia de tesis en `Base Lógica` o `Nota de tesis`.

Si la ficha no confirma además Estudios Filosóficos, no asciende a identidad
institucional MEF.

### 3. Identidad institucional MEF

`institutional-work-confirmed` requiere conjuntamente:

- título exacto;
- autor exacto;
- evidencia explícita de tesis;
- evidencia de programa en la ficha institucional;
- SYS estable.

Marcadores aceptados en la evidencia de programa:

- Maestría en Estudios Filosóficos;
- Maestro/a en Estudios Filosóficos;
- Estudios Filosóficos.

Sólo este nivel puede alimentar una fase posterior de proyección pública.

### 4. Holding físico

`physicalHoldingConfirmed=true` sólo es posible cuando:

- la identidad institucional MEF ya está confirmada;
- Aleph devuelve holdings por `item-global`.

T2CZ no equipara ficha bibliográfica y ejemplar físico.

## Autoridades nominales

Se usa la misma normalización estricta de T2CM/T2CN: orden, puntuación y tildes
pueden variar, pero el conjunto de tokens del autor debe coincidir.

Hay dos excepciones controladas:

### Marcela Castillo

T2CY contiene una corroboración institucional de Universidad de Caldas que
reproduce simultáneamente:

- nombre completo: Marcela Castillo Villegas;
- programa UdeG;
- trabajo de grado exacto.

Por ello T2CZ puede aceptar esa forma completa como alias institucional
corroborado.

### Rómulo Daza y García

Permanece `variant-review`. Aunque Aleph encontrara título, autor, programa y
SYS, T2CZ **no** lo auto-promueve hasta resolver formalmente la autoridad nominal
`Rómulo Daza y García` ↔ `Rómulo Ramírez Daza y García`.

## Estrategia de consulta

Para cada una de las once entradas:

1. `WTI` con título completo y búsqueda no adyacente;
2. `WTI` con título completo y búsqueda adyacente;
3. sólo si lo anterior no produce un conjunto acotado, `WAU` por autor;
4. máximo ocho candidatos;
5. abrir cada registro y adjudicar con la ficha completa.

Una búsqueda por autor jamás basta para confirmar la obra.

## Seguridad y persistencia

El artifact puede contener únicamente:

- SYS;
- título observado;
- autor observado;
- `Base Lógica`;
- `Nota de tesis`;
- holdings estructurados cuando la identidad ya esté confirmada;
- diagnósticos de búsqueda sin query strings.

Se rechazan:

- tokens de sesión;
- cookies;
- contraseñas;
- HTML crudo;
- bitstreams;
- PDFs;
- endpoints de descarga.

## Archivos

- `scripts/thesis/resolve_mef_aleph_t2cz.py`
- `scripts/thesis/config/mef-aleph-resolution-t2cz-baseline.json`
- `tests/test_thesis_mef_aleph_t2cz.py`
- `.github/workflows/thesis-mef-aleph-t2cz.yml`
- este documento.

## Resultado vivo verificado

La primera ejecución viva de T2CZ terminó correctamente:

- workflow run: `42095008520`;
- head: `c75757cd7ce28e957a0e5766c1e98b6291e125e5`;
- artifact: `13445819877`;
- digest:
  `sha256:c0333f87885d4fdee12d65e7057a64a42a12748b55cedc52ffb49a44c89578d0`.

Métricas observadas:

- input: **11**;
- resolved: **0**;
- ambiguous: **0**;
- unresolved: **11**;
- `institutionalWorkIdentitiesConfirmed`: **0**;
- `physicalHoldingsConfirmed`: **0**;
- `exactWorkProgramUnresolvedCandidates`: **0**;
- fichas públicas añadidas: **0**.

Por tanto, la consulta exacta en `UDG01` no recuperó ninguna de estas once
tesis como ficha Aleph adjudicable.

### Falsos positivos por autor

Sólo dos personas devolvieron registros al ampliar la búsqueda por autor.

#### Mauricio Morales Díaz

Aleph devolvió dos SYS:

- `000361121`;
- `000539900`.

Ambos corresponden a ediciones/registros de:

**Estudios filosóficos: argumentación, epistemología, ontología, ética**

y exponen:

- `Base Lógica: Libros`;
- título distinto;
- sin evidencia de que sean la tesis buscada.

Se conservan únicamente como falsos positivos bibliográficos.

#### Íker Javier Pulido Rodríguez

Aleph devolvió:

- SYS `000594609`;
- título: **El espíritu de Tenamaxtli: narrativa de vida de Alfonso Íñiguez Pérez**;
- `Base Lógica: Libros`.

El autor coincide, pero la obra es distinta. No se promueve.

### Nueve casos sin candidato Aleph

Las búsquedas exactas no devolvieron candidatos para:

- Rómulo Daza y García;
- Norbert Charles Schwartz Hernández;
- Marcela Castillo;
- Christian Jhovanny Cervantes Barraza;
- Joaquín Galindo Castañeda;
- Guillermo Ortiz Gaxiola;
- Humberto Isaac Puertos Salinas;
- Rolando Isaías Rodríguez Lara;
- Dalila Ayala Castillo.

El resultado vivo seguro quedó congelado en:

`scripts/thesis/config/mef-aleph-resolution-t2cz-baseline.json`

para no depender de un artifact temporal.

## Conclusión metodológica

T2CZ refuerza el hallazgo de T2CV/T2CY: la ausencia en el catálogo consultado no
equivale a ausencia de tesis. Para estas once identidades, Aleph/UDG01 no aporta
una ficha institucional adjudicable.

La siguiente fase debe cambiar de proveedor, no insistir ciegamente con más
variantes del mismo OPAC. Las rutas prioritarias son:

1. RIUdeG y metadatos institucionales por autor/título;
2. catálogos y publicaciones CUCSH que declaren formalmente origen de tesis;
3. perfiles/directores institucionales con identificación work-level;
4. acervos físicos/Biblioteca Rodríguez Lapuente sólo cuando exista una pista
   nominal o bibliográfica verificable.

Los títulos T2CY conservan íntegramente su fuerza como evidencia de tesis
concluidas; simplemente no obtuvieron todavía Nivel D institucional mediante
Aleph.
