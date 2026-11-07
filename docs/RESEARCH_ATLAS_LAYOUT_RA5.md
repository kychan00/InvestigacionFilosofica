# RA5 — Layout incremental determinista del Atlas de Investigación

## Estado

**Fase RA5 — primera geometría visual del Research Atlas. Sin integración pública de UI.**

RA5 añade una capa completamente separada:

```text
ResearchAtlasSnapshot
        │
        ▼
ResearchAtlasLayoutEngine
        │
        ▼
ResearchAtlasLayout V1
        │
        ├── x / y
        ├── pinning
        ├── viewport
        ├── spawn provenance
        └── métricas de estabilidad
```

La geometría no modifica el conocimiento.

---

## 1. Regla de procedencia: OpenAlex Philosophy

En este proyecto, **OpenAlex Philosophy** no significa «consultar OpenAlex live cada vez que el Atlas necesita una obra».

La fuente operativa del corpus filosófico es el dataset administrado por el proyecto en Hugging Face:

`CristianPelayo/openalex-philosophy`

Ese corpus deriva de OpenAlex y es la base de:

- recuperación filosófica;
- metadata estática;
- embeddings Qwen3;
- Related Work Index;
- artefactos browser-static.

Por tanto:

> El Atlas debe conservar la revisión concreta del corpus Hugging Face utilizado y no sustituirla silenciosamente por una consulta live a OpenAlex.

Una consulta live a OpenAlex, si algún día se usa como enriquecimiento, tendrá procedencia y contrato propios.

---

## 2. Separación estricta entre grafo y layout

Input:

`ResearchAtlasSnapshot`

Output:

`ResearchAtlasLayout`

RA5 no puede:

- añadir nodos;
- borrar nodos;
- añadir aristas;
- reinterpretar evidencia;
- cambiar identidad;
- modificar `directHit`;
- resolver autores;
- ejecutar Related Works;
- ejecutar embeddings.

La posición `x/y` es estado visual.

---

## 3. Motor V1

ID:

`anchored-force-v1`

Revisión:

`2026-11-07.ra5-v1`

Características:

- completamente determinista;
- timestep fijo;
- sin `Math.random()`;
- sin dependencia nueva;
- compatible con ejecución en Worker futuro;
- entrada y salida serializable.

---

## 4. Qué define la geometría de obras

RA5 sigue la regla de RA0:

> Las obras forman el territorio; las personas se conectan al territorio.

Sólo tres clases pueden ejercer fuerza obra↔obra en V1.

### semantic-neighbor

Fuerza principal.

La distancia objetivo depende del score semántico.

Mayor cosine similarity → distancia objetivo menor.

### lexical-neighbor

Fallback más débil.

Nunca se mezcla numéricamente con cosine.

Tiene su propio perfil de fuerza.

### related-work

Sólo participa cuando contiene una relación estructural no reducida a autoría o semántica ya representada.

Ejemplos elegibles:

- shared-topic;
- shared-concept;
- same-debate;
- historical-context acompañado por otra señal válida.

---

## 5. Qué NO ejerce fuerza de obra

No ejercen fuerza:

- `query-result`;
- `same-author`;
- `contribution`;
- `coauthor`;
- `author-mention`.

Tampoco la ejerce un `related-work` cuyos tipos sean únicamente:

- `same-author`;
- `shared-coauthor`.

Esto evita convertir el Author Authority Graph en un clusterizador semántico accidental.

La posición en resultados tampoco determina geometría.

---

## 6. Doble representación semantic + related

RA4 puede conservar simultáneamente:

- `related-work`;
- `semantic-neighbor`.

RA5 no duplica la fuerza.

Para una misma pareja de obras existe prioridad geométrica:

```text
semantic-neighbor
      >
lexical-neighbor
      >
related-work
```

Sólo una fuerza obra↔obra queda activa por pareja.

Las demás relaciones siguen presentes en el snapshot y en la futura UI.

---

## 7. Spawn inicial

### Direct hits L0

Si no existe layout anterior:

- nacen sobre un anillo determinista alrededor de QueryNode;
- el ángulo deriva del ID estable;
- el ranking no determina el ángulo.

### Expansiones L1

Intentan nacer cerca del vecino geométrico visible con mayor prioridad.

Si no existe vecino visible:

- usan un anillo determinista exterior.

Cada node layout conserva:

- `spawn.method`;
- `spawn.anchorRef` cuando aplica.

---

## 8. QueryNode

QueryNode queda anclado por defecto en:

`(0, 0)`

Es centro de navegación.

No participa en las fuerzas semánticas.

