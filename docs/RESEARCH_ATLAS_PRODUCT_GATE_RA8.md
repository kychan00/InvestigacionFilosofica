# RA8 — Product Gate del Atlas de Investigación

## Estado

**Fase RA8 — benchmark reproducible previo a integración en la búsqueda principal.**

RA8 no añade todavía el Atlas a `index.html`.

Su función es responder una sola pregunta:

> ¿El Research Atlas está suficientemente estable, rápido, legible y reversible como para entrar al flujo principal de búsqueda?

---

## 1. Principio

La latencia de red y el coste del Atlas son problemas distintos.

RA8 los separa.

### Capa A — coste del Atlas

Mide:

- ResearchAtlasLiveSession;
- RA2 assembler;
- RA7 lexical fallback;
- RA5 layout;
- serialización del snapshot.

No depende de red externa.

### Capa B — coste de interfaz

Mide en Chromium real:

- carga del renderer;
- Canvas;
- lista accesible;
- filtros;
- selección;
- zoom;
- claro/oscuro;
- geometría responsive;
- tiempo hasta Atlas renderizado.

---

## 2. Casos congelados

Archivo:

`benchmark/research-atlas/v8/product-gate-config.json`

Casos:

1. 5 resultados — `libertad en Kant`;
2. 20 resultados — `estética y aura en Walter Benjamin`;
3. 50 resultados — `lógica y ontología en Quine`.

Cada caso se ejecuta 25 veces para el gate de núcleo.

---

## 3. Por qué los resultados son deterministas

RA8 no usa red live para aprobar CI.

Las fuentes externas pueden:

- estar lentas;
- limitar tráfico;
- cambiar contenido;
- fallar temporalmente.

Eso haría imposible distinguir un fallo del Atlas de un fallo de infraestructura.

Por eso el benchmark usa SearchResponse representativos con la misma forma contractual que consume RA7.

La integración live real ya quedó cubierta por RA7.

---

## 4. Qué se está midiendo

El benchmark no implementa un assembler paralelo.

Usa:

`ResearchAtlasLiveSession`

con un `searchPhilosophyImpl` inyectado que devuelve SearchResponse deterministas.

Por tanto siguen ejecutándose:

- assembler real;
- identidad real;
- AuthorMention overlay;
- lexical-neighbor real;
- layout real.

---

## 5. Gate de CPU

Umbrales iniciales:

| Caso | Resultados | p95 máximo |
| --- | ---: | ---: |
| small | 5 | 35 ms |
| medium | 20 | 75 ms |
| large | 50 | 160 ms |

Estos umbrales no miden red.

Miden construcción de Atlas.

---

## 6. Gate de tamaño

Para 50 resultados:

`ResearchAtlasSnapshot <= 350000 bytes`

Este límite evita que el estado del Atlas crezca sin control antes de agregar nuevas capas.

---

## 7. Gate de densidad lexical

RA7 ya impone:

`maximumEdges = 36`

RA8 falla si el caso de 50 resultados supera 36 lexical-neighbor.

Esto evita convertir el mapa en un cabello de líneas.

---

## 8. Benchmark mode del renderer

RA8 añade una ruta diagnóstica:

`research-atlas.html?benchmark=1`

Sólo en ese modo el renderer intenta cargar:

`artifacts/research-atlas-ra8/product-gate-fixture.json`

El fixture se genera durante CI.

No forma parte del flujo normal.

El modo benchmark:

- no inicializa ResearchAtlasLiveSession;
- no consulta philosophy-map;
- no consulta Hugging Face;
- no consulta Crossref;
- no consulta Internet Archive;
- no consulta servicio semántico;
- deshabilita el formulario live.

---

## 9. Navegadores y viewports

Chromium prueba:

- 320 × 844;
- 390 × 844;
- 768 × 1024;
- 1440 × 920.

Para cada viewport se conserva evidencia screenshot claro/oscuro.

---

## 10. Umbral browser

RA8 exige:

- tiempo hasta Atlas renderizado <= 1800 ms;
- stage >= 250 px;
- overflow horizontal <= 2 px;
- controles principales >= 44 px;
- 50 obras presentes;
- lista HTML alternativa presente;
- filtro funcional;
- selección funcional;
- zoom funcional;
- claro/oscuro funcional.

---

## 11. Accesibilidad

El benchmark comprueba que el Canvas no sea la única superficie.

El caso grande debe conservar al menos las 50 obras en:

`#ra-node-list`

La selección desde esa lista debe abrir:

`¿Por qué está aquí?`

Esto mantiene el contrato RA-G.

---

## 12. Evidencia

RA8 produce:

`artifacts/research-atlas-ra8/core-report.json`

`artifacts/research-atlas-ra8/browser-report.json`

`artifacts/research-atlas-ra8/product-verdict.json`

más screenshots por viewport y tema.

---

## 13. Veredicto

`evaluate-product-gate.mjs` genera:

`eligibleForMainSearchIntegration`

Sólo puede ser `true` cuando:

- core = PASS;
- browser = PASS;
- no existen failures.

---

## 14. Lo que RA8 no decide

RA8 no afirma:

- que Related Work remoto esté listo;
- que Author Authority runtime esté completo;
- que semantic-neighbor esté disponible para todo resultado;
- que 50 resultados sea el límite final del producto;
- que el Atlas deba sustituir la lista.

El Atlas sigue siendo una segunda representación.

---

## 15. OpenAlex Philosophy

RA8 no altera la política de origen.

`OpenAlex Philosophy` continúa siendo:

`CristianPelayo/openalex-philosophy`

en Hugging Face.

La API client-side de OpenAlex sigue deshabilitada.

---

## 16. Criterio para RA9

Si:

`product-verdict.status = PASS`

entonces RA9 puede integrar:

`Resultados ⇄ Atlas`

dentro de `index.html`, detrás de un toggle reversible.

Si RA8 falla, RA9 no debe empezar.

---

## 17. Integración futura

La forma deseada sigue siendo:

```text
consulta
  ↓
SearchResponse
  ↓
┌─────────────────────────┐
│ Resultados   |   Atlas  │
└─────────────────────────┘
      │             │
      │             └── mismo SearchResponse
      └──────────────── lista actual
```

No habrá dos búsquedas.

No habrá dos rankings.

No habrá dos identidades.

---

## 18. Gate RA8

RA8 queda cerrado cuando:

1. config está versionado;
2. core gate pasa;
3. 5/20/50 pasan;
4. browser gate pasa en cuatro viewports;
5. no hay overflow;
6. accesibilidad base pasa;
7. screenshots quedan como artefacto;
8. RA1–RA7 pasan;
9. `npm test` pasa;
10. product-verdict = PASS.

Sólo entonces puede abrirse RA9.
