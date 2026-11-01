# Tesis Humanidades UdeG — Benchmark y puertas de calidad V1

## Estado

**T0 — protocolo de evaluación previo a implementación.**

El propósito es impedir que decisiones visualmente atractivas o técnicamente sofisticadas entren a producción sin evidencia.

---

## 1. Principio

Una técnica nueva entra al sistema porque supera una puerta de calidad congelada, no porque “parece mejor”.

Cada benchmark debe fijar:

- corpus revision;
- fixture revision;
- algoritmo;
- parámetros;
- modelo y revisión;
- seed cuando aplique;
- hardware relevante;
- métricas;
- threshold;
- resultado PASS/FAIL.

---

## 2. Benchmark A — Source harvest

Evalúa cosecha y snapshots.

Casos:

- Identify;
- ListMetadataFormats;
- ListSets;
- paginación/resumption token;
- incremental from/until;
- registro modificado;
- registro eliminado;
- timeout;
- token inválido/expirado;
- respuesta parcial;
- fuente caída;
- schema inesperado.

Gates:

- ningún fallo reemplaza snapshot válido por vacío;
- conteos y hashes son reproducibles;
- incremental no pierde fixtures conocidos;
- borrados se representan explícitamente.

---

## 3. Benchmark B — Humanities admission

Gold set humano de programas y tesis.

Debe incluir:

- programa humanístico actual;
- posgrado;
- especialidad si aparece;
- programa histórico;
- alias;
- cambio de nombre;
- programa interinstitucional;
- programa externo;
- programa no humanístico del CUCSH;
- tema humanístico dentro de programa no humanístico;
- tema tecnológico dentro de Filosofía;
- programa desconocido.

Métricas:

- false include;
- false exclude;
- review rate;
- unresolved rate.

Prioridad:

**false include institucional** es error de primer orden.

La semántica nunca forma parte del clasificador de admisión.

---

## 4. Benchmark C — Role normalization

Fixtures reales y sintéticos:

- un autor;
- varios autores;
- director en campo contributor;
- director concatenado en author;
- codirector;
- diferentes mayúsculas;
- “Directora de tesis”;
- “director de tesis”;
- roles sin etiqueta;
- cadena compuesta;
- persona homónima.

Gates:

- ningún director explícito se transforma en thesis-author;
- rawValue permanece intacto;
- ambigüedad se conserva;
- AuthorMention se genera por persona, no por cadena compuesta.

---

## 5. Benchmark D — Thesis deduplication

Gold pairs:

- mismo Handle;
- mismo trabajo en RIUdeG/UDGVirtual;
- títulos con puntuación diferente;
- títulos casi iguales de personas distintas;
- misma persona y títulos semejantes en años distintos;
- programa distinto;
- institución externa;
- metadatos corregidos;
- registros duplicados del mismo proveedor.

Métricas:

- precision de merge;
- recall de merge;
- false merges.

Prioridad:

**false merge > duplicate retained**.

No se promueve un algoritmo con false merge en casos críticos del gold set.

---

## 6. Benchmark E — Known-item retrieval

Consultas por:

- título exacto;
- fragmento de título;
- Handle;
- autor;
- director;
- programa;
- combinación autor+término;
- variantes con/sin acentos.

Métricas:

- MRR;
- Recall@1;
- Recall@5;
- Recall@10.

El known-item path no depende de embeddings.

---

## 7. Benchmark F — Semantic retrieval

Conjunto de consultas humanas redactadas sin copiar títulos.

Debe cubrir:

- Filosofía;
- Historia;
- Letras;
- Antropología;
- Geografía;
- Lenguas;
- temas interdisciplinares;
- español;
- inglés cuando exista corpus;
- consultas cortas;
- planteamientos largos.

Comparaciones mínimas:

- modelo candidato A/B/...;
- título-only;
- título+abstract;
- título+abstract+keywords;
- dimensiones;
- cuantización;
- índice exacto/aproximado.

Métricas:

- Recall@10;
- Recall@50;
- nDCG;
- juicio humano de vecinos;
- bytes de artefactos;
- tiempo cold/warm;
- memoria.

El modelo ganador se fija por revisión y hash.

---

## 8. Benchmark G — Topology neighbors

Evalúa específicamente el embedding usado para atlas.

No utiliza programa ni unidad administrativa en el texto.

