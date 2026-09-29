---
type: protocol
status: active-execution
area: evaluation
candidate: qwen3-browser-q8-1024
updated: 2026-09-29
---

# Qwen3 · Protocolo de validación externa independiente

## Propósito

Definir la siguiente fuente legítima de evidencia para el candidato browser-q8 después del resultado mixto de [[Qwen3-Browser-Q8-Confirmatory-v2]].

Este documento es la capa conceptual y de gobernanza, no la fuente ejecutable. La preregistración canónica ya vive en `benchmark/qwen3/` y fue congelada antes de recuperar candidatos; todo avance operativo debe seguir ese contrato.

## Decisión de entrada

El gate post-resultado mantiene el candidato como **research-only** y ordena **no cambiar producción**.

- Decision artifact SHA-256: `7024ceded4fd4203988b244b16d49413da047645a4347973aab37327881265e2`
- Decision freeze commit: `c3e36e042407e9c465d76976a915eb556339b097`
- Resultado que fija: H1 apoyada; H2 y H3 no apoyadas.

La futura validación no puede reinterpretar ni borrar ese resultado.

## Qué significa independencia

La validación sólo contará como externa independiente si satisface simultáneamente:

1. Las consultas o el marco de muestreo provienen de una persona, institución o corpus que no diseñó los holdouts Qwen3 anteriores.
2. Al menos una persona adjudicadora no participó en la selección de consultas, desarrollo del reranker ni adjudicaciones previas.
3. La identidad A/B, rangos, scores, proveedor y procedencia permanecen ocultos hasta congelar todos los juicios.
4. El candidato browser-q8 se reutiliza byte por byte, sin tuning basado en los holdouts observados.
5. Recuperación, runtime, queries, métricas, exclusiones, análisis y reglas de decisión se preregistran antes de recuperar documentos.

Usar al mismo investigador con una nueva lista creada a partir de los resultados observados sería otra validación interna, no validación externa.

## Candidato que puede evaluarse

- Modelo, revisión, q8, prompt, `max_length=1024`, WebGPU y tie-break deben permanecer congelados.
- A conserva el ranking de producción que esté explícitamente fijado al iniciar el nuevo estudio.
- B reordena exactamente el mismo Top 20 mediante raw score browser-q8 descendente.
- No se permite threshold, blending, cambio de pool ni inferencia con labels humanos.
- Si producción cambia antes del estudio, la nueva base debe registrarse como un experimento distinto; no se debe presentar como continuación byte-idéntica del v2.

## Marco de consultas

El conjunto debe ser nuevo respecto de development, holdouts internos y confirmatory v2. Debe derivarse de un marco externo trazable, por ejemplo:

- necesidades reales anonimizadas aportadas por investigadores externos;
- programas de cursos o bibliografías que no se usaron para construir el benchmark;
- un muestreo documentado de catálogos, agendas o preguntas de investigación externas.

Antes de congelar el set se deben comprobar colisiones exactas, variantes traducidas y solapamiento semántico de familias con todos los benchmarks previos.

La capacidad confirmada permite un balance de cuatro idiomas —español, inglés, francés y portugués— y tres intenciones —philosopher-concept, work e interdisciplinary-challenge—. La selección congelada asigna una consulta a cada celda idioma × intención, para 12 consultas. Este tamaño está determinado por un techo humano de 250 juicios y debe revisarse explícitamente como limitación de potencia antes de la recuperación; no permite inferencia por subgrupo.

