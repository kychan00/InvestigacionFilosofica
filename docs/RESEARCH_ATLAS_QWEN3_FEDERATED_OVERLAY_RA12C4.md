# RA12-C4 — Qwen para un buscador federado: base congelada + alias + overlay semántico

**Estado:** benchmark real + arquitectura de integración. No activa nuevas aristas en producción.

## La idea central

Qwen **no necesita que un artículo venga originalmente de Hugging Face**. Hugging Face es actualmente el lugar donde tenemos precalculados y verificados los vectores de 451,823 documentos del corpus V4. El grafo debe seguir consumiendo el **SearchResponse federado** normal: OpenAlex Philosophy, Crossref, CUCSH Filosofía, Internet Archive y futuras fuentes.

Cada resultado debe pasar por una capa semántica independiente del proveedor:

1. ¿Ya conocemos exactamente esta obra dentro de V4?
2. Si no llega con OpenAlex ID, ¿su DOI/Crossref ID demuestra que es una obra V4?
3. Si no existe en V4, ¿tiene identidad estable y texto suficiente para generar un vector compatible?
4. Si tampoco cumple eso, se conserva en el grafo con RA11 y no se inventa una identidad.

El origen bibliográfico y la existencia de un vector son dos dimensiones distintas.

## Tres caminos

### A. Obra ya existente en V4

Ejemplo: OpenAlex Philosophy devuelve `W123`.

```text
SearchResponse
   ↓
openalex:W123
   ↓
alias/index V4
   ↓
vectorId / cluster / ordinal
   ↓
vector Qwen autenticado
```

No hay que recomputar nada.

### B. La misma obra llega desde otra fuente

Ejemplo: Crossref devuelve `10.1234/abc`, mientras el registro V4 de `W123` ya posee ese DOI.

```text
Crossref result
  DOI 10.1234/abc
       ↓
alias exacto DOI
       ↓
OpenAlex W123
       ↓
vector V4 existente
```

Esto es especialmente importante: **no debemos tratar un resultado Crossref como “obra nueva” sólo porque Crossref no conoce nuestro W-ID**.

RA12-C4 construye, desde los metadatos V4 SHA-verificados, un índice exacto:
- `openalex:W…`
- `doi:10.…`
- `crossref:10.…`

Cada alias apunta a `WorkID + vectorId + cluster + ordinal`. Si un alias identifica dos obras distintas, se elimina: falla cerrado. No se usa título+año para declarar identidad.

### C. Obra genuinamente externa

Ejemplo: CUCSH recupera un artículo local que no existe en V4, o Internet Archive encuentra una edición/obra no cubierta.

Ese resultado **no se agrega al corpus base OpenAlex V4**. Entra a un **overlay semántico separado**:

```text
SearchResponse externo
        ↓
identidad estable
(DOI o provider + sourceId)
        ↓
snapshot de procedencia
        ↓
texto embebible versionado
(título + abstract cuando exista)
        ↓
Qwen3-Embedding-0.6B
MISMO modelo/revisión que V4
        ↓
L2 normalization
        ↓
int8 compatible
        ↓
semantic overlay v1
```

Después, el Atlas puede calcular coseno entre:
- V4 ↔ V4
- V4 ↔ overlay
- overlay ↔ overlay

porque todos viven en **el mismo espacio vectorial Qwen**.

## Por qué NO conviene “meter todos los artículos a openalex-philosophy”

El dataset V4 ya es una referencia congelada, auditada y reproducible. Si empezamos a añadir arbitrariamente resultados de Crossref, CUCSH e Internet Archive dentro del mismo namespace:

- dejamos de saber qué representa la versión V4;
- se rompe su reproducibilidad;
- mezclamos procedencias y políticas de actualización;
- podríamos duplicar una obra que ya existía por DOI;
- una corrección local obligaría a reconstruir una base enorme;
- se vuelve más difícil distinguir “fuente bibliográfica” de “capa de representación semántica”.

La mejor arquitectura es:

```text
          FUENTES BIBLIOGRÁFICAS
 ┌──────────┬───────────┬─────────┬──────────────┐
 │ OpenAlex │ Crossref  │ CUCSH   │ Internet Arc│
 └────┬─────┴─────┬─────┴────┬────┴──────┬───────┘
      └─────────── SearchResponse ─────────┘
                       │
              identidad semántica
                       │
          ┌────────────┴────────────┐
          │                         │
    Qwen V4 base                Qwen overlay
  (451,823 congelado)       (incremental, versionado)
          │                         │
          └────────────┬────────────┘
                       │
                   Atlas 2D
```

