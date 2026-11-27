# Renovación editorial de temas — Primera entrega: Territorio

**Rama:** `feature/corpus-editorial-refresh-territory-v1`

## Dirección de arte

La primera versión aplicaba paletas a una colección heterogénea de componentes. Territorio ahora se trata como un **atlas académico**, no como un conjunto de degradados llamativos: fondos mineral/papel, tinta botánica, acento terracota reservado para referencias y jerarquía de acciones en verde profundo. En oscuro, la identidad se traslada a verdes boscosos y cobre sobrio.

### Ámbitos de esta entrega

- Portada del corpus, navegación, buscador y controles.
- Filtros, espacio de resultados, tarjetas, indicadores y acciones.
- Ficha bibliográfica completa, abstract y metadatos.
- Expediente del autor, bibliografías y cronología.
- Atlas integrado, paneles, marcadores y canvas (mediante tokens que ya lee `research-atlas-embed.js`).

No se cambian el DOM, búsqueda, ranking, fuentes, Firebase, guardados, modales, gestos ni geometría móvil. El archivo es una capa CSS sobre fases 0–5 y está enlazado **exclusivamente desde `index.html`**. Predeterminado, Marginalia, Observatorio, tesis, revistas, catálogo y páginas autónomas quedan intactos.

## Validación

`npm test` incorpora `tests/corpus-appearance-polish-territory.test.mjs` para contraste WCAG AA, aislamiento entre temas/rutas y ausencia de mutaciones geométricas. Se mantienen los smokes de Chromium de las fases 0–5 para 320, 390, 768 y 1280 px.

Pendiente: revisar capturas generadas por CI para claro/oscuro, confirmar comportamiento Safari iOS y Android físicos, y probar persistencia real con Firebase. **No hacer merge sin validación del propietario.**

## Próximas fases (una por una)

1. **Territorio**: esta entrega, revisión de diseño y ajustes sobre el mismo PR.
2. **Marginalia**: tipografía, anotaciones y papel sin ruido visual (futuro trabajo, no implementado aquí).
3. **Observatorio**: instrumentos de consulta, constelaciones y jerarquía nocturna (futuro trabajo, no implementado aquí).

Esta entrega no presupone cambios en los demás temas.

## Auditoría de revisión previa al merge

- Se comprobó que el encabezado del expediente de autor no quedaba temático y que el menú lateral y la barra de escritorio retenían tintes azules de Carbon. Ambos se uniforman en esta capa, tanto en claro como en oscuro.
- La suite Playwright ahora verifica superficies y tinta calculadas en la portada, navegación, menú y barra lateral. También captura `landing-territory-{light|dark}-{390|1280}.png` (cuatro capturas adicionales).
- Se añadió validación de contraste para leyendas, menú y hover de acciones, sin cambiar ninguna geometría, gesto ni script funcional.
- Se mantiene la revisión visual de capturas y Safari/Android físicos como paso manual independiente.

- Se detectó una colisión de especificidad con el borde superior del espacio de resultados; ahora gana el acento editorial de Territorio. El navegador comprueba el color calculado.
- El smoke abre y cierra el menú real en móvil y escritorio, verifica `inert` y `aria-hidden`, y guarda capturas del menú y de la tarjeta de resultados para 390/1280 px en ambos modos.

- Auditoría de capturas: corregida la regla antigua `#search-depth` (fondo blanco/texto pálido en oscuro); botón de profundidad y caret nativo conservan su comportamiento, con contraste adecuado. Eliminados los acentos azules residuales de subrayado activo, cuenta y rótulos editoriales. Las pruebas de navegador comprueban sus colores calculados y el radio de borde.

- Ajuste de lectura en móviles: se reserva espacio al final del encabezado de la tarjeta para la numeración y, si existe, para el marcador de guardado. Se mantienen los tamaños y posiciones de ambos controles; la prueba comprueba el espaciado aplicado en el título.

- Auditoría del expediente de autor: placeholder con tinta de contraste completo, estado de foco en cobre, para evitar que el campo de búsqueda se pierda en modo oscuro. En resultados, se elimina únicamente el fondo que prolongaba la barra de acciones a lo ancho de la tarjeta, sin alterar dimensiones de botones ni su comportamiento.

## Kant como emblema cartográfico · noviembre de 2026

Se añade el grabado en acero **Immanuel Kant**, de J. L. Raab según Döbler, anterior a 1899. Fuente: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Immanuel_Kant_(portrait).jpg), Public Domain Mark 1.0. Original de 677 × 845 píxeles, 253745 bytes, SHA-256 `27e7705d56a9f7d1437ea99179a4580997f0bb0f6b0424d4e8001ac322ba2215`, alojado en `assets/territory-kant.jpg` sin modificaciones binarias. La veladura es exclusivamente CSS.

- Portada: el retrato sustituye la antigua Φ decorativa; se conservan las curvas de nivel y la paleta verde mineral. La escala y opacidad bajan en móvil/tableta para no competir con la lectura.
- Tarjetas de búsqueda y obras de autor: grabado integrado en la miniatura existente, con veladura oscura que mantiene el índice blanco, incluso cuando la miniatura se reduce al número móvil. La imagen no representa al autor de la obra, es un emblema fijo del tema.
- Ficha bibliográfica: marca de agua no interactiva en el encabezado; metadatos, botones y resumen mantienen su estructura.
- Alto contraste e impresión: se desactivan las imágenes decorativas. Sin animaciones ni peticiones externas.
- Playwright comprueba decodificación local real, presencia en portada, tarjetas y ficha, y ausencia en los otros tres temas. Se conservan las capturas existentes a 390 y 1280 px.

El flujo temporal de descarga queda eliminado del árbol final. No se modifican las fuentes bibliográficas, Firebase, los algoritmos del Atlas ni los demás temas.