Philosophy Stack Exchange es el marco externo porque contiene preguntas públicas escritas fuera del proyecto. La ruta API se preserva como historia de intentos output-free, pero dejó de ser la superficie activa después del bloqueo del proveedor. La adquisición aceptada usa el snapshot semanal oficial de [Stack Exchange Data Explorer](https://data.stackexchange.com/philosophy). El snapshot fuente sanitizado de 9.846 preguntas, el frame determinista de candidatos, las colisiones con queries previas, la exclusión semántica y la selección SHA-256 ya están congelados. No se permite selección manual posterior por conveniencia. Las nueve traducciones no inglesas y su verificación independiente también están congeladas.

## Juicio humano

Para superar la limitación del symmetric-difference audit, la validación externa debería adjudicar la **unión completa de los Top 10 de A y B**, incluidos los elementos compartidos. Así podrá identificar:

- P@10 absoluto de A;
- P@10 absoluto de B;
- ΔP@10 pareado;
- cambios de centralidad 3;
- acuerdo entre jueces, si participan dos o más.

Se mantiene la escala de [[Judgment-Protocol]]: 0 irrelevante, 1 relacionado insuficiente, 2 relevante, 3 central.

La hoja pública debe usar IDs ciegos y excluir condition, rank, scores, IDs internos, proveedor y procedencia de recuperación. A petición del adjudicador, podrá incluir un DOI normalizado, URL estable u otro identificador bibliográfico neutral, siempre que se derive de forma idéntica e independiente de condición. Toda consulta externa deberá registrarse. Si aun así falta evidencia, se permite abstención motivada; el borrador conservador declara inconcluso el gate confirmatorio ante cualquier abstención única no resuelta y exige límites de peor caso.

## Análisis preregistrado

La preregistración ejecutable decidió antes de recuperar:

- estimando primario y población principal;
- denominador y tratamiento de queries sin cambios;
- intervalo de incertidumbre o prueba pareada, si se hará inferencia formal;
- análisis overall, por intención, familia e idioma;
- métrica de centralidad 3;
- manejo de desacuerdos y datos faltantes;
- criterio de promoción, no inferioridad o rechazo;
- política para análisis exploratorios y multiplicidad.

El contrato congelado usa como estimando primario la media macro de 12 deltas P@10, prueba exacta unilateral de 4.096 sign flips, umbral de relevancia ≥2, análisis de centralidad 3 secundario, subgrupos sólo descriptivos y gate inconcluso ante cualquier abstención primaria no resuelta. La vigilancia de centralidad se formuló prospectivamente para este estudio y no se presenta como hipótesis original del v2.

## Gate de producto futuro

Una eventual promoción sólo podrá considerarse si una preregistración nueva define y satisface criterios suficientes de:

1. mejora de relevancia humana;
2. ausencia de regresiones críticas por intención o idioma;
3. preservación o mejora de centralidad;
4. estabilidad operativa WebGPU;
5. fallback seguro al ranking determinista;
6. costo y latencia aceptables;
7. trazabilidad y posibilidad de desactivación.

Ningún criterio se considera satisfecho por este borrador.

## Prohibiciones

- No usar los 212 labels confirmatorios para tuning.
- No elegir nuevas consultas buscando maximizar el efecto observado.
- No alterar H2/H3 retroactivamente.
- No llamar “externa” a una evaluación sin fuente y juez independientes.
- No desplegar el reranker mientras este gate permanezca en estado research-only.
- No crear una UI de evaluación que exponga información A/B durante el juicio.

## Estado operativo

### Hito de incorporación externa

Un profesor externo manifestó disponibilidad para colaborar. Para proteger su privacidad y el cegamiento, el repositorio canónico no almacena nombre, correo ni institución y utiliza provisionalmente el identificador `external-adjudicator-01`.

El paquete canónico fue congelado en el commit experimental `27f6e4d`:

- planificación no ejecutable: SHA-256 `b0d4de9b43b1604de2b144030f47f3275f79f91fe117e4f5bffdd175bd79fd36`;
- intake anónimo: SHA-256 `d15748c9223ace0a14222de254979a86978652594668bd4c2dd019ccf0b2d475`;
- instrucciones ciegas de adjudicación: SHA-256 `b2b190556fd0e1facfb2957f0c5c59bd1844d31552d5ebacb517ed73b8d32e85`;
- controles dedicados: `4/4`; suite completa: `297/297`.

La función **sólo adjudicación** ya fue confirmada. También se confirmó ausencia de participación en selección de consultas, desarrollo del sistema y evaluaciones previas. El adjudicador puede evaluar principalmente español e inglés y relevancia temática/filosófica en francés y portugués. Su capacidad aproximada es de 200–250 pares. La identidad y los datos de contacto permanecen fuera de Git.

El brief que puede compartirse con el profesor sólo explica la tarea de relevancia académica, la escala 0–3, el uso de metadata descriptiva y el manejo de incertidumbre o abstención. No contiene identidad del modelo, condiciones experimentales, rangos, scores, hipótesis ni resultados previos.

El intake completo y el diseño provisional fueron congelados en el commit experimental `1681f0f`:

- intake anónimo completo: SHA-256 `841507c74d0661d4d697d64f25d16681ea96c9eb070ad8856267c018c1c39b9e`;
- diseño provisional: SHA-256 `92273a5740326f0b815bb4e07cc32da9aaaf2f9505a8c7095d49c837ca8be30c`;
- controles dedicados acumulados: `9/9`; suite completa: `302/302`.

El diseño cabe dentro de la capacidad declarada: 12 consultas y una unión observada de 171 pares primarios únicos, más diez repeticiones ciegas para consistencia intraevaluador = 181 filas. El estimando primario congelado es ΔP@10 pareado macro por consulta con umbral de relevancia ≥2; la prueba exacta recorre las `2^12 = 4096` permutaciones pareadas de signos.

Estado canónico actual: `normalized-judgments-frozen-post-judgment-analyzer-pending`, `inference_authorized=false-complete`, `unblinding_authorized=false-analyzer-not-frozen`. El marco fuente, la clasificación determinista, las 12 asignaciones, el paquete de traducción, las traducciones humanas verificadas, el query set final, la preregistración, el runner productivo, el pool Top-20, el dataset limpio, el runner browser-q8, los 240 raw scores, A/B interno, la auditoría ciega, el retorno externo y los juicios normalizados ya fueron congelados. No se ha reconstruido el mapa privado ni ejecutado unblinding.

### Hito del marco fuente público

El repositorio canónico congeló un contrato y builder que sólo pueden conservar campos públicos y sanitizados de Philosophy Stack Exchange: ID de pregunta, título, tags, score, número de respuestas, fecha de creación, URL estable y licencia oficial. Se excluyen autor/owner, cuerpo, respuestas, comentarios y respuestas API crudas. Esta fase no clasifica intenciones, no selecciona las 12 consultas y no ejecuta retrieval ni inferencia.

El builder inicial se congeló en `f454f81`. Tres ejecuciones sucesivas abortaron sin outputs por omisiones de `content_license`; las correcciones `5a0db8f`, `9544a00` y `c00b135` mantuvieron el mismo universo y añadieron hidratación oficial acotada y exclusión explícita cuando la licencia sigue ausente. Después se detectó que la API rechaza páginas mayores que 25 sin token. La corrección `b3271f036dc4074bda851a096afa3c46c42f21b8` divide exhaustivamente el mismo universo en ocho ventanas disjuntas de score/fecha, valida pertenencia y duplicados, y conserva el límite oficial sin credenciales ni truncamiento.

- Contrato de marco fuente: SHA-256 `49b202d8205a6a3aaa0cc6bf427dfc3b9c01fc267d72e282e19fd06e1770c900`.
- Builder por ventanas: SHA-256 `ecd2d0cb26f915485e0737c475641cc46d67f632d881657ecb4aaadbec1073be`.
- Controles dedicados: `10/10`; suite completa al congelar: `312/312`.
- Output aceptado: **ninguno**.

La primera ejecución desde ese commit también terminó antes de escribir outputs porque el proveedor respondió HTTP 400 durante una hidratación individual. Una consulta diagnóstica única a `/info` identificó `throttle_violation` y anunció nuevas solicitudes disponibles en 85,668 segundos. El intento y la decisión de esperar quedaron registrados canónicamente en `bdbfad4175bf2e15ab22fe44231f71f0d6903c7c`. No se introdujeron credenciales, mirrors, caches, truncamiento ni otra fuente.

La ruta API quedó retirada prospectivamente sin aceptar ninguno de sus intentos como snapshot. Para evitar una dependencia recurrente del throttle sin usar credenciales, mirrors, caches o truncamiento, se congeló una ruta separada mediante Stack Exchange Data Explorer. La consulta exacta conserva los predicados sustantivos —pregunta, creación anterior al corte, score ≥3, al menos una respuesta, no cerrada y licencia oficial no vacía— y sólo selecciona ID, título, tags, score, número de respuestas, fecha y licencia. La compatibilidad SQL final quedó congelada en `4557af8e34a359e21df0e76c5b467c896c876cf4`.

La consulta corregida se ejecutó una sola vez en la superficie oficial de Philosophy SEDE y devolvió 9.846 filas, por debajo del techo de 50.000. El CSV temporal no se versionó; su SHA-256 `14be10aeb3873867df2955420e55e096ae42ec1207fbecf8d9faea0d78f3dace` y sus 1.504.557 bytes quedaron registrados en metadata. El normalizador offline produjo:

- snapshot JSONL SHA-256 `3dc7ce68a91f7fbc5d46550a12d61d438a84c40528ad859ee1e743d2ef222374`;
- metadata SHA-256 `454af13ddc5c8d712f2f6da9817c61424b60ef2b64b05dc3a79c0bd3aea77965`;
- commit canónico de congelación `fea8553`;
- controles dedicados `7/7` y suite completa `319/319`.

La validación independiente confirmó esquema y campos exactos, 9.846 IDs únicos en orden ascendente, elegibilidad, corte temporal, URL estable, licencias permitidas, privacidad, hashes y linaje del runtime comprometido. No se conservaron autor, owner, cuerpo, contenido de respuestas, comentarios ni datos de usuario. El snapshot refleja la observación semanal de SEDE y no se presenta como estado near-live de la API.

El hito del marco fuente quedó cerrado con un snapshot público aceptado. La selección posterior se documenta por separado y no altera ese snapshot.

### Hito del clasificador de intención

El contrato determinista se congeló antes de leer filas en `401102e8a305f384bfa2ee19b03d5fccf7ccf9fe`. Sólo usa título y tags públicos. `work` exige una frase congelada de obra; `philosopher-concept` exige marcador de filósofo más tag conceptual no genérico y excluye obra o dominio externo; `interdisciplinary-challenge` exige marcador de dominio externo más puente filosófico y excluye obra o filósofo. No hay precedencia: únicamente coincidencias exactas de una regla son elegibles; el resto se excluye antes de selección.

La ejecución única, local y sin red clasificó las 9.846 preguntas y quedó congelada en `8b9484c`:

- 3.570 candidatos exactos;
- 1.743 `philosopher-concept`;
- 84 `work`;
- 1.743 `interdisciplinary-challenge`;
- 6.276 no clasificados;
- JSONL SHA-256 `b01f07c121007512294a30e4ac59d2c45d3ade787a5a210dc859019a01f30ce0`;
- metadata SHA-256 `9cc891a999612b3e78b0b757128d462bcf92fe6a3cb477ced7dbfa1bba75b3a6`.

La validación independiente reconstruyó cada decisión desde el contrato y confirmó orden, campos, linaje y explicación de señales. Los conteos se aceptaron sin retocar reglas. No se calculó clave de selección, no se eligió ninguna pregunta y no hubo traducción, retrieval, inferencia o labels humanos.

### Hito de selección y traducción

El contrato de selección fijó cinco fuentes anteriores con hashes exactos, 150 consultas previas, normalización, aliases, stopwords y umbrales inclusivos de colisión antes de leer los 3.570 candidatos. La clave es `sha256(validation_id + NUL + intent + NUL + source_question_id)`; se toman las primeras cuatro claves elegibles por intención y se asignan `es`, `en`, `fr`, `pt` en ese orden.

El primer intento comprometido en `b62c98afa4b1e22a5d88b1d7a511aabb183fe068` terminó antes de leer candidatos y sin outputs porque un locator apuntaba al conteo numérico y no al arreglo de consultas de un preregistro previo. La corrección `b898d6d98127370321b8c2aa87dbb82c7947c0e7` cambió sólo ese locator, añadió una regresión estructural y mantuvo intactas las reglas científicas.

La ejecución válida excluyó 154 candidatos únicos y congeló 12 asignaciones en `b8df0db2ddcd55a875e12d030dc77d2ae14e9165`:

- JSONL seleccionado: SHA-256 `ba03242da8a3e44440b9baf1de5deb3a009af072c3ac122ec640bb55f977b65d`;
- metadata: SHA-256 `75634c79e91569575d244643d1f21fda0b1cd6b9f38d31eb0a3d11ce0d6dfe6d`;
- balance: 4 por intención y 3 por idioma;
- reconstrucción independiente: colisiones, primeras cuatro claves, linaje, asignación lingüística y bloqueo de traducción confirmados.

El builder del paquete de traducción se congeló en `6e2eeda1b3a7daf482aeaf141cad7e7fcf3f6f2b` y el paquete vacío en `ea7f58e13edf0d0c8b0d248cfa5535eaf0cfd07b`:

- JSONL ciego: SHA-256 `fad140a7ef765147f5fc365a82f184391fc90e81c7a34d39f4dfcddf6abe8f30`;
- metadata: SHA-256 `93e7cc23b4cc4ed55b7c6e8e0780c68812dfae72237b347d0b000089ebfdb4ab`;
- contenido: nueve textos fuente, tres por idioma no inglés, IDs opacos y campos humanos vacíos;
- exclusiones: query/source ID, intención, tags, señales, clave de selección, condición, rango, score, retrieval y relevancia.

Máquina y modelos de lenguaje no pueden traducir. Un preparador humano debe completar las nueve traducciones y un verificador humano distinto debe aprobar preservación de significado, intención, entidades y calificadores, además de naturalidad. Ninguno puede ser `external-adjudicator-01`. El original comprometido es inmutable; el retorno humano debe ser un JSONL manual separado.

El retorno completo cumplió ese contrato y quedó congelado canónicamente en `36102cdc2c35fd97dac702fcc7adde581f1fc63b`:

- attachment recibido: SHA-256 `255d8ad28610aabe8d058113cb5584afcfc89dc0b51868ad381e7e68635c23bf`;
- JSONL canónico: SHA-256 `84ebbd50bc552cc388c74ae934a436c1110ae4943e526f8a19880af04669dbb1`;
- metadata: SHA-256 `54bc94313cbf18f6ac83b5c18cf6a1aa3df9ceeb72bb18ad97d98e190819d66f`;
- canonicalización: sólo se añadió newline terminal;
- roles: `translation-preparer-01` y `translation-verifier-01`, distintos y no identificatorios;
- resultado: 9/9 traducciones, 6/6 checks por ítem, todas con estado `verified`.

Los nombres y datos de contacto permanecen fuera de Git. Este hito cierra exclusivamente la traducción; no autoriza retrieval.

### Hito de preregistración ejecutable

El query set final y la preregistración quedaron congelados antes de retrieval en `1956bb7e5b4674298bda47306f9edb39ba67aef6`:

- query set de 12 consultas: SHA-256 `2ead8ff5cf611dfe8836ab625d05b293fd0538e9159e663a7822458cb416a5af`;
- preregistración: SHA-256 `d75981a5f96a625ece08f94437ff7a3e1fbd2830f1ab0e9f2fd0a5dd88f75a22`;
- controles dedicados: `7/7`;
- suite completa: `353/353`;
- outputs de ejecución presentes: ninguno.

El contrato fija la producción base `bb9689da2016ca26a08359e8655eca7a5b771937`, Top-20 por consulta y aborto sin sustitución si falta un resultado. B usa exactamente el mismo pool que A y sólo reordena por raw score browser-q8; WebGPU q8 y `max_length=1024` quedan obligatorios, sin onnxruntime-node, threshold, blending, tuning o labels humanos.

La auditoría adjudica la unión deduplicada completa de ambos Top 10: máximo 240 pares únicos más diez repeticiones ciegas deterministas. Así identifica P@10 absoluto y ΔP@10. El profesor no verá condición, rango, score, IDs internos, proveedor, provenance, identidad de repetido ni resultados previos.

El estimando primario es la media macro de los 12 ΔP@10 por consulta. La prueba unilateral enumera los `2^12 = 4096` sign flips y usa `p = count(T_perm >= T_obs) / 4096`, con α = 0.05. Apoyo requiere Δ positivo, p ≤ 0.05 y cero abstenciones primarias no resueltas. Una abstención única hace el gate inconcluso, sin imputación y con bounds de peor caso. Repetidos sólo miden consistencia intraevaluador.

La potencia está limitada prospectivamente: inferencia formal sólo overall; idioma e intención son descriptivos; falta de apoyo no equivale a equivalencia o no inferioridad. Cualquier resultado mantiene el candidato research-only hasta una decisión de producto separada.

### Hito de retrieval productivo

El runner se congeló antes de consultar fuentes en `2462f9857a6841bb23dc284c7fb84f365969e405`. Fijó hashes de preregistración y query set, producción base `bb9689da2016ca26a08359e8655eca7a5b771937`, Top-20 exacto, 240 filas, aborto sin sustitución y ausencia de Qwen y labels. El `src` comprometido, staged y working debía permanecer idéntico a producción.

La implementación ejecutó el `searchPhilosophy` productivo intacto en Chrome headless efímero mediante CDP. No creó una UI interactiva ni añadió runtime de inferencia. El preflight desde el commit congelado fue output-free y la ejecución única completó las 12 consultas:

- pool JSONL: 240 filas, SHA-256 `65f57ab021dc3d196ed3026e2785db3694cdc4a060a6668804793fb5132f84b2`;
- metadata: SHA-256 `2ae131641505b566ced896841e8d23847a583b940f42c925141d4c836dea43f9`;
- freeze commit: `4c0675a`;
- runtime: Chrome 154.0.8037.58, commit `2462f9857a6841bb23dc284c7fb84f365969e405`;
- controles posteriores: 20 registros únicos por consulta, rangos 1–20, identidad exacta de query/idioma/familia/intención, hashes y linaje correctos, cero campos de score Qwen o relevancia humana.

Una primera invocación fue interrumpida antes de iniciar retrieval y no dejó proceso, parcial ni output. La ejecución válida no se repitió. Después de finalizar y escribir ambos artefactos, macOS devolvió `ENOTEMPTY` al retirar el perfil temporal de Chrome; el pool ya estaba cerrado, la metadata escrita y los parciales eliminados. El perfil efímero se retiró después de salir Chrome y la carrera de limpieza se corrigió en `7f3abd0`, sin alterar o regenerar datos.

### Hito del dataset limpio

El builder determinista se congeló antes de escribir entradas en `41a68b18891da0555cfce60756f76d3261bb9763`. Fijó el pool y su metadata, la preregistración, el query set, el runtime de retrieval, el orden exacto de los 240 pares y un contrato de nueve campos que excluye rango productivo, proveedores, provenance, condiciones, scores y labels.

Después de repetir el preflight output-free desde ese commit, el builder se ejecutó una sola vez. El dataset y la metadata quedaron congelados en `ba6e06162a81e4ffa63ee5dc13166c1632bf4242`:

- dataset JSONL: 240 pares ordenados, SHA-256 `c594c0beb94a1a59b0c2a7497cd49a6c0b5173540557ad05a93aca2cf1aa6ae9`;
- metadata: SHA-256 `e09000e612d7d36c362a9118e2198e7eda506742aabc76f0b1dbc41c3ed48756`;
- cobertura: 12 consultas y 235 documentos distintos, con 240 claves consulta-documento únicas y cero duplicados eliminados;
- validación: reconstrucción independiente exacta, objeto por objeto y en el mismo orden.

### Hito del runner browser-q8

El runner se congeló antes de descargar pesos o puntuar en `9441425226b233631ae6bd4d398442fc1deb0a99`. Fija el modelo `onnx-community/Qwen3-Reranker-0.6B-ONNX`, la revisión exacta ya preregistrada, el artefacto q8, `max_length=1024`, el scorer previamente cerrado, los hashes del dataset y todos los paths de salida.

El bundle auditado tiene SHA-256 `10331143893127b266366568631b4d50ea8867c2be2ee1ab790f2627aee9f39f`: resuelve `transformers.web.js` y `onnxruntime-web`, contiene una entrada ONNX web y cero entradas `onnxruntime-node`, `transformers.node` o backend Node. El scorer rechaza Node, exige `navigator.gpu`, adaptador no fallback, `device=webgpu`, `dtype=q8` y sesiones ONNX que reporten WebGPU/q8.

El preflight output-free desde el commit congelado validó 240 filas, 12 consultas, todos los hashes, bundle web-only, ausencia de checkpoint y outputs, y cero ejecución o descarga. La ejecución oficial resumible comenzó después: antes de aceptar el primer score, el runtime confirmó un adaptador Apple no fallback con arquitectura `metal-3` y sesión ONNX `device=webgpu`, `dtype=q8`.

La ejecución se recuperó de dos interrupciones de infraestructura mediante el checkpoint de prefijo exacto. La primera preservó 106 filas al vencer el timeout de 7.200.000 ms después de una pausa prolongada del host; la segunda reanudó desde la fila 107, volvió a probar WebGPU/q8, preservó 142 filas y terminó cuando Chrome salió prematuramente. La tercera, con el mismo runner congelado, un timeout de infraestructura mayor y prevención de reposo del host, volvió a probar WebGPU/q8, reanudó desde la fila 143 y finalizó 240/240. No se repuntuó ninguna fila completada y el checkpoint se eliminó después del cierre atómico.

Los scores y metadata quedaron congelados en `0003a7f02143faa3d03c11b9e809f50720b6ac34`:

- raw scores JSONL: 240 filas, SHA-256 `85c4081cd8541946d8f21a348b15245e0bbcd5417a58ed8ecb9ec073c4c8c2d1`;
- metadata: SHA-256 `387be19c3c32ffd53246ac7fd1054329dc803c5dd6d6614de12aae171b6e12a7`;
- runtime: Chrome headless efímero, `onnxruntime-web`, WebGPU, q8, adaptador Apple `metal-3` no fallback;
- límites: sin labels humanos, threshold, blending, cambio de pool, UI interactiva, pesos en el repositorio o cambio de producción;
- validación: 240 fingerprints reconstruidos en orden exacto, 8/8 controles dedicados y 378/378 en la suite completa.

### Acciones permitidas ahora

Puede avanzarse sin riesgo en:

- construir y probar un analizador post-juicio que fije todos los hashes y commits congelados;
- implementar exactamente la reconstrucción determinista de primarios y repetidos, P@10 absoluto, ΔP@10, consistencia intraevaluador, tratamiento de abstenciones, bounds de peor caso y prueba exacta de 4.096 signos;
- congelar el analizador antes de darle acceso operativo al mapa A/B;
- ejecutar el analizador una sola vez después de ese congelamiento y registrar por separado resultados formales y descripciones por idioma/intención.

La respuesta del profesor resuelve el rol, la independencia declarada, los idiomas y la capacidad. El marco externo, la selección, traducciones, potencia, preregistración, retrieval Top-20, dataset, runner, scores, A/B y paquete ciego ya están resueltos. El pool, dataset, inferencia, condiciones y muestra congelados no deben rerunearse ni reconstruirse.

### Hito de A/B y auditoría ciega

El builder A/B determinista quedó congelado antes de generar condiciones en `91f00fa5fa6773c11a198d8fba829adb0d458752`. Su preflight predijo 480 filas y SHA-256 `16f14ffae6a15956ab3a5cd45cc0394ea26b943e3262880a44bdb4ca8a1b6000`. La ejecución única reprodujo exactamente ese hash y los outputs quedaron congelados en `0a12f11acb36f8c87e6592902700ccaf43b640d4`; la metadata tiene SHA-256 `fd9e28e9cb3f589b23ca9a7fd8ea26a8729871097b5652295611ceb45ba832b8`. A es el orden productivo congelado; B conserva exactamente los mismos 20 candidatos por consulta y sólo los ordena por raw score descendente, con rango original ascendente para empates exactos. No hubo labels, threshold, blending, tuning ni cambio de pool.

El builder de la auditoría ciega quedó congelado en `5c085e32438525a47ce8fb20fc72bc48f6422f04`. El preflight predijo el paquete final y la ejecución única volvió a producir los hashes exactos. La muestra quedó congelada en `9d969b75b92eb95977e3c34443c2e7ed2ab79709`:

- 171 ítems primarios únicos de la unión completa de ambos Top 10;
- diez repeticiones ciegas deterministas y 181 filas totales;
- JSONL SHA-256 `cf040edea08f643e4dc0ebb6d391d9e29b02284a4d5583f9d853b35cde380a37`;
- metadata SHA-256 `661684403bf69e67465749c4f1d85bb2685883c4acc5c6289cddcdc198f6feef`;
- campos visibles limitados a ID ciego, consulta, bibliografía descriptiva, referencia neutral de consulta y campos vacíos de juicio;
- ausencia de condición, rango, scores, IDs internos, provenance, identidad de repetido y resultados previos;
- validación independiente de esquema, orden, multiplicidades, cegamiento y 397/397 controles.

El JSONL ciego fue el único artefacto enviado al adjudicador. La entrega exacta quedó congelada en `8d73a3bf2df931eb2c1b9c7f5636f69bc820bc0b`: JSONL SHA-256 `a4e7af79e2208497f4efd95afc9418d8f8b99671894070a8ab8dc80be5f8cbb6` y metadata SHA-256 `6b887d54008602bb4cddf845ecef14714d47a0ae0eb391f1ba5d336b02b069dc`. Contiene 180 puntuaciones y una abstención justificada; la identidad primaria o repetida de esa abstención permanece desconocida.

El normalizador ciego se congeló antes de producir outputs en `e750d178b8cedba101e9317f7b8dd515389b8f87`. Leyó sólo la entrega, su metadata y la muestra pública, y reprodujo de forma exacta las 181 adjudicaciones en un contrato mínimo. La ejecución única quedó congelada en `98de5bc25fbc73f0161ab3fb7453e429f70f4ee4`:

- juicios JSONL SHA-256 `5112d36a2a17a5747867ae0cc26cdf915a5edc57836a872320272179cca744a1`;
- metadata SHA-256 `2245e751762076d13ae7b0fcbe1162929a2b9b1e70fd2d36b3a8e15ebd76b87a`;
- 180 filas puntuadas y una abstención; distribución de presentaciones 0: 72, 1: 61, 2: 27 y 3: 20;
- 30 lookups y 30 notas conservados;
- cero acceso a A/B, scores, rangos, IDs internos o identidad de repetidos;
- validación independiente y 402/402 controles.

Estos conteos incluyen diez repeticiones ocultas y no constituyen todavía resultados del experimento. El siguiente límite es técnico: congelar el analizador post-juicio antes de reconstruir el mapa privado. Sólo su ejecución posterior podrá determinar si la abstención afecta un ítem primario, calcular el gate y producir el primer unblinding formal.

## Relacionado

- [[Qwen3-Browser-Q8-Confirmatory-v2]]
- [[Judgment-Protocol]]
- [[Evaluation-Lineage]]
- [[Qwen3-Reranker-Laboratory]]