Hugging Face puede alojar **ambas capas**, pero en rutas/versiones distintas.

## Qué debe guardar el overlay

Por defecto:
- ID semántico estable (`doi:...` o `provider:...:sourceId`);
- proveedor(es) y IDs originales;
- URL de procedencia;
- fecha/version de ingestión;
- modelo y revisión Qwen;
- hash del texto utilizado para embedding;
- vector normalizado/int8;
- hash del vector;
- licencia/procedencia de los metadatos.

No debemos asumir que podemos redistribuir texto completo o abstracts de cualquier fuente. Se puede guardar el vector y la procedencia y conservar texto sólo cuando la licencia/condiciones lo permitan. El sitio debe seguir enlazando al documento original; el overlay no se convierte en repositorio de PDFs.

## ¿Cuándo se genera un vector nuevo?

No durante cada render del Atlas.

El flujo recomendado es incremental:

1. Una búsqueda encuentra resultados.
2. El alias index resuelve los ya conocidos.
3. Los realmente externos se agregan a una **cola de candidatos** deduplicada.
4. Un proceso batch periódico toma esa cola.
5. Valida identidad/procedencia y política de texto.
6. Ejecuta Qwen una sola vez por versión de documento.
7. Publica una nueva revisión del overlay.
8. El navegador usa los nuevos vectores en búsquedas posteriores.

Así el buscador continúa siendo rápido y el corpus semántico aprende gradualmente de las fuentes que efectivamente usamos.

Para casos donde queramos semántica inmediata sobre una obra recién descubierta existiría otra opción: un pequeño servicio de embedding bajo demanda. No es la opción inicial porque añade costo, disponibilidad y superficie operativa. El overlay batch es más reproducible y compatible con el proyecto estático.

## RA12-C4: qué medimos ahora

El benchmark fija seis consultas antes de mirar los resultados:

- libertad en Kant
- lógica y ontología en Quine
- fenomenología del miedo
- cosificación y tecnología en Lukács
- causalidad en Hume
- ética estoica y virtud

Desde Chromium ejecuta el motor federado real con:
- OpenAlex Philosophy
- CUCSH Filosofía
- Crossref
- Internet Archive
- **sin OpenAlex API en vivo**

De cada único SearchResponse se toman prefijos top 5, top 20 y top 50.

Cada resultado cae en uno de cuatro estados:

| Estado | Significado |
| --- | --- |
| `base-direct` | trae OpenAlex ID y existe en V4 |
| `base-alias` | no llega como W-ID, pero DOI/Crossref demuestra identidad con V4 |
| `overlay-candidate` | no existe en V4, pero tiene identidad estable + texto embebible |
| `unresolved` | no se puede afirmar identidad ni preparar embedding con seguridad |

La métrica `baseV4Coverage` cuenta direct + alias.  
La métrica `eventualQwenCoverageIfOverlayEmbedded` suma candidatos válidos del overlay.

Esto contesta empíricamente cuánto de **nuestro buscador real**, no del corpus estático, puede participar en Qwen.

## Qué NO hace RA12-C4

- No genera embeddings nuevos.
- No publica el alias index ni el overlay en Hugging Face.
- No modifica el corpus V4.
- No trata coincidencias de título/año como identidades.
- No agrega PDFs.
- No cambia SearchResponse, ranking ni UI.
- No activa `semantic-neighbor`.
- No convierte el origen del documento en “Hugging Face”; el proveedor original sigue siendo la autoridad bibliográfica.
- No cambia de búsqueda al abrir el Atlas.

## Después de RA12-C4

Si los resultados muestran candidatos externos útiles, la siguiente fase debe ser **RA12-C5 — Overlay Builder**:

1. congelar el alias index observado;
2. revisar esquema de derechos/procedencia por fuente;
3. crear la cola deduplicada;
4. usar exactamente Qwen3-Embedding-0.6B revisión `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`;
5. producir 1024 dimensiones, L2, int8 scale 127;
6. validar paridad contra Qwen V4;
7. publicar en `research-atlas/qwen3-semantic-overlay/v1/...` con manifest inmutable;
8. integrar V4 + overlay en el resolvedor del Atlas con RA11 como fallback.

