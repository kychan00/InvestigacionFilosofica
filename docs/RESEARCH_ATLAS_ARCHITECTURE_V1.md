# RA0 — Arquitectura V1 del Atlas de Investigación

## Estado

**Fase RA0 — arquitectura y reglas solamente.**

Este documento define la arquitectura objetivo de un **Atlas de Investigación dinámico, incremental y trazable** para la búsqueda principal de Investigación Filosófica.

RA0 no cambia todavía:

- el runtime;
- el ranking;
- los proveedores;
- la interfaz pública;
- la política de fuentes;
- el comportamiento de búsqueda tradicional;
- el comportamiento de búsqueda semántica;
- el Author Authority Graph;
- el Related Work Index;
- el despliegue.

La implementación posterior deberá conservar las reglas ya vigentes del proyecto, en especial:

- cero llamadas client-side directas a `api.openalex.org`;
- OpenAlex Philosophy como corpus primario versionado para descubrimiento filosófico;
- Crossref, Internet Archive, CUCSH y demás fuentes como evidencia federada;
- Author Authority Graph como autoridad para identidad de personas;
- separación entre registro fuente, obra intelectual, persona y relación;
- ausencia de historial persistente de búsquedas;
- ningún atlas puede inventar referencias, autorías, influencias o identidades.

---

## 1. Visión

La búsqueda actual responde principalmente a la pregunta:

> «¿Qué resultados son relevantes para esta consulta?»

El Atlas de Investigación deberá añadir una segunda pregunta:

> «¿Cómo se relacionan entre sí las obras y las personas que aparecen alrededor de esta consulta, y qué evidencia sostiene cada relación?»

Cada búsqueda podrá generar temporalmente un **territorio de investigación**.

Ese territorio se construirá conforme lleguen y se normalicen los resultados, sin esperar necesariamente a que todas las fuentes terminen.

El usuario deberá poder observar, entre otras cosas:

- obras centrales para la consulta;
- obras semánticamente próximas;
- autores confirmados de esas obras;
- coautorías documentadas;
- autores conectados por producción compartida;
- vecindarios bibliográficos;
- convergencias y separaciones temáticas;
- procedencia de cada dato;
- por qué un nodo o una arista aparece;
- cómo cambia el mapa al filtrar, explorar o expandir.

El Atlas no sustituye la lista de resultados.

La lista responde mejor a:

- precisión bibliográfica;
- orden;
- filtros;
- lectura secuencial;
- apertura de fuentes.

El Atlas responde mejor a:

- estructura;
- relaciones;
- exploración;
- descubrimiento;
- navegación entre obras y personas.

Ambas vistas deben coexistir.

---

## 2. Diferencia fundamental respecto del Atlas de Tesis

El Atlas de Tesis parte de un corpus cerrado y reconstruible.

Su topología puede calcularse como un artefacto estable antes del despliegue.

El Atlas de Investigación parte de una **consulta abierta** cuyos resultados pueden llegar en momentos diferentes desde varias fuentes.

Por ello no debe copiar literalmente el pipeline:

```text
corpus fijo
   ↓
representación completa
   ↓
t-SNE global
   ↓
mapa final
```

Si una proyección global como t-SNE se recalculara cada vez que llega un nuevo resultado:

- los nodos cambiarían continuamente de posición;
- el usuario perdería contexto;
- el orden de llegada de proveedores afectaría la experiencia;
- una misma consulta podría parecer un territorio diferente por razones puramente temporales.

El Atlas de Investigación necesita otro contrato:

```text
consulta
   ↓
resultados parciales
   ↓
normalización + identidad
   ↓
grafo incremental
   ↓
relaciones tipadas
   ↓
layout estable y progresivo
```

La topología de Tesis y la topología de Investigación son sistemas diferentes aunque compartan principios epistemológicos.

---

## 3. Principios no negociables

### 3.1 Ranking no es topología

El resultado número 1 de una búsqueda no es automáticamente el «centro intelectual» del mapa.

El ranking sirve para recuperación.

La topología sirve para representar relaciones.

El score de ranking puede modificar:

- tamaño;
- énfasis;
- opacidad;
- orden de aparición.

No debe convertirse silenciosamente en distancia semántica.

### 3.2 Resultado no es obra canónica

Un resultado de Crossref, OpenAlex Philosophy o Internet Archive es evidencia de una posible obra.

Antes de convertirse en un nodo bibliográfico compartido debe pasar por las reglas de normalización y fusión existentes.

