# T2AV — Química Farmacobiológica · auditoría de evidencia

## Decisión

**HOLD — evidence only.** Esta fase no crea ni modifica autoridad de programa, aliases o admisiones.

La Queue full posterior a la integración V28 identifica como mayor grupo unresolved a `licenciatura en quimica farmacobiologica`, con **1,085 obras** de CUCEI. En el corpus congelado:

- 1,085 documentos con `programRef = null`, todos `quarantine`.
- 1,082 fechas válidas; dos sospechosas y una desconocida.
- Una sola etiqueta de programa normalizada observada en este cohort.

Se utiliza un criterio **exacto** de programa, no de similitud temática. No se confunden Química Farmacobiológica, Ingeniería Química, Farmacia, Bioquímica o etiquetas de posgrado, aunque puedan compartir contenidos académicos.

## Evidencia conservada

- Fuente reproducible: artifact original full `13099541204` del repositorio.
- Versión de autoridad al iniciar: `2026-11-02.v28`.
- Metadata Confidence: sin cambios.
- CI `Thesis QFB evidence T2AV`: cálculo de acuerdos/desacuerdos del programa, procedencia, fechas, duplicados por título, pares estructurales título+autor y conflictos externos.

El reporte calcula los conflictos desde el corpus completo; **no se inventa una cantidad antes de ejecutarlo**. Conflictos estructurales, si existen, serán bloqueantes para futuras decisiones item-level.

## Siguiente decisión

Una futura V29 requiere evidencia institucional del título exacto y revisión de conflictos estructurales reales. Sólo entonces podrá valorarse EXCLUDE bajo el objetivo humanities-only, sin borrar registros ni resolver identidades por regex.
