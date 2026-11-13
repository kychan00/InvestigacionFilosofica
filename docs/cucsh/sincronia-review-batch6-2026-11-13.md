# Sincronía — lote 6: ocho registros, verificación negativa y nueva fuente institucional (2026-11-13)

## Estado real y política de integridad

- Rama consultada: `feature/cucsh-sincronia`, HEAD anterior `6e402c949b0018cc4b24e15814f66e8efb08a985`.
- Última restauración aprobada: [Action #43406831800](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/43406831800). Su artefacto `sincronia-yoon-pending-authors.json` se descargó e inspeccionó directamente en esta ejecución: `totalSincroniaRecords=1454`, `pendingAuthorRecords=51`, `authorlessArticleCandidatesExcludingEditorialNavigation=49`, `highConfidenceEditorialNavigationCount=2`. El total CUCSH de 1845 consta en la auditoría del lote anterior y la validación de esa Action. Estos son recuentos del artefacto aprobado, no una nueva auditoría del HEAD.
- Se revisan **ocho registros no incluidos en los lotes 4 y 5**. Ninguno se atribuye sin prueba de vínculo entre autor, obra y edición o URL histórica. Se preservan corpus, IDs, orden, fechas, enlaces y estados. No hay nueva Action de restauración ni ejecución de `npm test`, porque no se altera el corpus.

## Ocho candidatos investigados

| Número | ID sufijo | Rótulo histórico | URL congelada | Decisión |
|---|---|---|---|---|
| 8 | `4800ef829bfca4e699cb` | Atreverse | http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/ana.html | La carpeta `dante` no acredita firma de Dante Medina; `ana.html` podría señalar otra persona u obra. |
| 8 | `582537d89e07194c5970` | Hypertextualizado | http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/hyper.html | Carpeta común no acredita autoría de cada pieza. |
| 8 | `a9b2551729fe0893d5e3` | Dante Medina | http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/bio.html | `bio.html` sugiere ficha biográfica, no artículo firmado; no convertir el nombre del título en firma. |
| 10 | `935efad9845e05a0557f` | Mercado laboral y sociedad civil | http://fuentes.csh.udg.mx/CUCSH/Sincronia/mercado.htm | Título genérico: no se halló fuente que una firma y URL. |
| 12 | `049b6fce1737edb3c1c1` | Bañuelos,Raul | http://fuentes.csh.udg.mx/CUCSH/Sincronia/banuelos.htm | El nombre es rótulo del índice, no prueba del autor de un texto específico. |
| 12 | `2e5cafc18653b60bce9f` | Clemente, William A. | http://fuentes.csh.udg.mx/CUCSH/Sincronia/clemente2.htm | No atribuir el nombre del índice sin contenido primario. |
| 12 | `498c90b4e581430b8d98` | Rhodes, Robin, | http://fuentes.csh.udg.mx/CUCSH/Sincronia/rhodes.htm | Falta título de la obra y firma primaria. |
| 12 | `a3e241ad29f293bd2136` | Velasco,Arnulfo Eduardo, | http://fuentes.csh.udg.mx/CUCSH/Sincronia/velasco2.htm | La participación documentada de Velasco en otros números no identifica el contenido de esta ruta. |

## Hallazgo institucional nuevo y su alcance

El artículo académico de **Javier Ponce y Madai Peña** en la revista de la **Universidad de Guadalajara**, *Elementos y desafíos para crear, desarrollar y mantener una revista electrónica. Los casos: Argos y Sincronía* (2016), describe directamente la historia editorial de Sincronía: fue lanzada en el invierno de 1996 por Stephen W. Gilbert; participaron al inicio Dolores Pérez y Claudia Macías; posteriormente Javier Ponce y Raúl E. Rodríguez Monsiváis ejercieron la codirección. La fuente distingue claramente las revistas **Argos** y **Sincronía**, cuya historia está entrelazada, pero cuyos registros no deben fusionarse: https://paakat.cugdl.udg.mx/index.php/paakat/article/view/264/html

Esta fuente aporta procedencia institucional sólida para un futuro apartado histórico/editorial de la revista. **No acredita por sí sola las firmas de los ocho artículos de este lote**. En particular, confirma la actividad literaria de Dante Medina y Raúl Bañuelos en otros contextos, pero no vincula sus nombres a `ana.html`, `hyper.html` o `banuelos.htm`.

Otra fuente, Dialnet, confirma publicaciones de Arnulfo Eduardo Velasco en el número 25 (2002), **no** el contenido del registro `velasco2.htm` del número 12: https://dialnet.unirioja.es/ejemplar/60678. La atribución cruzada por autor y revista sería un falso positivo.

## Decisión y siguiente paso

- **Cero nuevas autorías acreditadas en este lote**; no se editan metadatos, ni se simula una Action exitosa.
- Próxima prioridad: recuperar capturas fechadas de `dante/ana.html`, `dante/hyper.html`, `dante/bio.html` y de los cuatro rótulos personales del número 12. Clasificar `bio.html` como ficha biográfica solamente tras verificar el contenido original.
- Mantener irresueltos el conflicto año/edición `reyes4.htm` y la ambigüedad de obra `korstanjespring09.htm`; conservar las dos páginas editoriales sin autor como navegación.