Dos registros que describen la misma obra no deben crear dos nodos sólo porque vienen de proveedores diferentes.

### 3.3 Nombre no es persona

Una cadena como «Hannah Arendt» o «D. Hernández» no crea por sí sola un nodo canónico de persona.

Los nodos de persona deben reutilizar el Author Authority Graph.

Cuando no exista resolución suficiente, la interfaz podrá mostrar una **mención no resuelta**, pero nunca presentarla como identidad confirmada.

### 3.4 Coincidencia temática no implica relación histórica

Dos autores o dos obras pueden estar próximos temáticamente sin que exista evidencia de:

- influencia;
- lectura;
- respuesta;
- filiación;
- escuela;
- polémica;
- dependencia histórica.

El sistema debe usar términos como:

- similitud temática;
- vecindad semántica;
- producción compartida;
- coautoría documentada;
- relación bibliográfica.

Nunca debe transformar similitud en «influyó en» sin evidencia explícita.

### 3.5 Toda arista debe tener tipo y procedencia

No existirán líneas anónimas.

Cada relación debe saber:

- qué significa;
- de dónde proviene;
- si es factual o derivada;
- qué algoritmo o regla la produjo;
- con qué revisión;
- qué evidencia la sostiene;
- si puede desaparecer al reconstruir el grafo.

### 3.6 La incertidumbre es visible

Una relación puede ser:

- confirmada;
- probable;
- derivada;
- provisional;
- no resuelta.

No se debe esconder incertidumbre bajo una línea visual convincente.

### 3.7 El Atlas consume la búsqueda; no la reemplaza

El Atlas no implementará una segunda búsqueda paralela.

Debe consumir los resultados normalizados que ya produce la arquitectura actual.

Esto evita:

- duplicar lógica;
- divergir del ranking;
- volver a consultar proveedores;
- crear diferencias silenciosas entre «Resultados» y «Atlas».

### 3.8 El orden de llegada no decide identidad

Si Crossref responde antes que Internet Archive, eso no debe convertir su registro en una obra distinta.

Dado el mismo conjunto final de registros y revisiones, el grafo canónico debe converger al mismo conjunto de:

- nodos;
- identidades;
- aristas bibliográficas;
- evidencias.

El layout visual puede animarse durante la llegada, pero el modelo subyacente no debe depender accidentalmente del timing de red.

### 3.9 IA generativa no crea el grafo factual

Una capa generativa futura podrá explicar relaciones ya recuperadas.

No podrá crear por sí misma:

- autores;
- obras;
- DOI;
- relaciones de autoría;
- coautorías;
- citas;
- influencias;
- identidad de homónimos.

### 3.10 El Atlas no activa costes ocultos

La existencia del Atlas no puede activar automáticamente el modo Qwen3 browser semantic.

La política vigente del modo browser semántico se conserva:

- sigue siendo opt-in;
- conserva su preflight;
- conserva sus advertencias de descarga/cache;
- el Atlas no descarga el modelo por el hecho de abrirse.

---

## 4. Arquitectura de alto nivel

```text
                         CONSULTA DEL USUARIO
                                │
                                ▼
                     parser + expander existentes
                                │
                                ▼
                     Search Engine / Semantic Mode
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            resultados parciales       resultado final
                    │                       │
                    └───────────┬───────────┘
                                ▼
                    Canonical Result Stream
                                │
                                ▼
                    Research Atlas Assembler
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
     obras canónicas      Author Authority      relaciones existentes
                          Graph                 / Related Work Index
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                ▼
                   Query-scoped Research Graph
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
     semantic layer        authority layer       provenance layer
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                ▼
                   incremental stable layout
                                │
                                ▼
               Resultados ⇄ Atlas ⇄ ficha/autor
```

---

## 5. Punto de integración con la búsqueda existente

La implementación no deberá consultar directamente a cada proveedor desde el Atlas.

El consumidor primario será el objeto normalizado que ya produce el sistema de búsqueda.

La arquitectura actual ya separa:

```text
parser
  ↓
expansions
  ↓
providers
  ↓
mergeResults
  ↓
rankResults
  ↓
SearchResponse
```

El Atlas se conecta **después de la normalización/fusión**.

En búsquedas progresivas podrá escuchar eventos equivalentes a:

```text
provider-settled
search-snapshot-updated
semantic-federation-updated
search-complete
```

El Atlas nunca deberá alterar el array de resultados que usa la lista.

Entrada conceptual:

```text
ingestSearchSnapshot(searchResponse, eventMetadata)
```