Gold set:

- pares temáticamente cercanos entre disciplinas;
- pares administrativamente iguales pero temáticamente lejanos;
- tesis con títulos genéricos;
- tesis bilingües;
- títulos muy cortos.

Métricas:

- precisión de vecinos humanos;
- estabilidad entre rebuilds;
- concentración artificial por programa.

Gate conceptual:

si los vecinos se explican principalmente por el nombre del programa o centro, la representación falla.

---

## 9. Benchmark H — Clustering

Evalúa:

- estabilidad;
- cohesión;
- separación;
- cobertura;
- outliers;
- utilidad humana.

Las métricas internas de clustering no bastan.

Se requiere auditoría humana estratificada por disciplina y tamaño de grupo.

Ninguna etiqueta automática se publica como definitiva sin política de label decision.

---

## 10. Benchmark I — 2D atlas

El mapa no necesita preservar todas las distancias del espacio alto-dimensional, pero debe conservar vecindarios útiles.

Métricas candidatas:

- trustworthiness;
- neighbor preservation@K;
- estabilidad con seed fija;
- auditoría visual;
- densidad extrema;
- solapamiento ilegible.

La proyección se evalúa separada del clustering.

---

## 11. Benchmark J — Hybrid search

Compara:

- lexical;
- semantic;
- RRF;
- otras fusiones justificadas.

Métricas:

- nDCG;
- MRR;
- Recall@K;
- diversidad;
- known-item preservation.

Un ranking híbrido no puede empeorar de forma importante la recuperación de títulos exactos.

---

## 12. Benchmark K — Laboratorio determinista

Fixtures de propuestas reales/sintéticas.

Verifica:

- vecinos recuperados;
- ubicación;
- distribución por clúster;
- densidad;
- cronología;
- directores derivados exclusivamente de tesis vecinas;
- ausencia de afirmaciones de disponibilidad;
- ausencia de porcentajes de “originalidad”.

Toda cifra mostrada debe poder reconstruirse desde datos guardados.

---

## 13. Benchmark L — Capa generativa opcional

Sólo aplica cuando exista.

Fixtures:

- prompt injection dentro de propuesta;
- nombres falsos;
- solicitud de inventar bibliografía;
- corpus sin antecedentes;
- antecedentes ambiguos;
- director inexistente;
- metadatos contradictorios.

Gates:

- cero referencias inventadas;
- sólo IDs/tesis recuperadas;
- schema válido;
- no altera resultados deterministas;
- fallback completo.

---

## 14. Benchmark M — Performance web

Perfiles mínimos:

- móvil medio;
- escritorio;
- conexión lenta simulada;
- cold cache;
- warm cache.

Métricas:

- bytes iniciales;
- tiempo interactivo;
- tiempo de primera búsqueda;
- memoria;
- FPS/pan del atlas;
- tamaño por shard;
- número de requests.

No se fija todavía threshold numérico; T4 deberá preregistrarlo antes de medir modelos.

---

## 15. Benchmark N — Accessibility/UI

Verifica:

- teclado;
- foco;
- lector de pantalla;
- contraste claro/oscuro;
- hit targets;
- zoom 200%;
- 320/375/390/768/1280 px;
- reducción de movimiento;
- atlas con alternativa tabular.

El mapa nunca puede ser la única forma de acceder a una tesis.

---

## 16. Dataset del benchmark

Los gold sets deben estar separados del corpus de entrenamiento/curaduría cuando eso afecte la evaluación.

Cada fixture registra:

- ID;
- propósito;
- fuente;
- expected result;
- rationale;
- reviewer;
- revision.

Los casos difíciles y regresiones reales se conservan indefinidamente.

---

## 17. Release gate

Una release de Tesis no se considera estable hasta que:

1. validación estructural PASS;
2. admission benchmark PASS;
3. dedup benchmark PASS;
4. role benchmark PASS;
5. retrieval gates aplicables PASS;
6. UI/accessibility gates aplicables PASS;
7. manifest y hashes existan;
8. diff esté limpio;
9. CI termine correctamente;
10. artefactos publicados correspondan al manifest.

---

## 18. No objetivos de T0

T0 no fija números arbitrarios de Recall, latencia o tamaño.

Los thresholds deben preregistrarse en la fase que mida una implementación real, usando una baseline reproducible.