La regla conceptual es sencilla: **las fuentes encuentran obras; Qwen representa obras; el Atlas relaciona las obras**. Ninguna de esas tres capas debe sustituir a las otras.


## Resultado real corregido — workflow 42556275169

La primera ejecución de RA12-C4 fue descartada como medición de cobertura porque el benchmark local no había compilado el bundle DuckDB que utiliza `OpenAlex Philosophy`. El pipeline fue corregido para ejecutar `npm run build:duckdb` antes de Chromium. La ejecución **42556275169**, sobre `2b5d7c28eebf6a3cfaeda38b17b0b239d4fdfd16`, completó las seis consultas con **cero errores de proveedor** y reemplaza por completo aquella primera medición.

### Cobertura observada en los SearchResponses reales

| Corte agregado (6 consultas) | Resultados observados | Ya en V4 | Candidatos overlay | No resueltos | Cobertura V4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Top 5 | 30 | 2 | 28 | 0 | **6.7 %** |
| Top 20 | 120 | 5 | 115 | 0 | **4.2 %** |
| Top 50* | 297 | 85 | 212 | 0 | **28.6 %** |

\* Dos consultas devolvieron 49 y 48 resultados, por eso el corte agregado top 50 contiene 297 y no 300.

Todos los resultados que no resolvieron contra V4 en esta muestra sí tenían identidad estable y texto suficiente bajo el contrato actual; por eso la métrica potencial `eventualQwenCoverageIfOverlayEmbedded` es 100 % en los tres cortes. **Eso no significa que Qwen ya cubra 100 %**: los 212 candidatos externos todavía no tienen embedding de overlay.

### Desglose de los 297 resultados capturados

| Fuente | Resultados | V4 directo | V4 por alias | Candidato overlay |
| --- | ---: | ---: | ---: | ---: |
| OpenAlex Philosophy | 85 | 85 | 0 | 0 |
| Crossref | 127 | 0 | 0 | 127 |
| CUCSH Filosofía | 57 | 0 | 0 | 57 |
| Internet Archive | 28 | 0 | 0 | 28 |

Este resultado no prueba que ninguna obra de Crossref/CUCSH/Internet Archive exista también en OpenAlex. Revela una limitación de **identidad disponible**: el V4 congelado produjo 451,823 aliases `openalex:W…`, pero **cero DOI/Crossref aliases utilizables**. El schema V4 tiene campos `doi` y `crossref_id`, pero en el corpus congelado no aportaron valores normalizables al índice.

Por ello, antes de embeder automáticamente los 127 Crossref observados, conviene construir una capa separada de autoridad **DOI ↔ OpenAlex WorkID**. Esa capa puede recuperar obras que ya tengan vector V4 y evitar duplicarlas en el overlay. Debe ser versionada y auditable; no debe reescribir el V4 ni inferir identidad por título/año.

### Latencia observada del buscador, no de Qwen

Las seis búsquedas federadas completas en Chromium CI midieron:

- p50: **1,729 ms**
- p95: **9,363 ms**
- mínimo: **1,226 ms**
- máximo: **9,363 ms**

Estos tiempos incluyen las fuentes federadas y sus expansiones. No miden todavía la recuperación/verificación de todos los vectores ni el embedding del overlay.

### Evidencia

- Workflow: `42556275169`
- Job: `128962576576`
- Artifact: `13647139355`
- ZIP artifact: **7,622,627 bytes**
- SHA-256 ZIP: `fa5adb2e3e0a32cc87d3861627b46fbe77e472a8d28b0bcdf29898083be39e18`
- Registro persistente: `benchmark/research-atlas/v12/ra12c4-real-federated-coverage.json`
- Candidatos overlay únicos observados: **212**
- Embeddings overlay generados: **0**
- Producción modificada: **no**

## Consecuencia para RA12-C5

RA12-C5 debe dividirse en dos pasos:

**C5-A — Identity Enrichment:** crear un índice versionado DOI/Crossref → OpenAlex WorkID, con una fuente verificable, para reutilizar todos los vectores V4 que podamos antes de generar nada nuevo.

**C5-B — Overlay Builder:** sólo después, tomar los candidatos que sigan siendo realmente externos, aplicar Qwen con la misma revisión/contrato de texto y publicarlos en el namespace separado del overlay.

Esa secuencia es más barata y epistemológicamente más limpia que «meter todo a Hugging Face». Primero resolvemos si la obra ya existe; sólo después la representamos como nueva.
