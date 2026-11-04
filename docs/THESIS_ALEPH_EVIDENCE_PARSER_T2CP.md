# T2CP — Auditoría de evidencia de tesis en el parser Aleph

## Problema observado
T2CO ejecutó 38 referencias en dos lotes, con cero identidades nuevas confirmadas.
Ese resultado **no** constituye prueba de que las tesis no estén catalogadas.

La inspección de `page_evidence()` en `probe_udg_opac_endpoints_v1.py`
encontró un defecto de proyección de datos: `relevantRows` sólo conservaba
filas que coincidían con una lista de palabras genéricas, pero esa lista no
incluía `Nota de tesis`, `Base Lógica` o `Base Logica`.
El resolvedor T2CO, en cambio, requiere explícitamente el contenido de
`Nota de tesis` o `Base Lógica: Tesis` para adjudicar una identidad.
Una fila válida que no contuviera otra palabra clave se descartaba antes
de llegar al resolvedor.

## Corrección mínima
Añadir las tres etiquetas bibliográficas al filtro de `page_evidence()`.
No se cambia el predicado de coincidencia exacta título/autor, no se introducen
fusiones difusas y no se modifica ningún índice canónico.

## Validación
- Prueba sintética con un registro completo de control que incluye
  `Número de sistema`, `Título`, `Autor`, `Base Lógica` y `Nota de tesis`.
- Re-ejecución de T2CO sobre las primeras ocho referencias con la misma cola,
  para comparar contra el lote previo sin reclamar nuevos holdings antes de
  abrir y validar las fichas originales.
- Mantener la política reference-only y el resguardo de sesiones.

## Interpretación y límites
Este defecto de código demuestra que un campo podía perderse; **no demuestra**
por sí solo que ésa fuera la razón de los 38 casos sin resolver.
También quedan por auditar los índices `WTI`/`WAU`, la paginación Aleph,
las inconsistencias entre catálogo Drupal y OPAC, los valores de autor
y la cobertura de bibliotecas físicas de la UdeG.

Las fuentes institucionales describen al OPAC como un catálogo de ubicación de
materiales físicos. Una búsqueda infructuosa no equivale a inexistencia de tesis.
La reconstrucción de maestrías y de Doctorado en Humanidades debe continuar con
Control Escolar, programas, CUCSH y bibliotecas, además de Aleph.
