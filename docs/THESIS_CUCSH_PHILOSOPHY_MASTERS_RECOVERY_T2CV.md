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