Salida conceptual:

```text
ResearchAtlasSnapshot
```

---

## 6. Unidad principal: ResearchAtlasSession

Cada búsqueda crea una sesión efímera.

Campos conceptuales:

- `id`;
- `normalizedQuery`;
- `rawQuery`;
- `searchMode`;
- `filters`;
- `startedAt`;
- `state`;
- `sourceRevisions`;
- `searchRevision`;
- `graphRevision`;
- `nodeRefs`;
- `edgeRefs`;
- `providerStates`;
- `warnings`;
- `partialErrors`.

Estados candidatos:

- `collecting`;
- `canonicalizing`;
- `enriching`;
- `settling`;
- `complete`;
- `partial`;
- `failed`.

La sesión vive por defecto en memoria.

No constituye historial persistente.

---

## 7. Tipos de nodo V1

RA0 define sólo los tipos necesarios para una primera implementación rigurosa.

### 7.1 QueryNode

Representa la consulta actual.

No es una entidad bibliográfica.

Sirve como referencia visual y de procedencia.

Campos mínimos:

- query original;
- query normalizada;
- modo de búsqueda;
- filtros;
- expansiones aplicadas;
- revisión.

El QueryNode puede aparecer visualmente como origen de la exploración, pero no debe ejercer por sí mismo una fuerza semántica falsa sobre las obras.

### 7.2 WorkNode

Representa una obra bibliográfica normalizada dentro de la sesión.

Debe conservar:

- identidad canónica o clave de fusión;
- título;
- año;
- tipo;
- autores presentables;
- DOI/OpenAlex/ISBN/otros IDs cuando existan;
- proveedores;
- SourceRecord refs cuando estén disponibles;
- matched queries;
- score de recuperación;
- señales semánticas disponibles;
- estado de identidad;
- URL canónica segura;
- revisiones de las fuentes.

Un WorkNode no es un SourceRecord.

### 7.3 AuthorityPersonNode

Representa una AuthorityPerson ya resuelta.

Debe reutilizar:

- ID interno del Author Authority Graph;
- nombre canónico;
- aliases verificados;
- identificadores;
- afiliaciones observadas;
- obras confirmadas;
- estado de resolución;
- evidencia.

Una persona no se recrea dentro del Atlas.

El Atlas referencia la autoridad existente.

### 7.4 AuthorMentionNode

Tipo opcional y visualmente distinto.

Sólo se utiliza cuando una mención participa de forma útil en la exploración pero todavía no puede enlazarse con seguridad a una AuthorityPerson.

Debe quedar marcado como:

`unresolved-author-mention`

Nunca debe confundirse visualmente con una persona confirmada.

### 7.5 Tipos reservados para fases posteriores

No entran en V1 sin contrato propio:

- ConceptNode;
- InstitutionNode;
- JournalNode;
- SourceNode;
- CitationNode;
- School/TraditionNode.

Especialmente, un término frecuente no debe convertirse automáticamente en «concepto filosófico».

---

## 8. Tipos de arista V1

Toda arista debe usar un contrato común.

Campos conceptuales:

- `id`;
- `fromRef`;
- `toRef`;
- `relationType`;
- `evidenceClass`;
- `status`;
- `weight`;
- `metric`;
- `method`;
- `sourceRecordRefs`;
- `evidenceRefs`;
- `decisionRefs`;
- `buildRevision`;
- `explanation`.

### 8.1 query-result

Relaciona la consulta con una obra recuperada.

Evidencia:

- motor;
- expansión;
- proveedor;
- posición;
- score.

Es una relación de recuperación, no una afirmación temática definitiva.

### 8.2 contribution

Relaciona una AuthorityPerson con una WorkNode.

Ejemplos:

- author;
- coauthor;
- editor;
- translator;
- coordinator;
- prologue;
- other documented role.

Sólo se crea cuando existe evidencia compatible con Author Authority.

### 8.3 semantic-neighbor

Relaciona dos obras mediante una representación semántica compatible.

Debe registrar:

- modelo;
- revisión;
- representación;
- métrica;
- score;
- índice;
- método de recuperación.

No significa influencia.

### 8.4 lexical-neighbor

Fallback derivado de texto disponible en la sesión.

Debe permanecer separado de `semantic-neighbor`.

Un score lexical no se compara directamente con un score de embedding.

### 8.5 same-author

Relación derivada entre dos obras cuando comparten una AuthorityPerson confirmada.

No debe derivarse sólo de igualdad de cadenas.

### 8.6 coauthor

