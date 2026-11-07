# T2DG · Editorial UdeG en la vista pública de tesis

## Objetivo

Integrar en `tesis.html` un tercer territorio bibliográfico llamado **Editorial UdeG** para consultar publicaciones filosóficas de la Editorial Universidad de Guadalajara sin mezclarlas con el corpus de tesis.

La página pública conserva tres vistas independientes:

1. **Humanidades** · corpus efectivo V2 de tesis admitidas.
2. **Filosofía** · inventario y cruces filosóficos de tesis.
3. **Editorial UdeG** · publicaciones editoriales filosóficas.

## Contrato del corpus editorial

Archivo público:

`data/editorial/udg-philosophy-v1/index.json`

Contrato:

- `schemaVersion`: `editorial-udg-philosophy-index-v1`
- `revision`: `2026-11-07.v1`
- `records`: **33**
- categoría oficial Filosofía: **24**
- relación filosófica verificada fuera del filtro: **9**
- `referenceOnly`: `true`
- `pdfCopies`: `0`

Fuente primaria del catálogo:

`https://editorial.udg.mx/libros.html?cat=144&manufacturer=5606`

La instantánea utilizada fue previamente curada y publicada en `kychan00/philosophia`, commit:

`a931ad3b7be79227c5aee3035d03b2dcbaf0a81b`

## Política de inclusión

### Categoría oficial

Se incluyen los títulos que Editorial UdeG clasifica directamente en **Filosofía**.

### Relación filosófica verificada

También se admite una publicación fuera de ese filtro cuando su ficha editorial explicita contenido filosófico sustantivo, por ejemplo:

- ética;
- epistemología;
- lógica;
- teoría de la argumentación;
- metafísica;
- ontología;
- metodología expresamente filosófica.

No basta con pertenecer a Humanidades, Literatura, Psicología o Religión.

## Interfaz pública

El selector **Elija el territorio bibliográfico** incorpora:

`Editorial UdeG · 33`

Al activarlo:

- se ocultan filtros propios de tesis: programa, grado, unidad académica y años;
- aparecen filtros de **procedencia** y **formato**;
- la búsqueda consulta título, autor, formato y criterio de inclusión;
- cada tarjeta se presenta como publicación editorial, nunca como tesis;
- cada tarjeta enlaza sólo a `editorial.udg.mx`;
- se puede copiar una referencia bibliográfica básica;
- el hero, contador, etiqueta de resultados y metodología cambian al contexto editorial;
- la URL admite `?scope=editorial`.

## Separación de dominios

Este cambio **no modifica**:

- Effective Corpus V2;
- decisiones INCLUDE / REVIEW / QUARANTINE / EXCLUDE;
- Program Authority;
- inventario histórico de tesis CUCSH;
- Atlas 2D de tesis;
- holdings;
- archivos PDF.

El corpus editorial es complementario y reference-only.

## Implementación

Archivos principales:

- `tesis.html`
- `js/thesis-demo.js`
- `css/thesis-demo.css`
- `src/core/editorial-udg-search.js`
- `data/editorial/udg-philosophy-v1/index.json`
- `tests/editorial-udg-public-view.test.mjs`
- `tests/thesis-public-v1-release.test.mjs`
- `release-manifest.json`

## Barreras de calidad

La integración falla cerrada si:

- el corpus deja de tener 33 registros;
- las capas 24 + 9 cambian sin revisión;
- aparece un ID o URL duplicado;
- una URL sale de `editorial.udg.mx`;
- se introduce una descarga PDF;
- un registro carece de título, autor, formato, procedencia o criterio de inclusión.

## Estado

Rama: `feat/tesis-editorial-udg-20261107`

PR, checks, merge SHA y despliegue Pages deben registrarse después de la validación. No declarar publicado hasta verificar el workflow de Pages sobre el SHA fusionado.
