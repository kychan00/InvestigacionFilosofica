# Arquitectura V1 — Relaciones bibliográficas en fichas

**Rama:** `feat/record-related-works-architecture-20261101`  
**Estado:** diseño; sin integración de producto  
**Objetivo:** añadir al final de cada ficha una sección de obras relacionadas que sea rápida, explicable, diversa y filosóficamente útil, sin descargar modelos pesados al abrir una ficha.

---

## Estado de Fase 0

La arquitectura ya tiene un contrato ejecutable y una matriz sintética versionada:

- `src/core/related-work-contract.js`
- `tests/related-work-contract.test.mjs`
- `benchmark/related-works/v1/fixtures.json`
- `docs/RELATED_WORKS_DATA_CONTRACTS_V1.md`
- `docs/RELATED_WORKS_FIXTURES_V1.md`

Fase 0 no define todavía pesos finales de ranking ni modifica la UI. Su cierre exige que todas las relaciones publicables sean tipadas, explicables y respaldadas por evidencia estructurada.

---

## 1. Principio de producto

La sección no debe comportarse como un recomendador genérico de comercio electrónico.

Una obra puede estar relacionada con otra por razones distintas:

- afinidad conceptual o semántica;
- autoría o coautoría;
- pertenencia a un mismo debate;
- proximidad temática;
- continuidad histórica;
- relación bibliográfica o de citación verificada;
- misma tradición, filósofo, problema u objeto;
- aparición conjunta en fuentes académicas.

Por eso el producto debe representar **relaciones tipadas** y no únicamente un número de similitud.

El usuario debe poder entender por qué aparece cada obra.

---

## 2. Nombre conceptual

Internamente se propone el término:

> **Bibliographic Relation Graph / Grafo de relaciones bibliográficas**

La primera interfaz será:

> **Obras relacionadas**

La lista es una proyección del grafo, no la estructura de datos definitiva.

Esto permite reutilizar el mismo motor posteriormente en una vista de constelación 2D.

---

## 3. Restricción principal de rendimiento

El corpus semántico existente contiene 451,823 documentos y la búsqueda Qwen3 Browser Static V4 conserva 1,024 dimensiones.

El modelo de embeddings del navegador es demasiado grande para cargarlo automáticamente al abrir una ficha.

**Regla V1:**

> Abrir una ficha nunca puede iniciar por sí mismo la descarga del modelo Qwen3.

La relación semántica se debe **precalcular offline** y publicar como artefacto estático.

El modo semántico completo puede seguir existiendo como acción explícita del usuario, nunca como dependencia del folio.

---

## 4. Arquitectura general

```text
                    BUILD OFFLINE

OpenAlex Philosophy / HF
        │
        ├── vectores semánticos existentes
        ├── autores
        ├── topics / conceptos
        ├── año / tipo / idioma
        └── relaciones bibliográficas verificables
                    │
                    ▼
          Related Work Builder
                    │
        ┌───────────┼────────────┐
        ▼           ▼            ▼
  vecinos ANN   señales       identidad
  semánticos    estructurales canónica
        └───────────┼────────────┘
                    ▼
        relation-index-v1
        artefacto estático
                    │
────────────────────┼────────────────────
                    │
                    ▼
                  WEB
                    │
        seed de la ficha actual
                    │
                    ▼
          RelatedWorksResolver
                    │
           fetch de 1 shard
                    │
                    ▼
     filtro + diversidad + explicación
                    │
                    ▼
          Obras relacionadas
                    │
                    └── futuro: constelación 2D
```

---

## 5. Identidad de la obra semilla

Antes de buscar relaciones se debe obtener una identidad estable.

Orden de preferencia:

1. DOI normalizado;
2. OpenAlex Work ID;
3. identificador bibliográfico estable de proveedor;
4. identidad curada/verificada;
5. fallback controlado: título normalizado + año + primer autor.

Nunca se debe mezclar una obra únicamente por parecido aproximado del título cuando exista un identificador fuerte.

El motor de relaciones debe reutilizar las reglas de deduplicación e identidad ya presentes en `merge-results.js`.

---

## 6. Fingerprint de relación

Cada obra tendrá un `relationFingerprint` lógico compuesto por:

```text
identity
authors[]
coauthors[]
year
type
language
journal
topics[]
philosophyCorpus.conceptId
philosophyCorpus.ontologyKeyword
philosophyCorpus.documentRole
semanticVectorId
verifiedRelations[]
```

No todos los campos estarán disponibles para todas las fuentes.

La ausencia de un dato nunca se interpreta como evidencia negativa.

---

## 7. Generadores de candidatos

El sistema no tendrá una única fuente de candidatos.

### 7.1 Afinidad semántica

Fuente principal para similitud conceptual.

