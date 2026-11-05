# T2DD — Resolución CUCSH / Biblioteca Dr. Manuel Rodríguez Lapuente

**Fecha:** 5 de noviembre de 2026  
**Base:** T2DC / PR #194  
**Objetivo:** buscar a Mario Damián del Muro Silva y Adriel Manuel Hernández
Guzmán en el catálogo propio de tesis de maestría de la Biblioteca Central
Dr. Manuel Rodríguez Lapuente, independientemente de la etiqueta de programa.

## Contexto

T2DC cerró exhaustivamente RIUdeG/OAI para las formas bibliográficas conocidas:

- 275 páginas OAI;
- 27,429 registros activos;
- 2 tombstones;
- 27,431 entradas declaradas por el set;
- 0 coincidencias exactas, title-only o author-only para Mario;
- 0 coincidencias exactas, title-only o author-only para Adriel.

Eso no prueba inexistencia. La siguiente fuente institucional natural es el
catálogo propio de tesis de la Biblioteca Central del CUCSH.

## Biblioteca

SiUBiUDG publica actualmente:

**Biblioteca Central Dr. Manuel Rodríguez Lapuente**  
CUCSH — Ciencias Sociales y Humanidades  
Calle Guanajuato No. 1045, Edificio B, Col. La Normal, C.P. 44260,
Guadalajara, Jalisco.

Página institucional:

https://bibliotecas.udg.mx/Red-de-Bibliotecas/Centros-Universitarios-Tematicos/CUCSH/Biblioteca-Central-Dr-Manuel-RodrIguez-Lapuente

El portal histórico de la propia biblioteca mantiene vistas Drupal de tesis:

- `vista-tesis-licenciatura`;
- `vista-tesis-maestria`;
- `vista-tesis-doctorado`.

Las fichas individuales incluyen, cuando existe el dato:

- título;
- autor;
- coautor;
- director/asesor;
- año;
- programa.

## Lo que ya sabemos de T2CV

T2CV recorrió previamente el listado **sin filtro** de maestrías:

- 239 páginas;
- 2,383 filas;
- 48 etiquetas distintas de programa;
- 0 filas etiquetadas como `Maestría en Estudios Filosóficos`;
- 0 filas etiquetadas como `Maestría en Filosofía`;
- 0 etiquetas de programa con texto filosófico.

T2DD no repite esa selección por programa. En cambio, vuelve a recorrer todas
las filas y busca los dos trabajos prioritarios por título y autor, incluso si
el programa estuviera mal etiquetado.

## Objetivos exactos

### Mario Damián del Muro Silva

**Análisis retórico del discurso político: Figuras a través del Twitter en la
elección presidencial 2018 en México**

Programa confirmado por T2DB:

**Maestría en Estudios Filosóficos**

### Adriel Manuel Hernández Guzmán

Forma bibliográfica institucional:

**El Estado propuesto por Platón en la República es una utopía**

Variante autoral preservada:

**¿El Estado que propone Platón en la República es una utopía?**

Programa confirmado por T2DB:

**Maestría en Estudios Filosóficos**

## Regla de adjudicación

T2DD distingue cuatro casos.

### 1. Título + autor exactos + programa MEF

Puede quedar:

`cucsh-library-catalog-reference-confirmed`

Esto confirma una referencia bibliográfica institucional de la biblioteca.

### 2. Título + autor exactos + otro programa

Queda:

`exact-reference-program-conflict-review`

No se sobreescribe el programa observado aunque T2DB tenga autoridad MEF.

### 3. Título + autor exactos sin programa

Queda:

`exact-reference-program-unresolved`

### 4. Coincidencia sólo por título o sólo por autor

Se conserva como diagnóstico, nunca como identidad.

## Catálogo ≠ holding físico

Incluso una ficha exacta de la Biblioteca CUCSH no basta para afirmar:

- ejemplar físico presente;
- signatura;
- inventario;
- ubicación;
- disponibilidad;
- formato impreso/CD.

Por ello:

`libraryCatalogReferenceConfirmed=true`

nunca produce automáticamente:

`physicalHoldingConfirmed=true`.

Para confirmar un holding se requiere una fuente que exponga inventario,
signatura, ubicación/colección y/o estado del ejemplar, o una confirmación
directa de la biblioteca.

## Si el catálogo completo da cero

T2DD dejará preparado un paquete de consulta manual con:

- autor;
- título;
- año;
- programa;
- variantes de título;
- evidencia institucional previa;
- campos concretos que deben pedirse a biblioteca:
  - número de registro;
  - signatura topográfica;
  - número de inventario;
  - sede/colección;
  - formato;
  - disponibilidad.

Ese paquete no equivale a enviar un correo automáticamente.

## Política

T2DD:

- no descarga tesis;
- no guarda HTML crudo;
- no usa credenciales;
- no toca Effective Corpus V2;
- no cambia Program Authority;
- no publica fichas;
- no interpreta ausencia del catálogo como inexistencia.

## Archivos

- `scripts/thesis/scan_cucsh_master_catalog_mef_targets_t2dd.py`
- `tests/test_thesis_cucsh_master_catalog_t2dd.py`
- `.github/workflows/thesis-cucsh-master-catalog-t2dd.yml`
- este documento.

## Siguiente decisión

Si aparece una referencia exacta:

1. congelar la ficha;
2. comprobar detalle institucional;
3. buscar signatura/inventario/holding;
4. sólo entonces proyectar ubicación física.

Si no aparece:

1. congelar el cierre exhaustivo del catálogo;
2. generar la solicitud institucional de verificación física;
3. pasar a archivo de programa / coordinación / biblioteca;
4. no repetir RIUdeG, Aleph ni el mismo catálogo sin un identificador nuevo.
