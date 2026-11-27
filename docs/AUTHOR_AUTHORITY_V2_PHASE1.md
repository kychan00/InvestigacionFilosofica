# Author Authority Graph V2 — Fase 1: protocolo y auditoría
Estado: experimental, sin integración pública. Base congelada: b85cf848389d5457281a90aebb65955c967135ff.
## Fuente primaria y coste
El corpus es CristianPelayo/openalex-philosophy en Hugging Face. Reutilizamos la release author-index-v3 y su manifest/checksum fijados en benchmark/author-authority/v1/config.json (parquet v3.2/philosophy-corpus-v3-2-search.parquet, revisión 5a4a195085de54bf607a6c4397092ffb32716dcc). Mearman/OpenAlex es el origen auxiliar del snapshot ya procesado, no una API. Cero llamadas a api.openalex.org, cero créditos OpenAlex, sin claves ni nuevas dependencias. La evaluación offline no contacta proveedores. No se presupone que el snapshot disponga de afiliaciones, fechas vitales o todos los identificadores.
## Auditoría de la línea base
- author-authority-resolution.js: motor aislado; nombre D, contexto B/C, identificadores A; no gobierna el runtime de fichas. ORCID afirmado se trata como determinista; comprobar procedencia y checksum en V2.
- author-identity-lookup.js: agrupa IDs por ORCID compartido; aún hay riesgo de ORCID contaminado; no confundir mismo nombre con misma persona.
- remote-author-resolution.js: selección por dominancia bibliográfica no prueba identidad.
- author-federated-matching.js: exact-name/name-variant permiten atribuir registros sin desambiguación; distinguir recuperar de atribuir.
- author-deep-discovery.js: mezcla archivos tras búsqueda federada; un registro dudoso puede contaminar estadísticas.
- author-portrait-policy.js: ORCID limita rutas alternativas. Retrato y biografía deben consultar autoridad común sin dependencia mutua.
- benchmark V1 silver: mide invariantes respecto al índice, no verdad humana. El gold inicial tiene seis variantes de una persona. Existe protocolo ciego de 100 pares; no se encontró judgments.jsonl de autoridad en main.
## Contrato V2
Mantener AuthorityPerson, AuthorMention, SourceRecord, Contribution, WorkVersion y DecisionLedger V1. EvidenceAssertion añade scope (identity/contribution/portrait), polarity, kind, sourceRefs, lineageKey, reliability (asserted/corroborated/verified), revision, subjectRef y objectRef. No se cuenta dos veces la misma procedencia; una ausencia de información no contradice. La decisión conserva evidenceRefs, algorithmVersion, datasetRevision, status, reasonCodes. No se inventan identificadores.
Separar resolución de persona, atribución de obra y licencias de retrato. Una persona corroborada no garantiza todas sus obras; un DOI identifica el documento, no a todos sus autores. ORCID válido sintácticamente no significa titular correcto.
### Política objetivo (aún no aplicada)
- confirmed: ancla verificada o convergencia de señales independientes fuertes, sin contradicción material.
- probable: evidencia positiva incompleta; visible en sección independiente, nunca mezclada con estadísticas confirmadas.
- ambiguous/unresolved: conservar candidatos y fuentes, no atribuir por defecto.
- rejected: contradicción corroborada, registrar motivo; no borrar registro fuente.
Fechas de publicación posteriores a muerte pueden ser reediciones/traducciones, no veto. Una publicación anterior al nacimiento requiere distinguir edición, error de fecha y autoría. Tema/idioma/afiliación diferente no son vetos por sí solos. No sumar puntos arbitrarios ni promover popularidad.
## Benchmark
1. Ejecutar V1 sobre release fijada y reportar cobertura, conflictos y silver.
2. Ejecutar regresiones runtime V2 fase 1 (baseline, sin cambiar producción). Separar fixtures sintéticos de reconstrucciones documentadas; ninguno equivale a gold humano independiente. Reportar falsos positivos, falsos negativos, abstenciones y errores por tarea. Casos no concluyentes no se fuerzan a etiquetas binarias.
3. Construir muestra humana de 300 casos: 60 contemporáneos, 50 históricos, 60 latinoamericanos, 60 homónimos, 40 variantes lingüísticas, 30 iniciales. Cuotas objetivo, sin rellenar con datos inventados; estratos primarios excluyentes, etiquetas secundarias permitidas. Reusar los 100 pares V1 para arrancar la revisión sin duplicar casos. Selección determinista con seed, snapshot, IDs, hash; separar desarrollo y evaluación por persona/bloque nominal, nunca por registro suelto. No se ha materializado aún la muestra de 300.
4. Juicio ciego independiente, fuentes y razones; casos no concluyentes explícitos, doble revisión en desacuerdos. No generar etiquetas humanas mediante IA. Medir precision, recall, F1 y cobertura/abstención separadamente para persona y contribución; B-cubed para clustering cuando exista gold agrupado. Medir retratos por disponibilidad elegible y licencia, no por todos los autores.
5. Gate siguiente: cero fusiones incompatibles en regresiones críticas; sin regresión de recall frente a baseline en holdout revisado; publicar métricas e intervalos/muestras. No fijar porcentajes arbitrarios sin baseline humano. El gate de fase 1 valida ejecución y trazabilidad, no exige que el software antiguo ya esté libre de errores.
## Casos de referencia
- David Chalmers: https://consc.net/all-papers/ y https://consc.net/all-books/ ; homónimo histórico https://books.google.com/books?id=g_-IJgRsQ9EC ; homónimo médico https://pubmed.ncbi.nlm.nih.gov/27261794/.
- Walter Benjamin / Benjamin Walter: https://doi.org/10.5194/tc-14-1779-2020.
- Rahel Jaeggi: https://doi.org/10.1177/1468795X231182636.
- Método: Subramanian et al., S2AND (2021), https://arxiv.org/abs/2103.07534.
## Próximas fases
Motor V2 puro y pruebas, evaluación en sombra, adaptadores de contribución, UI de incertidumbre, SIVA con autoridad común. PR #403 permanece separado y sin fusionar. No publicar cambios de perfil hasta evaluar las métricas.
