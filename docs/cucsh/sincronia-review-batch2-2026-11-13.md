# Sincronía — segundo lote de verificación histórica (2026-11-13)

## Base comprobada

Se consultó la rama `feature/cucsh-sincronia`, HEAD inicial `6819f9cd5782507aa55f21cb3888654e353384bc`, y el artefacto `sincronia-pts-pending-authors.json` de la Action exitosa [#43376924914](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/43376924914). El artefacto registra **1,845 registros CUCSH**, **1,454 de Sincronía**, **52 sin autor**, desglosados en **50 candidatos a artículo y dos entradas de navegación editorial**. No se presupone que un rótulo onomástico de índice sea una firma del texto.

## Segundo lote de ocho candidatos: sin atribución autorizada

Esta pasada prioriza los rótulos de índice que parecen firmas, pero cuyo **título real de obra es desconocido**. Se revisaron búsquedas de texto exacto con el nombre del autor y la ruta histórica en buscadores; ninguna arrojó un documento primario que pruebe simultáneamente identidad del artículo, firma y enlace.

| ID (sufijo) | Número | Rótulo histórico | URL histórica | Resultado y condición para desbloquear |
|---|---:|---|---|---|
| `45e6f64e9c503606fd0d` | 16 | Medina, Jorge | `http://fuentes.csh.udg.mx/CUCSH/Sincronia/arrivi.htm` | `arrivi` podría aludir a una obra o tema, no identifica autor. Se necesita página con encabezado y firma. |
| `78815d4ff675c1655f09` | 16 | Reyes, Giovanni E. | `http://fuentes.csh.udg.mx/CUCSH/Sincronia/ecgrow.htm` | El nombre indexado es una pista de autoría, pero `ecgrow` no prueba título ni versión del artículo. |
| `a3d34239ce50b4e18aa4` | 16 | Shulterbrandt, Sahnya, | `http://fuentes.csh.udg.mx/CUCSH/Sincronia/cabeza.htm` | No deducir título o firma a partir de `cabeza`; falta fuente primaria. |
| `b6f5b07d79cc222d68e1` | 16 | Forum Intercultura | `http://fuentes.csh.udg.mx/CUCSH/Sincronia/uspr.htm` | Puede ser entidad, foro o sección, no necesariamente autor personal. Exige clasificación documental antes de atribución. |
| `c620fd33bd50bf1b7558` | 16 | Formanchuk, Alejandro E. | `http://fuentes.csh.udg.mx/CUCSH/Sincronia/formanchuk2.htm` | La semejanza del apellido con la ruta no sustituye una firma verificable. |
| `e60046233994aa2ee497` | 16 | Yoon Bong Seo | `http://fuentes.csh.udg.mx/CUCSH/Sincronia/revueltas.htm` | Una URL alusiva a Revueltas no acredita un título preciso ni la firma de Yoon Bong Seo. |
| `b79324bd7275d6009db8` | 18 | Powell, Jason & Ian Cook | `http://sincronia.cucsh.udg.mx/foucchin.htm` | Búsqueda de combinación de autores y `foucchin.htm` sin copia primaria concluyente; preservar coautoría posible sin escribirla como verificada. |
| `e904a85e0a828a3eb2e9` | 18 | Martins , Floriano | `http://sincronia.cucsh.udg.mx/fressia.htm` | Búsqueda de nombre y `fressia.htm` sin prueba de firma del documento; el nombre del archivo no autoriza título. |

### Evidencia negativa y trazabilidad

- Se consultaron búsquedas textuales específicas para las rutas `foucchin.htm`, `fressia.htm`, `revueltas.htm`, `arrivi.htm` y `ecgrow.htm` con los rótulos correspondientes; el motor no devolvió coincidencias documentales. **La ausencia de resultados no prueba ausencia de publicación**.
- Para `cabeza.htm`, `uspr.htm` y `formanchuk2.htm`, el informe identifica el requisito de prueba primaria, no una autoría acreditada.
- Fuentes de control: [Action #43376924914](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/43376924914), artefacto `sincronia-pts`; informe de la primera pasada `docs/cucsh/sincronia-review-2026-11-13.md`.

### Decisión

**0 registros bibliográficos alterados.** No se crean autores, títulos, años ni URLs sustitutas. Se conservan las dos entradas de navegación editorial del número 46 sin atribución y el conflicto de mapeo URL/obra de Korstanje en el número 50. El contador de 52 procede de la última Action de datos comprobada, no de una nueva Action. No corresponde ejecutar `npm test` o un workflow de restauración cuando no hay cambio de código ni de corpus; no se declara una CI nueva como exitosa.

**Siguiente vía de recuperación:** capturas de Wayback por URL exacta, copias de los números 16 y 18 en hemerotecas, y bibliografías institucionales que vinculen simultáneamente título, firma y edición. Mantener `main` y los PR intactos.
