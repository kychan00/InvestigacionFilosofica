---
type: project-state
updated: 2026-10-29
status: design
---

# Project State

## Producción actual

**Investigación Filosófica** funciona como motor federado de recuperación bibliográfica especializado en filosofía.

Flujo actual:

```text
consulta
→ parser
→ expansión conceptual y multilingüe
→ recuperación federada
→ normalización
→ deduplicación
→ ranking
→ presentación
```

Fuentes activas principales:

- OpenAlex Philosophy
- Crossref
- Internet Archive
- CUCSH Filosofía

La arquitectura actual está documentada en el `ARCHITECTURE.md` del repositorio.

## Recuperación semántica sobre corpus propio

Se abrió una línea de ingeniería separada para construir un backend de recuperación semántica sobre el corpus OpenAlex Philosophy alojado en Hugging Face.

Arquitectura objetivo:

```text
Parquet fijado en Hugging Face
→ Qwen3-Embedding-0.6B offline
→ shards versionados de embeddings
→ FAISS + metadata/FTS
→ candidatos semánticos y lexicales
→ Qwen3-Reranker-0.6B opcional
→ API desacoplada
```

Estado al 2026-10-10:

- implementación modular creada en una rama aislada del repositorio;
- generación inicial e incremental separada de la indexación;
- FAISS, filtros deterministas, caché de consultas, búsqueda lexical/híbrida, reranker y contratos API implementados;
- pipeline completo validado con un backend de embeddings controlado;
- smoke real completado con 20 documentos: Qwen3-Embedding en Apple MPS, índice FAISS de 1024 dimensiones y consulta semántica con el documento esperado en primer lugar;
- reranker real validado sobre diez candidatos y conservación de `semantic_score`/`rerank_score`;
- FAISS aislado en un worker persistente para evitar el crash nativo reproducible al mezclar `faiss-cpu` y PyTorch en el mismo proceso macOS;
- suite pública existente: 68/68 pruebas;
- el primer reranking local de diez candidatos tardó aproximadamente tres minutos, por lo que el rendimiento interactivo continúa abierto;
- la auditoría de abstracts V3.2 encontró 207.470 de 451.823 documentos elegibles con abstract no vacío —45,918%— y confirmó que el builder histórico sólo reconstruía abstracts para targets selectivos;
- la ruta API timestamped se fijó prospectivamente y capturó 244.353 targets en 2.444 lotes, con 230.038 IDs devueltos y 82.905 abstracts reconstruibles;
- el V3.3 quedó publicado en la revisión Hugging Face `1c59478b679f5836ef6e8dce28b2d725d04f8e02`, con esquema, orden y columnas no abstract idénticos a V3.2;
- la cobertura elegible subió de 45,918% a 64,267%: 290.375 de 451.823 documentos tienen abstract;
- la auditoría material V3.3 y el smoke real aprobaron; el documento modal esperado quedó primero con embedding y reranker, y la API respondió HTTP 200;
- el batch 16 agotó el límite MPS de 9,07 GiB antes de escribir un shard; batch 1 completó 20/20 embeddings sin cambiar el contrato científico;
- el gate gratuito de archivo en iCloud aprobó con cien documentos reales: cuatro shards, manifest y estado SQLite pasaron subida, expulsión local, descarga y comparación SHA-256;
- los seis archivos de la prueba conservan 892.051 bytes lógicos y ocupan cero bloques locales tras la expulsión final; el runner reanudable conserva localmente sólo manifest y SQLite;
- el build completo V3.3 terminó con los contratos fijados: 451.823 documentos, 402 shards ordenados y conteos exactos en SQLite y manifest;
- los 402 recibos coinciden con los 402 placeholders canónicos de iCloud; todos quedaron verificados y expulsados a cero bloques locales;
- el estado SQLite archivado tiene SHA-256 `79302121abbd35c54136b2cc8d238a562e8964b5737bdd77a935f2aca3401af1` y el último shard tiene SHA-256 `d5414b7857246dba55cde84899e2c75c98f6177eb9b8032a9dca08c13d6e3256`;
- el índice completo quedó construido y validado: 451.823 vectores, 451.823 filas SQLite/FTS, FAISS SHA-256 `31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68` y metadata SHA-256 `e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0`;
- las cinco consultas internas pasaron un smoke semántico e híbrido sin reranker;
- la comparación acotada con reranker se congeló antes de inferencia y puntuó 60 pares en 153,818 segundos; su auditoría ciega contiene 59 ítems sin condición, rango ni scores;
- los 59 juicios humanos 0–3 se congelaron completos y sin abstenciones antes del unblinding; el analizador también se congeló antes de abrir A/B;
- la ejecución única produjo un resultado mixto: macro `ΔnDCG@10 = −0,001608360268`, `ΔP@10 = +0,02` y `ΔP@5 = 0,0`; la mejora primaria no se observó y no se autoriza promoción a producción;
- el servicio aplica ya esa decisión: reranker desactivado por defecto, peticiones incapaces de elevar esa capacidad y opt-in local explícito; una búsqueda real completa y una petición API confirmaron resultados semánticos con scores de reranker nulos;
- la API semántica está expuesta como alfa pública gratuita en `https://filosofia-semantic.tail829c9b.ts.net`, mediante FastAPI en el Mac del proyecto y Tailscale Funnel como terminación HTTPS;
- el servicio público busca sobre los 451.823 documentos, mantiene el reranker desactivado y no permite que una petición lo habilite; limita cada cliente a diez búsquedas por diez minutos y admite una sola inferencia concurrente;
- dos agentes de sesión reinician automáticamente el daemon de Tailscale y la API después de un fallo o un nuevo inicio de sesión; el servicio depende todavía de que el Mac permanezca encendido, con sesión iniciada y conexión de red;
- el smoke remoto aprobó salud, búsqueda semántica real, rechazo del escalamiento de reranker y CORS para GitHub Pages;
- el frontend de producción quedó integrado mediante el merge `5453c4c1fdd7625c721ce71e8d5c307289e3036a`; el workflow de GitHub Pages `37985827954` aprobó pruebas y despliegue;
- la búsqueda federada continúa seleccionada por defecto; `Semántica · alfa` es una elección explícita, muestra tiempo transcurrido, fuerza `enable_reranker = false` y activa automáticamente el respaldo tradicional ante red, HTTP 429, HTTP 503 o Mac dormido;
- el indicador operacional llegó a producción mediante el merge `68eb2a223e53e87f8bea72239f1f943b6d7b36ed`; consulta `/health` sin inferencia, muestra disponibilidad y conteo del índice, identifica el motor seleccionado/activo/usado y marca el fallback como respaldo automático;
- el workflow de GitHub Pages `37987230177` aprobó pruebas y despliegue del indicador; la verificación pública confirmó el HTML/JavaScript actualizado y `/health` listo con CORS desde GitHub Pages;
- el primer smoke público reproducible ejecutó las cinco consultas internas congeladas, obtuvo HTTP 200 en las cinco y conservó 50 resultados Top 10 sin fallback ni reranker; la latencia cálida fue 0,733–6,184 s, con mediana 1,501 s y media 2,561 s;
- el smoke cerró como `PASS_WITH_DATA_QUALITY_FINDINGS`: registró un título vacío, duplicados o casi duplicados, mojibake, HTML literal y una deriva temática visible; estos hallazgos abren trabajo de higiene de metadata y deduplicación, pero no constituyen etiquetas humanas ni autorizan tuning;
- la auditoría de higiene e identidad se congeló antes de aplicarse en `39c5b21` y sus resultados quedaron congelados en `40fe59f`; confirmó un grupo exacto de dos IDs elegible para futuro colapso conservador, un grupo probable de tres IDs sólo para revisión y cinco hallazgos de metadata, sin alterar scores, orden, IDs ni el hash del smoke;
- la transformación experimental de presentación quedó congelada en `c700290`, su corrección de provenance en `104800c` y la validación held-out en `e8c1b94`; 25 documentos de rangos 11–15, todos ajenos al Top 10, conservaron IDs, ranks y scores sin falsos colapsos, mientras los caminos positivos de sanitización y colapso exacto quedaron cubiertos por 44 pruebas;
- el gate corpus-wide de identidad quedó congelado con runner `3b5e21f` y resultados `d9bb1ca`; recorrió 451.823 registros read-only, encontró 9.266 grupos exactos con 21.351 miembros y 12.085 repeticiones potencialmente colapsables, y la validación independiente confirmó cero conflictos de autor y cero discrepancias de contenido o IDs; el snapshot no contiene DOI y el gate no cambió serving;
- la integración API presentacional quedó congelada tras contrato `2ec41cb`, implementación `30722c1` y smoke local `4b06d71`; exige doble opt-in, pasó 53/53 pruebas y redujo una ventana Top 10 a nueve representantes colapsando sólo el par exacto `openalex-W2211243423`/`openalex-W7069018285`, con IDs, orden, scores y provenance preservados;
- el rollout público presentacional quedó congelado con runner `43268b1` y resultados `1f50348`; el daemon anuncia la capacidad, la petición default-off preservó diez resultados y la petición opt-in devolvió nueve representantes con provenance completa; PR 14 se fusionó en `02f445b`, la suite frontend aprobó 75/75 pruebas y el workflow `38054638384` desplegó GitHub Pages; búsqueda federada y ranking permanecen sin cambios;
- el runtime público durable quedó instalado fuera de `.codex/worktrees`, fijado al código `5f05e7c`, con entorno Python e índice V3.3 bajo rutas permanentes; tras un reinicio completo, ambos LaunchAgents, Tailscale Funnel, salud local/pública y una consulta fría se recuperaron automáticamente, conservando 451.823 documentos, primer ID y score, reranker apagado y cero fallback; el gate operacional V1 está cerrado;
- la recuperación estática browser V4 quedó construida y publicada en la revisión inmutable de Hugging Face `5a4a195085de54bf607a6c4397092ffb32716dcc`: 451.823 documentos, 256 shards int8, 883 páginas de metadata y 1.397 archivos bajo el manifest SHA-256 `0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa`;
- Chrome reprodujo exactamente los 50 IDs congelados para cada una de cinco consultas desde los artefactos públicos; la V4 obtuvo Recall@10 medio `0,96`, mínimo `0,90`, Recall@50 medio `0,948` y paridad media browser/canónica `0,9997217`;
- existe una integración separada y default-off mediante `?semantic=browser-v4`: usa fp16/WebGPU, conserva la búsqueda federada como predeterminada y fallback, no necesita el Mac encendido y advierte que la primera descarga del modelo ronda 1,12 GiB;
- esa integración se fusionó mediante el PR 15 en `1e874d5a4dfbb6daa0c048676c77a19c3286f263`; el workflow `38302130687` aprobó pruebas, build auditado y despliegue de GitHub Pages, y la URL pública entrega el modo únicamente con `?semantic=browser-v4`;
- la suite local aprobó 81/81 pruebas JavaScript y 3/3 pruebas Python; GitHub aceptó la rama sin bypass después de corregir un falso positivo de Push Protection causado por un nombre público de clase de Transformers.js, no por una credencial real;
- el gate de producto browser V1 quedó preregistrado y congelado antes de una única medición pública: Chrome 155 usó WebGPU Apple `metal-3` no fallback, reprodujo exactamente 36 IDs y completó las tres fases sin POST al servicio semántico del Mac;
- la primera consulta fría tardó 194,611 s y transfirió 1.297.598.732 bytes; la repetición en sesión tardó 1,305 s sin red y la consulta nueva tras recarga tardó 49,956 s con 80.163.169 bytes; el perfil temporal alcanzó 1.575.182.336 bytes y fue eliminado;
- el gate técnico pasó y el opt-in informado quedó desplegado como `En este navegador · beta`: advierte descarga, caché y requisito WebGPU, exige aceptación explícita, hace preflight sin descargar el modelo y conserva la búsqueda tradicional como predeterminada; el siguiente límite es una matriz prospectiva en más dispositivos; véase [[Browser-Semantic-Product-Gate-V1]];
- el rollout se fusionó mediante el PR 16 en `97de6057004388a73b428415f7c39b1b39bb2443`; el workflow `38660085085` aprobó 81/81 pruebas y desplegó GitHub Pages, y la verificación pública confirmó `index.html` y `js/app.js` idénticos a `main`;
- la corrección visual del consentimiento se fusionó mediante el PR 17 en `c19f6bba94586ecc854dce3d7dc2b0b370a2d165`; elimina el workspace vacío que se superponía al panel, permite que el hero crezca, presenta descarga/caché/latencia como métricas, distingue selección pendiente y conserva accesibilidad y responsive; el workflow `38663237030` aprobó 81/81 pruebas y la publicación fue verificada sin overflow horizontal;
- la opción pública `En este navegador · beta` fue retirada por decisión de producto mediante el PR 18 y el merge `e4c5646f1db7cd50cbe151acba4114c17c9639a0`; la interfaz conserva únicamente `Tradicional` y `Semántica · alfa`, mientras los artefactos estáticos browser V4 permanecen como evidencia histórica y técnica no expuesta;
- el mismo PR introdujo [[Author-Intent-Ranking-V1]] en la búsqueda federada: coincidencia exacta de nombre completo y coincidencia fuerte de filósofo reconocido se ordenan antes que menciones en títulos; la consulta pública `Alonso Nava Amezcua` colocó tres obras del autor en los tres primeros puestos, con señal `A 3` y score presentado de 95;
- la suite aprobó 84/84 pruebas y el workflow de GitHub Pages `40616167147` terminó correctamente; la verificación pública reprodujo la retirada de la tercera opción y el nuevo orden de autor;
- la capa [[Remote-Author-Identity-V1]] quedó integrada mediante el PR 22 y el merge `1e70854210fea74d411652d22c9442898874e56e`: usa un índice remoto shardeado derivado de snapshots fijados de Hugging Face, Wikidata humano como evidencia de alias y ORCID del snapshot, sin llamadas a la API de OpenAlex ni descarga masiva en el navegador;
- la release inmutable `author-index-v1` contiene 852.230 aliases y 443.604 relaciones publicables de obra para 215.015 autores resueltos; el tar SHA-256 es `07f6076cb042ef3665ca159048e90cff2815c80aec937ce6c93e458c6d3106ba` y el manifest SHA-256 `5b42d423de84e6f93513060b1aeda400b691a0154d3f96eda1293ba2125df1fa`;
- las variantes `Kant`, `Emmanuel Kant` y `Kant Emmanuel` convergen en el autor dominante `Immanuel Kant` y cargan sus obras directas; los homónimos no dominantes exigen selección explícita y toda indisponibilidad remota conserva el fallback federado;
- la integración de identidad pasó 94/94 pruebas JavaScript y no cambió retrieval semántico, `src/core/rank.js` ni los artefactos Qwen congelados;
- la ruta pública `Semántica · alfa` integra ahora [[Semantic-Federation-Author-Metadata-V1]]: conserva primero el núcleo semántico y añade después candidatos acotados de Crossref, Internet Archive, CUCSH y el snapshot propio OpenAlex Philosophy, rotulados como fuente y sin inventar `semantic_score`;
- `author-index-v2` añade 1.024 shards inversos obra→autores, con 362.019 obras publicables —80,127838% del corpus—; su tar tiene SHA-256 `7575c2da2972a4bf1cc6b142a87d0a1eb5cb5bf7976d61b8ca572061612ea9c9` y los 3.072 archivos internos reprodujeron el manifest sin discrepancias;
- los PR 23 y 24 quedaron fusionados en `63bb1515aad1f76c217cad171d772260fb6105bb` y `9c391645aade2fa6a47dae4e35d9f97de5a272c3`; el deploy `40800835187` publicó V2 y un smoke real mostró autores en resultados OpenAlex Philosophy y fuentes complementarias, con API OpenAlex y reranker desactivados;
- esta integración aprobó 98/98 pruebas JavaScript y 7/7 pruebas Python, no cambió `src/core/rank.js`, no hizo tuning y no tocó artefactos congelados de `benchmark/qwen3`;
- el PR 25 corrigió el enriquecimiento obra→autores para que un shard con `503` o timeout no descarte los demás: concurrencia acotada, tres intentos y conservación parcial; el merge `6cad155e93850bb7bca20d7f6d3c23196ae08530`, el deploy `40803212204` y 99/99 pruebas quedaron validados, y un smoke sobre Kant recuperó autor en 7/10 resultados mientras tres ausencias correspondían realmente al snapshot;
- [[Multi-Author-Relationship-Search-V1]] quedó desplegado mediante el PR 26 y el merge `4eaecb0e17035378d35dcdd152f84e0b0e3306c4`: resuelve cada nombre de una consulta multiautor, muestra perfiles con Wikipedia/Wikidata/ORCID y prioriza establemente documentos que cubren más autores; `Kant y Hegel` mostró ambos perfiles y artículos relacionales en los primeros puestos, el workflow `40935062110` aprobó 102/102 pruebas y no se modificaron `src/core/rank.js`, retrieval, reranker ni artefactos Qwen;
- [[Author-Works-Navigation-V1]] quedó desplegado mediante los PR 27–29 y el merge final `62af9f738de1c56fd137cba1dad3b65df0e6e80c`: los nombres de autor en perfiles y resultados abren una vista exclusiva de hasta cincuenta obras de autoría directa; la identidad exacta del snapshot tiene prioridad, los homónimos conservan selección explícita y no aparece paginación federada; el workflow `40942214479` aprobó 103/103 pruebas y el smoke público reprodujo 50 obras para Kant y tres para Miguel Giusti sin contexto residual;
- el PR 30 y el merge `32c3ee8753a17b4190b8fe1f984b4beda0ec1944` añadieron retorno de contexto desde la vista de autor: el workflow `40965168441` aprobó 103/103 pruebas y el recorrido público `Kant y Hegel → Miguel Giusti → volver` restauró 38 resultados y la consulta original sin repetir recuperación;
- los PR 31–32 y el merge final `f6c143abb4b5113cd98db7d5547b3d5e97f90f83` convirtieron los autores en enlaces compartibles que abren una pestaña nueva y separan nombre, ID OpenAlex y ORCID; el workflow `40966105688` aprobó 103/103 pruebas y el smoke público confirmó una segunda pestaña de Miguel Giusti mientras la búsqueda original permaneció intacta;
- [[Author-Archive-Page-V1]] quedó desplegada mediante el PR 33 y el merge `0da9fa8584bcc4fd595c3a4f6362632c141bf558`: la ruta de autor tiene encabezado editorial, biografía/evidencia, métricas del corpus visible, mapa léxico descriptivo, cronología, taxonomía y bibliografía de autoría directa; el workflow `40969819348` terminó correctamente;
- el PR 34 corrigió las rutas compartibles cuyos IDs llegan como texto frente a IDs numéricos en JSONL y preservó el enriquecimiento biográfico sólo cuando Wikidata coincide con el mismo autor exacto; el merge `2f844082143bcfce5cf3100de9ffe2aefa5978f0`, el workflow `40971188558` y 107/107 pruebas quedaron validados; el smoke público de Miguel Giusti reprodujo biografía, tres obras, periodo 2012–2026 y sus enlaces de evidencia;
- la interfaz denomina la señal `similitud`, no probabilidad ni juicio humano de relevancia, y oculta filtros sin respaldo material en el snapshot semántico;
- la suite de producción aprobó 74/74 pruebas y el build auditado conservó cero imports Node en el bundle browser-q8.

