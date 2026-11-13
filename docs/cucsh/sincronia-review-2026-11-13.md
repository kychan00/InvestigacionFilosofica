# Sincronía — verificación de candidatos pendientes (2026-11-13)

Estado de partida confirmado por la Action #43376924914 (SUCCESS), artefacto `sincronia-pts-pending-authors.json`: 1,845 registros CUCSH; 1,454 Sincronía; 52 sin autor, de los cuales 2 son navegación editorial y 50 candidatos a artículo. El lote anterior recuperó Ponce, Martínez Torres y Semo. Este documento registra resultados de búsqueda **sin atribuir autorías no demostradas**.

## Ocho candidatos inspeccionados

| ID (sufijo) | Núm. | Título indexado | Resultado / evidencia insuficiente |
|---|---:|---|---|
| 436f156845f87b644223 | 1 | La traducción del inglés al español de los Collected Papers de Charles Sanders Peirce, | El Grupo de Estudios Peirceanos de la Universidad de Navarra acredita a Fernando Carlos Vevia Romero como traductor del volumen de 1997, **no como autor del artículo Sincronía de 1996**. La cronología exige corroboración directa. |
| 53ca1099d5f51b81cc33 | 1 | Nicaragua´s Thermidorian Reaction | El archivo termina en `costantini.html`; no se encontró una fuente bibliográfica independiente que una título, autor y URL. No convertir nombre de archivo en firma. |
| 2126d56c91012923e100 | 4 | American Frontiers, Gregory H. Nobles | El nombre Gregory H. Nobles identifica al autor del **libro reseñado**, no necesariamente al reseñista de Sincronía. `mandell.htm` no basta para atribución. |
| 63fcb1b95f79aa94948b | 4 | El deber de la critica | `zinser.htm` es una pista onomástica, no una prueba de autoría; resultados sobre Aguilar Zinser no confirman esta obra exacta. |
| d033194e9ccdac732454 | 4 | After Chenalho: No More Business as Usual | `castaned.htm` no identifica de forma comprobada al autor; resultados recientes con «No More Business as Usual» son obras diferentes y posteriores. |
| 4869f07f890d2997ddb1 | 5 | Cronotopía y marginalidad discursiva en la novela _Los muros de agua_ de José Revueltas | `duran.html` no constituye firma; falta índice con autor o copia de la obra. |
| 8fc5dab0bf280ad85a8d | 7 | Velia Calvimontes Salinas | Entrada titulada con nombre de persona; sin página original no se puede decidir si es autora, entrevistada o sujeto biográfico. |
| 8eded0eac6e2a217ade1 | 50 | Korstanje, Maximiliano E. | **Conflicto existente, no resolver**: Dialnet atribuye dos obras distintas al mismo autor en el mismo número; no hay mapeo inequívoco de `korstanjespring09.htm` a una de ellas. |

## Fuentes consultadas y alcance

- Universidad de Navarra, Grupo de Estudios Peirceanos, «Peirce en español»: https://www.unav.es/gep/Peirce-esp.html — confirma traducción del libro de Peirce por Fernando C. Vevia, pero **no** la autoría del artículo de 1996.
- Universidad de Guadalajara, `Filosofía del siglo XXI` (2009), volumen dedicado a Fernando Carlos Vevia Romero: https://pdfcoffee.com/vevia-romero-fernando-carlos-filosofia-del-siglo-xxi-pdf-free.html — en su bibliografía se documentan otras colaboraciones con Sincronía (1999 y 2000), **no** el artículo de 1996. Copia de tercero; verificar contra ejemplar institucional.
- Dialnet, número 50: https://dialnet.unirioja.es/ejemplar/251077 — conflicto Korstanje previamente registrado en auditoría.
- Archivo original histórico: conservar todas las URL de `sincronia-pts-pending-authors.json`, sin declarar que estén accesibles.

## Decisión y siguiente ruta

**0 atribuciones nuevas acreditadas en esta investigación.** No se modifica `src/data/cucsh-filosofia.json`, ni el contador 52, ni las dos páginas editoriales. No afirmar éxito de una restauración sin Action de datos. Priorizar índices originales de números 1, 4, 5 y 7, capturas Wayback de URLs exactas y bibliografías institucionales que identifiquen **título + firma**; en número 50 se exige además **URL exacta + título**. Las coincidencias temáticas, apellidos en rutas y nombres de personas como títulos son insuficientes.
