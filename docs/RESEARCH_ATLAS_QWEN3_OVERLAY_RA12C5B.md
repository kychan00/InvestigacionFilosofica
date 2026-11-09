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
- coseno medio mínimo: **0.997**

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


## Corrección del gate de paridad antes del primer build válido

El primer intento que llegó a comparar embeddings reales produjo coseno mínimo **0.997301** y media **0.997376**, pero falló porque el contrato inicial había fijado media ≥0.998.

Ese umbral mezclaba dos representaciones distintas: el embedding nuevo es float32 L2, mientras la referencia disponible en V4 ya fue cuantizada a int8 con escala 127 y después reconstruida para calcular coseno. Para un vector unitario de 1,024 dimensiones con cuantización uniforme de paso 1/127, el error RMS aproximado es **0.072737** y el coseno esperado frente al vector cuantizado es aproximadamente **0.997365**.

Por ello el umbral medio se corrigió prospectivamente a **0.997** antes de aceptar ningún overlay. El mínimo individual permanece en **0.995**. La igualdad byte a byte sigue registrándose como diagnóstico y no se convirtió retroactivamente en un gate.

Esta corrección no relaja una falla semántica: documenta que 0.998 era incompatible con el techo esperado de comparar float32 contra una referencia int8.


## Resultado real — primer overlay federado construido

La ejecución válida de C5-B fue el workflow `42560032286`, job `128974206664`, sobre el commit `b6af32d5af33f392064835fba846aec3e74e8617`.

Después de repetir la búsqueda federada, reconciliar DOI mediante C5-A y excluir obras ya presentes en V4, quedaron **207 identidades externas únicas** para embedding:

| Tipo de identidad | Documentos |
| --- | ---: |
| OpenAlex real fuera de V4 | **143** |
| DOI bajo autoridad de fuente | **37** |
| Identidad estable del proveedor | **27** |

El texto usado por Qwen se distribuyó así:

| Materia textual | Documentos |
| --- | ---: |
| título + abstract | **125** |
| título + metadata adicional | **68** |
| sólo título | **14** |

El metadata publicable conserva hashes, identidad y procedencia, pero **0 cuerpos de abstract**, `documentText`, texto completo o PDF.

### Compatibilidad con el espacio V4

Antes del overlay se re-embebieron ocho documentos V4 genuinos. Los controles terminaron distribuidos en los clusters **41 y 208**, cuatro por cluster.

| Medida | Resultado |
| --- | ---: |
| Coseno mínimo float nuevo ↔ V4 int8 | **0.9973011613** |
| Coseno medio | **0.9973758459** |
| Coseno máximo | **0.9974628687** |
| Coseno esperado por cuantización 1024D/int8 | ≈ **0.9973651120** |
| Acuerdo de bytes tras cuantizar otra vez | **100 % en los 8 controles** |

El acuerdo int8 de 100 % es especialmente fuerte: una vez aplicado el mismo contrato L2 + escala 127, los ocho controles reprodujeron exactamente los bytes almacenados en V4.

El primer gate medio propuesto de 0.998 falló con una media 0.997376. Antes de aceptar ningún overlay se corrigió a 0.997 porque el comparador usaba un embedding float nuevo frente a una referencia que ya había sufrido cuantización int8. El valor observado coincide prácticamente con el límite analítico esperado de esa cuantización.

### Artefacto Qwen generado

| Artefacto | Resultado |
| --- | ---: |
| Documentos | **207** |
| Vectores int8 | **211,968 bytes** |
| Digests SHA-256 | **6,624 bytes** |
| Metadata comprimida | **26,673 bytes** |
| Componentes saturados a ±127 | **0** |
| SHA-256 del manifest | `e76848f2876370b9682d8b906b8704371a331cd0ff2cae4a9fe0bb11a4216166` |

Hashes principales:

- vectores: `88596081fb50f6dd4a47cbca24b711982a4beca3ed991555588b71ddc4abe89f`
- digests: `1c9a1bb51ef6162d96468f9b990a62a9fae31370140d5d705c1aeefda4f5d491`
- índice: `8e2d1dc520c3c8f4d8bc85ec402ae6ec900e6cd3220a90f710debd3987c3bc90`
- metadata: `93ad389844a400f25091e53d7d8ad0d3cf9726f9450e7e61184b5631ce2eacb9`

### Tres vectores repetidos no son colisiones de hash

El auditor encontró **204 SHA de vector distintos para 207 identidades**. Se inspeccionaron los tres grupos repetidos y en todos los casos las identidades distintas habían producido **exactamente el mismo hash del texto de entrada**:

1. `doi:10.12804/th9789587843309` y `openalex:W2979496811`.
2. `openalex:W2325635106` y `openalex:W2620381083`.
3. `openalex:W4239003752` y `openalex:W4241576600`.

Por tanto, no se trata de una colisión SHA ni de una falla del modelo: **texto idéntico → vector idéntico** bajo un modelo determinista.

C5-B deliberadamente **no fusiona esas identidades**. Que dos registros tengan el mismo texto embebido no es autoridad bibliográfica suficiente para declarar que representan la misma obra.

### Evidencia preservada

- Workflow: `42560032286`
- Job: `128974206664`
- Artifact: `13649068736`
- ZIP: **225,092 bytes**
- SHA-256 ZIP: `9138b16de3e5367a9553a6af4a39f2e73ead808c337dc198b73e62cb6828199f`
- Registro permanente: `benchmark/research-atlas/v12/ra12c5b-real-overlay-evidence.json`

El overlay sigue en estado **built-unpublished**: todavía no está en Hugging Face y no participa en el Atlas público.

## Siguiente gate: RA12-C5-C

C5-C debe fijar exactamente este artifact, publicarlo en un namespace inmutable de Hugging Face y comprobar desde el origen real de GitHub Pages:

1. identidad del SearchResponse → ordinal del overlay;
2. manifest y metadata por SHA;
3. Range 206 de los 1,024 bytes del vector;
4. SHA individual del vector;
5. coseno V4 ↔ overlay y overlay ↔ overlay en el navegador;
6. fallback RA11 ante cualquier falla.

Sólo después de esa prueba se puede plantear conectar el resolvedor combinado al Atlas. La publicación por sí sola **no habilitará** nuevas aristas semánticas.