La fuente ejecutable canónica es `semantic_retrieval/` y `docs/SEMANTIC_RETRIEVAL.md` en el repositorio. El vault conserva únicamente la interpretación arquitectónica. Véanse [[Semantic-Retrieval-Service]], [[Abstract-Coverage-V3.2]], [[Abstract-Enrichment-V3.3-Preflight]], [[Abstract-Coverage-V3.3]], [[ICloud-Embedding-Archive]], [[Full-Semantic-Index-V3.3]], [[Semantic-Retrieval-Reranker-Bounded-V1]], [[Public-Semantic-API]], [[Public-Semantic-Smoke-V1]], [[Semantic-Metadata-Hygiene-V1]], [[Semantic-Presentation-Hygiene-V1]], [[Semantic-Corpus-Identity-Audit-V1]], [[Semantic-Presentation-API-Integration-V1]], [[Semantic-Presentation-Public-Rollout-V1]], [[Semantic-Durable-Runtime-V1]], [[Browser-Semantic-Static-V4]] y [[Browser-Semantic-Product-Gate-V1]].

## Nueva fase estratégica

Diseñar e implementar **Modo Investigación**.

La nueva fase no reemplaza el buscador existente. Construye sobre él una metodología completa para acompañar una investigación desde la inquietud inicial hasta un estado de la cuestión trazable y una estructura argumentativa propia.

