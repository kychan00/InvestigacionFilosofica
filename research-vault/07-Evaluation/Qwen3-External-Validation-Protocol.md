---
type: protocol
status: draft
area: evaluation
candidate: qwen3-browser-q8-1024
updated: 2026-09-28
---

# Qwen3 · Protocolo de validación externa independiente

## Propósito

Definir la siguiente fuente legítima de evidencia para el candidato browser-q8 después del resultado mixto de [[Qwen3-Browser-Q8-Confirmatory-v2]].

Este documento es un protocolo conceptual y de gobernanza, no una preregistración ejecutable ni autorización para iniciar recolección. La preregistración canónica futura deberá vivir en `benchmark/qwen3/` y congelarse antes de recuperar candidatos.

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

Philosophy Stack Exchange es el marco externo porque contiene preguntas públicas escritas fuera del proyecto. La ruta API se preserva como historia de intentos output-free, pero dejó de ser la superficie activa después del bloqueo del proveedor. La adquisición aceptada usa el snapshot semanal oficial de [Stack Exchange Data Explorer](https://data.stackexchange.com/philosophy). El snapshot fuente sanitizado de 9.846 preguntas, el frame determinista de candidatos, las colisiones con queries previas, la exclusión semántica y la selección SHA-256 ya están congelados. No se permite selección manual posterior por conveniencia. Las nueve traducciones no inglesas y su verificación independiente siguen pendientes.

## Juicio humano

Para superar la limitación del symmetric-difference audit, la validación externa debería adjudicar la **unión completa de los Top 10 de A y B**, incluidos los elementos compartidos. Así podrá identificar:

- P@10 absoluto de A;
- P@10 absoluto de B;
- ΔP@10 pareado;
- cambios de centralidad 3;
- acuerdo entre jueces, si participan dos o más.

Se mantiene la escala de [[Judgment-Protocol]]: 0 irrelevante, 1 relacionado insuficiente, 2 relevante, 3 central.

La hoja pública debe usar IDs ciegos y excluir condition, rank, scores, IDs internos, proveedor y procedencia de recuperación. A petición del adjudicador, podrá incluir un DOI normalizado, URL estable u otro identificador bibliográfico neutral, siempre que se derive de forma idéntica e independiente de condición. Toda consulta externa deberá registrarse. Si aun así falta evidencia, se permite abstención motivada; el borrador conservador declara inconcluso el gate confirmatorio ante cualquier abstención única no resuelta y exige límites de peor caso.

## Análisis que debe preregistrarse

La futura preregistración deberá decidir antes de recuperar:

- estimando primario y población principal;
- denominador y tratamiento de queries sin cambios;
- intervalo de incertidumbre o prueba pareada, si se hará inferencia formal;
- análisis overall, por intención, familia e idioma;
- métrica de centralidad 3;
- manejo de desacuerdos y datos faltantes;
- criterio de promoción, no inferioridad o rechazo;
- política para análisis exploratorios y multiplicidad.

El resultado confirmatorio v2 sugiere vigilar especialmente que una mejora binaria no oculte pérdida de documentos centrales, pero esa vigilancia futura debe formularse prospectivamente y no presentarse como hipótesis original del v2.

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

El diseño cabe exactamente dentro de la capacidad máxima: 12 consultas × hasta 20 documentos de la unión Top-10 = 240 pares únicos, más 10 repeticiones ciegas para consistencia intraevaluador = 250 filas. El estimando primario propuesto es ΔP@10 pareado macro por consulta con umbral de relevancia ≥2; la prueba candidata recorre las `2^12 = 4096` permutaciones pareadas de etiquetas. Esta inferencia todavía debe revisarse y no está preregistrada.

Estado canónico actual: `verified-human-translations-frozen-preregistration-pending`, `execution_authorized=false`. El marco fuente, la clasificación determinista, las 12 asignaciones, el paquete ciego y las nueve traducciones humanas verificadas ya fueron congelados. No se inició recuperación de producción, inferencia, construcción A/B, auditoría o juicio humano.

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

### Acciones permitidas ahora

Puede avanzarse sin riesgo en:

- diseñar, probar y revisar la preregistración ejecutable completa;
- resolver prospectivamente potencia, abstenciones, repetidos ciegos y gate decisorio;
- preparar instrucciones y acuerdos de adjudicación;
- diseñar el esquema de preregistración;
- estimar esfuerzo, costo y tamaño de muestra.

La respuesta del profesor resuelve el rol, la independencia declarada, los idiomas y la capacidad. El marco externo, la selección y las traducciones ya están resueltos, pero no la potencia ni la preregistración; por tanto, no autoriza retrieval ni adjudicación.

No debe iniciarse retrieval, inferencia, A/B ni juicio hasta contar con:

- reglas de selección, clasificación y traducción ya congeladas y respetadas;
- preregistración ejecutable completa y congelada;
- decisión explícita sobre tamaño de muestra e inferencia.

## Relacionado

- [[Qwen3-Browser-Q8-Confirmatory-v2]]
- [[Judgment-Protocol]]
- [[Evaluation-Lineage]]
- [[Qwen3-Reranker-Laboratory]]