Relación entre dos AuthorityPerson cuando existe al menos una obra canónica en la que ambas tienen contribuciones compatibles.

Debe poder explicar qué obra sostiene la relación.

### 8.7 shared-coauthor

Relación derivada y secundaria.

Sólo se utiliza cuando añade valor exploratorio y debe apuntar a la autoridad compartida que la explica.

### 8.8 related-work

Puede representar una relación ya producida por el Related Work Index cuando no se reduzca a un único tipo anterior.

Debe conservar las señales que justificaron la relación.

### 8.9 citation

Reservada hasta disponer de evidencia explícita de citación.

Nunca se infiere desde similitud temática.

### 8.10 influence

Prohibida por defecto.

Sólo podría existir en una fase futura con fuente explícita, contrato y benchmark propios.

---

## 9. Clases de evidencia

Las relaciones deben distinguir al menos:

### factual

Proviene de una afirmación bibliográfica o autoridad verificable.

Ejemplos:

- persona contribuyó a obra;
- DOI identifica registro;
- coautoría documentada.

### derived

Se calcula desde hechos o representaciones.

Ejemplos:

- semantic-neighbor;
- lexical-neighbor;
- same-author;
- shared-coauthor.

### provisional

Todavía depende de resolución incompleta.

Ejemplo:

- mención de autor candidata a AuthorityPerson.

El diseño visual deberá distinguir estas clases.

---

## 10. Capas del Atlas

El Atlas no tendrá una sola «verdad geométrica».

Se separan tres planos.

### 10.1 Capa bibliográfica

Contiene:

- obras;
- personas;
- contribuciones;
- identificadores;
- relaciones documentadas.

Es la capa factual.

### 10.2 Capa semántica

Contiene:

- vecinos;
- similitudes;
- afinidad lexical;
- representaciones;
- clusters futuros.

Es reconstruible y derivada.

### 10.3 Capa visual

Contiene:

- x/y;
- zoom;
- selección;
- pinning;
- animación;
- estado de expansión;
- visibilidad.

La posición visual no es un hecho bibliográfico.

---

## 11. Regla de geometría V1

El mapa debe preservar una idea central:

> Las obras forman el territorio; las personas se conectan al territorio.

Por ello se propone una arquitectura híbrida.

### 11.1 Obra ↔ obra

Las relaciones entre obras definen la geometría principal.

Pueden usar:

- semantic-neighbor;
- lexical-neighbor;
- Related Work edges.

La comparación entre métricas heterogéneas debe calibrarse antes de mezclarse.

No se suman scores incompatibles sin normalización y benchmark.

### 11.2 Persona ↔ obra

Los autores se colocan como una capa de autoridad conectada a sus obras.

La aparición de un autor no debe empujar artificialmente todas sus obras hasta formar un cluster sólo porque comparten persona.

La posición de personas puede derivarse de:

- baricentro de sus obras visibles;
- fuerzas satélite;
- agrupación de contribuciones.

Pero sus fuerzas no deben dominar la topología obra↔obra.

### 11.3 QueryNode

La consulta puede permanecer como ancla visual o centro de navegación.

No debe actuar como evidencia de que todas las obras son mutuamente próximas.

---

## 12. Layout incremental

El algoritmo exacto no se congela en RA0.

Sí se congelan sus propiedades.

El layout V1 debe:

1. aceptar nodos nuevos sin reiniciar el mapa;
2. mantener nodos ya visibles con desplazamiento limitado;
3. usar seed determinista cuando exista aleatoriedad;
4. poder reconstruir un snapshot final;
5. ejecutarse fuera del hilo principal cuando sea necesario;
6. soportar pinning;
7. evitar que el orden de llegada sea una fuente de identidad;
8. conservar interacción fluida;
9. poder representar nodos sin señal semántica fuerte;
10. distinguir relaciones estructurales de semánticas.

Candidato inicial para benchmark:

- grafo force-directed incremental con seed fija;
- pesos por tipo de arista;
- fixed timestep;
- hysteresis;
- spawn cerca del vecino de mayor evidencia;
- estabilización progresiva.

Alternativas a comparar antes de congelar:

- UMAP local;
- PaCMAP;
- proyección anclada sobre embeddings globales;
- force + coordenadas semánticas iniciales;
- estrategia híbrida.

t-SNE completo por cada batch no es candidato preferente para tiempo real por su inestabilidad visual.

---

## 13. Llegada progresiva de resultados

Ejemplo conceptual:

