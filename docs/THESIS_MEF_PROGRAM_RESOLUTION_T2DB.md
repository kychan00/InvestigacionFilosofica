# T2DB — Resolución de autoridad de programa MEF

**Fecha:** 5 de noviembre de 2026  
**Programa objetivo:** `program:udg:mae-estudios-filosoficos`  
**Base:** T2DA / PR #192

## Objetivo

T2DA dejó tres prioridades nuevas:

1. Mario Damián del Muro Silva — tesis de maestría UdeG + programa MEF ya
   corroborado institucionalmente;
2. Adriel Manuel Hernández Guzmán — tesis de maestría UdeG, pero el programa MEF
   sólo estaba apoyado por un perfil controlado por el autor;
3. Jesús Octavio Campos Ramos — tesis de maestría UdeG, programa sin resolver.

T2DB intenta mejorar **autoridad de programa** y recuperar un identificador
work-level estable. No vuelve a consultar Aleph para el mismo lote.

## Contexto RIUdeG

La colección institucional de tesis RIUdeG declara actualmente **27,424** tesis:

- https://www.riudg.udg.mx/handle/20.500.12104/9

La ausencia de un resultado público estable en una búsqueda dirigida no se usa
como prueba de inexistencia. T2DB sólo registra que no se recuperó un
identificador individual para estos tres casos.

## Mario Damián del Muro Silva

Tesis citada en T2DA:

**Análisis retórico del discurso político: Figuras a través del Twitter en la
elección presidencial 2018 en México** (2019)

La autoridad de programa queda confirmada por dos superficies oficiales de la
Universidad de Guadalajara:

- Redes Universitarias:
  https://publicaciones.udg.mx/simeh/authors/view/id/9831
- Editorial Universidad de Guadalajara:
  https://editorial.udg.mx/gpd-101-lecciones-de-vida-que-aprendi-en-la-universidad-9786075818610-69388a5d04fc2.html

Ambas lo describen como **Maestro en Estudios Filosóficos por la UdeG**.

Estado T2DB:

`mef-program-confirmed-work-id-unresolved`

No apareció:

- handle específico de tesis;
- SYS específico;
- ficha work-level individual;
- holding físico.

Por tanto, el programa está confirmado, pero la tesis todavía no asciende a
`institutional-work-confirmed`.

## Adriel Manuel Hernández Guzmán

Tesis citada en T2DA:

**El Estado propuesto por Platón en la República es una utopía** (2011)

T2DA sólo tenía como evidencia de programa un perfil autoral.

T2DB recupera una fuente oficial UdeG: la ficha editorial de
**Rumbo de las humanidades**, donde la Universidad de Guadalajara presenta a
Adriel como:

**Doctor en Humanidades, Maestro en Estudios filosóficos y Licenciado en
Filosofía.**

Fuente:

- https://publicaciones.udg.mx/catalog/product/view/id/3969/s/gpd-rumbo-de-las-humanidades-9786075711027/

Esto cambia la autoridad de programa de:

`mef-author-controlled-corroboration`

a:

`mef-program-institutionally-confirmed`.

### Variante de título

El perfil autoral de Adriel expone además la tesis bajo la forma interrogativa:

**¿El Estado que propone Platón en la República es una utopía?**

Mientras que la bibliografía usada en T2DA registra:

**El Estado propuesto por Platón en la República es una utopía**

T2DB conserva ambas formas y no declara que sean bibliográficamente idénticas
hasta obtener una fuente work-level.

## Jesús Octavio Campos Ramos

Tesis citada en T2DA:

**El presupuesto de la unificación del concepto y del ser en Dios en el
argumento ontológico de San Anselmo, según Hegel** (2021)

La publicación oficial en *Sincronía*:

- https://revistasincronia.cucsh.udg.mx/index.php/sincronia/article/view/307

confirma identidad autoral y continuidad temática sobre el argumento ontológico,
pero no identifica el programa de maestría.

El ORCID público:

- https://orcid.org/0009-0001-1220-6765

sirve únicamente como identificador de autor.

Estado:

`master-thesis-program-still-unresolved`

No se cuenta como MEF.

## Resultado

- casos prioritarios: **3**;
- programas MEF institucionalmente confirmados: **2**;
- upgrades de evidencia autoral → institucional: **1** (Adriel);
- programas aún sin resolver: **1** (Jesús);
- handles de tesis recuperados: **0**;
- SYS nuevos: **0**;
- identidades work-level confirmadas: **0**;
- holdings físicos: **0**;
- fichas públicas nuevas: **0**.

## Regla central

T2DB confirma que:

> programa institucionalmente confirmado ≠ identidad institucional de la tesis.

Mario y Adriel tienen ahora una combinación muy fuerte de tesis UdeG + programa
MEF, pero todavía no existe un identificador estable de cada obra.

## Siguiente fase

T2DC debe ampliar la búsqueda de **identidad work-level**, no seguir acumulando
biografías:

1. Mario y Adriel: buscar registro individual en RIUdeG, catálogo de posgrado,
   bibliografía de programa o fuente UdeG que asigne identificador a la tesis;
2. Jesús: resolver primero el programa antes de cualquier inclusión MEF;
3. Marcela, Íker, Joaquín, Mauricio, Christian y Dalila permanecen como segundo
   lote de búsqueda work-level;
4. no volver a Aleph salvo que otra fuente aporte un SYS concreto.

T2DB no modifica Effective Corpus V2, Program Authority ni la vista pública.
