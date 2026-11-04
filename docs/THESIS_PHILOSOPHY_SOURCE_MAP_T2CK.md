# T2CK — Mapa total de fuentes para tesis filosóficas UdeG

## Diagnóstico

T2CJ demostró que el problema no es simplemente una baja producción de tesis, sino **fragmentación institucional de los registros**.

La vista pública T2CI contiene 18 referencias filosóficas porque parte del corpus efectivo y de una curaduría pequeña. El catálogo CUCSH, por sí solo, expone 217 referencias de Licenciatura en Filosofía. Por tanto, RIUdeG/T2CI no representan todavía el universo histórico.

## Dónde puede estar una tesis

T2CK define cinco capas que deben cruzarse, sin importar si el ejemplar es digital o físico:

1. **Catálogo de Tesis Biblioteca CUCSH** — inventario local por programa; T2CJ confirmó 217 Licenciatura en Filosofía.
2. **OPAC/ALEPH SiUBiUDG** — catálogo de toda la Red de Bibliotecas y localizador de ejemplares físicos.
3. **Biblioteca Central Dr. Manuel Rodríguez Lapuente, La Normal** — custodia física histórica. En 2026 CUCSH informó que el acervo general no fue trasladado en la primera fase hacia Belenes.
4. **CUCSH Belenes y acervos departamentales** — custodia física y servicios bibliotecarios actuales.
5. **RIUdeG / WDG Biblio** — handles y documentos digitales cuando han sido depositados.

A esto se suma una sexta capa administrativa: **Departamento de Filosofía, coordinaciones de programa y Control Escolar**, que pueden conservar listas de titulados, actas y títulos de trabajos que nunca entraron correctamente a los catálogos.

## Maestría: por qué cero en el catálogo CUCSH es imposible como universo

El filtro Drupal de CUCSH para `Maestría en Estudios Filosóficos` existe pero hoy devuelve cero filas. Eso no significa cero tesis.

La página oficial de la Maestría documenta cohortes desde 2007 y establece Taller de Tesis I y II; la documentación institucional vigente exige tesis para la obtención del grado.

El informe CUCSH 2024 reportó 16 estudiantes matriculados en la Maestría en Estudios Filosóficos y una eficiencia terminal de 94.1%. El Primer Informe 2026 reporta 20 estudiantes matriculados. Por tanto, la ausencia de filas en el catálogo Drupal debe tratarse como **hueco de catalogación/migración**, no como ausencia de producción.

## Doctorado: el error de buscar “Doctorado en Filosofía”

CUCSH no ofrece actualmente una autoridad exacta llamada Doctorado en Filosofía. El programa pertinente es **Doctorado en Humanidades**, cuyas disciplinas y línea Pensamiento incluyen explícitamente filosofía, ética, lógica, hermenéutica e historia de las ideas.

Las tesis doctorales filosóficas deben descubrirse dentro del Doctorado en Humanidades y adjudicarse obra por obra por tema/director/línea/evidencia. No deben renombrarse como programa Doctorado en Filosofía.

## Acervo físico

El SiUBiUDG declara que su OPAC colectivo permite ubicar los recursos físicos existentes en las bibliotecas de toda la Red Universitaria.

La Biblioteca Central Dr. Manuel Rodríguez Lapuente sigue registrada en La Normal. CUCSH informó en 2026 que sólo una parte de fondos especiales fue trasladada a Belenes y que **el acervo general no sería trasladado en esa fase**.

Eso convierte a La Normal en una fuente prioritaria para tesis históricas impresas que no estén digitalizadas.

## Datos abiertos ALEPH

Transparencia UdeG publica un XLSX: **Listado de títulos del catálogo ALEPH**, descrito como el listado de materiales bibliográficos de la Red de Bibliotecas disponibles en el OPAC.

T2CK añade un probe reproducible que descarga ese snapshot, inspecciona sus hojas y filtra señales de Filosofía/tesis/maestría/doctorado/CUCSH sin persistir el archivo bruto.

## Política de integración

- digital y físico tienen el mismo valor para **descubrimiento bibliográfico**;
- se conserva la ubicación física cuando exista;
- no se exige PDF para admitir una referencia;
- no se almacena PDF ni full text;
- identidad por número de sistema, handle u otra clave exacta;
- si sólo hay título/autor/año, la reconciliación es determinista y fail-closed;
- no fuzzy auto-merge;
- Doctorado en Humanidades se filtra por contenido filosófico, no se relabela.

## Próximas fases

1. **ALEPH open data** — medir cuántos registros filosóficos/históricos aparecen en el snapshot.
2. **OPAC/holdings** — recuperar número de sistema y ubicación física de las tesis CUCSH.
3. **Maestría** — reconstruir titulados/títulos desde ALEPH + RIUdeG + programa/Control Escolar.
4. **Doctorado en Humanidades** — construir una auditoría de tesis de la línea Pensamiento y contenido filosófico.
5. Reconciliar todo contra T2CI antes de ampliar la vista pública.


## Resultado del snapshot ALEPH 2019

El probe leyó correctamente el XLSX oficial de Transparencia UdeG:

- 5 hojas;
- 1,551,638 filas bibliográficas;
- la hoja de Centros Universitarios contiene 444,645 filas.

Las métricas lexicales iniciales no deben interpretarse como conteos de tesis: palabras como “síntesis”, “prótesis” o libros metodológicos sobre tesis producen falsos positivos. El snapshot se conserva como **índice bibliográfico histórico para reconciliación por identidad**, no como clasificación de tesis.

Una búsqueda de control sobre el reporte no encontró coincidencias directas para varios trabajos filosóficos que ya están confirmados en CUCSH (por ejemplo Guillermo Vargas Curiel, Guillermo Castillo Ramírez o los dos trabajos recientes de la Maestría). Esto confirma que el snapshot ALEPH de 2019 tampoco es exhaustivo respecto del catálogo local de tesis CUCSH.

## Control Escolar como contador de cobertura

Transparencia UdeG publica concentrados anuales de **Títulos, Diplomas y Grados**. T2CK inspecciona los XLSX 2022–2025 sin conservarlos.

Esta capa no identifica por sí sola el título de la tesis, pero permite construir un denominador de cobertura por programa/año. Para la Maestría y el Doctorado, donde la tesis/defensa es parte obligatoria del plan, una diferencia entre grados expedidos y tesis localizadas constituye un hueco verificable de catalogación.

## Evidencia de que la Maestría está subcatalogada

La página oficial documenta 152 alumnos matriculados en siete cohortes entre 2007 y 2021, Taller de Tesis I/II y dirección de tesis desde tercer semestre. CUCSH reportó 16 titulados de la Maestría en Estudios Filosóficos sólo en 2021 y una eficiencia terminal de 94.1% en 2024.

Por tanto, los cero registros que actualmente devuelve el filtro Drupal de Maestría son un defecto de cobertura/migración y no representan la producción real.

## Doctorado: universo filosófico dentro de Humanidades

El Doctorado en Humanidades reserva el último año a Seminarios de Tesis y exige Presentación y Defensa de Tesis. Su línea **Pensamiento** enumera explícitamente filosofía, ética/moral, lógica, valores, argumentación y hermenéutica.

La reconstrucción doctoral deberá partir del universo de tesis del Doctorado en Humanidades y clasificar obra por obra, conservando siempre el programa real `Doctorado en Humanidades`.
