# Corpus Appearance — Fase 2: resultados y filtros

## Dependencias

- **Fase 0:** PR #382 — política de rutas y cuentas.
- **Fase 1:** PR #384 — sincronización desde Mi perfil y temas de cabecera.
- **Fase 2:** esta rama añade exclusivamente una hoja CSS y su enlace a `index.html`, con tests de regresión y sin modificar el motor bibliográfico.
- **Orden obligatorio:** integrar primero #382, después #384, y finalmente esta fase; no hacer merge automático.

## Componentes migrados

1. Delimitadores de búsqueda: filas, etiquetas, campos, controles y restablecimiento.
2. Workspace del corpus: superficies, panel lateral, indicadores, facetas y pestaña activa.
3. Tarjetas de obras de `#results`: fondos, bordes, visual, títulos, abstract, metadatos, procedencias, pertinencia y puntaje.
4. Acciones: enlaces bibliográficos/DOI y botón «Ver ficha» (color, enfoque; tamaño y posición siguen siendo propiedad de `mobile-layout.css`).
5. Estados auxiliares: carga, avisos, «Cargar más» y «Buscar más».

## Límites explícitos

- **Sin cambios funcionales** en `js/app.js`, búsqueda, ranking, deduplicación, navegación, guardados o desplazamiento al primer artículo.
- **Sin modificaciones** en modales completos, archivos/cronologías de autor, atlas de investigación y ninguna página de tesis, artículos institucionales, revistas o filosofía latinoamericana.
- Se preserva `data-corpus-shell="default"` como ausencia de overrides: la apariencia anterior es idéntica.
- Solo `index.html` carga `css/corpus-appearance-results.css`; el selector comienza por `html[data-corpus-shell]:not([data-corpus-shell="default"]) body:not(.author-view)`.
- Todas las reglas de fase 2 son de **presentación**: no se cambian `display`, grid, posición, anchura, altura, overflow, transforms, scroll ni tamaño de objetivos táctiles.

## Compatibilidad visual y móvil

- Tres estilos × claro/oscuro = seis paletas heredadas de fase 1, con contraste explícito para texto, etiquetas y botones.
- `#results > .result-card` separa las tarjetas del buscador de `.author-work-grid`; los autores se migrarán en fase 4.
- Las reglas del layout móvil conservan: miniatura de ranking 40×40, botones de 48px, columna única y botones de guardar sin obstruir el número de resultado.
- `forced-colors` utiliza los colores del sistema.
- Las sombras, gradientes y dibujos se construyen con CSS, sin imágenes ni nuevas solicitudes externas.

## Comprobación

- `node --test tests/corpus-appearance-policy.test.mjs tests/corpus-appearance-runtime.test.mjs tests/corpus-appearance-results.test.mjs`
- `npm test` y CI móvil y del buscador (GitHub Actions).
- Pruebas visuales pendientes en iPhone Safari, Android Chrome y escritorio: 320/360/390/430/768/1024/1440px; ambos modos; búsqueda con 1/20/más resultados; scroll al primer resultado; cargar más; guardado; abrir DOI y ficha.
- **Rollback:** quitar solo el link de `css/corpus-appearance-results.css` de `index.html`; fase 0/1 y el perfil continúan funcionando.
