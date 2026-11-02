# T2AU — Program Authority V28 parcial: Ingeniería Civil

## Evidencia y decisión

**Decisión V28:** `program:udg:ingenieria-civil`, licenciatura de CUCEI, `exclude` en el buscador de **humanidades UdeG**, sin eliminar obras de la colección de origen.

- Grupo exacto: `licenciatura en ingenieria civil`.
- **1,197 obras** con acuerdo entre el programa de RIUdeG y `dc.degree.name`.
- **CUCEI: 1,197**, sin desacuerdos de fuente.
- **28 advertencias** por título coincidente con otra etiqueta, pero **0 conflictos estructurales** de título y autor.
- Años válidos observados: 1965–2025; 1 fecha sospechosa y 5 sin fecha válida.
- Fuente institucional actual: https://www.cucei.udg.mx/es/oferta-academica/licenciaturas/licenciatura-en-ingenieria-civil
- Oferta de licenciaturas de CUCEI: https://www.cucei.udg.mx/index.php/oferta-academica/licenciaturas

Fuente de corpus congelado: artifact `13099541204`; auditoría de evidencia T2AT: artifact `13169256251`. El nombre contemporáneo se utiliza para establecer el programa exacto, **no para inferir** una equivalencia automática de todas las denominaciones históricas o próximas.

## Límites

**No se agregan aliases por semejanza.** Sólo la etiqueta exacta de licenciatura se resuelve a V28.

La auditoría T2AT también observó **36 obras** en cuatro etiquetas de maestría. Quedan **sin vincular** a esta autoridad; permanecen en QUARANTINE mientras no haya una fase documental propia para posgrados.

El veto de **Metadata Confidence V4** mantiene cualquier registro `blocked` en QUARANTINE aunque el nombre del programa sea válido. El workflow V28 reproduce la proyección completa y escribe cuántos registros tuvieron veto, sin suponer su resultado.

## Validación

El workflow `Thesis civil engineering Authority V28` comprueba sobre 27,576 obras:

1. Revisión exacta de `programRef` para 1,197 obras.
2. EXCLUDE sólo en registros elegibles y QUARANTINE en `blocked`.
3. Sin vinculación ni admisión de las 36 obras de posgrado.
4. Versión de Metadata Confidence intacta `2026-11-02.v4`.
5. Generación de artifact `v28-reprojection.json` para la cuenta auditable.

La V28 no implica despliegue de producción. Validar PR, merge y el resultado publicado por separado.