## Decisiones adoptadas

1. La unidad epistemológica principal no será el paper sino el **problema filosófico**.
2. El sistema debe ayudar a formar la pregunta, no exigir que el usuario llegue con una pregunta perfecta.
3. La interdisciplinariedad forma parte de la construcción del objeto de estudio.
4. El estado del arte debe reconstruir posiciones, tensiones, transformaciones, problemas abiertos y evidencia.
5. La dialéctica no se reducirá mecánicamente a tesis–antítesis–síntesis.
6. Las relaciones filosóficas serán explícitas: objeta, responde, matiza, reformula, presupone, integra, transforma, etc.
7. La IA debe conservar trazabilidad hasta la fuente y distinguir:
   - dato bibliográfico;
   - extracción textual;
   - inferencia interpretativa.
8. El sistema debe conservar la genealogía de la pregunta del propio investigador.
9. Obsidian será herramienta de control conceptual y exportación opcional, nunca dependencia del producto público.
10. El investigador conserva la decisión final sobre pregunta, interpretación, hipótesis y escritura.

## En diseño

- Modelo formal de `ResearchProject`.
- Modelo de `Problem`, `Question`, `Concept`, `Claim`, `Argument`, `Evidence`, `Relation`, `Position` y `Controversy`.
- Constructor socrático de preguntas.
- Modelo de investigación interdisciplinaria.
- Corpus primario/secundario y roles documentales.
- Genealogía dialéctica.
- Genealogía conceptual.
- Laboratorio de argumentos.
- Prueba adversarial de hipótesis.
- Metodología ejecutable.
- Estado del arte narrativo y matricial.