El hecho de que dos obras estén cerca del QueryNode no significa que sean próximas entre sí.

---

## 9. Autoridades y menciones

AuthorityPerson se coloca **después** de estabilizar las obras.

Su target visual es:

- baricentro de sus WorkNodes visibles;
- más un pequeño offset satélite determinista.

Una persona no altera las coordenadas de sus obras.

AuthorMention se coloca como satélite de la obra a la que pertenece y tampoco participa en geometría semántica.

---

## 10. Incrementalidad

Cuando llega un snapshot nuevo:

1. los nodos existentes reutilizan su posición anterior;
2. los nodos nuevos nacen cerca de vecinos existentes cuando es posible;
3. las fuerzas se recalculan;
4. existe hysteresis hacia posiciones anteriores;
5. el desplazamiento máximo permitido se limita.

Default:

`maxExistingDisplacement = 0.18`

Esto evita que el mapa se reorganice por completo cuando aparece una nueva obra.

---

## 11. Pinning

El caller puede fijar coordenadas explícitas.

Un nodo pinned no se mueve durante la simulación.

La futura UI podrá usar esto para:

- drag manual;
- conservar foco;
- comparar regiones;
- fijar una obra de interés.

---

## 12. Determinismo

No se utiliza aleatoriedad runtime.

Ángulos y separaciones se derivan de FNV-1a 64-bit sobre IDs estables.

Dos snapshots equivalentes con arrays en distinto orden producen el mismo layout.

---

## 13. Collision y centering

Existe repulsión local entre WorkNodes para evitar colisiones.

También existe una fuerza visual muy débil hacia el origen para impedir drift indefinido.

Ninguna de ambas representa evidencia intelectual.

Son restricciones de composición.

---

## 14. Layout contract

Schema:

`research-atlas-layout-v1`

Campos principales:

- `sessionRef`;
- `graphRevision`;
- `engine`;
- `nodes[]`;
- `viewport`;
- `diagnostics`.

Cada node layout contiene:

- `id`;
- `nodeType`;
- `x`;
- `y`;
- `pinned`;
- `spawn`.

No duplica título, autores ni metadata bibliográfica.

La UI debe recuperar esos datos desde ResearchAtlasSnapshot.

---

## 15. Métricas

RA5 incluye:

`measureResearchAtlasLayout()`

Mide:

- nodeCount;
- workNodeCount;
- longitud por tipo de arista geométrica;
- overlaps;
- nodos previos reutilizados;
- meanExistingDisplacement;
- maxExistingDisplacement;
- viewport.

Estas métricas servirán para comparar futuras estrategias sin modificar el grafo.

---

## 16. Propiedades verificadas

El fixture RA5 prueba que:

1. todos los nodos reciben coordenadas;
2. QueryNode permanece anclado;
3. el orden de arrays no cambia el layout;
4. personas no cambian coordenadas de obras;
5. AuthorMention no cambia coordenadas de obras;
6. authority-only Related Work no ejerce fuerza;
7. nodo L1 nuevo nace cerca de un vecino;
8. nodos previos respetan máximo desplazamiento;
9. pinning es exacto;
10. searchPosition no cambia geometría;
11. el snapshot de entrada no se muta;
12. la ejecución incremental reutiliza estado previo.

---

## 17. Relación con el Atlas de tesis

Se reutilizan principios de UX del Atlas de tesis:

- pan/zoom;
- selección;
- detalle lateral;
- búsqueda sin mutar topología;
- colores como overlay;
- separación entre datos y render.

No se reutiliza su topología.

El Atlas de tesis tiene coordenadas offline congeladas.

El Research Atlas tiene geometría efímera e incremental por búsqueda.

Son productos visualmente emparentados, pero epistemológicamente distintos.

---

## 18. Qué queda fuera de RA5

RA5 todavía no:

- crea canvas;
- modifica `index.html`;
- integra eventos de búsqueda;
- hace fetch de Related Work shards;
- usa Web Worker;
- anima transiciones;
- muestra leyenda;
- implementa selección;
- persiste layouts;
- publica historial de búsquedas.

---

## 19. Próxima fase: RA6

RA6 debe construir el **renderer experimental** consumiendo únicamente:

- ResearchAtlasSnapshot;
- ResearchAtlasLayout.

Primera meta:

> poder ejecutar una búsqueda en un entorno experimental y ver cómo el mapa crece sin cambiar todavía la UX principal de producción.

RA6 reutilizará el lenguaje de interacción del Atlas de tesis, pero mantendrá estilos, nodos y aristas propios del Research Atlas.
