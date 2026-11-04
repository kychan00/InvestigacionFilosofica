# T2CJ — Recon del Catálogo de Tesis de Biblioteca CUCSH

## Objetivo

Evaluar `http://www.biblioteca.cucsh.udg.mx/catalogo-de-tesis` como fuente adicional de descubrimiento bibliográfico para tesis UdeG, con especial interés en Filosofía.

T2CJ no modifica el corpus efectivo, Program Authority ni la vista pública.

## Hallazgo inicial

El landing institucional resolvió por HTTP y expuso tres vistas específicas:

- `/vista-tesis-licenciatura`;
- `/vista-tesis-maestria`;
- `/vista-tesis-doctorado`.

La variante HTTPS agotó timeout en el primer recon; por eso el probe usa fallback acotado y conserva esta fragilidad como evidencia operativa.

## Recon de estructura

La revisión V2 del probe visita las tres vistas y conserva únicamente:

- formularios y acciones;
- nombres/IDs de filtros;
- opciones de `select`;
- filas tabulares de muestra;
- señales textuales que contienen Filosofía;
- enlaces navegables permitidos;
- hashes y métricas de las páginas.

No persiste HTML bruto.

## Papel de la fuente

Jerarquía propuesta:

1. RIUdeG / handle persistente para identidad y metadatos modernos;
2. Catálogo de Tesis CUCSH como fuente institucional complementaria;
3. ALEPH histórico cuando aporta número de sistema/nota de tesis;
4. fuentes académicas secundarias sólo para descubrimiento/revisión.

El catálogo CUCSH puede descubrir referencias históricas o locales que RIUdeG no expone bien. Una coincidencia futura deberá usar identificadores estables o claves bibliográficas exactas; nunca fuzzy matching.

## Reference-only

El probe:

- visita sólo hosts Biblioteca CUCSH;
- rechaza `.pdf`, `/bitstream` y `/download`;
- no usa credenciales ni cookies;
- no descarga tesis ni texto completo;
- sólo sube `catalog-report.json` como artifact temporal.

## Siguiente decisión

El artifact de las vistas de Licenciatura/Maestría/Doctorado determinará si podemos construir un harvester de programas y tesis de Filosofía. Cualquier ampliación pública posterior requerirá reconciliación contra V2/RIUdeG y una fase separada.