## Próximo hito

Construir fixtures mínimo/completo, JSON Schema y pruebas de invariantes para
los contratos ya aceptados [[ResearchProject-Data-Contract-V1]] y
[[Research-Mode-Flow-V1]], en una rama aislada y antes de modificar el runtime.

## Documentos clave

- [[Research-Process]]
- [[Question-Formation]]
- [[Epistemological-Model]]
- [[Research-Mode]]
- [[Research-Mode-Architecture]]

## Research Vault · evaluación Qwen3

Se añadió [[Evaluation-Hub]] como mapa epistemológico de los experimentos Qwen3.

La sección documenta:

- protocolo de juicio humano;
- linaje entre development y validaciones frescas;
- artefactos científicos históricos;
- separación entre AI silver, Qwen scorer/reranker y juicio humano;
- estado del holdout confirmatorio browser-q8 v2.

Los informes originales permanecen preservados como snapshots en `07-Evaluation/Source-Reports/`, mientras que los artefactos canónicos siguen perteneciendo a `benchmark/qwen3/`.

El experimento confirmatorio browser-q8 v2 está cerrado y congelado en su rama experimental. El unblinding se ejecutó una sola vez desde un analizador previamente congelado: H1 recibió apoyo direccional (`ΔP@10` interdisciplinario `+0.060`), mientras H2 (`−0.010`) y H3 (`−0.010`) no lo recibieron. El efecto descriptivo global fue `ΔP@10 = +0.070`, pero la auditoría no identifica P@10 absoluto ni introduce significancia formal. El resultado es mixto, interno y no autoriza un cambio automático de producción. Los artefactos y hashes canónicos permanecen bajo `benchmark/qwen3/` en el worktree experimental.

