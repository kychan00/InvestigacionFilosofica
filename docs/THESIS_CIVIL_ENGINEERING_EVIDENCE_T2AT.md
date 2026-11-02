# T2AT — Ingeniería Civil · Evidence Boundary Audit V1

## Estado
**HOLD — auditoría no admisiva.** No crea ni modifica Program Authority, aliases, Metadata Confidence o admission.

## Selección post-V27

En la Queue full congelada (27,576 obras), el mayor grupo unresolved individual es:

- `licenciatura en ingenieria civil` — **1,197 obras**, todas asignadas a **CUCEI**.
- `programRef = null`; admission observado: **QUARANTINE**.

El nombre institucional actual **Ingeniería Civil** está publicado en la División de Ingenierías de CUCEI. Esta evidencia establece el ámbito disciplinar, pero **no** constituye por sí sola una decisión de aplicar autoridad retrospectiva a todos los registros históricos del corpus.

Fuente: https://www.cucei.udg.mx/index.php/oferta-academica/licenciaturas

## Límite importante: no confundir niveles

También se observaron **36 obras** en cuatro etiquetas de posgrado distintas:

| Etiqueta normalizada | Obras |
| --- | ---: |
| maestria en ciencias de la ingenieria civil | 24 |
| maestria en ingenieria civil | 10 |
| maestria en ciencias en la ingenieria civil | 1 |
| maestria en ingenieria civil especialidad estructuras | 1 |

CUCEI publica una **Maestría en Ingeniería Civil** separada de la licenciatura y explica su carácter profesionalizante. Esa documentación **no autoriza** a fusionar automáticamente las otras tres denominaciones históricas como aliases del posgrado vigente.

Fuentes:
- https://www.cucei.udg.mx/node/102
- https://www.cucei.udg.mx/maestrias/ingenieria-civil/es/acerca-de

## Protocolo de evidencia

El auditor de familia existente calcula sobre el artifact full congelado:

- fuente y programa crudos;
- acuerdo/desacuerdo de `dc.degree.name`;
- unidad académica observada;
- fechas y cohortes;
- títulos duplicados entre programas;
- conflictos estructurales de título y autor;
- pares internos o externos al cohort seleccionado.

Su resultado se publica en los artifacts del workflow. Las métricas de conflicto se derivan del corpus y **no se suponen a priori**.

El regex `^licenciatura en ingenieria civil$` sólo define el cohort de auditoría; no es una regla de búsqueda, normalización de identidad ni admisión.

## Límites obligatorios

1. No crear Program Authority V28 en T2AT.
2. No convertir títulos o temas de tesis en evidencia programática.
3. No combinar licenciatura y maestría por semejanza nominal.
4. No borrar cuarentena ni conflictos estructurales.
5. Conservar el registry V27 y Metadata Confidence V4 intactos.
6. Mantener evidencia separada de conclusiones de autoridad.

## Siguiente decisión

Tras verificar el reporte estructural completo y las fuentes institucionales, una fase posterior podrá decidir **sólo para la etiqueta exacta** si corresponde un programa `EXCLUDE` bajo `humanities-only`, siempre sujeto al veto item-level de Metadata Confidence.

No se inferirá autoridad para las cuatro variantes de maestría hasta documentar su identidad institucional y temporal.
