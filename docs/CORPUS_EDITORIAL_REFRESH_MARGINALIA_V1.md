# Marginalia · Edición crítica (renovación editorial del corpus, fase 2)

## Concepto
Una interfaz de consulta con la dignidad visual de una **edición crítica académica**.
No reproduce páginas rayadas ni dibujos de libreta: crea una composición tipográfica
con papel marfil, tinta grafito, notas granate y pautas de imprenta muy tenues.
El modo oscuro utiliza tinta cálida sobre papel carbón, con contraste WCAG AA.

## Ámbitos intervenidos
- Portada, buscador, select de profundidad, pestañas y filtros.
- Navegación del corpus: barra móvil, navegación de escritorio, menú lateral y acceso a cuenta.
- Resultados: fichas, resumen, fuentes, número de resultado, guardado y acciones.
- Modal de ficha bibliográfica, resumen, autoría y accesos.
- Expediente de autor, archivo de obras y cronología.
- Atlas semántico incrustado, paneles, controles, lienzo y colores leídos por Canvas.

## Límites técnicos
Una capa CSS: \`css/corpus-appearance-polish-marginalia.css\` añadida solo en
\`index.html\`, inmediatamente después de la capa de Territorio. Los selectores
usan \`data-corpus-shell="marginalia"\` y no alteran Predeterminado, Territorio,
Observatorio, tesis, revistas o filósofos latinoamericanos. No se tocan fuentes,
ranking, perfil, Firebase, guardados, estructuras DOM, JavaScript de producto,
pan, zoom, responsive grids ni scroll. Única excepción de espaciado: se reserva
el margen textual junto a la numeración y marcador móvil (como Territorio).

## Validación
- \`tests/corpus-appearance-polish-marginalia.test.mjs\`: paletas AA, aislamiento,
  preservación de geometría/gestos y protección frente a estilos heredados.
- \`scripts/qa/corpus-appearance-smoke.mjs\`: color realmente calculado tras la
  transición, controles de profundidad, menú táctil, expediente de autor, fichas y
  Atlas a 320, 390, 768 y 1280 px. Capturas Marginalia para claro/oscuro.
- PENDIENTE manual: Safari iOS, Android físico y persistencia Firebase entre cuentas.

**No hacer merge sin aprobación del propietario.**