Se reutilizan los embeddings Qwen3 ya construidos para el corpus.

Offline se obtiene para cada obra un conjunto pequeño de vecinos aproximados.

No se calcula el embedding de la obra en tiempo de apertura de la ficha.

### 7.2 Topic / concepto

Se comparan:

- topics;
- `primary_concept_id`;
- ontology keywords;
- conceptos de `philosophy-map.json`;
- áreas filosóficas cuando puedan inferirse sin inventar información.

### 7.3 Autoría

Se consideran:

- mismo autor;
- coautoría directa;
- colaboradores compartidos.

Un mismo autor es una señal fuerte, pero no debe monopolizar la lista.

### 7.4 Red bibliográfica

Cuando exista evidencia estructurada se podrá incorporar:

- cita;
- obra citada;
- referencias bibliográficas;
- continuación editorial.

**Nunca se mostrará “cita a” o “es citado por” si sólo se infirió por similitud textual.**

Esta señal entra únicamente cuando el corpus de datos permita verificarla.

### 7.5 Contexto histórico

Proximidad temporal puede ayudar a distinguir:

- debate contemporáneo;
- recepción posterior;
- reconstrucción histórica.

El año por sí solo nunca produce una relación.

### 7.6 Fuentes externas

Crossref, Internet Archive y CUCSH pueden complementar cuando la semilla no esté en el corpus semántico.

No deben disparar una batería de búsquedas nuevas por cada ficha.

Se utilizarán principalmente como fallback o enriquecimiento progresivo.

---

## 8. Índice estático de relaciones

Nombre propuesto:

`related-work-index-v1`

Debe publicarse como release inmutable y versionada.

### Estructura lógica

```json
{
  "seed": "openalex:W123",
  "version": 1,
  "neighbors": [
    {
      "id": "openalex:W456",
      "vectorId": 91231,
      "signals": {
        "semantic": 0.91,
        "topic": 0.72,
        "author": 0,
        "coauthor": 0,
        "citation": null,
        "temporal": 0.40
      },
      "reasons": [
        "semantic",
        "shared-topic"
      ]
    }
  ]
}
```

El artefacto final puede usar nombres compactos y compresión; el JSON anterior describe el contrato lógico, no el formato físico.

### Sharding

No se debe publicar un único archivo gigante.

Opciones:

- hash de identidad;
- prefijo del OpenAlex Work ID;
- particiones deterministas de vector ID.

Objetivo de runtime: abrir una ficha debe necesitar **una petición pequeña** para recuperar sus relaciones precalculadas.

---

## 9. Ranking de relaciones

La salida no debe ordenar simplemente por cosine similarity.

Propuesta conceptual:

```text
relationScore =
    semanticAffinity
  + topicAffinity
  + authorGraph
  + bibliographicGraph
  + philosophicalAffinity
  + metadataConfidence
  - redundancyPenalty
```

Los pesos deben calibrarse con evaluación humana antes de congelarse.

### Importante

El score numérico es una herramienta interna.

En la UI no hace falta mostrar “93.4 % relacionado”.

Es mejor mostrar razones verificables.

---

## 10. Diversificación

Sin diversificación, una obra de Dinora podría devolver seis obras de Dinora y ocultar el debate intelectual alrededor de ella.

La lista final debe aplicar un reranking tipo MMR o equivalente.

Reglas iniciales:

- máximo 2 obras consecutivas del mismo autor;
- evitar duplicados editoriales;
- evitar múltiples versiones de la misma obra;
- favorecer al menos dos tipos de relación cuando existan;
- no sacrificar relevancia extrema sólo para cumplir diversidad artificial.

Una salida ideal de seis elementos podría contener:

1. afinidad conceptual fuerte;
2. misma autora;
3. misma problemática con otro autor;
4. colaboración/coautoría;
5. relación bibliográfica verificada;
6. obra históricamente próxima relevante.

No se exige esta distribución si los datos no la justifican.

---

## 11. Razones explicables

Cada resultado debe producir `relationReasons[]`.

Ejemplos válidos:

- **Afinidad conceptual** · Teoría crítica / Adorno.
- **Misma autora** · Dinora Hernández López.
- **Colaboración académica** · comparte coautor.
- **Mismo problema** · violencia, diferencia y crítica social.
- **Relación bibliográfica** · cita verificada.
- **Contexto histórico** · producción contemporánea del mismo debate.

Ejemplos inválidos:

- “Está relacionado porque la IA lo considera parecido”.
- “Cita a esta obra” sin evidencia bibliográfica.
- etiquetas filosóficas inventadas a partir de una sola palabra.

---

## 12. Runtime: RelatedWorksResolver

Módulo propuesto:

`src/core/related-works.js`

Responsabilidades:

