# Author Authority Graph V2 — Fase 2
## Estado
Motor experimental puro; no se conecta al runtime público. Se incorpora al PR #404, conservando la fase 1 y el PR #403 separado. La revisión exacta de la fuente sigue siendo la declarada en el protocolo de fase 1, sin llamadas directas a OpenAlex.
## Línea base observada
GitHub Actions, jobs 140683138607 y 140683137491: 215015 perfiles, 215002 grupos, 8898 grupos con colisión nominal. V1 informa cero false merges/splits según sus invariantes silver, no según verdad humana. La precisión de atribución en seis regresiones de contribución es 0.75 y recall 1; un falso positivo (Chalmers 1627). No extrapolar esta muestra al corpus.
## Motor
resolveAuthorityV2 recibe subjectRef, scope, datasetRevision, candidateRefs y EvidenceAssertion validadas. No accede a red, no conoce nombres de filósofos ni usa número de publicaciones. La evidencia debe ser específica de identidad, contribución o retrato.
- Un ancla explícita verificada confirma salvo contradicción material o competencia confirmada.
- Dos señales bibliográficas fuertes de tipos distintos y procedencia independiente permiten confirmar sin ORCID. Una sola señal corroborada produce probable.
- Coincidencia nominal, afiliación, temática, periodo y popularidad no confirman por sí solos. No se trata ausencia de datos como contradicción.
- Veto explícito verificado rechaza una candidatura si no tiene ancla verificada contradictoria; cuando ambas existen se conserva ambigüedad. Una contradicción material pendiente de resolución impide confirmar. Las diferencias temáticas/institucionales no deben convertirse en vetos por los adaptadores.
- Candidatos probables múltiples o confirmados múltiples quedan ambiguos. Candidatos sin evidencia suficiente permanecen unresolved. Cada evaluación conserva sus evidencias, motivo y número de componentes de procedencia.
- Se agrupan lineageKey y referencias de fuente compartidas transitivamente antes de evaluar convergencia. No se deduce independencia a partir de nombres de proveedores. Esta garantía depende de que los adaptadores produzcan referencias/linajes correctos.
- Fechas de edición posteriores a muerte no son incompatibilidad. El veto temporal requiere evidencia verificada de fecha original imposible, no un simple año de catálogo. La identidad de un retrato tampoco certifica licencia.
## Límites
Este motor evalúa evidencias suministradas; todavía no las extrae de los registros reales ni verifica las declaraciones de procedencia por sí mismo. Los controles son sintéticos, no una prueba de precisión sobre 215015 personas. La integración de adaptadores, evaluación comparativa en sombra, muestra humana de 300 casos, umbrales y persistencia del ledger quedan para fases posteriores. No se cambian los datos originales, los perfiles públicos, SIVA ni las bibliotecas privadas.
