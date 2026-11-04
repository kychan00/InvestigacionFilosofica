# T5AA — Atlas 2D experimental de Tesis UdeG V1

## Estado

**Experimento de topología y visualización. No constituye todavía T7 Atlas UI estable ni un benchmark semántico aprobado.**

Esta fase construye la primera cartografía interactiva de las tesis de Humanidades UdeG sobre la release pública inmutable:

- release fuente: `thesis-effective-corpus-v1`;
- obras canónicas fuente: 27,576;
- obras admitidas usadas por el Atlas: **561 INCLUDE**;
- PDFs o texto completo alojados: **0**.

T5AA no cambia:

- Program Authority;
- Scope Policy;
- Metadata Confidence;
- decisiones work-level;
- release `thesis-effective-corpus-v1`.

---

## 1. Propósito

Transformar el corpus efectivo de tesis en una experiencia navegable que permita:

1. observar vecindarios temáticos;
2. recorrer una proyección 2D;
3. seleccionar una tesis y conocer sus ocho vecinas;
4. aplicar overlays institucionales sin alterar la topología;
5. conectar el Atlas con la búsqueda bibliográfica existente;
6. auditar públicamente cómo se construyó el mapa.

La interfaz propuesta queda en:

`atlas.html`

y consume únicamente:

`data/theses/atlas-v1/index.json`

más su manifest reconstruible.

---

## 2. Regla epistemológica central

La arquitectura V1 ya fijó el contrato de topología:

> **título normalizado**

Por tanto, T5AA prohíbe que estos campos entren en la representación que decide posición, vecindarios o clustering:

- programa;
- programa canónico;
- grado;
- unidad académica;
- autor;
- director;
- resumen;
- palabras clave;
- cualquier atributo administrativo.

Estos campos sí pueden viajar como **metadatos de presentación** y utilizarse como overlays de color.

La prueba `test_non_topology_metadata_cannot_move_the_map` modifica simultáneamente abstract, keywords, programa, unidad académica y autor. Las coordenadas, vecindarios, clusters e input hashes deben permanecer idénticos.

Esto evita que la estructura visual reproduzca artificialmente la organización administrativa de la Universidad.

---

## 3. Pipeline experimental

```text
thesis-effective-corpus-v1
        │
        ├── filtrar INCLUDE exactos
        │
        ▼
  561 títulos normalizados
        │
        ▼
TF-IDF word 1–2 grams
        │
        ▼
TruncatedSVD
        │
        ├──────────────► cosine kNN (k=8)
        │
        ├──────────────► HDBSCAN
        │
        ▼
      t-SNE 2D
        │
        ▼
atlas-v1/index.json + manifest.json
```

Dependencias numéricas están fijadas en:

`scripts/thesis/requirements-atlas-v1.txt`

Contrato completo:

`scripts/thesis/config/thesis-atlas-v1.json`

La seed, dimensiones, perplexity, k, parámetros HDBSCAN y revisión de stopwords están fijados.

---

## 4. Representación

Método experimental:

- TF-IDF;
- unigramas y bigramas;
- términos funcionales congelados por `atlas-stopwords-v1`;
- reducción SVD;
- normalización L2.

El vector no se publica en Pages.

Cada nodo conserva únicamente:

- `inputHash`;
- dimensiones;
- versión del contrato;
- revisión de build.

La representación es un artefacto reconstruible, no verdad bibliográfica.

---

## 5. Vecindarios

Cada tesis conserva exactamente ocho vecinas mediante similitud coseno.

El payload sigue el contrato conceptual de `ThesisNeighborhood`:

- `neighborRefs`;
- `similarityValues`;
- métrica;
- `k`;
- versión del índice;
- versión de representación;
- build revision.

Las vecinas se calculan en el espacio de alta dimensión, **no a partir de la distancia visual del canvas**.

---

## 6. Proyección

T5AA utiliza t-SNE con seed fija.

La coordenada se normaliza a un espacio visible cercano a `[-1, 1]`, preservando la razón de aspecto del resultado.

La coordenada:

- no expresa calidad;
- no expresa importancia;
- no expresa originalidad;
- no expresa cronología;
- no expresa posición institucional.

La proyección se evalúa separadamente de los vecinos de alta dimensión.

---

## 7. Clustering y etiquetas

HDBSCAN propone regiones densas.

Los clusters generados son de nivel experimental `topic`.

Las etiquetas se proponen a partir de términos TF-IDF medios de los títulos del cluster.

Toda etiqueta:

- tiene estado `proposed`;
- conserva términos de evidencia;
- tiene método explícito;
- mantiene `publishedLabelRef = null`.

La interfaz usa las expresiones **«región experimental»** y **«etiqueta propuesta»**.

No existe ruta silenciosa que convierta estas etiquetas en taxonomía oficial.

