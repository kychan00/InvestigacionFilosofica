# RA9 — Integración del Atlas en la búsqueda principal

## Estado

**Fase RA9 — Resultados ⇄ Atlas en `index.html`.**

RA8 autorizó esta fase con:

`eligibleForMainSearchIntegration = true`

RA9 integra el Atlas como segunda representación de la misma búsqueda.

---

## 1. Regla central

No existen dos búsquedas.

```text
consulta
   ↓
SearchResponse
   ├── Resultados
   └── Atlas
```

La lista y el Atlas consumen el mismo objeto `SearchResponse`.

---

## 2. Vista por defecto

La experiencia histórica permanece intacta.

`Resultados` es la vista seleccionada por defecto.

El toggle sólo aparece después de que el primer SearchResponse válido llegue.

---

## 3. Canal interno

`app.js` publica eventos:

- `research-atlas:reset`
- `research-atlas:search-response`
- `research-atlas:filter-results`

El renderer embebido escucha esos eventos.

No importa:

- `searchPhilosophy`;
- `searchMorePhilosophy`;
- `searchPublicSemantic`;
- `ResearchAtlasLiveSession`.

No usa `fetch()`.

---

## 4. Momentos de sincronización

El Atlas recibe el SearchResponse en:

1. resultados parciales federados;
2. resultado final federado;
3. resultado final semántico;
4. carga de más resultados;
5. restauración de la búsqueda después de una vista exclusiva de autor.

---

## 5. Pipeline

```text
SearchResponse existente
        │
        ▼
ResearchAtlasAssembler
        │
        ▼
AuthorMention overlay conservador
        │
        ▼
lexical-neighbor
        │
        ▼
ResearchAtlasLayoutEngine
        │
        ▼
ResearchAtlasViewModel
        │
        ▼
Canvas + lista HTML
```

---

## 6. OpenAlex Philosophy

Sin cambios.

`OpenAlex Philosophy` continúa siendo:

`CristianPelayo/openalex-philosophy`

en Hugging Face.

RA9 conserva:

`OPENALEX_PHILOSOPHY_HF_REVISION`

en `sourceRevisions`.

---

## 7. Resultados parciales

Cuando una fuente termina:

`renderProgressiveSearch()`

publica el mismo SearchResponse parcial al Atlas.

RA5 reutiliza las posiciones anteriores.

La vista puede seguir abierta mientras llegan nuevas fuentes.

---

## 8. Filtros principales

Los filtros de:

- idioma;
- tipo;
- año;
- orden;

se aplican actualmente después del SearchResponse.

RA9 no reconstruye el grafo al cambiar esos controles.

`app.js` publica únicamente:

`resultIdentityKey(result)`

de cada resultado visible.

El renderer calcula una máscara.

Resultado:

- geometría intacta;
- IDs intactos;
- ranking no se convierte en distancia;
- obras fuera del filtro desaparecen de la vista;
- autores/menciones conectados sólo permanecen si una obra visible los sostiene.

---

## 9. Sort

Ordenar por:

- relevancia;
- año;
- citas;
- Qwen3;

no modifica la geometría del Atlas.

El conjunto visible puede permanecer igual aunque cambie el orden de la lista.

---

## 10. UI

Nuevo control:

```text
Resultados | Atlas
```

El Atlas incluye:

- Canvas;
- pan;
- zoom;
- selección;
- inspector «¿Por qué está aquí?»;
- filtro local de nodos;
- capas de relación;
- lista HTML alternativa;
- estado de sincronización.

---

## 11. Accesibilidad

El toggle usa:

- `role=tablist`;
- `role=tab`;
- `role=tabpanel`;
- `aria-selected`;
- `aria-controls`.

Flechas izquierda/derecha cambian de tab.

El Canvas no es la única navegación.

---

## 12. Vista de autor

La vista exclusiva de autor no se mezcla con el Atlas de consulta.

Cuando `body.author-view` aparece:

- se fuerza `Resultados`;
- toggle y Atlas se ocultan.

Al restaurar la búsqueda original:

- `app.js` vuelve a publicar el SearchResponse original.

---

## 13. Reversibilidad

RA9 no sustituye `#results`.

La lista permanece en DOM dentro de:

`#research-results-panel`

El Atlas vive en:

`#research-atlas-panel`

Cambiar de tab sólo alterna visibilidad.

---

## 14. Política de red

Abrir el Atlas debe producir:

`0 requests externos adicionales`

La prueba browser registra requests antes y después del cambio de tab.

---

## 15. Estado epistemológico

RA9 conserva:

- work-direct;
- work-expanded;
- authority-person;
- author-mention;
- semantic-neighbor;
- lexical-neighbor;
- related-work;
- contribution.

Como en RA7, si no hay Author Authority Graph runtime publicado para una persona:

`autor → AuthorMention`

Nunca se confirma por nombre.

---

## 16. Responsive

RA9 prueba:

- 390 × 844;
- 768 × 1024;
- 1440 × 920.

El gate exige:

- sin overflow horizontal;
- stage >= 250 px;
- lista accesible;
- filtro funcional;
- zoom funcional;
- regreso Resultados funcional;
- author-view funcional.

---

## 17. Gate RA9

RA9 se considera completo cuando:

1. Resultados es default;
2. Atlas aparece sólo con SearchResponse;
3. parcial y final sincronizan;
4. cargar más sincroniza;
5. filtros principales usan identidad canónica;
6. filtros no recalculan layout;
7. toggle crea cero requests externos;
8. lista accesible permanece;
9. mobile/tablet/desktop pasan;
10. RA1–RA8 y `npm test` permanecen verdes.

---

## 18. Lo que RA9 no hace

RA9 no:

- publica Related Work masivo;
- carga Author Authority masivo;
- activa OpenAlex API;
- auto-descarga Qwen browser;
- reemplaza la lista;
- guarda historial de Atlas.

---

## 19. Próxima fase

**RA10 — enriquecimiento de autoridad y Related Work remoto.**

Una vez publicado el artefacto remoto estable:

- AuthorityPerson confirmados;
- coauthor;
- shared-coauthor;
- Related Work L1 real;

podrán enriquecer el Atlas principal sin cambiar la integración de búsqueda de RA9.
