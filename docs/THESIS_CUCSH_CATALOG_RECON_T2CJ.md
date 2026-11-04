# T2CJ — Recon e inventario del Catálogo de Tesis de Biblioteca CUCSH

## Objetivo

Evaluar y enumerar la cobertura de Filosofía en `http://www.biblioteca.cucsh.udg.mx/catalogo-de-tesis` como fuente institucional complementaria.

T2CJ no modifica el corpus efectivo, Program Authority ni la vista pública.

## Estructura confirmada

El catálogo expone tres vistas Drupal Views:

- `vista-tesis-licenciatura`;
- `vista-tesis-maestria`;
- `vista-tesis-doctorado`.

Cada una ofrece un filtro GET por programa y una tabla con:

- título;
- autor;
- coautor;
- director/asesor;
- año;
- programa.

La Licenciatura incluye `Licenciatura en Filosofía`. La Maestría incluye tanto `Maestría en Estudios Filosóficos` como la autoridad histórica `Maestría En Filosofía`. Doctorado no expone un programa exacto de Filosofía, coherente con la política vigente.

## Inventario V3

El probe T2CJ V3:

1. descubre de forma accent-insensitive todas las opciones de programa que contienen Filosofía/Filosóficos;
2. construye el filtro GET exacto de Drupal;
3. pagina cada programa con orden estable por título;
4. conserva sólo metadatos tabulares y, cuando existe, la URL de detalle institucional;
5. deduplica por título + autor + año + programa;
6. falla si un filtro devuelve un programa distinto.

## Hallazgos verificados del catálogo vivo

El run final del PR #174, sobre el head `bc3916689b962fc4691b30a088365d9aefc0f68b`, produjo un artifact metadata-only con:

- **217 referencias** de `Licenciatura en Filosofía`;
- **22 páginas** efectivamente recorridas para ese programa;
- **217/217** referencias con URL institucional de detalle;
- **0 registros** devueltos por el filtro `Maestría en Estudios Filosóficos`;
- **0 registros** devueltos por el filtro histórico `Maestría En Filosofía`;
- **0 programa exacto Doctorado en Filosofía** en las opciones de Doctorado.

Los filtros de ambas maestrías sí aparecen como opciones del catálogo, pero actualmente no devuelven filas. T2CJ conserva esta diferencia entre **autoridad/opción expuesta** y **contenido realmente servido**.

La tabla de Licenciatura contiene datos históricos con calidad irregular. En particular, al menos un registro no expone año y otro publica `208` como año. Estos valores no se corrigen por inferencia y deben conservarse como evidencia defectuosa hasta una reconciliación posterior.

## Cruce preliminar contra T2CI/V2

La comparación determinista del inventario CUCSH con los índices públicos generados en T2CI encontró:

- **1 coincidencia exacta por título normalizado + autor + año**: Guillermo Vargas Curiel, ya identificado como `thesis:work:00027577`;
- **1 candidato adicional por mismo autor + mismo año + mismo programa**, Guillermo Castillo Ramírez (2004), cuyo título difiere por el error textual `femenidad` / `feminidad`; no se fusiona automáticamente;
- Israel Alejandro Romero Ramírez aparece también en el catálogo de Licenciatura con una tesis distinta de 2009, por lo que compartir autor no implica identidad de obra.

Por tanto, el catálogo CUCSH aporta **más de 200 referencias programáticamente filosóficas que no están hoy representadas por una coincidencia exacta en V2/T2CI**. La cifra exacta de nuevas identidades públicas deberá fijarse en la fase de reconciliación, no en T2CJ.

## Jerarquía de evidencia

1. RIUdeG / handle persistente;
2. Catálogo de Tesis CUCSH como fuente institucional complementaria;
3. ALEPH histórico cuando aporta número de sistema/nota de tesis;
4. fuentes académicas secundarias sólo para descubrimiento/revisión.

Una referencia CUCSH no se convierte automáticamente en nueva obra pública. La fase siguiente deberá reconciliar por identificador persistente o clave bibliográfica exacta; nunca fuzzy matching.

## Reference-only

El probe no descarga tesis ni texto completo. Rechaza `.pdf`, `/bitstream` y `/download`; no usa credenciales ni cookies; no persiste HTML bruto.

## Siguiente fase

T2CK deberá reconciliar el inventario CUCSH de Filosofía contra:

- Effective Corpus V2;
- RIUdeG;
- la vista T2CI ya publicada;
- los suplementos y decisiones curatoriales existentes.

Sólo después de esa reconciliación se podrá ampliar la vista pública de Filosofía con referencias nuevas, conservando programa real, provenance y estado de validación.
