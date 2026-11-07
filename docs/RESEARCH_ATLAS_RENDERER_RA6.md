# RA6 — Renderer experimental del Atlas de Investigación

## Estado

**Fase RA6 — primera representación visual navegable.**

RA6 introduce una ruta experimental:

`research-atlas.html`

No está enlazada desde la navegación principal de `index.html`.

Esto es deliberado.

RA6 sirve para validar la representación antes de integrar el Atlas al flujo real de búsqueda.

---

## 1. Pipeline visible

```text
fixture RA5
   │
   ▼
ResearchAtlasSnapshot
   │
   ▼
ResearchAtlasLayout
   │
   ▼
ResearchAtlasViewModel
   │
   ▼
Canvas + lista accesible + inspector
```

El renderer no modifica el snapshot ni el layout.

---

## 2. View model

Nuevo módulo:

`src/core/research-atlas-view.js`

Su función es convertir datos ya validados en una estructura de presentación.

No decide:

- identidad;
- similitud;
- ranking;
- autoridad;
- posiciones;
- evidencia.

Sólo traduce esos hechos a:

- tipo visual de nodo;
- tipo visual de arista;
- etiquetas;
- subtítulos;
- explicación «¿Por qué está aquí?»;
- filtros de visibilidad.

---

## 3. Tipos visuales de nodo

### work-direct

Obra que llegó como hit directo de búsqueda.

Canvas:

- círculo sólido azul.

### work-expanded

Obra descubierta por expansión L1.

Canvas:

- círculo hueco con borde cian.

### authority-person

Persona confirmada por Author Authority Graph.

Canvas:

- rombo verde.

### author-mention

Mención todavía no resuelta o ambigua.

Canvas:

- círculo discontinuo amarillo.

### query

Consulta actual.

Canvas:

- retícula/ancla central.

QueryNode no se presenta como obra.

---

## 4. Tipos visuales de arista

### semantic-neighbor

- línea azul;
- continua;
- alpha parcialmente ligado al score;
- evidencia derivada.

### related-work

- línea violeta;
- discontinua;
- conserva relación compuesta.

### contribution

- línea verde;
- factual;
- AuthorityPerson → WorkNode.

### author-mention

- línea amarilla;
- discontinua;
- provisional.

`query-result` no se dibuja por defecto.

Existe en el grafo y puede activarse por el view model, pero no se usa como topología visual principal.

---

## 5. Filtros

El buscador interno de RA6 filtra:

- título;
- autor;
- identidad;
- proveedor;
- subtítulo.

No recalcula layout.

No mueve nodos.

No modifica topología.

Sólo cambia visibilidad.

---

## 6. Capas

RA6 permite activar/desactivar:

- semantic-neighbor;
- related-work;
- contribution;
- author-mention.

Ocultar una capa no modifica el ResearchAtlasSnapshot.

---

## 7. Simulación incremental

Botón:

`Simular nueva obra`

Carga el `expandedSnapshot` del fixture RA5 usando el mismo `ResearchAtlasLayoutEngine`.

Por tanto:

- posiciones previas se reutilizan;
- la nueva obra nace cerca de su vecino;
- el desplazamiento anterior respeta RA5;
- no se recrean entidades existentes.

Es una demostración controlada del comportamiento que después deberá conectarse a resultados progresivos reales.

---

## 8. Inspector

Al seleccionar un nodo se muestra:

- tipo;
- identidad;
- método de spawn;
- relaciones visibles;
- sección «¿Por qué está aquí?»;
- conexiones visibles.

El inspector evita que el Canvas sea una visualización opaca.

---

## 9. Accesibilidad

El Canvas no es la única vía.

RA6 incluye una lista HTML navegable por teclado que refleja los nodos visibles.

Además:

- controles son botones nativos;
- filtros usan input nativo;
- selección se anuncia en el panel lateral;
- estados usan `aria-live`;
- focus visible;
- layout responsive;
- soporte de tema claro/oscuro;
- respeto de `prefers-reduced-motion`.

RA7 deberá profundizar benchmark de teclado y lector de pantalla.

---

## 10. Proveniencia OpenAlex Philosophy

RA6 no consulta OpenAlex live.

El fixture conserva:

`hf:CristianPelayo/openalex-philosophy:fixture-ra5`

como `sourceRevision`.

El renderer tampoco consulta la API de Hugging Face.

Consume exclusivamente artefactos locales ya versionados.

---

## 11. Seguridad arquitectónica

RA6 no:

- ejecuta Qwen;
- descarga modelos;
- llama OpenAlex API;
- llama Hugging Face API;
- consulta Crossref;
- consulta Internet Archive;
- persiste búsquedas;
- escribe cookies nuevas;
- almacena layouts en servidor.

---

## 12. Qué falta antes de integrar búsqueda real

RA6 todavía usa fixture.

La siguiente fase deberá conectar el renderer a la búsqueda progresiva real.

Antes de hacerlo se necesitan:

1. adaptador de eventos SearchResponse → ResearchAtlasAssembler;
2. carga selectiva de Authority artifacts;
3. resolución Related Works por seed elegible;
4. cancelación al iniciar nueva consulta;
5. control de race conditions;
6. presupuesto de expansión;
7. worker para layout si los benchmarks lo exigen;
8. fallback si un artefacto no está disponible.

---

## 13. Gate de RA6

RA6 se considera completo si:

- la página experimental carga sin modificar producción principal;
- Snapshot/Layout/ViewModel permanecen separados;
- nodos visuales conservan sus estados epistemológicos;
- relaciones semánticas/factuales/provisionales son distinguibles;
- el filtro no altera posiciones;
- el Canvas tiene alternativa en lista;
- la simulación incremental reutiliza RA5;
- ninguna llamada live nueva aparece en el renderer;
- `npm test` permanece verde.

---

## 14. Próxima fase

**RA7 — integración experimental con búsqueda real.**

Objetivo:

> una consulta real en el motor principal deberá alimentar el Atlas progresivamente, todavía detrás de una bandera/entrada experimental, sin cambiar el comportamiento de la lista de resultados.

RA7 será la primera fase donde el Atlas deje de usar un fixture y empiece a observar SearchResponse reales.
