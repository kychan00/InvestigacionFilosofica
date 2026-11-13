# Sincronía — lote 5: verificación negativa y conservación de ocho registros (2026-11-13)

## Base verificable

- Rama inspeccionada antes de la investigación: `feature/cucsh-sincronia`, HEAD `65d311ef4f2be55312df5602d2818adf3bc2f627`.
- La última restauración aprobada es [Action #43406831800](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/43406831800), `completed/success`. Se descargó su artefacto `sincronia-yoon` y se inspeccionó directamente `sincronia-yoon-pending-authors.json`: **1,845 registros CUCSH**, **1,454 de Sincronía**, **51 sin autor**, de los que **49 son posibles artículos** y **2 páginas de navegación editorial**. No son estimaciones derivadas de informes anteriores.
- La presente revisión **no atribuye autores ni altera el corpus**: las fuentes disponibles no enlazan inequívocamente firma, título y ejemplar/URL original. No se ha ejecutado una nueva Action de restauración ni `npm test` para este documento.

## Ocho registros nuevos examinados

Estos ocho registros **no se incluyen** entre los ocho examinados en el lote 4. Los identificadores, títulos y rutas provienen del artefacto auditado de la Action exitosa, no de reconstrucciones por apellido.

| Núm. | ID (sufijo) | Título del índice congelado | URL histórica | Decisión |
|---|---|---|---|---|
| 2 | `5a5c77cbf7b126732d8e` | Debate sobre desaparecidos en la Argentina de Menem | http://fuentes.csh.udg.mx/CUCSH/Sincronia/figioni.htm | Sin prueba externa de firma; el nombre de archivo no la acredita. |
| 4 | `350cd62320155bec831b` | ¿Amigos o Enemigos? | http://sincronia.cucsh.udg.mx/sergio.htm | Título genérico y nombre de pila en URL, sin identidad acreditada. |
| 7 | `4b66525607125c9d8c80` | Yolanda Bedregal | http://fuentes.csh.udg.mx/CUCSH/Sincronia/bedregal.htm | Nombre puede ser objeto de perfil, no necesariamente firma. |
| 7 | `503927fb46aa32462439` | Elsa Dorado de Revilla | http://fuentes.csh.udg.mx/CUCSH/Sincronia/revilla.htm | Índice con nombre personal, falta confirmar autoría y naturaleza de la pieza. |
| 7 | `8fc5dab0bf280ad85a8d` | Velia Calvimontes Salinas | http://fuentes.csh.udg.mx/CUCSH/Sincronia/velia.htm | No transferir el nombre del título al campo autores sin texto original. |
| 9 | `4784c1d977cea2ee58c4` | Nuevas Tecnologias, Nuevas Profesiones | http://fuentes.csh.udg.mx/CUCSH/Sincronia/anuies.htm | `anuies` puede indicar una institución, no un autor individual. |
| 9 | `47f368eb8611d2cb666e` | Consideraciones acerca de William Butler Yeats | http://fuentes.csh.udg.mx/CUCSH/Sincronia/freiderich.htm | Ni Yeats ni el apellido de la ruta bastan para acreditar la firma. |
| 11 | `092c265452a009c0ddf5` | Los elementos ocultistas en la obra de Jorge Luis Borges | http://fuentes.csh.udg.mx/CUCSH/Sincronia/velasco.htm | Borges es objeto de estudio, no autor del artículo; apellido de ruta no prueba identidad. |

### Acceso primario y falsos positivos

Se intentó abrir directamente `figioni.htm`, `anuies.htm` y `velasco.htm` desde las URLs históricas: el acceso falló. Esto **no demuestra** que no existan capturas archivadas ni autoriza modificar `legacyAccessStatus`. Se comprobó también un resultado externo que parecía contener la frase «cronotopía y marginalidad discursiva», pero era un libro distinto, *Cronotopías urbanas* (René Julio Castillo, Universidad Libre, 2012), por lo que **no** acredita la firma del artículo de *Los muros de agua* del número 5. Véase https://es.scribd.com/document/1043216300/CRONOTOPIA; se excluye expresamente como evidencia de identidad de obra.

### Próxima búsqueda priorizada

1. Obtener capturas de las URLs exactas anteriores en repositorios de preservación o índices universitarios con firma explícita.
2. Comprobar el número 7 como posible sección de perfiles, semblanzas o antología: no confundir el sujeto del título con la autoría.
3. Examinar el conflicto de `reyes4.htm` (año/número) y `korstanjespring09.htm` (dos posibles obras) sin resolver por conjetura.
4. En cuanto se documente una firma, restaurar en un solo lote de hasta ocho con controles fail-closed, auditoría histórica, auditoría de pendientes y `npm test`, siempre en la rama existente.

**Política:** conservar IDs, orden, títulos, fechas, números, URLs y accesibilidad históricos; mantener aparte las dos páginas editoriales; no modificar `main`, no hacer merge ni abrir PR nuevo.