Las tesis que HDBSCAN marque como ruido permanecen en el Atlas y se describen como «fuera de regiones densas».

---

## 8. Overlays

La posición es constante.

El usuario puede cambiar el color por:

1. región experimental;
2. programa;
3. grado;
4. periodo.

Cambiar overlay nunca recalcula:

- x/y;
- vecinos;
- cluster;
- input hash.

Esto implementa la separación arquitectónica entre topología semántica y atributos institucionales.

---

## 9. UI

La página `atlas.html` incorpora:

- canvas 2D;
- pan;
- zoom por rueda y controles;
- búsqueda;
- centrado de resultados;
- regiones sugeridas;
- cambio de overlay;
- selección de nodo;
- panel de metadatos;
- ocho tesis vecinas clicables;
- salida al repositorio institucional;
- deep-link hacia la vista bibliográfica en `tesis.html?q=...`;
- explicación metodológica;
- métricas de proyección;
- modo claro y oscuro;
- layout responsive.

El mapa nunca es la única forma de acceder a una tesis: la vista lista continúa disponible en `tesis.html`.

---

## 10. Métricas visibles

El builder calcula:

- trustworthiness @ 8;
- neighbor preservation @ 8;
- tasa descriptiva de vecinos del mismo programa;
- número de clusters;
- outliers;
- varianza explicada acumulada del SVD.

Estas cifras son diagnósticas.

**No constituyen todavía PASS de Benchmark G, H o I.**

En particular, el benchmark requiere:

- gold set humano de vecinos;
- pares interdisciplinarios;
- casos administrativamente iguales pero temáticamente lejanos;
- auditoría estratificada de clusters;
- auditoría visual;
- estabilidad;
- detección de concentración artificial por programa.

Hasta cerrar esos gates, la interfaz debe seguir mostrando:

`experimental-not-benchmark-approved`

y:

`not-yet-human-benchmarked`.

---

## 11. Política reference-only

El Atlas reutiliza el builder bibliográfico seguro del demo V1 para derivar:

- título;
- autores;
- año;
- programa;
- grado;
- unidad;
- palabras clave breves;
- extracto acotado de abstract institucional;
- handle/URL institucional.

No publica:

- PDF;
- bytes PDF;
- full text;
- texto extraído;
- visor capturado;
- SourceRecord raw;
- XML OAI raw;
- vectores.

Los links admitidos siguen limitados a hosts institucionales/Handle y vetan rutas directas de archivo PDF, bitstream o download.

---

## 12. CI

Workflow:

`.github/workflows/thesis-atlas-v1.yml`

Verifica:

1. dependencias numéricas fijadas;
2. unit tests Python;
3. contrato JS;
4. suite completa npm;
5. descarga de la release V1;
6. verificación de hashes T2BZ;
7. build real de 561 nodos;
8. identidades únicas;
9. ocho vecinos por tesis;
10. coordenadas finitas;
11. topología title-only;
12. URLs institucionales;
13. ausencia de payload documental;
14. tamaño máximo;
15. manifest;
16. artifact de evidencia reference-only.

La regresión móvil existente añade un smoke de Atlas en:

`scripts/qa/thesis-atlas-smoke.mjs`

para:

- teléfono;
- tableta;
- escritorio;
- claro;
- oscuro;
- búsqueda;
- overlay;
- zoom;
- panel de detalle;
- ocho vecinos;
- overflow horizontal.

---

## 13. Pages

El deploy de Pages:

1. descarga y verifica `thesis-effective-corpus-v1`;
2. construye el índice bibliográfico actual;
3. instala el stack numérico congelado;
4. reconstruye Atlas V1;
5. verifica 561 nodos, manifest, vecinos, coordenadas y ausencia de archivos documentales;
6. sólo entonces empaqueta Pages.

Rutas previstas tras merge manual + deploy exitoso:

- `/InvestigacionFilosofica/atlas.html`;
- `/InvestigacionFilosofica/data/theses/atlas-v1/index.json`;
- `/InvestigacionFilosofica/data/theses/atlas-v1/manifest.json`.

No se declarará publicado hasta comprobar:

- merge real;
- SHA exacto de `main`;
- GitHub Actions SUCCESS;
- SHA desplegado;
- rutas públicas.

---

## 14. Siguiente fase

T5AA sirve para observar el comportamiento real del primer mapa.

Después deben separarse dos líneas:

### T5AB — Benchmark Topology / Atlas
Construir y congelar Benchmarks G, H e I con revisión humana.

### T5AC — Acerca del Atlas
Página metodológica visual con ejemplos reales de:

- registro institucional → referencia;
- título → representación;
- vecinos;
- proyección;
- clustering;
- etiquetas;
- overlays;
- límites epistemológicos.

Sólo después de resultados suficientes debe evaluarse promover la experiencia hacia T7 Atlas UI estable y, más adelante, T8 Laboratorio.
