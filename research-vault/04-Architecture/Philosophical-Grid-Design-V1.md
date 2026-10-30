---
type: architecture
area: product-design
project: InvestigacionFilosofica
status: deployed
updated: 2026-10-30
---

# Philosophical Grid Design V1

## Decisión

La interfaz pública adopta un sistema visual editorial de alta precisión: retícula de ocho puntos, superficies rectangulares, jerarquía tipográfica fuerte, contraste alto y movimiento funcional. La referencia de diseño no aparece como marca, texto ni dependencia visible en el producto. La identidad sigue siendo la de **Investigación Filosófica**.

La Escuela de Atenas deja de funcionar como fondo decorativo claro y pasa a ser arquitectura visual: imagen desaturada, velos oscuros, cuadrícula y márgenes de archivo. La tipografía serif señala pregunta, autor y obra; la sans organiza acciones; la monoespaciada identifica estado, fuente, rango y trazabilidad.

## Gramática visual

- retícula base de 8 px y composición hero de doce columnas;
- negro, blanco, grises de archivo y azul eléctrico como señal operativa;
- cian, verde, oro y rojo reservados para estado, provenance o advertencia;
- controles rectangulares, foco visible y estados seleccionados mediante línea o bloque, no ornamento;
- resultados representados como registros de archivo, con rango, inicial, metadata, acciones y score separados;
- páginas universales de autor tratadas como archivos intelectuales, con identidad, evidencia, métricas, cronología y bibliografía;
- movimiento breve para entrada, hover, carga y cambio de estado, con degradación completa bajo `prefers-reduced-motion`.

## Alcance

La nueva capa cubre:

1. portada y navegación;
2. consola de búsqueda tradicional/semántica;
3. filtros, métricas e interpretación;
4. resultados y controles de provenance;
5. estados de carga, avisos y fallback;
6. modales de ficha y enlaces institucionales;
7. identidad multiautor;
8. página universal de autor;
9. responsive de escritorio a 390 px.

El cambio es exclusivamente presentacional. No modifica parser, retrieval, fusión, ranking, `src/core/rank.js`, reranker, contratos semánticos ni artefactos Qwen congelados.

## Implementación canónica

La implementación ejecutable vive en el repositorio principal:

- `index.html` incorpora la capa y la microcopy editorial;
- `css/philosophical-grid.css` contiene tokens, componentes, responsive y movimiento;
- `tests/semantic-search-ui.test.mjs` fija la carga de la capa, la tesis de interfaz, el soporte de movimiento reducido y la ausencia de marcas externas.

El CSS se carga después de la hoja histórica para aislar el rediseño y evitar una reescritura simultánea de la lógica productiva. Esta es una frontera de migración deliberada; una consolidación futura requerirá un cambio separado y verificable.

## Validación

- PR: `#43`;
- commit de implementación: `fa6c807`;
- merge a `main`: `21b2a5999e75ae95f807b25ced8d19406cc67cb0`;
- GitHub Pages workflow: `41086150517`;
- suite: 120/120 pruebas;
- QA local y pública en 1280 × 720 y 390 × 844;
- cero overflow horizontal en portada, resultados y página de autor;
- búsqueda tradicional real verificada con resultados progresivos;
- ficha universal de autor verificada en escritorio y móvil;
- publicación comprobada desde la URL pública con la hoja versionada correcta.

## Criterio filosófico

La interfaz expresa una tesis del producto: buscar filosofía no consiste sólo en hacer coincidir palabras, sino en reconstruir una conversación. La composición distingue visualmente pregunta, concepto, obra, autor y evidencia para sostener esa lectura sin introducir una interpretación automática nueva.

## Límite

Este hito no evalúa relevancia y no debe incorporarse a la línea experimental Qwen. Es una decisión de producto y presentación. La evidencia científica, el ranking y sus conclusiones permanecen exactamente donde estaban.
