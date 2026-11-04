# Demo V1 — Buscador público de Tesis UdeG

## Alcance

Primera experiencia visual de las tesis de Humanidades dentro de
**Investigación Filosófica**, aislada de la búsqueda federada existente.

Ruta propuesta, tras merge manual y despliegue Pages validado:

`https://kychan00.github.io/InvestigacionFilosofica/tesis.html`

La navegación principal incorpora el enlace **Tesis UdeG** y conserva
las funcionalidades existentes de OpenAlex, Crossref, CUCSH, etc.

## Fuente y alcance de datos

El demo consume `thesis-effective-corpus-v1` (T2BZ),
**inmutable y verificada por SHA-256**. Su conjunto de admisión contiene:

- 27,576 obras canónicas;
- 561 INCLUDE (únicas publicables en búsqueda principal);
- 193 REVIEW;
- 18,971 QUARANTINE;
- 7,849 EXCLUDE;
- 2 REJECT_SOURCE.

Solo las **561 INCLUDE** se proyectan al índice compacto de la interfaz.
Los restantes estados no aparecen ni son descargados por el navegador del demo.

El builder `scripts/thesis/build_thesis_demo_index_v1.py`:

1. recibe los bytes gzip descargados de la release T2BZ;
2. compara su SHA-256 con el contrato inmutable;
3. descomprime y compara el SHA-256 del JSON;
4. verifica esquema, revisiones y conteos exactos de V1;
5. toma solo obras INCLUDE, sin alterar ninguna decisión;
6. exporta solo metadatos bibliográficos breves: ID, título, autor,
   dirección, fecha confiable, programa, grado, unidad, palabras clave,
   **extracto acotado a 460 caracteres del resumen institucional**;
7. deriva únicamente URLs de handle o páginas institucionales autorizadas;
8. no exporta PDF, ruta directa al archivo, texto completo, OAI raw XML
   ni SourceRecord íntegro;
9. ordena los resultados y fija un techo de 2.5 MB para el índice;
10. falla si la cardinalidad, identidad o versión no coincide con la release.

El script genera `data/theses/demo-v1/index.json` **durante Pages**;
no se comitea el índice derivado ni se sobrescribe la release T2BZ.

La fuente primaria de consulta sigue siendo RIUdeG/UDGVirtual, con enlaces
institucionales HTTPS y sin archivos espejados, de acuerdo con la política
`docs/THESIS_HUMANITIES_SOURCE_POLICY_V1.md` actualizada en #165.

## Funcionalidad visible

- búsqueda local y sin acentos por título, autores, dirección,
  programa, unidad, palabras clave y extracto del resumen institucional;
- filtros por programa, grado, unidad y años válidos;
- orden por fecha o título;
- paginación de doce resultados;
- ficha ampliable de procedencia y metadatos, nunca visor propio de PDF;
- acción «Consultar en repositorio institucional» en nueva pestaña;
- copiar referencia bibliográfica como ayuda, no exportación de contenido;
- interfaz responsiva y modo claro/oscuro compatible con el sistema existente;
- estados accesibles de carga, resultados vacíos, filtros y errores de red.

**Este es un demo de búsqueda lexical sobre metadatos, no un motor semántico,
no el Atlas 2D ni la capa generativa.** No pretende exhibir todavía las
562 INCLUDE de T2CC, porque V2 requiere publicación nueva e independiente.

## Seguridad, trazabilidad y pruebas

La política prohíbe PDFs y textos completos en Git, releases, Pages,
artefactos, datasets derivados y cachés persistentes. El visor no acepta
enlaces remotos fuera de los dominios institucionales autorizados,
ni rutas `*.pdf`, `/bitstream` o `/download`. La aplicación construye
las fichas con `textContent`, evitando inyectar HTML procedente de metadatos.

Pruebas automáticas:

- `tests/test_thesis_demo_index_v1.py`: admisión estricta, URLs,
  fechas sospechosas, ausencia de cargas documentales y fail-closed;
- `tests/thesis-demo.test.mjs`: acentos, filtros, fechas, paginación,
  identidad de corpus y veto de enlaces externos/descargas;
- workflow `.github/workflows/thesis-demo-v1.yml`:
  prueba en PR sobre la release real, verifica la release y genera
  el índice de 561 registros de forma reproducible;
- `deploy.yml`: reconstruye desde release verificada y exige índice
  pequeño, 561 identidades únicas y ausencia de PDF en el artefacto del demo.

No deben declararse demo publicado, resultados reales visibles o URL lista
para compartir antes de: merge manual → GitHub Actions SUCCESS para el SHA
fusionado → HTTP de `tesis.html` y `data/theses/demo-v1/index.json`.

## Etapas posteriores

1. Activación de V2 inmutable (562 INCLUDE), con manifest y despliegue
   independiente de T2CC, y switch del índice tras verificación.
2. Mejoras de experiencia de búsqueda basadas en uso real, manteniendo
   filtros transparentes y provenance.
3. Integración Author Authority Graph, relacionados y Atlas 2D una vez
   admitidos sus contratos y benchmarks.

La implementación no modifica AcademicProgramAuthority, Scope Policy,
Metadata Confidence, ni las adjudicaciones documentadas de obras.
