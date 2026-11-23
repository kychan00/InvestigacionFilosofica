# Auditoría final · Apariencia del corpus (fase 5)

**PR único:** [#382](https://github.com/kychan00/InvestigacionFilosofica/pull/382)
**Estado de integración:** rama de trabajo; sin merge a `main`.

## Alcance entregado

- Fase 0: identidad de tema, lista permitida de rutas, clave `if:profile-shell:<uid>`.
- Fase 1: carga diferida tras autenticación verificada, caché por cuenta, sincronización Firestore y entre pestañas.
- Fase 2: formularios, filtros, tarjetas de resultados, estados de carga, DOI/acciones.
- Fase 3: folio bibliográfico completo y modal, usando contrato `--rf-*`.
- Fase 4: expediente del autor, cronología horizontal, metadatos ORCID, panel del Atlas y colores del canvas.

**Exclusiones:** tesis, Atlas de tesis, Atlas experimental autónomo, revistas de la UdeG, catálogo de artículos UdeG, filósofos latinoamericanos, perfil privado y páginas independientes.

## Conciliación con `main`

La rama del PR estuvo seis commits detrás de `main`. Se creó un commit de fusión de dos padres conservando todos los cambios de apariencia y copiando las tres rutas alteradas en `main` (`js/profile.js`, `tests/firebase-private-research.test.mjs`, `tests/profile-save-persistence.test.mjs`). **Ninguna corrección de persistencia se reemplazó por una versión anterior.**

Después de la conciliación, la comparación `main...feature/corpus-appearance-phase0-contract` indicó cero commits pendientes por incorporar desde `main`. Verificar de nuevo antes de fusionar si `main` avanza.

## Contraste y accesibilidad

`tests/corpus-appearance-final-audit.test.mjs` verifica WCAG AA **4.5:1** para texto de página, leyendas, fichas bibliográficas, enlaces, controles primarios, títulos de autor, valores y etiquetas del Atlas, para Territorio, Marginalia y Observatorio tanto en claro como oscuro. Para nodos del canvas distingue contraste no textual **3:1**. Las pruebas leen valores hexadecimales reales de las hojas CSS.

También comprueba: fallback Predeterminado, separación por UID, cuenta verificada, recuperación de Firestore sin bloquear la búsqueda, sincronización de pestañas, foco visible, colores forzados y exclusión de rutas.

**Límites de esta comprobación:** las pruebas de tokens contrastan parejas previstas, no todos los píxeles de gradientes sobre imágenes ni todas las posibles capas transparentes. La inspección visual final sigue siendo necesaria.

## Responsive y navegador

`scripts/qa/corpus-appearance-smoke.mjs` es una prueba real de Chromium/Playwright que configura cada combinación en la interfaz:

- Anchos: **320, 390, 768 y 1280 px**.
- Cuatro temas por dos modos: **32 estados**.
- Tarjetas: elemento de ranking visible y ausencia de desplazamiento horizontal inesperado.
- Ficha/modal: panel dentro del viewport, botón cerrar con **mínimo de 44 px**, scroll interno hasta contenidos largos.
- Autor: dossier dentro del viewport, cronología conserva `overflow-x: auto`.
- Atlas incrustado: panel dentro del viewport, stage con altura útil, `touch-action: none` en canvas y tokens de color.
- Capturas de pantalla de los tres temas personalizados a 390 y 1280 px; artefacto `mobile-ui-screenshots` de GitHub Actions.

Este smoke usa **fixtures locales y temas simulados en el DOM** para evitar necesitar cuentas/contraseñas reales, consultas remotas y accesos privados en CI. Valida las capas visuales y geometría, pero **no constituye una prueba end-to-end de Firebase** ni una prueba física en Safari iOS.

## Pruebas de comportamiento existentes que se mantienen

El workflow `mobile-ui-regression.yml` también ejecuta: login/perfil y guardado, selector de proyectos y autores, fichas, scroll, cronología, vistas claro/oscuro y páginas de tesis/revistas separadas. `core-health.yml` incluye las pruebas unitarias y de regresión.

## Fallos investigados durante fase 5

- Un intento de `Mobile UI regression` se interrumpió antes de ejecutar tests por **`ETIMEDOUT` de NuGet al descargar ONNX Runtime durante `npm ci`**. Esto es un fallo de infraestructura/red externo a los estilos. Se solicitó repetir el job; no se considera aprobación hasta obtener una ejecución completa.
- Los asserts del Atlas ligados a un número de versión fijo quedaron reparados en fase 4 para permitir el cache bust del módulo `research-atlas-embed.js`.

## Criterios antes del merge

- [ ] Preflight `npm test` exitoso con auditoría de contraste.
- [ ] `Mobile UI regression` completo en el último commit (incluyendo smoke de 32 estados y capturas).
- [ ] Tests de Atlas y buscador completos en último commit.
- [ ] Inspección de capturas de Chromium para 390 y 1280 px en 3 temas × 2 modos.
- [ ] Revisión manual en Safari iPhone y Android Chrome: visibilidad, teclado, scroll, botones de guardar y cierre de modal.
- [ ] Inicio de sesión real de dos cuentas y anónimo: persistencia de tema tras recargar, cerrar sesión, cambiar de cuenta y cambiar de pestaña.
- [ ] Revisión de compatibilidad con último `main` y estado mergeable del PR #382.

**No hacer merge automático.** Cuando la auditoría y validación del propietario estén listas, realizar merge únicamente con su autorización explícita.

## Reversión

Cada fase está aislada. Si se detecta un defecto visual, quitar la hoja CSS correspondiente de `index.html`; el módulo del Atlas puede volver al import anterior si su personalización de canvas no es deseada. Nunca revertir los ajustes de guardado del perfil ya integrados desde `main`.
