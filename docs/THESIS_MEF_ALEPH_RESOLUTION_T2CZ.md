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
- `tests/test_thesis_mef_aleph_t2cz.py`
- `.github/workflows/thesis-mef-aleph-t2cz.yml`
- este documento.

## Interpretación prevista

El workflow del PR ejecuta la consulta viva y publica
`mef-aleph-resolution-t2cz.json` como artifact. El resultado decide la fase
siguiente:

- con SYS + programa confirmado: preparar adjudicación/integración;
- con SYS exacto pero programa ausente: conservar como
  `exact-work-program-unresolved`;
- con candidatos discordantes: revisión humana;
- sin candidatos: mantener T2CY sin degradar su evidencia.

Cero resultados en Aleph nunca significa cero tesis.
