# T2CJ — Recon del Catálogo de Tesis de Biblioteca CUCSH

## Objetivo

Evaluar la página institucional:

`http://www.biblioteca.cucsh.udg.mx/catalogo-de-tesis`

como una fuente adicional de descubrimiento bibliográfico para tesis UdeG, con
especial interés en Filosofía.

T2CJ **no modifica** el corpus efectivo, Program Authority ni la vista pública.
Primero identifica la estructura navegable y los enlaces de metadatos que la
Biblioteca CUCSH expone.

## Papel de la fuente

La jerarquía propuesta es:

1. RIUdeG / handle persistente para identidad y metadatos modernos;
2. Catálogo de Tesis CUCSH como fuente institucional complementaria;
3. ALEPH histórico para validación cuando aporta número de sistema/nota de tesis;
4. fuentes académicas secundarias sólo para descubrimiento/revisión.

El catálogo CUCSH puede ayudar a descubrir referencias históricas o locales que
no estén bien expuestas en RIUdeG, pero una coincidencia nunca se deduplica por
fuzzy matching.

## Recon reference-only

El probe T2CJ:

- visita únicamente hosts de Biblioteca CUCSH;
- sigue redirecciones sólo mientras permanezcan en ese host;
- conserva únicamente texto de anclas y URLs de navegación;
- calcula SHA-256 del HTML para trazabilidad, pero **no persiste el HTML**;
- rechaza `.pdf`, `/bitstream` y `/download`;
- no usa credenciales, cookies ni URLs de sesión;
- no descarga tesis ni texto completo.

El artifact temporal contiene sólo `catalog-report.json`.

## Siguiente decisión

Después de inspeccionar el artifact real se decidirá si el catálogo permite:

- enumerar programas;
- enumerar registros de tesis;
- extraer identificadores estables (por ejemplo nodos Drupal);
- cruzar registros con V2/RIUdeG;
- ampliar la cobertura de Filosofía mediante evidencia institucional.

No se publicará ninguna nueva referencia por esta fuente sin una fase de
reconciliación y pruebas posterior.
