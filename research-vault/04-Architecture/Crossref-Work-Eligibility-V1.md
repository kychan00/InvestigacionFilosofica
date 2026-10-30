---
type: architecture-note
project: InvestigacionFilosofica
status: deployed
updated: 2026-10-30
---

# Crossref Work Eligibility V1

## Problema observado

La consulta `tecnociencia` recuperaba numerosos registros rotulados como
`TECNOCIENCIA Chihuahua`. No eran artículos sobre el concepto, sino objetos
editoriales de Crossref: revistas completas y fascículos con DOI propio.

La anomalía no pertenecía al concepto `tecnociencia`. Puede ocurrir siempre
que una consulta coincida con el nombre de una revista, volumen o serie.
Crossref mezcla obras citables y contenedores editoriales en el endpoint
`/works`; el pipeline productivo los normalizaba sin distinguirlos.

## Regla productiva

La elegibilidad se resuelve ahora en el límite de la fuente Crossref, antes de
la fusión y el ranking:

1. se exige un título no vacío;
2. se excluyen tipos de contenedor como `journal`, `journal-issue`,
   `journal-volume`, `book-series`, `book-set`, `proceedings-series`,
   `report-series` y `standard-series`;
3. se conservan artículos, capítulos, libros, monografías y demás obras
   documentales aunque su título contenga el mismo término que una revista;
4. una consulta libre mantiene `query.bibliographic`, para no perder autores
   arbitrarios que todavía no estén clasificados localmente;
5. una intención de autor ya explícita usa `query.author`, y una obra ya
   reconocida usa `query.title`.

No existe una lista negra de conceptos, revistas o personas.

## Verificación

- suite completa: 120/120 pruebas;
- `Alonso Nava Amezcua` muestra en producción sus obras directas en los puestos
  1 y 2, con coincidencia exacta de autor;
- `tecnociencia` devuelve diez obras en el smoke público final y cero
  apariciones de `TECNOCIENCIA Chihuahua`;
- se comprobó la invalidación de caché del módulo para navegadores que habían
  cargado la primera publicación;
- workflow final de GitHub Pages: `41077241618`, completado correctamente.

## Linaje productivo

- PR 40 / merge `68a5704a9bca1d6dce51e3f1bcf2f3921b0d62ab`: gate de
  elegibilidad y pruebas iniciales;
- PR 41 / merge `10c69e1abdb0c2f222a3a0071ffdae37315474a2`: preservación de
  descubrimiento de autores en consultas libres;
- PR 42 / merge `7a65e818d5b5233e918f8318e16ab69f9088729a`: invalidación
  explícita de caché.

## Límite epistemológico

Esta es una regla de higiene de candidatos de una fuente bibliográfica, no una
evaluación de relevancia filosófica. No usa labels humanos, Qwen o tuning; no
modifica `src/core/rank.js`, el retrieval semántico ni los artefactos
experimentales congelados. El código ejecutable y sus pruebas permanecen en el
repositorio principal; esta nota conserva su interpretación arquitectónica.
