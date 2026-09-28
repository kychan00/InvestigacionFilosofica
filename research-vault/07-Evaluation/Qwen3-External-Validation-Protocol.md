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

La capacidad confirmada permite un balance provisional de cuatro idiomas —español, inglés, francés y portugués— y tres intenciones —philosopher-concept, work e interdisciplinary-challenge—. El diseño de borrador asigna una consulta a cada celda idioma × intención, para 12 consultas. Este tamaño está determinado por un techo humano de 250 juicios y debe revisarse explícitamente como limitación de potencia antes de la recuperación; no permite inferencia por subgrupo.

Philosophy Stack Exchange es el marco externo candidato porque contiene preguntas públicas escritas fuera del proyecto y ofrece acceso estructurado mediante [Stack Exchange Data Explorer](https://data.stackexchange.com/philosophy) y su API. El contrato y el builder de adquisición ya están congelados, pero todavía no existe un snapshot fuente aceptado. Después de congelarlo aún deberán definirse y congelarse la clasificación automática de intención, la selección SHA-256, la traducción y su verificación independiente. No se permite selección manual posterior por conveniencia.

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

Estado canónico actual: `design-draft-not-preregistered`, `execution_authorized=false`. Los intentos de adquisición del marco fuente no produjeron ningún snapshot aceptado. No se inició selección de consultas, recuperación de producción, inferencia, construcción A/B, auditoría ni juicio humano.

### Hito del marco fuente público

El repositorio canónico congeló un contrato y builder que sólo pueden conservar campos públicos y sanitizados de Philosophy Stack Exchange: ID de pregunta, título, tags, score, número de respuestas, fecha de creación, URL estable y licencia oficial. Se excluyen autor/owner, cuerpo, respuestas, comentarios y respuestas API crudas. Esta fase no clasifica intenciones, no selecciona las 12 consultas y no ejecuta retrieval ni inferencia.

El builder inicial se congeló en `f454f81`. Tres ejecuciones sucesivas abortaron sin outputs por omisiones de `content_license`; las correcciones `5a0db8f`, `9544a00` y `c00b135` mantuvieron el mismo universo y añadieron hidratación oficial acotada y exclusión explícita cuando la licencia sigue ausente. Después se detectó que la API rechaza páginas mayores que 25 sin token. La corrección `b3271f036dc4074bda851a096afa3c46c42f21b8` divide exhaustivamente el mismo universo en ocho ventanas disjuntas de score/fecha, valida pertenencia y duplicados, y conserva el límite oficial sin credenciales ni truncamiento.

- Contrato de marco fuente: SHA-256 `49b202d8205a6a3aaa0cc6bf427dfc3b9c01fc267d72e282e19fd06e1770c900`.
- Builder por ventanas: SHA-256 `ecd2d0cb26f915485e0737c475641cc46d67f632d881657ecb4aaadbec1073be`.
- Controles dedicados: `10/10`; suite completa al congelar: `312/312`.
- Output aceptado: **ninguno**.

La primera ejecución desde ese commit también terminó antes de escribir outputs porque el proveedor respondió HTTP 400 durante una hidratación individual. Una consulta diagnóstica única a `/info` identificó `throttle_violation` y anunció nuevas solicitudes disponibles en 85,668 segundos. El intento y la decisión de esperar quedaron registrados canónicamente en `bdbfad4175bf2e15ab22fe44231f71f0d6903c7c`. No se introdujeron credenciales, mirrors, caches, truncamiento ni otra fuente.

Por tanto, el estado operativo sigue siendo anterior a la selección: el builder está congelado, el snapshot y su metadata no existen, y no puede diseñarse la clasificación sobre observaciones descargadas hasta que la cuota oficial se restablezca y el artefacto pase validación independiente.

### Acciones permitidas ahora

Puede avanzarse sin riesgo en:

- verificar el reset del proveedor y ejecutar una vez el builder ya congelado;
- validar y congelar el snapshot público antes de cualquier clasificación o selección;
- preparar instrucciones y acuerdos de adjudicación;
- diseñar el esquema de preregistración;
- estimar esfuerzo, costo y tamaño de muestra.

La respuesta del profesor resuelve el rol, la independencia declarada, los idiomas y la capacidad. No resuelve el marco externo, las traducciones, la potencia ni la preregistración y no autoriza ejecución.

No debe iniciarse retrieval, inferencia, A/B ni juicio hasta contar con:

- snapshot del marco externo y consultas seleccionadas, ambos congelados;
- reglas de selección, clasificación y traducción congeladas;
- preregistración ejecutable completa y congelada;
- decisión explícita sobre tamaño de muestra e inferencia.

## Relacionado

- [[Qwen3-Browser-Q8-Confirmatory-v2]]
- [[Judgment-Protocol]]
- [[Evaluation-Lineage]]
- [[Qwen3-Reranker-Laboratory]]
