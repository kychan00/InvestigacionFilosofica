# Sincronía · Auditoría del corpus histórico CUCSH (11 de noviembre de 2026)

## Alcance y estado

La integración se trabaja únicamente en la rama `feature/cucsh-sincronia`. No hay publicación en `main` ni PR de integración nuevo. El *snapshot* de esta rama contiene **1,450 registros de Sincronía**, junto con los **391 registros previos** de Protrepsis (303) y Quadripartita Ratio (88): **1,841 registros CUCSH Filosofía**.

- **Números 1–60**: 598 artículos, procedentes de archivo original UdeG, Dialnet y Redalyc.
- **Números 61–90**: 852 artículos reconciliados contra el índice de números del OJS y su alimentación OAI-PMH.
- **Total de números representados**: 90/90.
- **Originales conservados**: ninguno fue eliminado durante el backfill del número 44.

El recuento de números es una **cobertura de números editoriales, no certificación de exhaustividad de cada artículo**. Los pisos históricos impiden regresiones de publicaciones observadas, pero no sustituyen la comparación bibliográfica con los sumarios originales.

## Hallazgo corroborado: número 44 (2007)

En la auditoría de bajo volumen se consultó el ejemplar de Dialnet [547426](https://dialnet.unirioja.es/ejemplar/547426). Nuestro snapshot contenía 2 artículos; Dialnet devolvió 10. Se incorporaron los siguientes ocho artículos con identificadores de artículo independientes y autoría verificada en la respuesta del catálogo:

| Dialnet | Título |
|---|---|
| 7417990 | Génesis de un personaje teatral |
| 7417991 | Un estudio contrastivo de los fonemas oclusivos entre español y chino |
| 7417992 | Antropología de la conquista |
| 7417993 | Una aproximación sistémica a la realidad política |
| 7417994 | ‘Trust’ and Power |
| 7417995 | Elementos simbólicos y míticos en La Fiesta del Chivo, de Mario Vargas Llosa |
| 7417996 | Pedro Páramo, de Juan Rulfo y La viuda, de Hwang Sun Won |
| 7417997 | Desarrollo de habilidades lecto-investigadoras en lengua extranjera mediante textos virtuales |

**Coincidencia por revisar:** el artículo de código Dialnet `7417991` (número 44) comparte título con el código `2289013` (número 39). Son dos registros bibliográficos diferentes. Ambos permanecen en el corpus, y el informe de la inserción documenta la coincidencia; **no se fusionan automáticamente**.

La comparación de los números **29, 31, 33, 34 y 55** encontró el mismo número de artículos en el snapshot y en Dialnet, con títulos/identificadores coincidentes. El número 44 quedó con los **10** registros identificados.

## Otras revisiones pendientes

Los números antiguos **3, 6 y 8** fueron contrastados posteriormente con los índices originales: **4/4**, **3/3** y **3/3** enlaces de artículos coincidentes, sin faltantes en esos sumarios ([auditoría 43030104902](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/43030104902)). Esto acredita concordancia con el índice accesible, no revisión editorial independiente de cada página.

La auditoría de autorías encontró **204 registros sin autores**, todos procedentes del archivo original (355 de Dialnet y 39 de Redalyc ya contaban con autoría). Una muestra de diez páginas ([auditoría 43030567727](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/43030567727)) mostró falsos positivos del extractor, incluidas afiliaciones universitarias. Por eso se incorporaron **seis atribuciones verificadas contra la línea de autor junto al título**, sin inferir nombres en registros no confirmados: Helen Galkina y Marcial Gonzalez (número 3), Gilbert Larochelle y Antonio L Rappa (número 6), José María Areta (número 47) y Kyeong-Eun Park (número 50). [Validación e incorporación 43031380471](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/43031380471). Quedan **198 registros históricos sin autor**.

Se corrigió el lector de páginas HTML antiguas con codificación Latin-1 / Windows-1252 para futuras consultas y se auditó el corpus guardado. Se detectaron **69 registros históricos** con al menos un carácter de sustitución `�` en título o resumen ([auditoría 43031884214](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/43031884214)).

Se contrastaron 68 títulos afectados correspondientes a 19 números con los índices originales ([comparación 43032349081](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/43032349081)): 41 coincidencias fuertes de título y URL, 21 documentos cuyos índices no pudieron recuperarse, 5 sin coincidencia de enlace y uno que requiere revisar la similitud. Una ficha adicional corresponde a un número fuera del mapa de índices originales consultado.

**Se repararon exclusivamente los 41 títulos confirmados**, conservando IDs, URL, autorías, relaciones, registros y los nombres anteriores en su procedencia; [validación, búsquedas e integración 43032950925](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/43032950925). El corpus mantiene 1,450 Sincronía y 1,841 CUCSH. **Quedan 28 registros con caracteres de sustitución** por revisar con otras fuentes. Ningún título no confirmado fue modificado.

La validación ahora impide que cosechas posteriores borren autorías verificadas, reviertan títulos reparados o pierdan sus datos de procedencia.

También quedan observaciones sobre coincidencias entre títulos. Una ausencia de autor no autoriza inventar nombres.

## Evidencia reproducible

- Auditoría estructural por número: [GitHub Actions 42975117370](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/42975117370). Antes del backfill, 60/60 números, 590 registros, cero errores estructurales, 32 observaciones de revisión.
- Comparación de números escasos en Dialnet: [GitHub Actions 42975312757](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/42975312757). Detectó los ocho artículos faltantes del 44.
- Integración de los ocho registros: [GitHub Actions 42975808247](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/42975808247). Validación estricta, pruebas de búsqueda y regresión correctas. La nueva auditoría: 598 registros históricos, cero errores estructurales, 31 observaciones.
- Scripts: `scripts/cucsh/audit_sincronia_historical.py`, `scripts/cucsh/audit_sincronia_early.py`, `scripts/cucsh/probe_sincronia_author_sources.py`, `scripts/cucsh/backfill_sincronia_authors.py`, `scripts/cucsh/probe_sincronia_sparse.py`, `scripts/cucsh/backfill_sincronia_44.py`, `scripts/cucsh/propose_sincronia_title_repairs.py` y `scripts/cucsh/apply_sincronia_title_repairs.py`.

**Política:** cualquier ampliación futura debe preservar identificadores y URLs originales, evitar duplicados según evidencia editorial, producir reporte auditable y superar pruebas antes de incorporarse a esta rama.