El gate post-resultado conserva el candidato como **research-only** y fija `production_ranking_action = no-change`. El siguiente estudio admisible es una validación humana externa realmente independiente; su protocolo conceptual está en [[Qwen3-External-Validation-Protocol]]. El profesor externo confirmó un rol exclusivamente adjudicador, ausencia de participación previa, cobertura en español e inglés y capacidad temática en francés y portugués, con un máximo aproximado de 250 pares. El diseño congelado usa 12 consultas y la unión completa de ambos Top 10; el paquete resultante contiene 171 pares primarios únicos y diez repeticiones ciegas.

La ruta API del marco público de Philosophy Stack Exchange quedó preservada como historia de adquisición fallida y fue sustituida prospectivamente por Stack Exchange Data Explorer debido al `throttle_violation` del proveedor. La consulta SQL, el contrato y el normalizador offline se congelaron antes de adquirir datos. La ejecución única de SEDE produjo 9.846 preguntas públicas elegibles y el snapshot sanitizado quedó congelado canónicamente en `fea8553`: JSONL SHA-256 `3dc7ce68a91f7fbc5d46550a12d61d438a84c40528ad859ee1e743d2ef222374` y metadata SHA-256 `454af13ddc5c8d712f2f6da9817c61424b60ef2b64b05dc3a79c0bd3aea77965`. La validación independiente confirmó esquema, orden, unicidad, elegibilidad, corte temporal, licencias, privacidad y linaje.

