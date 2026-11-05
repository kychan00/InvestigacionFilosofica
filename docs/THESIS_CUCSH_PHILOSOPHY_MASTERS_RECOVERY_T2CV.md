# T2CV — Recuperación de tesis de Maestría filosófica desde el catálogo CUCSH sin filtrar

**Fecha:** 4 de noviembre de 2026

## Problema

La vista pública T2CU ya contiene **233 referencias filosóficas**, pero sólo
tres pertenecen a `Maestría en Estudios Filosóficos`: dos INCLUDE
institucionales de 2024 y una referencia REVIEW de Adriel Manuel Hernández
Guzmán.

Eso es claramente incompleto:

- la UdeG exige **presentar una tesis** para obtener el grado de la Maestría en
  Estudios Filosóficos;
- la página del programa documenta cohortes desde 2007–2009;
- Control Escolar registra **45 grados** de Maestro/Maestra en Estudios
  Filosóficos entre 2018 y 2025;
- el catálogo CUCSH sí ofrece las opciones
  `Maestría en Estudios Filosóficos` y `Maestría En Filosofía`, pero el
  filtro por programa devuelve **0 filas** en T2CJ;
- la vista general de maestrías, en cambio, expone paginación hasta
  `page=238`, es decir, 239 páginas de registros mezclados.

Un resultado vacío del filtro no puede tratarse como ausencia de tesis.

## Estrategia T2CV

`recover_cucsh_philosophy_masters_t2cv.py` recorre la vista **sin filtro** de
maestrías, página por página, y selecciona localmente las filas cuyo campo
`Maestria` coincide de forma exacta tras normalización con:

1. `Maestría en Estudios Filosóficos`
   → `program:udg:mae-estudios-filosoficos`;
2. `Maestría En Filosofía`
   → `program:udg:mae-filosofia-historica`.

No se usa similitud temática ni fuzzy matching.

## Fuentes cruzadas

### Catálogo Biblioteca CUCSH

Fuente bibliográfica de título, autor, año, programa y URL de detalle cuando
está disponible. El crawler guarda únicamente metadata y hashes de página;
no guarda HTML bruto ni PDFs.

### Control Escolar 2018–2025

Los archivos públicos de títulos, diplomas y grados se usan sólo como
**contador de cobertura**. El total observado es 45 grados del programa.

Esos 45 grados **no** se convierten automáticamente en 45 identidades de
tesis porque los archivos agregados no contienen título/autor de cada trabajo.

### Vista pública actual

T2CV compara el catálogo recuperado con tres semillas ya visibles:

- Carlos Itzcóatl Enciso Durán — *Entre la moral y lo político…* — INCLUDE;
- Santiago Juárez Salazar — *Una lectura del epicureísmo desde la teoría
  crítica* — INCLUDE;
- Adriel Manuel Hernández Guzmán — *¿El Estado que propone Platón en la
  República es una utopía?* — REVIEW.

La coincidencia requiere título + autor normalizados.

## Evidencia institucional adicional

La página oficial de la Maestría declara que el tutor se convierte en director
de tesis y que existen Taller de Tesis I y II. La oferta institucional de UdeG
establece explícitamente la tesis como requisito de grado.

CUCSH informó además en 2024 la publicación de las tesis de Enciso Durán y
Juárez Salazar, y el Informe CUCSH 2024 las registra bajo la Maestría en
Estudios Filosóficos.

Referencias:

- https://www.cucsh.udg.mx/maestrias/maestria-en-estudios-filosoficos
- https://ww1.udg.mx/es/oferta-academica/posgrados/maestrias/maestria-en-estudios-filosoficos
- https://www.cucsh.udg.mx/noticias/explican-en-fil-estudiantes-de-la-maestria-en-estudios-filosoficos-del-cucsh-trabajos-de

## Restricciones

T2CV es **reconocimiento**, no publicación:

- no altera T2CU ni el índice público;
- no modifica Program Authority ni el corpus canónico;
- no infiere holdings físicos;
- no almacena PDFs;
- no trata matrículas de cohorte como egresos;
- no trata grados agregados como identidades bibliográficas;
- no fusiona el programa histórico de Maestría en Filosofía con el programa
  actual de Estudios Filosóficos.


## Resultado vivo comprobado

El workflow T2CV recorrió **239 páginas** del listado general de maestrías y
leyó **2,383 filas**. El campo de programa contiene **48 etiquetas distintas**.

Resultado:

- `Maestría en Estudios Filosóficos`: **0 filas**;
- `Maestría en Filosofía` histórica: **0 filas**;
- cualquier otra etiqueta cuyo texto normalizado contenga `filosof`: **0**;
- semillas públicas encontradas en el catálogo: **0 de 3**;
- grados de Maestría en Estudios Filosóficos registrados por Control Escolar
  entre 2018 y 2025: **45**.

Esto descarta la hipótesis de que las tesis estuvieran ocultas por un fallo
del filtro server-side o por una variante ortográfica del nombre del programa.
Aunque el selector Drupal anuncia ambos programas filosóficos, sus registros
no forman parte de las 2,383 filas públicas del catálogo general de maestrías.

El resultado **no** significa que no existan tesis. Al contrario: el requisito
institucional de titulación, los 45 grados de Control Escolar y las tesis
2024 ya documentadas demuestran producción de tesis que el catálogo no
representa.

### Comprobación con RIUdeG

Una auditoría separada del corpus real RIUdeG usado por el proyecto
(27,576 registros fuente) tampoco encontró metadata de
`Maestría en Estudios Filosóficos`. Sólo aparecen dos registros del programa
histórico `Maestría en Filosofía`, ya conocidos por el proyecto:

- Víctor Manuel Favila Vega, 2005 — *Qvaestiones qvodlibetales de historiae philosiphia* — handle `20.500.12104/49346`;
- Adriana Pérez Armendáriz, 2006 — *Examen breve de dos paradojas de la teoría de conjuntos* — handle `20.500.12104/49365`.

Por tanto, repetir búsquedas en el catálogo CUCSH o en el corpus RIUdeG actual
no es la siguiente estrategia adecuada para recuperar la Maestría en Estudios
Filosóficos.

## Siguiente ruta institucional

La recuperación debe desplazarse a fuentes que documenten **defensas,
egresados y tesis del programa**:

1. Coordinación de la Maestría en Estudios Filosóficos y Departamento de
   Filosofía CUCSH.
2. Informes anuales, coloquios, exámenes de grado, notas institucionales y
   publicaciones derivadas.
3. Control Escolar como ledger de cobertura: 45 grados 2018–2025, sin crear
   identidades cuando falta título/autor.
4. Catálogos/archivos físicos de Rodríguez Lapuente y Belenes cuando exista
   evidencia de depósito.
5. RIUdeG sólo cuando aparezca un handle de tesis exacto, no por similitud
   temática con libros o artículos derivados.

T2CV no envía correos ni solicitudes en nombre del usuario. Una fase posterior
puede preparar un expediente de recuperación institucional con las identidades
ya conocidas y los huecos por año.

## Salida

El artifact `philosophy-masters-recovery.json` reportará:

- páginas de maestría inspeccionadas;
- filas totales del catálogo general;
- identidades actuales recuperadas;
- identidades históricas recuperadas;
- duplicados;
- cobertura 2018–2025;
- coincidencia con las tres semillas públicas;
- comparación con los filtros server-side de T2CJ.

La siguiente fase sólo podrá proyectar nuevas fichas públicas después de
revisar este artifact y confirmar que la identidad bibliográfica recuperada es
institucional y no un efecto del catálogo.