```text
t0   consulta enviada
t1   OpenAlex Philosophy entrega 12 obras
t2   aparecen WorkNodes iniciales
t3   CUCSH agrega 4 obras y fusiona 1 duplicado
t4   Crossref agrega metadatos y DOI a 2 nodos existentes
t5   Internet Archive agrega 3 obras nuevas
t6   Author Authority resuelve autores visibles
t7   Related Work Index agrega vecinos de obras elegibles
t8   se estabiliza el snapshot
```

Durante ese proceso:

- un nodo puede enriquecerse sin cambiar de identidad;
- dos nodos provisionales pueden fusionarse;
- una mención puede resolverse a persona;
- una arista provisional puede convertirse en factual;
- una arista derivada puede recalcularse.

Toda transición debe ser explicable.

---

## 14. Regla de fusión

El Atlas reutiliza la lógica de identidad de obra existente.

No implementa una función de merge independiente.

Prioridad conceptual actual:

- DOI;
- identificador OpenAlex;
- ID de proveedor dentro de su namespace;
- fallback bibliográfico controlado.

Una fase posterior podrá sustituir el fallback por una autoridad de obra más fuerte, pero el Atlas no inventará su propio criterio.

Cuando dos resultados se fusionen:

- el nodo conserva todos los proveedores;
- conserva SourceRecords;
- conserva matchedQueries;
- conserva identificadores compatibles;
- recalcula sus relaciones;
- no duplica la obra visualmente.

---

## 15. Integración con Author Authority Graph

Esta integración es obligatoria para conseguir el objetivo de «autores relacionados» sin fabricar identidades.

Flujo:

```text
WorkNode
   │
   ▼
AuthorMention
   │
   ▼
Author Authority resolution
   │
   ├── confirmed → AuthorityPersonNode
   ├── probable  → persona con estado visible
   ├── ambiguous → no fusionar
   └── unresolved → AuthorMentionNode opcional
```

Reglas:

1. misma cadena de nombre no basta;
2. ORCID compatible tiene alta fuerza;
3. identificadores contradictorios vetan fusión automática;
4. coautores recurrentes son evidencia, no identidad por sí solos;
5. una persona puede tener varias afiliaciones;
6. una obra colectiva conserva roles;
7. ninguna relación autor↔autor se crea sólo porque ambos aparecen en resultados de la misma consulta.

---

## 16. Qué significa «autores relacionados»

El sistema debe evitar una categoría ambigua.

En V1, un autor puede estar relacionado con otro por:

- coautoría documentada;
- coautor compartido;
- obras semánticamente vecinas de ambos;
- participación en una misma obra;
- relación bibliográfica explícita disponible en una fuente futura.

La UI deberá decir exactamente cuál.

Ejemplo válido:

> «Conectados por 3 coautorías confirmadas.»

Ejemplo válido:

> «Sus obras aparecen en el mismo vecindario semántico de esta consulta.»

Ejemplo inválido:

> «Autor influido por…»

si no existe evidencia histórica explícita.

---

## 17. Integración con Related Work Index

El Atlas debe reutilizar el índice de relaciones ya construido cuando una WorkNode pueda enlazarse a una identidad compatible.

Ventajas:

- no recalcular embeddings para todo;
- aprovechar vecinos precomputados;
- reducir latencia;
- conservar revisiones;
- reutilizar señales de Author Authority;
- mantener trazabilidad.

Regla:

> un vecino precalculado puede ampliar el grafo, pero debe distinguirse de un resultado directo de la consulta.

Los nodos incorporados por expansión deben llevar:

`discoveryOrigin = related-work-expansion`

y no mezclarse silenciosamente con los hits directos.

---

## 18. Integración con búsqueda semántica

### 18.1 Semantic service

Si la consulta usa el modo semántico existente:

- los resultados semánticos conservan su score y revisión;
- la federación externa conserva su carácter de companion;
- un resultado federado externo no hereda un score semántico que nunca recibió.

### 18.2 Browser semantic

El Atlas no dispara la descarga.

Si el usuario ya activó conscientemente browser semantic, el Atlas puede consumir su SearchResponse.

### 18.3 Traditional

El Atlas también debe funcionar con búsqueda tradicional.

No puede requerir Qwen para existir.

Las relaciones disponibles serán más conservadoras cuando no exista representación semántica compatible.

---

## 19. Expansión controlada

Un grafo bibliográfico puede crecer sin límite.

Por ello toda expansión debe tener presupuesto.

Niveles conceptuales:

### L0 — hits directos

Resultados de la consulta.