El clasificador determinista de intención se congeló antes de aplicarse en `401102e` y se ejecutó una sola vez sin red, modelo o labels. El frame aceptado quedó congelado en `8b9484c` con 3.570 candidatos explicables: 1.743 `philosopher-concept`, 84 `work` y 1.743 `interdisciplinary-challenge`; JSONL SHA-256 `b01f07c121007512294a30e4ac59d2c45d3ade787a5a210dc859019a01f30ce0` y metadata SHA-256 `9cc891a999612b3e78b0b757128d462bcf92fe6a3cb477ced7dbfa1bba75b3a6`.

Después se congelaron las colisiones con 150 consultas previas, la exclusión semántica y la selección SHA-256. Un primer intento falló sin outputs por un locator de esquema y se corrigió antes de leer candidatos. El selector corregido `b898d6d98127370321b8c2aa87dbb82c7947c0e7` produjo 12 asignaciones —cuatro por intención y tres por idioma—, congeladas en `b8df0db2ddcd55a875e12d030dc77d2ae14e9165`: JSONL SHA-256 `ba03242da8a3e44440b9baf1de5deb3a009af072c3ac122ec640bb55f977b65d` y metadata SHA-256 `75634c79e91569575d244643d1f21fda0b1cd6b9f38d31eb0a3d11ce0d6dfe6d`. Una reconstrucción independiente confirmó colisiones, orden, linaje y asignación lingüística.

El paquete ciego para las nueve traducciones no inglesas quedó congelado en `ea7f58e13edf0d0c8b0d248cfa5535eaf0cfd07b`: JSONL SHA-256 `fad140a7ef765147f5fc365a82f184391fc90e81c7a34d39f4dfcddf6abe8f30` y metadata SHA-256 `93e7cc23b4cc4ed55b7c6e8e0780c68812dfae72237b347d0b000089ebfdb4ab`.

