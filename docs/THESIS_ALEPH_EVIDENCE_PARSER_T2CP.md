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

## Verificación viva y diagnóstico posterior

El reensayo del lote 0–7 con el parser reparado (run `41912878150`)
produjo **8 unresolved, 0 resolved, 0 nuevos holdings**. El defecto se
reproduce mediante un fixture HTML y quedó corregido, pero no explica
por sí solo estos casos.

La instrumentación de rechazo del run `41913276683` examinó **17 fichas
candidatas** entre las ocho referencias. Los 17 candidatos fueron rechazados
por `title-not-exact`; algunos también por `author-not-exact`.
Hubo dos referencias con consultas demasiado amplias y varias sin candidatos.
**Ninguna de las 17 fichas coincidió exactamente en título**, por lo que
el resultado no autoriza atribuir el rechazo a `Nota de tesis`.
Los contadores de motivos pueden solaparse y no deben sumarse como fichas únicas.

### Interpretación
El hallazgo confirmado es un bug de conservación de evidencia, ahora
cubierto por un test. El hallazgo independiente de reconciliación es que
los candidatos Aleph de esta muestra no son la misma obra según la clave
bibliográfica estricta. Deben investigarse errores del catálogo de origen,
variantes de catalogación, reglas de búsqueda del OPAC y fondos físicos.
No debe promoverse ninguna identidad por coincidencia temática o autor
parcial. Las ocho referencias siguen `unresolved`; la situación de las
otras treinta del lote 9–38 no fue revalidada por este PR.

### Ruta institucional
El SiUBiUDG declara el OPAC como localizador de materiales físicos; CUCSH
publicó que el acervo general de la Biblioteca Rodríguez Lapuente no
formó parte de la primera fase de traslado a Belenes. Debe preservarse
la vía de consulta directa con la Biblioteca Central en La Normal y
el departamento/programas de Filosofía. No existe aún respuesta formal
de personal bibliotecario obtenida en esta fase.
