# Sincronía — tercer lote: control cruzado de identidades y cobertura (2026-11-13)

## Estado verificable y alcance

Rama consultada antes de esta revisión: `feature/cucsh-sincronia`, HEAD `a383b81f746942c0131b83d2031ac6c18052c071`. La última restauración **comprobada mediante CI**, Action [#43376924914](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/43376924914), dejó 1,845 obras CUCSH, 1,454 Sincronía y 52 sin autor (50 candidatos a artículo, dos páginas editoriales). **No se ha reejecutado una auditoría sobre el HEAD de esta pasada**: esos números son una referencia de la última Action, no un recuento nuevo. Los commits posteriores de los lotes 1 y 2 sólo documentaron investigación.

## Hallazgo verificable: Dialnet identifica trabajos posteriores, no los originales pendientes

La [ficha oficial de la revista en Dialnet](https://dialnet.unirioja.es/servlet/revista?codigo=2487) identifica la publicación con ISSN-e **1562-384X** y la Universidad de Guadalajara, Departamento de Letras, como editor. El sumario accesible comienza, para el periodo histórico pertinente, por el **número 17 de 2000**: [ejemplar 17](https://dialnet.unirioja.es/ejemplar/547854). No puede presumirse cobertura de los números 1, 4, 5, 7, 16 y 18 a partir de ese sumario.

El [ejemplar 21 (2001)](https://dialnet.unirioja.es/ejemplar/294174) sí ofrece datos bibliográficos positivos de *otras obras*, con sus firmas. Permite verificar que algunos nombres del índice antiguo se relacionan con la revista, pero **no** establece que firmaran los documentos pendientes de números anteriores. Esto evita una atribución errónea por homonimia o continuidad editorial.

| Candidato histórico pendiente | Comprobación positiva posterior en Dialnet | Por qué no autoriza modificar la obra histórica |
|---|---|---|
| Giovanni E. Reyes, núm. 16, `ecgrow.htm` | Núm. 21: *Four Main Theories of Development: Modernization, Dependency, World-Systems, and Globalization* — Giovanni E. Reyes | Es un artículo de otro número; `ecgrow.htm` no queda mapeado al título de 2001 |
| Yoon Bong Seo, núm. 16, `revueltas.htm` | Núm. 21: *Intercambios y coincidencias culturales entre Asia y América* — Bong Seo Yoon | La variante de orden del nombre no identifica el documento sobre Revueltas |
| Yoon Bong Seo, núm. 16, `revueltas.htm` | Núm. 21: *Suicidios y/en un cuento de Borges* — Bong Seo Yoon y Claudia Macías Rodríguez | Hay coautoría documentada para una obra distinta; no trasladarla al número 16 |
| Floriano Martins, núm. 18, `fressia.htm` | Núm. 21: *Uma Situação de Palavras* — Jorge Lucio de Campos (entrevistador), Floriano Martins (entrevistado) | La distinción **entrevistador/entrevistado** demuestra el riesgo de convertir el nombre indexado en autor |
| Jason Powell e Ian Cook, núm. 18, `foucchin.htm` | Núm. 21: *Bio-ethics and Technologies of the Self: Understanding Aging* — Jason L. Powell | La obra de 2001 es de Powell solo; no demuestra que la de número 18 fuera de Powell y Cook ni que ambas sean idénticas |
| Fernando Carlos Vevia Romero, núm. 1, `436f156845f87b644223` | Núm. 17: *El texto como productor de sociedad* — Fernando Carlos Vevia Romero | Publicación distinta y posterior; no resuelve firma del artículo sobre traducción de Peirce de 1996 |
| Jorge Medina, núm. 16, `arrivi.htm` | Sin coincidencia inequívoca en los sumarios 17 y 21 revisados | Sin fuente primaria, no deducir título ni firma del archivo |
| Alejandro E. Formanchuk, núm. 16, `formanchuk2.htm` | Sin coincidencia inequívoca en los sumarios 17 y 21 revisados | No se puede usar la ruta como sustituto de portada o firma |

## Decisión de integridad

**Cero atribuciones nuevas**, cero registros de corpus modificados. Las coincidencias con el número 21 son **evidencia contextual**, no pruebas de identidad de una obra histórica. Conservar títulos, IDs, URL originales, años, estados de accesibilidad y el conflicto de Korstanje. Las dos páginas de navegación editorial no se consideran artículos. No se afirma que se haya ejecutado `npm test` o una nueva Action de restauración.

## Siguiente acción de investigación

1. Obtener páginas primarias o capturas archivadas por **URL histórica exacta** de `ecgrow.htm`, `revueltas.htm`, `fressia.htm`, `foucchin.htm` y `formanchuk2.htm`.
2. Verificar encabezado, firma y edición del documento original, y comparar con el índice congelado antes de añadir autorías.
3. Cuando haya una atribución probada, restaurar en lote (hasta ocho), con evidencia por registro, pruebas fail-closed, auditorías de integridad y `npm test` en una sola Action. No tocar `main`, no abrir PR ni fusionar.