Dos colaboradores humanos distintos y ajenos a la adjudicación completaron preparación y verificación. Sus identidades reales permanecen fuera de Git; el artefacto sólo conserva `translation-preparer-01` y `translation-verifier-01`. Las nueve traducciones verificadas quedaron congeladas en `36102cdc2c35fd97dac702fcc7adde581f1fc63b`: JSONL SHA-256 `84ebbd50bc552cc388c74ae934a436c1110ae4943e526f8a19880af04669dbb1` y metadata SHA-256 `54bc94313cbf18f6ac83b5c18cf6a1aa3df9ceeb72bb18ad97d98e190819d66f`. Los seis controles son verdaderos en cada ítem y ambos roles atestiguaron independencia y trabajo humano.

La preregistración ejecutable quedó congelada en `1956bb7e5b4674298bda47306f9edb39ba67aef6`: query set SHA-256 `2ead8ff5cf611dfe8836ab625d05b293fd0538e9159e663a7822458cb416a5af` y contrato SHA-256 `d75981a5f96a625ece08f94437ff7a3e1fbd2830f1ab0e9f2fd0a5dd88f75a22`. Fija producción, retrieval Top-20, browser q8/WebGPU, A/B same-pool, auditoría de unión completa, diez repetidos, abstenciones, prueba exacta global de 4.096 signos y gate sin cambio automático de producción. Idioma e intención son descriptivos: 12 consultas no dan potencia para inferencia por subgrupo ni equivalencia.

El runner de retrieval exclusivamente productivo quedó congelado en `2462f9857a6841bb23dc284c7fb84f365969e405`. Ejecuta el `searchPhilosophy` de producción intacto en Chrome headless efímero, sin UI interactiva, Qwen ni labels. Tras un preflight output-free se ejecutó una sola vez y el pool quedó congelado en `4c0675a`: 240 filas, exactamente 20 por consulta; JSONL SHA-256 `65f57ab021dc3d196ed3026e2785db3694cdc4a060a6668804793fb5132f84b2` y metadata SHA-256 `2ae131641505b566ced896841e8d23847a583b940f42c925141d4c836dea43f9`. Una carrera de limpieza posterior al cierre no afectó los artefactos y se corrigió separadamente en `7f3abd0`, sin rerun.

El builder determinista de entradas se congeló en `41a68b18891da0555cfce60756f76d3261bb9763` y se ejecutó una sola vez. El dataset quedó congelado en `ba6e06162a81e4ffa63ee5dc13166c1632bf4242`: 240 pares ordenados, 12 consultas, 235 documentos distintos y cero duplicados eliminados; JSONL SHA-256 `c594c0beb94a1a59b0c2a7497cd49a6c0b5173540557ad05a93aca2cf1aa6ae9` y metadata SHA-256 `e09000e612d7d36c362a9118e2198e7eda506742aabc76f0b1dbc41c3ed48756`. Una reconstrucción independiente confirmó igualdad objeto por objeto y la ausencia de rangos productivos, provenance, condiciones, scores Qwen y labels humanos.

El runner de inferencia browser-q8 se congeló antes de cargar el modelo en `9441425226b233631ae6bd4d398442fc1deb0a99`. Su bundle auditado contiene `transformers.web.js` y `onnxruntime-web`, con cero imports de `onnxruntime-node` o backend Node. La ejecución oficial se recuperó de dos interrupciones de infraestructura mediante el prefijo exacto checkpointed —106 filas tras timeout y 142 tras salida prematura de Chrome—, sin volver a puntuar ninguna fila completada. Cada sesión probó adaptador Apple no fallback, arquitectura `metal-3` y ONNX WebGPU/q8 antes de aceptar scores. Los 240 raw scores quedaron congelados en `0003a7f02143faa3d03c11b9e809f50720b6ac34`: JSONL SHA-256 `85c4081cd8541946d8f21a348b15245e0bbcd5417a58ed8ecb9ec073c4c8c2d1` y metadata SHA-256 `387be19c3c32ffd53246ac7fd1054329dc803c5dd6d6614de12aae171b6e12a7`. La validación independiente reconstruyó los 240 fingerprints y confirmó 378/378 controles totales. Los pesos permanecieron fuera del repositorio.

El builder A/B determinista quedó congelado antes de construir condiciones en `91f00fa5fa6773c11a198d8fba829adb0d458752`. El preflight predijo el SHA-256 exacto y la ejecución única lo reprodujo. Las 480 filas A/B y su metadata quedaron congeladas en `0a12f11acb36f8c87e6592902700ccaf43b640d4`: JSONL SHA-256 `16f14ffae6a15956ab3a5cd45cc0394ea26b943e3262880a44bdb4ca8a1b6000` y metadata SHA-256 `fd9e28e9cb3f589b23ca9a7fd8ea26a8729871097b5652295611ceb45ba832b8`. A conserva el orden productivo; B usa el mismo Top-20 y sólo reordena por raw score congelado, con desempate por rango productivo. Este artefacto es interno y no debe compartirse con el adjudicador.

