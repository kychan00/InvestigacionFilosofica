# Sincronía — auditoría confirmada y lote de ocho identidades (2026-11-13)

## Estado confirmado, no estimado

- Rama verificada: `feature/cucsh-sincronia`; HEAD de corpus: `1b50811a7f67b565922b834c7d74c39b38b92e7d`.
- [Action #43406831800](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/43406831800): **completed / success**. El job verificó las pruebas de restauración de Yoon Bong Seo, auditoría histórica, auditoría de pendientes, integridad del corpus y `npm test`, antes de hacer commit del corpus.
- Artefacto de esa Action: `sincronia-yoon` (informes `sincronia-yoon-historical-quality.json` y `sincronia-yoon-pending-authors.json`). El informe de pendientes fue inspeccionado directamente, no inferido de recuentos antiguos.
- CUCSH: **1,845** registros (según controles de Action); Sincronía: **1,454**; Sincronía sin autor: **51**, de los cuales **49** son candidatos a artículo y **2** son navegación editorial, que no debe recibir autor. En el informe, `pendingByIssue` suma 51; `titlesWithUnicodeReplacementCharacter=0`.
- Sigue existiendo **1 conflicto bibliográfico** (`reyes4.htm`, número 12 / 1999 frente a referencia del número 21 / 2001) y **1 asignación ambigua de URL** (`korstanjespring09.htm`, número 50, dos posibles obras). No resolver mediante conjetura.
- **Este lote de investigación no modificó el corpus**. Por ello no se ejecutó una Action de restauración adicional; la última suite integral aprobada es la Action indicada.

## Ocho candidatos examinados, sin autorías aprobadas

| Número | ID final | Título congelado | URL histórica | Resultado |
|---|---|---|---|---|
| 1 (1996) | `1578698f39fd24636e00` | `,` | `http://fuentes.csh.udg.mx/FrontPage%20Webs/Content/schmid.html` | Título malformado; el apellido de la URL no es prueba de firma ni título. |
| 1 (1996) | `436f156845f87b644223` | La traducción del inglés al español de los Collected Papers de Charles Sanders Peirce, | `http://sincronia.cucsh.udg.mx/vevia.html` | La especialidad del traductor Fernando Carlos Vevia Romero no prueba la firma de esta versión exacta. |
| 1 (1996) | `53ca1099d5f51b81cc33` | Nicaragua´s Thermidorian Reaction | `http://sincronia.cucsh.udg.mx/costantini.html` | Búsqueda de título distintivo sin una ficha fiable que una título, autor y número. |
| 1 (1996) | `af98cc00a0388baabb3d` | Publicación electrónica en Latinoamerica, | `http://sincronia.cucsh.udg.mx/gilbert.html` | Resultados generales de publicación electrónica no identifican esta obra de 1996. |
| 4 (1997) | `2126d56c91012923e100` | American Frontiers, Gregory H. Nobles | `http://sincronia.cucsh.udg.mx/mandell.htm` | Gregory H. Nobles es autor del libro mencionado; no se debe atribuirle automáticamente la reseña. |
| 4 (1997) | `63fcb1b95f79aa94948b` | El deber de la critica | `http://sincronia.cucsh.udg.mx/zinser.htm` | Frase genérica; sin firma documentada. |
| 4 (1997) | `d033194e9ccdac732454` | After Chenalho: No More Business as Usual | `http://sincronia.cucsh.udg.mx/castaned.htm` | Coincidencias temáticas contemporáneas no identifican artículo ni autor de 1997. |
| 5 | `4869f07f890d2997ddb1` | Cronotopía y marginalidad discursiva en la novela _Los muros de agua_ de José Revueltas | `http://fuentes.csh.udg.mx/CUCSH/Sincronia/duran.html` | Sin fuente independiente que acredite nombre completo, firma y edición. |

### Método y límite

Se revisó la cola real de pendientes de la Action exitosa y se hicieron búsquedas específicas por títulos y por posibles firmas. Los resultados accesibles no establecieron ninguna nueva correspondencia **título + firma + ejemplar o URL histórica** para los ocho registros. La presencia de un apellido en una ruta, la autoría del libro reseñado o una obra posterior del mismo investigador son insuficientes. No se alteraron IDs, orden, título, año, número, URL, accesibilidad, autores ni estados archivísticos.

### Próximo paso

Priorizar la captura original de `mandell.htm`, `vevia.html`, `costantini.html`, `duran.html` y `schmid.html`; buscar índices institucionales que citen la **misma URL** y firma. Continuar por lotes de hasta ocho, aplicando únicamente los casos acreditados en una Action con controles fail-closed, auditorías y `npm test`. No modificar `main`, no fusionar y no abrir PR.