### L1 — relaciones inmediatas

- autores de hits;
- vecinos directos;
- coautorías inmediatas.

### L2 — expansión bajo interacción

Sólo cuando el usuario selecciona:

- «expandir autor»;
- «ver obras relacionadas»;
- «abrir vecindario».

No debe existir crawling recursivo automático ilimitado.

Los umbrales exactos se fijarán en benchmark.

---

## 20. Prioridad visual

La UI debe distinguir:

### hit directo

Obra devuelta por la búsqueda.

### expansión

Obra o persona incorporada para explicar relaciones.

### autoridad

Persona resuelta.

### mención

Persona aún no resuelta.

### relación factual

Línea de evidencia bibliográfica.

### relación derivada

Línea de similitud o estructura calculada.

El diseño no debe hacer que una relación derivada parezca más cierta que una factual sólo por ser más visible.

---

## 21. Interacciones objetivo

La primera UI deberá permitir:

- alternar Resultados / Atlas;
- buscar normalmente sin cambiar de flujo;
- ver aparecer nodos conforme llegan resultados;
- seleccionar una obra;
- ver por qué está en el mapa;
- resaltar sus autores;
- resaltar obras relacionadas;
- abrir su ficha;
- abrir el autor;
- expandir un autor;
- ocultar/mostrar autores;
- ocultar/mostrar relaciones semánticas;
- filtrar por año;
- filtrar por tipo;
- filtrar por fuente;
- filtrar por idioma;
- pinnear nodos;
- resetear layout;
- volver a la lista;
- conservar tema claro/oscuro;
- funcionar en móvil, tableta y escritorio.

---

## 22. Inspector «¿Por qué está aquí?»

Toda WorkNode y toda arista importante debe poder explicarse.

Ejemplo de nodo:

```text
Apareció porque:
- resultado directo de «libertad en Kant»
- expansión #2
- OpenAlex Philosophy
- también encontrado en Crossref
- DOI fusionado
```

Ejemplo de arista:

```text
Tipo: semantic-neighbor
Modelo: Qwen3-Embedding
Métrica: cosine
Índice: related-work-index-v1
Similitud: ...
Build: ...
```

Ejemplo de autor:

```text
AuthorityPerson confirmada
Evidencia:
- ORCID
- OpenAlex Author ID
- 4 contribuciones confirmadas
```

La explicación forma parte del producto, no es una herramienta sólo para desarrolladores.

---

## 23. Reproducibilidad

Un Atlas de consulta no puede prometer una captura eterna si algunas fuentes son live.

Sí puede conservar un manifest de reconstrucción.

`ResearchAtlasManifest` conceptual:

- query;
- filters;
- search mode;
- timestamp;
- app commit;
- corpus revision;
- semantic revision;
- Related Work Index revision;
- Author Authority revision;
- provider revisions cuando existan;
- node count;
- edge count por tipo;
- partial failures;
- graph builder revision;
- layout revision;
- seed.

Cuando todas las entradas sean versionadas, el snapshot debe ser reconstruible.

Cuando una fuente live no sea inmutable, la UI debe declararlo.

---

## 24. URL y navegación

Ruta candidata:

`research-atlas.html`

o integración equivalente dentro de la vista de resultados.

La decisión final se tomará en fase UI.

La URL debería poder representar al menos:

- query;
- modo;
- filtros;
- nodo seleccionado.

No se debe serializar toda la sesión sensible ni crear historial remoto.

---

## 25. Privacidad

Se conserva la política del sitio:

- no guardar historial de búsqueda en servidor;
- no persistir credenciales;
- no persistir cookies institucionales;
- no crear una base de datos de comportamiento de usuarios;
- no enviar el grafo a un tercero sólo para layout;
- no usar el Atlas como telemetría encubierta.

Caches técnicas de artefactos estáticos deben seguir la política de los módulos que los originan.

---

## 26. Política documental

El Atlas de Investigación es una capa de descubrimiento.

No debe introducir por sí mismo:

- descarga masiva de PDFs;
- persistencia de full text;
- copia de documentos;
- scraping de visores;
- extracción de texto desde archivos sin contrato;
- almacenamiento de bytes documentales.

Puede enlazar a recursos según las políticas ya vigentes de cada proveedor.

---

## 27. Relación con conceptos y filosofía estructurada

La búsqueda actual ya reconoce filósofos, obras y conceptos en ciertos flujos.

RA0 no convierte automáticamente esas señales en nodos conceptuales.

Motivo:

