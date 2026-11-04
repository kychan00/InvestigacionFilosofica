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

El artifact temporal permitirá conocer el universo CUCSH de los tres programas filosóficos antes de reconciliar contra V2/RIUdeG.

## Jerarquía de evidencia

1. RIUdeG / handle persistente;
2. Catálogo de Tesis CUCSH como fuente institucional complementaria;
3. ALEPH histórico cuando aporta número de sistema/nota de tesis;
4. fuentes académicas secundarias sólo para descubrimiento/revisión.

Una referencia CUCSH no se convierte automáticamente en nueva obra pública. La fase siguiente deberá reconciliar por identificador persistente o clave bibliográfica exacta; nunca fuzzy matching.

## Reference-only

El probe no descarga tesis ni texto completo. Rechaza `.pdf`, `/bitstream` y `/download`; no usa credenciales ni cookies; no persiste HTML bruto.

## Siguiente fase

Con el inventario completo se comparará:

- CUCSH vs V2;
- CUCSH vs RIUdeG;
- CUCSH vs T2CI (18 referencias actuales).

Las referencias institucionales faltantes podrán pasar a una fase de reconciliación y curaduría antes de cualquier publicación.
