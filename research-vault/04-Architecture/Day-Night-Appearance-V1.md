---
type: architecture
area: product-interface
project: InvestigacionFilosofica
status: deployed
updated: 2026-10-31
---

# Apariencia Día/Oscuro V1

## Decisión

La interfaz pública ofrece una elección visible y accesible entre `Día` y
`Oscuro` dentro de la navegación principal. No son dos productos ni dos
plantillas independientes: ambos estados comparten estructura, contenido y
comportamiento.

En la primera visita, cuando todavía no existe una decisión explícita, la página
respeta `prefers-color-scheme` del sistema. Después, la elección del usuario se
guarda en `localStorage` bajo `investigacion-filosofica-theme` y se restaura
antes del primer pintado para evitar un destello del tema contrario. La
preferencia queda únicamente en el navegador; no requiere cuenta ni se envía a
un servicio.

## Cobertura

El sistema de tokens de color cubre:

- portada, navegación y buscador;
- consola de filtros previa a la búsqueda;
- workspace, métricas y tarjetas de resultados;
- archivos universales de autor;
- ficha bibliográfica y modal de Biblioteca UdeG;
- estados de foco, selección y acciones.

El acento azul de las tarjetas permanece como señal estable en ambos temas. La
retícula filosófica, las jerarquías editoriales y la identidad visual no se
alteran.

## Accesibilidad y responsive

- el selector usa botones con `aria-pressed` y etiqueta de grupo;
- funciona mediante teclado y conserva un objetivo táctil suficiente;
- las transiciones se desactivan con `prefers-reduced-motion`;
- el color del navegador se sincroniza mediante `theme-color`;
- la composición fue verificada a 390 px sin overflow horizontal.

## Verificación

- PR de producto: `#49`;
- merge: `ed9c2de7f3332ea09f0c104ae1223d4790119304`;
- suite: 128/128 pruebas;
- regresión móvil: workflow `41253942637`;
- despliegue GitHub Pages: workflow `41254022958`;
- QA público: cambio Día/Oscuro, persistencia tras recarga, resultados, archivo
  de Miguel Giusti y ficha bibliográfica en ambos temas.

## Límites

La implementación es exclusivamente de presentación. No modifica retrieval,
resolución de identidad, ranking, `src/core/rank.js`, reranker, scores, labels ni
artefactos Qwen congelados.