un token o topic de proveedor no equivale necesariamente a una entidad conceptual canónica.

Fase futura:

```text
Concept Authority
   │
   ├── nombre canónico
   ├── aliases
   ├── idiomas
   ├── filósofos relacionados
   ├── obras de referencia
   └── evidencia
```

Sólo entonces ConceptNode podrá participar como entidad estable.

---

## 28. Clustering

El clustering dinámico no es requisito para el primer Atlas.

Primero deben funcionar correctamente:

- identidad;
- relaciones;
- expansión;
- layout incremental.

Si se introduce clustering:

- será query-scoped;
- las etiquetas serán propuestas;
- no se presentarán como escuelas filosóficas;
- conservarán evidencia;
- tendrán benchmark humano;
- no usarán nombres de programa o proveedor para fabricar regiones.

---

## 29. Métricas de calidad

Antes de producción se deben crear benchmarks separados.

### Benchmark RA-A — identidad del grafo

Evalúa:

- duplicados;
- fusiones incorrectas;
- pérdida de proveedores;
- estabilidad de IDs;
- independencia del orden de llegada.

### Benchmark RA-B — Author Authority

Evalúa:

- falsos merges;
- homónimos;
- aliases;
- ORCID;
- coautoría;
- casos ambiguos.

Un falso merge de persona debe considerarse fallo grave.

### Benchmark RA-C — relaciones

Gold set humano para:

- semantic-neighbor;
- lexical-neighbor;
- same-author;
- coauthor;
- related-work.

### Benchmark RA-D — incrementalidad

Evalúa:

- desplazamiento de nodos ya estabilizados;
- convergencia;
- consistencia final;
- llegada en distinto orden;
- reconexiones.

### Benchmark RA-E — layout

Evalúa:

- legibilidad;
- edge crossings;
- densidad;
- vecindarios;
- estabilidad;
- separación de capas;
- auditoría visual.

### Benchmark RA-F — rendimiento

Evalúa:

- time to first meaningful atlas;
- memoria;
- FPS;
- coste de expansión;
- tamaño de artefactos;
- requests;
- CPU;
- comportamiento móvil.

Los thresholds deben preregistrarse antes de medir.

### Benchmark RA-G — accesibilidad

Debe cubrir:

- teclado;
- focus visible;
- lector de pantalla;
- alternativa lista;
- zoom 200%;
- reduced motion;
- móvil;
- dark/light;
- navegación sin canvas como única vía.

---

## 30. Invariantes de CI

Una implementación futura debe fallar si:

1. el Atlas modifica el ranking de búsqueda;
2. el Atlas hace una llamada directa no permitida a OpenAlex API;
3. abrir el Atlas activa browser semantic sin consentimiento;
4. dos DOI idénticos aparecen como obras separadas sin explicación;
5. una AuthorityPerson se crea por mera igualdad de nombre;
6. una relación `coauthor` carece de obra/evidencia;
7. una arista `semantic-neighbor` carece de modelo/revisión;
8. una relación de similitud se etiqueta como influencia;
9. un resultado federado hereda score semántico inexistente;
10. el mismo snapshot final produce identidades distintas por orden de llegada;
11. el layout bloquea el hilo principal por encima del gate definido;
12. el canvas es la única forma de acceder a la información;
13. existe overflow horizontal en viewports soportados;
14. se persiste historial de consulta sin política explícita;
15. una expansión automática excede sus presupuestos;
16. un nodo derivado se presenta como hit directo;
17. una mención ambigua se presenta como persona confirmada.

---

## 31. Separación entre grafo y layout

Debe existir un objeto intermedio independiente del renderer:

```text
ResearchAtlasSnapshot
  ├── session
  ├── nodes[]
  ├── edges[]
  ├── evidence[]
  ├── diagnostics
  └── manifest
```

El renderer consume ese snapshot.

Ventajas:

- tests sin navegador;
- posibilidad de otro renderer;
- export;
- reproducibilidad;
- benchmark científico separado del benchmark visual;
- menos acoplamiento entre Canvas/WebGL y reglas bibliográficas.

---

## 32. Contrato conceptual de snapshot

Ejemplo no definitivo:

```json
{
  "schemaVersion": "research-atlas-snapshot-v1",
  "session": {
    "query": "libertad en Kant",
    "searchMode": "traditional",
    "state": "complete"
  },
  "nodes": [],
  "edges": [],
  "diagnostics": {
    "directHits": 0,
    "expandedNodes": 0,
    "authorityPersons": 0,
    "unresolvedMentions": 0
  }
}
```

