# Apariencia del corpus bibliográfico — arquitectura V1

> Fase 0: contrato y regresiones. No activa temas sobre pantallas públicas todavía.

## Intención y alcance

El tema elegido desde «Mi perfil» (Predeterminado, Territorio, Marginalia u Observatorio) debe modificar la apariencia del **corpus federado** sin cambiar ranking, contenido, enlaces, autores, abstracts ni DOI.

**Dentro:** index.html y sus estados: búsqueda, resultados, filtros, tarjetas, fichas/modales, vista de autor mediante ?view=author, cronologías y Atlas incrustado.

**Fuera:** tesis.html, atlas.html (tesis), articulos.html (catálogo UdeG), filosofia-latinoamericana.html, revistas/** y research-atlas.html (Atlas experimental autónomo). Los estilos no deben cargarse en esas páginas.

## Arquitectura

1. **Origen y persistencia:** Mi perfil guarda profileShell en Firestore mediante updateUserProfileShell. La caché visual existente usa if:profile-shell:${uid} y solo se confirma después del guardado.
2. **Sesión auténtica:** no inferir identidad del hint de login. La caché solo puede leerse tras verificar la identidad/UID por Firebase Auth; un usuario sin sesión o con storage bloqueado ve Predeterminado. Nunca heredar el UID de otra cuenta.
3. **Rutas permitidas:** js/corpus-appearance-policy.js normaliza los cuatro IDs y valida / e /index.html, incluso en GitHub Pages con subcarpeta.
4. **Aplicador futuro:** una sola marca data-corpus-shell en el documento del index y variables CSS semánticas --corpus-*. No importar css/profile.css ni css/profile-observatorio.css; mantener compatibilidad con html[data-theme] para claro/oscuro.
5. **Rendimiento:** Firestore es la fuente de verdad, pero NO se consulta en cada búsqueda ni se carga como dependencia obligatoria de la interfaz pública. La carga inicial no debe bloquear resultados por autenticación.
6. **Aislamiento:** los renderizadores de búsqueda, fichas, autor y Atlas conservan datos/eventos; la capa visual nunca modifica la lógica federada, la deduplicación ni el grafo.

## Un PR por fase — sin merge automático

| Fase | Entrega | Condición de salida |
|---|---|---|
| 0 | Contrato de rutas, IDs, matriz de regresión | Sin cambios en la UI ni dependencias de red |
| 1 | Puente de preferencia verificada a index.html + tokens base | Fallback seguro y sin parpadeo |
| 2 | Buscador, filtros, resultados, paginación y estados vacíos | Misma búsqueda, orden y scroll |
| 3 | Fichas, enlaces DOI, abstract, diálogos y botones guardar | Sin regresiones de foco, overlay ni click |
| 4 | Archivos/cronologías de autor y Atlas incrustado | Sin reiniciar grafos al elegir tema |
| 5 | Auditoría móvil/web, contraste y limpieza de CSS | Matriz aprobada antes de activación general |

## Estilo y compatibilidad

- Separar tokens semánticos: fondo, superficie, texto, texto secundario, borde, acento, hover, sombra, tipografías y radios.
- Mantener el modo claro/oscuro existente independiente de los cuatro temas; cada tema debe disponer de ambas variantes.
- Evitar cambios temáticos de display, position, width, scroll, fixed/sticky y transform en componentes críticos; usar color y ornamento progresivamente.
- CSS encapsulado y cargado solamente en index.html; no disparar re-render ni observadores de scroll al cambiar de apariencia.
- Respetar prefers-reduced-motion, forced-colors, contraste, foco y tamaño de objetivo táctil.

## Matriz de regresión

- **Ruta**: raíz, GitHub Pages, vistas ?view=author y hashes; páginas excluidas intactas.
- **Identidad**: invitado, cuenta A/B, cambio de cuenta, cierre de sesión, offline, storage bloqueado y fallo de escritura Firestore.
- **Pantallas**: 4 temas × claro/oscuro × 320/360/390/430/768/1024/1440 px; Safari iOS, Chrome Android y escritorio.
- **Flujos**: buscar/auto-scroll al primer artículo, filtros, cargar más, guardar solo con sesión, DOI, ficha, modal, back/forward, autor y Atlas.
- **Rollback**: quitar el aplicador visual sin revertir el perfil ni los datos; Predeterminado conserva el aspecto previo.

**La fase 0 es deliberadamente inerte:** el módulo puro no se importa todavía en producción. La próxima fase conectará sesión, CSS y sincronización sin poner en riesgo el buscador.

## Fase 1: estado de integración

Los módulos de navegador `js/corpus-appearance.js` y `js/corpus-appearance-runtime.js` conectan la selección **únicamente al index**. El buscador conserva inmediatamente Predeterminado en el HTML inicial y solo habilita el puente Firebase si existe un indicio local reciente de sesión; el indicio jamás se usa como identidad ni para leer una clave por UID.

Después de obtener un usuario realmente verificado por Firebase Auth, la interfaz aplica la caché visual de su UID y valida en segundo plano el perfil de Firestore. La lectura remota tiene límite de tiempo y está separada del render del corpus. `storage` mantiene coherencia entre pestañas y descarta respuestas remotas antiguas al cambiar de cuenta o de tema.

La hoja `css/corpus-appearance.css` contiene tokens y tratamientos visuales limitados al lienzo, cabecera, navegación y panel inicial de búsqueda. Predeterminado sigue exactamente con su CSS previo. No se modifican tarjetas, fichas, autores, Atlas, controles de desplazamiento ni sus algoritmos.

Pruebas: `tests/corpus-appearance-policy.test.mjs` y `tests/corpus-appearance-runtime.test.mjs`, además del preflight completo existente. Los casos automatizados comprueban cuentas A/B, logout, almacenamiento bloqueado, modo invitado, lectura remota tardía, actualización desde otra pestaña, raíces GitHub Pages y páginas excluidas.

**Dependencia de integración:** PR fase 1 sobre la rama de fase 0 mientras el PR #382 siga sin integrar. Fusionar primero #382 en `main` y luego reorientar la fase 1 a `main`, sin activar merge automático.
