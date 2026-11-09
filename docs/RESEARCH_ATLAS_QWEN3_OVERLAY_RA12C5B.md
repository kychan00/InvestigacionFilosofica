# RA12-C5-B — Primer overlay semántico federado Qwen

**Estado:** construcción y auditoría del primer conjunto de vectores Qwen para obras externas al V4.  
**Impacto en producción:** ninguno.  
**Corpus base:** los 451,823 vectores Qwen V4 permanecen congelados e intactos.

## Qué cambia conceptualmente

Hasta RA12-C5-A, Qwen podía representar directamente sólo obras del corpus V4. C5-A resolvió primero identidades DOI → OpenAlex para evitar generar embeddings duplicados. C5-B toma **únicamente las obras que siguen siendo externas** y las representa en el mismo espacio vectorial.

La arquitectura queda:

```text
OpenAlex Philosophy ─┐
Crossref             ├─→ SearchResponse
CUCSH Filosofía      │       │
Internet Archive ────┘       ▼
                    identidad exacta
                         │
              ┌──────────┴──────────┐
              │                     │
           ya en V4             externa real
              │                     │
        reutilizar vector      Qwen overlay
              │                     │
              └──────────┬──────────┘
                         ▼
                mismo espacio 1024D
                         │
                         ▼
                     Atlas 2D
```

Hugging Face no sustituye a las fuentes. Una obra CUCSH sigue teniendo a CUCSH como procedencia; el overlay guarda sólo una representación matemática y su trazabilidad.

## Contrato de texto recuperado del backend histórico

Antes de generar el overlay se recuperó el código del PR histórico **#4, “Add semantic retrieval backend foundation”**, commit `4ad76042be6be6ff5358045fa0dd850216898cdf`.

El V3.3 construía el texto documental exactamente así:

```text
Title:
<título>

Abstract:
<abstract>

Authors:
<autor 1; autor 2>

Topics:
<tópico 1; tópico 2>

Keywords:
<keyword 1; keyword 2>
```

Los bloques ausentes se omiten. Los espacios internos se normalizan y el texto se corta a **24,000 caracteres**.

El backend histórico codificaba documentos **sin instrucción de query**. Qwen recomienda igualmente que los documentos de retrieval no lleven la instrucción usada para las consultas. El modelo fijado continúa siendo:

- `Qwen/Qwen3-Embedding-0.6B`
- revisión `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`
- 1,024 dimensiones
- pooling provisto por el checkpoint SentenceTransformers
- L2 normalization
- cuantización final `round(clip(x,-1,1)*127)` a int8

## Selección de candidatos

C5-B vuelve a ejecutar las seis búsquedas federadas de RA12-C4 y la autoridad DOI de C5-A.

Cada resultado se procesa así:

1. si su OpenAlex WorkID existe en V4 → excluido del overlay;
2. si C5-A recuperó por DOI un WorkID V4 → excluido;
3. si el DOI resuelve a un WorkID OpenAlex fuera de V4 → identidad primaria `openalex:W...`;
4. si el DOI no resuelve a OpenAlex → identidad `doi:...`;
5. si no hay DOI pero existe identidad estable de proveedor → `provider:<provider>:<sourceId>`;
6. si no hay identidad estable → no se embebe.

La deduplicación ocurre **antes** de cargar Qwen.

Cuando la misma identidad aparece varias veces, se conserva el texto más informativo de forma determinista: primero presencia de abstract, después longitud del abstract, número de campos, longitud total y finalmente ranking/ID.

## Gate de compatibilidad contra V4 real

No basta con usar “el mismo modelo”.

Antes de embeder candidatos externos, C5-B selecciona **8 documentos V4 genuinos** de forma determinística entre los clusters más pequeños que contengan controles válidos (título + abstract y metadata compatible con el V3.3 histórico), con máximo cuatro controles por cluster. Sólo los shards realmente seleccionados se descargan desde la revisión V4 fijada y se validan por SHA-256 contra el manifest original.

Los ocho documentos de control:

- tienen título y abstract;
- no dependen de metadata enriquecida posterior;
- reconstruyen el contrato textual histórico;
- se vuelven a embeder en CPU con la revisión Qwen fijada.

Después se compara el embedding nuevo con el vector int8 V4 autenticado.

Gates preregistrados:

- coseno mínimo por control: **0.995**
- coseno medio mínimo: **0.998**

La igualdad byte a byte tras cuantización también se registra, pero no es un gate duro porque pequeñas diferencias numéricas entre Apple MPS y CPU pueden mover componentes cercanos a un umbral de redondeo.

Si la paridad falla, **no se construye el overlay**.

## Artefacto resultante

El overlay candidato contiene:

- `vectors.i8`: 1,024 bytes por documento;
- `vector-digests.sha256.bin`: SHA-256 individual por vector;
- `vector-index.jsonl.gz`: ordinal, identidad, hash del texto y hash del vector;
- `overlay-metadata.jsonl.gz`: procedencia mínima y metadata bibliográfica;
- `v4-compatibility-audit.json`;
- `manifest.json`.

El metadata publicable **no contiene**:

- cuerpo del abstract;
- `documentText`;
- texto completo;
- PDF;
- contenido de la obra.

El texto con abstract utilizado para inferencia existe sólo temporalmente dentro del runner de CI y no forma parte del artifact subido por GitHub Actions.

## Validador independiente

`validate_ra12c5b_overlay.py` no carga Qwen.

Vuelve a comprobar:

- SHA y tamaño de todos los archivos;
- número de vectores;
- ordinales e identidades;
- hash del texto privado ↔ hash del índice ↔ hash del metadata;
- SHA-256 de cada vector int8;
- digest binario por ordinal;
- ausencia de campos de texto restringidos en metadata publicable;
- resultado del gate V4.

Esto separa “generación” de “validación”.

## Qué NO hace C5-B

- no modifica V4;
- no publica aún el overlay en Hugging Face;
- no cambia el SearchResponse;
- no altera ranking;
- no habilita `semantic-neighbor`;
- no agrega una llamada de búsqueda al abrir Atlas;
- no almacena PDFs;
- no asume derechos de redistribución de abstracts;
- no reemplaza las URLs ni autoridades originales.

## Después

Si C5-B pasa con datos reales:

**RA12-C5-C** debe fijar el artifact exacto, registrar su SHA raíz, publicarlo bajo un namespace inmutable como:

```text
research-atlas/qwen3-semantic-overlay/v1/<build-id>/
```

y probar desde GitHub Pages la cadena:

```text
SearchResponse identity
→ overlay metadata
→ vector SHA
→ Range 206
→ vector int8
→ coseno V4 ↔ overlay / overlay ↔ overlay
```

Sólo después se diseña la activación progresiva del Atlas semántico.