RA1 deberá convertir este esquema conceptual en contratos formales y fixtures.

---

## 33. Render candidates

La implementación visual puede evaluar:

- Canvas 2D;
- WebGL;
- SVG para capas pequeñas;
- combinación Canvas + DOM para accesibilidad;
- renderer especializado de grafos.

No se congela librería en RA0.

Criterios de elección:

- rendimiento;
- accesibilidad;
- tamaño;
- control del layout;
- soporte móvil;
- dark/light;
- facilidad para selección y hit testing;
- ausencia de dependencia de servicios externos.

---

## 34. Qué no debemos hacer

No:

- duplicar el motor de búsqueda;
- crear personas por string matching;
- mezclar raw scores de métricas distintas;
- usar ranking como distancia;
- llamar «influencia» a similitud;
- recalcular t-SNE completo en cada respuesta parcial;
- crear clusters oficiales automáticamente;
- descargar Qwen sin consentimiento;
- ocultar la procedencia de aristas;
- expandir autores infinitamente;
- guardar consultas en una base de datos por defecto;
- convertir un grafo visual en fuente de verdad;
- cambiar production search sólo para que el Atlas se vea mejor.

---

## 35. Fases propuestas

### RA0 — Arquitectura

Este documento.

Sin cambios de runtime.

### RA1 — Data contracts + fixtures

Definir formalmente:

- ResearchAtlasSession;
- ResearchAtlasNode;
- ResearchAtlasEdge;
- ResearchAtlasSnapshot;
- ResearchAtlasManifest;
- invariantes;
- fixtures positivos/negativos.

### RA2 — Graph Assembler

Construir un grafo sólo a partir de SearchResponse.

Sin UI.

Debe demostrar:

- merge estable;
- hits directos;
- proveniencia;
- arrival-order invariance.

### RA3 — Author Authority integration

Agregar:

- AuthorityPersonNode;
- AuthorMentionNode;
- contribution;
- coauthor;
- same-author.

### RA4 — Related Work / semantic integration

Agregar:

- semantic-neighbor;
- related-work;
- expansión L1;
- separación semantic/federated companion.

### RA5 — Incremental layout experiment

Crear una ruta experimental no productiva.

Comparar candidatos y fijar:

- layout;
- seed;
- budgets;
- estabilidad;
- rendimiento.

### RA6 — Benchmarks

Congelar:

- RA-A identidad;
- RA-B autores;
- RA-C relaciones;
- RA-D incrementalidad;
- RA-E layout;
- RA-F rendimiento;
- RA-G accesibilidad.

### RA7 — Atlas UI

Integrar Resultados ⇄ Atlas.

Incluye:

- móvil;
- dark/light;
- inspector de evidencia;
- filtros;
- selección;
- pinning;
- expansión.

### RA8 — Share / reproducibility

Manifest, deep links y reconstrucción.

### RA9 — Concept Authority opcional

Sólo si existe un contrato conceptual suficientemente fuerte.

---

## 36. Primer vertical slice recomendado

La primera demo no debe intentar resolver todo.

Debe demostrar una sola búsqueda con:

1. hits directos;
2. deduplicación;
3. WorkNodes;
4. AuthorityPerson de autores confirmados;
5. contribution edges;
6. algunos related-work/semantic-neighbor;
7. llegada incremental;
8. layout estable;
9. inspector «¿Por qué está aquí?»;
10. lista de resultados intacta.

Si este corte no es epistemológicamente claro y visualmente estable, no se debe ampliar el grafo.

---

## 37. Criterio de éxito

El Atlas de Investigación tendrá éxito si una persona puede hacer una consulta y pasar de:

> «Tengo 30 resultados.»

a:

> «Entiendo cuáles obras forman núcleos de discusión, qué autores aparecen realmente detrás de ellas, cuáles conexiones son bibliográficas, cuáles son semánticas y por qué el sistema me está mostrando cada relación.»

Sin convertir semejanza en verdad histórica.

Sin perder trazabilidad.

Sin romper la búsqueda existente.

Sin inventar identidades.

---

## 38. Regla final

El Atlas de Investigación no debe ser una visualización decorativa añadida a la búsqueda.

Debe ser una **segunda forma verificable de leer el resultado de la investigación**:

```text
Búsqueda
   │
   ├── lista → qué encontré
   │
   └── atlas → cómo se relaciona
```

La lista conserva precisión.

El Atlas revela estructura.

Ambas deben derivar de la misma evidencia.