1. canonicalizar la obra semilla;
2. localizar su shard;
3. recuperar candidatos;
4. eliminar la propia obra;
5. deduplicar por identidad;
6. aplicar filtros de confianza;
7. diversificar;
8. construir explicaciones;
9. devolver objetos de presentación.

Contrato conceptual:

```js
getRelatedWorks(seed, {
  limit: 6,
  signal,
  diversity: true
})
```

Debe ser independiente del DOM.

---

## 13. Fallback para obras fuera del corpus

Casos como registros curados, Internet Archive o Crossref pueden no disponer de `vectorId`.

Orden del fallback:

### Nivel A
Mapear por DOI/OpenAlex ID a una obra existente en el índice.

### Nivel B
Mapear por identidad bibliográfica fuerte.

### Nivel C
Consulta tradicional ligera construida a partir de:

- título;
- autor;
- topics verificados;
- conceptos explícitos.

### Nivel D
Mostrar que no hay relaciones suficientes.

No se debe inventar una lista sólo para evitar un estado vacío.

La búsqueda semántica pesada del navegador podrá ofrecerse como acción explícita:

> Explorar relaciones semánticas profundas

pero nunca se ejecutará automáticamente.

---

## 14. UI de la ficha

La nueva sección se ubica **después de la trazabilidad y explicación**.

Número conceptual:

`08 — Relaciones`

Título:

**Obras relacionadas**

No usar tarjetas independientes.

### Forma visual

Lista plana de datos, inspirada en un patrón de data-list:

```text
08  RELACIONES
    Obras relacionadas
──────────────────────────────────────────────
01  Afinidad conceptual
    Título de la obra
    Autor · 2024 · Revista                  ↗
    Teoría crítica · Adorno
──────────────────────────────────────────────
02  Misma autora
    Otro título
    Dinora Hernández López · 2023           ↗
──────────────────────────────────────────────
```

Características:

- fondo de sección coherente con el folio;
- filas separadas por líneas;
- hover/focus funcional;
- rail o código de relación;
- título dominante;
- autor clickeable;
- año y fuente como metadata;
- una o dos razones, no un párrafo;
- la fila abre la ficha relacionada;
- sin carrusel;
- sin “cards flotantes”;
- sin branding visible del sistema de diseño.

### Mobile

La fila cambia a disposición vertical.

No habrá scroll horizontal.

El área táctil mínima se conserva.

---

## 15. Exploración progresiva

V1:

- mostrar 6 relaciones;
- botón `Ver más relaciones`.

V2:

- filtros por tipo:
  - Concepto
  - Autoría
  - Red académica
  - Contexto

V3:

- **Explorar constelación**
- vista 2D con la obra actual como nodo central;
- aristas tipadas por la misma estructura `relationReasons`;
- ningún segundo motor de datos.

---

## 16. Cache

Dos niveles:

### Memoria
`Map<seedIdentity, RelatedWorksResponse>`

### HTTP
Artefactos versionados e inmutables con cache largo.

Una ficha reabierta no debe repetir descargas.

---

## 17. Estados de interfaz

### Loading

No usar spinner gigante.

Mostrar tres líneas skeleton discretas.

### Success

4–6 relaciones iniciales.

### Partial

Mostrar las disponibles y una nota metodológica breve.

### Empty

> No encontramos relaciones bibliográficas suficientemente confiables para esta obra.

No rellenar con resultados débiles.

### Error

La ficha principal nunca debe fallar porque falle el módulo de relaciones.

La sección se degrada de forma aislada.

---

## 18. Observabilidad

El módulo debe poder registrar en desarrollo:

- seed identity;
- shard;
- candidatos recibidos;
- candidatos descartados;
- score por señal;
- razones finales;
- diversidad aplicada;
- bytes descargados;
- latencia.

En producción no se muestran detalles internos al usuario.

---

## 19. Evaluación

Antes de producción se necesita un conjunto de semillas filosóficas diverso.

Propuesta inicial:

- 30–50 obras;
- filosofía analítica;
- continental;
- teoría crítica;
- ética;
- metafísica;
- epistemología;
- autoras/autores del corpus UdeG;
- obras antiguas y contemporáneas.

Cada relación se etiqueta manualmente:

- muy útil;
- útil;
- dudosa;
- irrelevante.

### Métricas

- Precision@6;
- nDCG@6;
- tasa de duplicados;
- diversidad de autores;
- diversidad de tipos de relación;
- falsos positivos de autoría/citación;
- latencia;
- bytes descargados.

No se publicará un peso definitivo de ranking sin comparar al menos una versión baseline.

---

## Estado de Fase 1A

La Fase 1A implementa el contrato físico del índice sin integrar todavía la UI.

Componentes:

