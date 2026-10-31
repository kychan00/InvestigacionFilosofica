---
type: product-architecture
project: InvestigacionFilosofica
status: deployed
updated: 2026-10-31
---

# Pre-Search Filter Console V1

## Decisión

La búsqueda pública presenta sus restricciones antes de ejecutar la consulta.
El investigador puede fijar año inicial, año final, idioma, tipo documental y
orden desde el panel principal, sin esperar a que exista una primera lista de
resultados.

Las fuentes no se convierten en una elección del usuario: OpenAlex Philosophy,
Crossref, Internet Archive y CUCSH permanecen activas según la ruta de búsqueda.
La interfaz lo declara y no expone un selector de proveedor. Esto evita que una
preferencia accidental reduzca el espacio bibliográfico sin que el usuario lo
advierta.

## Contrato de interacción

- los filtros son opcionales y empiezan sin restricciones adicionales;
- `Año desde` y `Año hasta` rechazan intervalos invertidos antes de buscar;
- `Idioma` y `Tipo` usan vocabularios explícitos, no inferencia generativa;
- `Ordenar por` conserva relevancia como valor inicial;
- en Semántica, esa opción se nombra `Similitud semántica` y `Citas` queda
  desactivada porque el índice no ofrece esa señal material;
- `Restablecer` limpia restricciones y restaura el orden predeterminado;
- el resumen indica cuántos resultados visibles cumplen y cuántos ajustes están
  activos.

## Ejecución por motor

En `Semántica · alfa`, año, idioma y tipo viajan en el contrato `filters` de la
petición a la API. La misma selección se conserva en presentación y orden.

En la búsqueda federada, los proveedores continúan emitiendo lotes progresivos.
Cada lote se filtra y ordena de inmediato antes de renderizarse; por eso la
interfaz puede mostrar resultados compatibles mientras otras fuentes todavía
responden. La consola no reconstruye retrieval ni modifica la puntuación
productiva.

## Responsive y accesibilidad

La retícula usa cinco columnas en escritorio, tres en tablet y dos en teléfono;
el orden ocupa la fila completa cuando el ancho es reducido. A 390 px no existe
overflow horizontal. Inputs y selects conservan 48 px de alto y el control de
restablecimiento 44 px. El estado de filtros usa una región viva.

## Límites científicos

Este cambio pertenece a presentación y control de consulta. No modifica
`src/core/rank.js`, retrieval, reranker, scores, labels humanos ni artefactos
congelados de `benchmark/qwen3`. Tampoco se deriva de los resultados de Qwen3.

## Linaje y verificación

- base móvil preservada: PR 44, PR 45 y PR 46;
- implementación: PR 48;
- merge productivo: `d6a5669964cf92c65ac88bad5669e87e1d0acb1d`;
- regresión móvil del PR: workflow `41222582465`;
- despliegue GitHub Pages: workflow `41222682217`;
- suite local y CI: 125/125 pruebas;
- smoke federado local: `tecnociencia`, 2000–2026, español y año descendente,
  con 2 de 6 resultados visibles;
- QA público: cinco controles presentes, cero selector de fuente, Semántica con
  `Similitud semántica`, citas desactivadas y geometría móvil 390/390 px.

La fuente ejecutable permanece en el repositorio productivo. Este documento es
la capa conceptual y de linaje del cambio.