El builder de auditoría de unión completa quedó congelado en `5c085e32438525a47ce8fb20fc72bc48f6422f04`. Tras repetir el preflight, se ejecutó una sola vez y el paquete ciego quedó congelado en `9d969b75b92eb95977e3c34443c2e7ed2ab79709`: 171 ítems primarios únicos más diez repeticiones ciegas, 181 filas en total. El JSONL tiene SHA-256 `cf040edea08f643e4dc0ebb6d391d9e29b02284a4d5583f9d853b35cde380a37` y la metadata SHA-256 `661684403bf69e67465749c4f1d85bb2685883c4acc5c6289cddcdc198f6feef`. La muestra excluye condición, rango, scores, IDs internos, provenance e identidad de repetido; los campos de juicio estaban vacíos al congelarla. La validación independiente confirmó orden, esquema, cegamiento, multiplicidades y 397/397 controles.

El retorno completo del adjudicador externo quedó preservado byte por byte en `8d73a3bf2df931eb2c1b9c7f5636f69bc820bc0b`: SHA-256 `a4e7af79e2208497f4efd95afc9418d8f8b99671894070a8ab8dc80be5f8cbb6`, con metadata SHA-256 `6b887d54008602bb4cddf845ecef14714d47a0ae0eb391f1ba5d336b02b069dc`. Las 181 filas conservaron orden, IDs y contenido bibliográfico; hubo 180 puntuaciones y una abstención justificada, 30 consultas externas registradas y 30 notas. La validación no leyó A/B ni reconstruyó identidad primaria/repetida.

El normalizador ciego quedó congelado en `e750d178b8cedba101e9317f7b8dd515389b8f87` y se ejecutó una sola vez. Los juicios mínimos quedaron congelados en `98de5bc25fbc73f0161ab3fb7453e429f70f4ee4`: JSONL SHA-256 `5112d36a2a17a5747867ae0cc26cdf915a5edc57836a872320272179cca744a1` y metadata SHA-256 `2245e751762076d13ae7b0fcbe1162929a2b9b1e70fd2d36b3a8e15ebd76b87a`. La distribución por presentaciones es 0: 72, 1: 61, 2: 27, 3: 20 y una abstención. En ese freeze todavía incluía repeticiones ocultas y no constituía un análisis de efecto; el mapa privado se reconstruyó sólo después de congelar también el analizador.

El analizador post-juicio quedó congelado antes del unblinding en `31539e90b96322e698bcbd6480299147fea67562` y se ejecutó una sola vez. El reporte quedó congelado en `8379fd1fdfd0ba5280a380d45cfce4ea1c084707`, SHA-256 `446381edb90fea3bcc0c28153b1163d86bfbae18fe58e58c578202d4369fbbcc`. La abstención corresponde a un ítem primario compartido por A y B: A queda acotado en P@10 `[0.225000, 0.233333]`, B en `[0.333333, 0.341667]`, y el ΔP@10 pareado permanece exactamente `+0.108333` en ambos extremos. Sin embargo, el gate preregistrado exige cero abstenciones primarias: el resultado formal es **inconcluso**, no se ejecutó la prueba exacta de 4.096 signos y no existe p-value. Las diez repeticiones tuvieron acuerdo exacto 10/10.

La decisión separada quedó congelada en `53e083f9f74147169dcde96f18906c52011a7ab6`: `production_ranking_action = no-change`, candidato **research-only** y sin promoción desde este gate inconcluso. La dirección positiva es evidencia descriptiva robusta a la abstención compartida, pero no equivale a apoyo confirmatorio formal. El estudio `external-validation-v1` está científicamente cerrado; cualquier réplica o resolución de missingness requiere una preregistración prospectiva nueva y no puede reescribir este resultado.

Después del cierre científico se abrió una línea de ingeniería separada: [[Qwen3-Browser-Q8-Opt-in-Prototype]]. El prototipo permanece desactivado por defecto y sólo aparece con `?qwen3=1`; no toca retrieval ni `src/core/rank.js`, usa el mismo Top 20, exige q8/WebGPU y conserva el orden normal ante cualquier fallo. Su latencia medida es de varios minutos por veinte documentos, por lo que no constituye todavía una función productiva general. Esta prueba no altera el próximo hito del Modo Investigación ni sustituye la necesidad de formalizar `ResearchProject`.
