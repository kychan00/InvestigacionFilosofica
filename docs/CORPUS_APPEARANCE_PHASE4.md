# Apariencia del corpus — Fase 4: autores y Atlas semántico

Esta fase se desarrolla **en el PR único #382**, sin abrir ni integrar PR adicionales.

## Alcance real

- **Archivo público de autor dentro de `index.html?view=author`:** cabecera y nombre del autor, biografía, alias, ORCID, métricas, análisis, coautoría, controles alfabéticos, tarjetas bibliográficas, sección académica, etc.
- **Cronología dentro del archivo de autor:** recorrido horizontal por fechas, estados activos, nodos de obras, cobertura de fuentes y acceso a fichas.
- **Atlas de la búsqueda principal:** pestañas «Resultados / Atlas», cabecera, filtros de capa y autores, zona de dibujo, leyenda, controles de zoom, panel de detalle, relaciones y lista accesible.
- **Excluye:** Atlas de tesis (`atlas.html`), Atlas experimental autónomo (`research-atlas.html`), revistas, filósofos latinoamericanos, catálogo institucional UdeG y fichas públicas fuera de `index.html`.

## Implementación

1. `css/corpus-appearance-author-atlas.css` aporta seis juegos de tokens con colores contrastados para `Territorio`, `Marginalia` y `Observatorio` en claro/oscuro, reutilizando la fase 1.
2. **Autores:** variables `--profile-*` aplicadas localmente a `body.author-view` para respetar el trabajo de accesibilidad de `author-visibility-repair.css`. Los tokens `--tl-*` se asignan a `#author-timeline-root`, así sus reglas de diseño existentes interpretan la paleta sin cambios de geometría.
3. **Canvas del Atlas:** `palette()` en `js/research-atlas-embed.js` consulta variables CSS `--corpus-atlas-*`; para Predeterminado o un invitado todas las variables faltantes conservan exactamente los colores originales. Un cambio de `data-corpus-shell` activa únicamente un redibujado.
4. **HTML:** `index.html` incorpora la hoja de fase 4 después de las fases anteriores, y cambia la versión del script del Atlas para evitar usar un JS cacheado.
5. La identidad gráfica de cada temática se conserva sin cambiar la semántica visual: obras directas, expandidas, autorías, menciones y aristas mantienen sus formas y tipos; **solo cambian los colores**.

## Regresiones evitadas

- No se cambia la estructura del grafo, el algoritmo de similitud, topología, búsqueda, ordenamiento ni los datos.
- No se alteran posiciones, `grid`, medidas, `scroll-snap`, `overflow-x`, `touch-action`, `pointer-events` ni eventos de puntero.
- La cronología conserva la selección de periodos, carga incremental y el acceso a obras.
- El Atlas conserva `drag/pinch/zoom`, filtros de aristas, abrir ficha/DOI, barra de estado y la alternativa de lista accesible.
- No se tocan el modal de la ficha `#record-modal`, el modal UdeG `#udeg-modal` ni las páginas independientes.

## Pruebas

`tests/corpus-appearance-author-atlas.test.mjs` valida los seis juegos de tokens, exclusión de rutas, carga ordenada, herencia de paletas, estado Predeterminado, redibujado ante cambio de apariencia y preservación de geometría y eventos.

### Regresión manual antes del merge

- 320, 360, 390, 430, 768, 1024 y 1440 px, ambas apariencias, cuatro temas, sesión y anónimo.
- Hegel y otros autores: abrir archivo, biografía ORCID, datos bibliográficos, seleccionar década/año, expandir obras, abrir ficha, volver a resultados, guardar autor y obra.
- Búsqueda tradicional y semántica: alternar Resultados/Atlas, seleccionar nodo, activar/desactivar tipos de arista, arrastrar en móvil, ampliar, restablecer zoom, lista accesible, abrir ficha y DOI.
- Cambiar tema desde otra pestaña mientras el Atlas permanece abierto; verificar redibujado sin perder selección/zoom.
- Comprobar contraste claro/oscuro y `prefers-reduced-motion`/colores forzados.

## Rollback

Quitar el enlace a `css/corpus-appearance-author-atlas.css` en `index.html` y restaurar el import del Atlas previo revierte esta capa; las fases 0–3 siguen intactas.

## Próxima fase

**Fase 5:** auditoría integral, compatibilidad, accesibilidad y corrección final de la rama frente a `main`. La decisión de merge sigue correspondiendo al propietario.
