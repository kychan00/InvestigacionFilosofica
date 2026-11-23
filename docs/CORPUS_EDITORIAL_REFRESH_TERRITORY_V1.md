# Renovación editorial de temas — Primera entrega: Territorio

**Rama:** \`feature/corpus-editorial-refresh-territory-v1\`

## Dirección de arte

La primera versión aplicaba paletas a una colección heterogénea de componentes. Territorio ahora se trata como un **atlas académico**, no como un conjunto de degradados llamativos: fondos mineral/papel, tinta botánica, acento terracota reservado para referencias y jerarquía de acciones en verde profundo. En oscuro, la identidad se traslada a verdes boscosos y cobre sobrio.

### Ámbitos de esta entrega

- Portada del corpus, navegación, buscador y controles.
- Filtros, espacio de resultados, tarjetas, indicadores y acciones.
- Ficha bibliográfica completa, abstract y metadatos.
- Expediente del autor, bibliografías y cronología.
- Atlas integrado, paneles, marcadores y canvas (mediante tokens que ya lee \`research-atlas-embed.js\`).

No se cambian el DOM, búsqueda, ranking, fuentes, Firebase, guardados, modales, gestos ni geometría móvil. El archivo es una capa CSS sobre fases 0–5 y está enlazado **exclusivamente desde \`index.html\`**. Predeterminado, Marginalia, Observatorio, tesis, revistas, catálogo y páginas autónomas quedan intactos.

## Validación

\`npm test\` incorpora \`tests/corpus-appearance-polish-territory.test.mjs\` para contraste WCAG AA, aislamiento entre temas/rutas y ausencia de mutaciones geométricas. Se mantienen los smokes de Chromium de las fases 0–5 para 320, 390, 768 y 1280 px.

Pendiente: revisar capturas generadas por CI para claro/oscuro, confirmar comportamiento Safari iOS y Android físicos, y probar persistencia real con Firebase. **No hacer merge sin validación del propietario.**

## Próximas fases (una por una)

1. **Territorio**: esta entrega, revisión de diseño y ajustes sobre el mismo PR.
2. **Marginalia**: tipografía, anotaciones y papel sin ruido visual (futuro trabajo, no implementado aquí).
3. **Observatorio**: instrumentos de consulta, constelaciones y jerarquía nocturna (futuro trabajo, no implementado aquí).

Esta entrega no presupone cambios en los demás temas.