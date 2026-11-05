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

## Resultado vivo verificado

El workflow T2DD completó el catálogo público de maestrías:

- workflow run: `42107024412`;
- head: `a5560406b4412cdd6d863a4b509188466e217f6e`;
- artifact: `13453091014`;
- digest:
  `sha256:6656a33ef6ca227c9cab9fc1710a8dc6021a4df0cd27ff2a7ea0cb26dc9a0c8f`.

Cobertura:

- páginas: **239**;
- último índice: **238**;
- filas de tesis de maestría: **2,383**;
- etiquetas de programa: **48**;
- etiquetas cuyo texto contiene filosofía/filosóficos: **0**.

### Adriel Manuel Hernández Guzmán

Se buscaron las dos formas conocidas del título.

Resultado:

- título + autor exactos: **0**;
- sólo título: **0**;
- sólo autor: **0**;
- referencia CUCSH confirmada: **no**;
- holding físico confirmado: **no**.

Estado:

`not-found-in-completed-cucsh-master-catalog`

Este resultado reproduce además el hallazgo independiente de T2CV: Adriel
estaba entre las semillas públicas contrastadas y ninguna de las tres semillas
MEF apareció en el catálogo.

### Mario Damián del Muro Silva

Resultado:

- título + autor exactos: **0**;
- sólo título: **0**;
- sólo autor: **0**;
- referencia CUCSH confirmada: **no**;
- holding físico confirmado: **no**.

Estado:

`not-found-in-completed-cucsh-master-catalog`

## Cierre de fuente

Para las formas bibliográficas conocidas, T2DD agota la vista pública
`vista-tesis-maestria`.

La ausencia no demuestra inexistencia. El catálogo puede estar incompleto,
puede no representar acervos históricos, o la tesis puede estar registrada en
otro sistema o únicamente en un inventario interno.

El baseline quedó congelado en:

`scripts/thesis/config/mef-cucsh-master-catalog-t2dd-baseline.json`

## Paquete de verificación física

T2DD prepara, pero **no envía**, el archivo:

`scripts/thesis/config/mef-physical-verification-request-t2dd.json`

El paquete contiene los dos trabajos y pide únicamente metadata bibliográfica y
de holding:

- título registrado;
- forma de autor;
- programa;
- año/fecha de defensa;
- director;
- número de registro;
- signatura;
- inventario/barcode;
- colección/sede;
- formato físico;
- disponibilidad;
- URL estable si existe;
- destino de transferencia/archivo si el ejemplar ya no está en la sede.

No solicita PDF ni texto completo.

### Ruta 1 — Biblioteca

SiUBiUDG identifica actualmente como autoridad de acervo a:

**Mtro. Rodolfo Gutiérrez Zermeño**  
Jefe de la Unidad de Biblioteca y Acervos Documentales  
Biblioteca Central Dr. Manuel Rodríguez Lapuente.

Fuente institucional:

https://bibliotecas.udg.mx/Red-de-Bibliotecas/Centros-Universitarios-Tematicos/CUCSH/Biblioteca-Central-Dr-Manuel-RodrIguez-Lapuente

### Ruta 2 — Programa

El directorio actual de CUCSH identifica como coordinadora de la Maestría en
Estudios Filosóficos a:

**Dra. Nalliely Hernández Cornejo**

Fuente institucional:

https://www.cucsh.udg.mx/directorio/division-de-estudios-historicos-y-humanos

La coordinación puede confirmar expediente de egreso/tesis y, en su caso,
indicar a qué biblioteca o archivo se entregó el ejemplar.

## Precisión sobre Aleph

T2CZ agotó Aleph para las once tesis del lote de direcciones/sinodalías T2CY.
**Mario y Adriel no pertenecían a ese lote**: ambos aparecieron después, en
T2DA.

Por ello una futura búsqueda Aleph exacta para Mario y Adriel no sería una
repetición de T2CZ. Debe considerarse una vía automatizable adicional antes o en
paralelo con la consulta institucional directa.

## Archivos

- `scripts/thesis/scan_cucsh_master_catalog_mef_targets_t2dd.py`
- `scripts/thesis/config/mef-cucsh-master-catalog-t2dd-baseline.json`
- `scripts/thesis/config/mef-physical-verification-request-t2dd.json`
- `tests/test_thesis_cucsh_master_catalog_t2dd.py`
- `.github/workflows/thesis-cucsh-master-catalog-t2dd.yml`
- este documento.

## Siguiente fase

T2DE debe hacer dos cosas sin confundirlas:

1. búsqueda exacta de Mario y Adriel en Aleph/UDG01, ya que nunca fueron parte
   del lote T2CZ;
2. si esa búsqueda no aporta SYS/holding, utilizar el paquete T2DD para
   verificación directa con Biblioteca y Coordinación MEF.

No se modifica Effective Corpus V2, Program Authority ni la vista pública.