- `scripts/related/build_related_work_index_v1.py`
- `scripts/related/validate_related_work_index_v1.py`
- `src/core/related-work-index-format.js`
- `benchmark/related-works/v1/index-builder-fixture.json`
- `tests/test_related_work_index_builder.py`
- `tests/related-work-index-format.test.mjs`
- `.github/workflows/related-work-index-v1.yml`
- `docs/RELATED_WORK_INDEX_V1A.md`

1A genera únicamente relaciones sustentadas por el corpus semántico y topics estructurados. Autoría, coautoría y citación quedan bloqueadas hasta integrar Authority Graph y Reference Graph.

El full build de 451,823 documentos requiere los originales congelados del FAISS y metadata SQLite. Los hashes están documentados, pero su ubicación pública original no está registrada en el repositorio; por ello no se sustituye silenciosamente con los shards int8 derivados de Static V4.

---

## Estado de Fase 2A

El runtime de lectura del índice está implementado sin integración de UI.

Componentes:

- `src/core/related-works-resolver.js`
- `tests/related-works-resolver.test.mjs`
- `docs/RELATED_WORKS_RUNTIME_V1.md`

Garantías actuales:

- manifest + un shard por seed;
- sin carga automática de Qwen3;
- sin búsquedas federadas automáticas;
- cache de shards y metadata;
- hidratación únicamente de páginas Static V4 necesarias;
- empty/partial para seed ausente;
- errores de infraestructura reintentables;
- salida `RelatedWorkEdge V1`.

2A no congela ranking final, diversidad ni UI. Es la capa de transporte/contrato que consumirá la sección del folio cuando exista un índice remoto real.

---

## Estado de Fase 1C

La integración del Author Authority Graph está implementada como un puente explícito y versionado:

- `scripts/related/build_authority_work_map_v1.mjs`
- `scripts/related/authority_work_map_v1.py`
- `docs/RELATED_WORK_AUTHORITY_SIGNALS_V1.md`
- `tests/authority-work-map.test.mjs`

El Related Work Builder puede ahora:

- producir `same-author` sólo desde AuthorityPerson confirmadas;
- producir `shared-coauthor` cuando ambas obras son multi-autoriales;
- enriquecer vecinos semánticos con evidencia de autoría;
- introducir candidatos de autoría que no estaban en el top semántico;
- conservar la relación de autoridad a través de registros DOI/OpenAlex deduplicados;
- producir aristas authority-only sin inventar un score semántico.

El bridge consume únicamente `work-authors` verificado y el `identifierRegistry` del Authority Graph. Los nombres nunca se utilizan para fusionar personas dentro de Related Works.

La publicación masiva todavía depende de ejecutar el Authority Batch real y de recuperar/republicar los originales FAISS + metadata SQLite con sus SHA congelados.

---

## 20. Fases

### Fase 0 — contrato
- arquitectura;
- identidad;
- esquema de señales;
- fixtures;
- benchmark humano.

### Fase 1 — índice offline
- construir vecinos semánticos;
- enriquecer con topics/autores;
- publicar `related-work-index-v1`;
- validación de integridad.

### Fase 2 — resolver runtime
- `related-works.js`;
- cache;
- fallback;
- deduplicación;
- diversidad;
- explicaciones.

### Fase 3 — UI
- sección 08;
- lista plana;
- claro/oscuro;
- móvil/escritorio;
- enlaces de autor;
- apertura de ficha relacionada.

### Fase 4 — red bibliográfica
- relaciones de citación/referencia verificadas cuando estén disponibles;
- coautoría avanzada;
- mejores razones.

### Fase 5 — constelación
- visualización 2D alimentada por el mismo grafo.

---

## 21. Criterios de aceptación V1

La función no se considera lista sólo porque “aparezcan seis obras”.

Debe cumplir:

1. no descargar Qwen3 automáticamente;
2. no llamar `api.openalex.org`;
3. no mostrar la propia obra;
4. no duplicar versiones;
5. no inventar citaciones;
6. no atribuir autores por similitud textual;
7. explicar al menos una razón real por relación;
8. mantener diversidad razonable;
9. funcionar en claro y oscuro;
10. funcionar desde 320 px;
11. no bloquear la apertura de la ficha;
12. degradarse de forma independiente;
13. conservar procedencia bibliográfica;
14. reutilizar la identidad canónica existente;
15. permitir reutilizar el mismo grafo en una futura vista 2D.

---

## 22. Decisión arquitectónica central

**No construir “recomendaciones”. Construir relaciones.**

La diferencia es importante:

- una recomendación intenta adivinar qué quiere leer el usuario;
- una relación intenta describir una conexión bibliográfica verificable entre dos objetos.

Investigación Filosófica debe priorizar la segunda.

El resultado puede sentirse más inteligente precisamente porque es más explicable y menos arbitrario.
