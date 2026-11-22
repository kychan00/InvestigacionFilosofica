# Apariencia del corpus · Fase 3 — Fichas bibliográficas y modales

Esta fase se incorpora **directamente a PR #382**, junto con las fases 0, 1 y 2. No se crea ninguna rama ni PR adicional.

## Implementación

- Nueva capa `css/corpus-appearance-records.css` enlazada únicamente desde `index.html`, después de `record-folio-polish.css` y las dos hojas anteriores de apariencia.
- Se aprovecha el contrato `--rf-*` ya existente del folio: las seis variantes (Territorio, Marginalia, Observatorio × claro/oscuro) personalizan el panel, encabezado, ficha, metadatos, abstract, autores, procedencia, botones de acceso y explicación de relevancia.
- Se ofrece contraste explícito `--rf-on-accent` para botones primarios y números de sección, especialmente cuando el acento es claro en modo oscuro.
- El título bibliográfico recupera tipografía editorial; la cabecera tiene un motivo exclusivamente CSS de cartografía, página pautada u órbitas, según el tema.
- Las variables `--rf-*` se asignan al nodo `#record-modal`, sin mutar datos de resultados, árboles DOM ni estilos del contenido del buscador.
- **Predeterminado no cambia**: todas las nuevas reglas dependen de `data-corpus-shell` distinto de `default`.

## Compatibilidad y límites

- El folio mantiene su posición, `max-height: calc(100dvh - 48px)`, scroll interno, grid y botones de 48px (incluido cerrar).
- Se conservan los enlaces originales DOI, acceso abierto, registro bibliográfico, autores, UdeG institucional y los datos sobre fuentes; ningún evento de navegación o guardado se modifica.
- Se preserva el modal de la Biblioteca Virtual UdeG (`#udeg-modal`) con su presentación independiente y todo lo demás fuera de `index.html`.
- La capa evita `width`, `height`, `display`, `position`, `overflow`, `touch-action`, `pointer-events` y cambios de transformaciones. Solo color y tipografía de jerarquía bibliográfica.
- En colores forzados, el sistema operativo mantiene prioridad sobre fondos y contraste.

## Pruebas

`tests/corpus-appearance-records.test.mjs` cubre inclusión exclusiva en index, orden CSS, seis conjuntos completos de tokens, fallback Predeterminado, aislamiento del modal institucional, geometría móvil, contenido DOI/abstract y accesibilidad del diálogo.

Pendiente validación en dispositivo real (iPhone Safari, Android Chrome, escritorio) después de incorporar las fases restantes. Chequear: DOI, autor clicable, explicar relevancia, abrir/cerrar, scroll dentro de ficha, guardar en los resultados antes/después de abrir el folio, modos claro/oscuro y sin inicio de sesión.

## Rollback

Quitar el enlace `css/corpus-appearance-records.css` del `index.html` restaura exactamente el folio previo, sin revertir las fases 0–2.

## Próxima fase

**Fase 4:** adaptación del archivo/cronología de autores y Atlas semántico incrustado. El Atlas independiente sigue excluido.
