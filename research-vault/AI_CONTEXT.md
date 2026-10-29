---
type: ai-context
updated: 2026-10-29
---

# Contexto para asistentes

## Repositorio

Este vault pertenece a:

`kychan00/InvestigacionFilosofica`

No confundir con:

`kychan00/philosophia`

El segundo repositorio contiene materiales académicos y clases que pueden servir como fuentes metodológicas, pero no es el runtime de Investigación Filosófica.

## Objetivo del proyecto

Construir una infraestructura epistemológica para investigación filosófica.

El sistema debe acompañar el tránsito:

```text
inquietud
→ delimitación
→ problematización
→ pregunta
→ disciplinas
→ método
→ búsqueda
→ corpus
→ lectura
→ tesis y argumentos
→ controversias
→ genealogía
→ estado del arte
→ hipótesis propia
→ crítica
→ reformulación
→ protocolo
→ estructura de escritura
```

## Unidad central

**Problem**, no **Paper**.

Los documentos funcionan como fuentes y evidencia de posiciones, afirmaciones, argumentos y transformaciones.

## Principios

- No sustituir el juicio del investigador.
- No presentar inferencias de IA como hechos textuales.
- Mantener trazabilidad.
- No forzar tesis–antítesis–síntesis.
- Reconstruir problemas, no sólo redes de documentos.
- Modelar interdisciplinariedad explícitamente.
- Conservar versiones de la pregunta del investigador.
- Tratar el estado del arte como reconstrucción de una conversación, no como lista de referencias.

## Lectura inicial recomendada

1. [[01_PROJECT_STATE]]
2. [[02_ROADMAP]]
3. [[Research-Process]]
4. [[Epistemological-Model]]
5. [[Research-Mode]]

## Estado de implementación

El motor bibliográfico existente está funcionando. La nueva fase se encuentra todavía en diseño conceptual. No implementar cambios de runtime que comprometan el modelo antes de formalizar el contrato de `ResearchProject`.

Existe además una línea de ingeniería desacoplada para recuperación semántica sobre el corpus propio: [[Semantic-Retrieval-Service]]. Su código y artefactos canónicos pertenecen al repositorio principal, no al vault. La ruta semántica se expone ya como alfa pública opt-in: no introduce todavía el modelo de `ResearchProject`, no cambia `src/core/rank.js`, conserva la búsqueda federada como predeterminada y vuelve automáticamente a ella cuando el backend local no está disponible.

La interfaz pública comprueba el endpoint ligero `/health` sin ejecutar inferencia y muestra tanto la disponibilidad semántica como el motor seleccionado, activo y finalmente usado. Este estado es informativo: la petición conserva siempre el fallback tradicional porque la disponibilidad puede cambiar después del chequeo.

El primer smoke operacional público reproducible está cerrado como `PASS_WITH_DATA_QUALITY_FINDINGS`: cinco consultas congeladas devolvieron 50 resultados directos del motor semántico, sin fallback y sin reranker. No es una evaluación humana de relevancia. Reveló un título vacío, duplicados o casi duplicados, mojibake, HTML literal y un caso visible de deriva temática. La evidencia ejecutable y sus hashes permanecen en `benchmark/semantic-retrieval/public-smoke-v1/`; véase [[Public-Semantic-Smoke-V1]].

La auditoría prospectiva [[Semantic-Metadata-Hygiene-V1]] separa anomalías de metadata, identidad exacta e identidad probable sin modificar el corpus ni el ranking. Su ejecución única encontró un grupo exacto de dos IDs y un grupo probable de tres IDs, además de cinco hallazgos de metadata. El resultado no autoriza integración productiva: el siguiente gate debe validar por separado cualquier limpieza de presentación o colapso conservador.

La capa experimental [[Semantic-Presentation-Hygiene-V1]] preserva fuente, IDs, ranks y scores mientras produce campos `display` sanitizados y provenance de grupos exactos. Pasó 44 pruebas y una validación held-out de 25 documentos sin solapamiento con el Top 10. El gate corpus-wide posterior validó sus reglas sobre el índice completo.

El gate [[Semantic-Corpus-Identity-Audit-V1]] extendió esa comprobación a los 451.823 registros V3.3: encontró 9.266 grupos exactos, 21.351 miembros y 12.085 repeticiones presentacionales potenciales. La validación independiente reprodujo todos los hashes de contenido, confirmó unicidad global de IDs y no encontró conflictos de autor. El corpus carece de DOI, por lo que la rama DOI permanece sólo sintéticamente probada. El gate autorizó únicamente una integración presentacional separada y default-off; no autorizó cambios de ranking ni de producción.

La integración [[Semantic-Presentation-API-Integration-V1]] conectó esa transformación a la API mediante doble opt-in: capacidad del servidor y consentimiento explícito de la petición. Pasó 53/53 pruebas y un smoke local sobre Top 10 que conservó IDs, orden y scores al colapsar un único par exacto.

El rollout [[Semantic-Presentation-Public-Rollout-V1]] activó después la capacidad en el daemon y en la ruta pública `Semántica · alfa`. El smoke público reprodujo el comportamiento 10→9, conservó provenance y scores, y mantuvo el reranker apagado. El frontend de PR 14 pasó 75/75 pruebas y GitHub Pages desplegó correctamente. La búsqueda federada sigue siendo la predeterminada y el cambio no afecta retrieval ni ranking.

La instalación [[Semantic-Durable-Runtime-V1]] sacó después código, entorno Python e índice del worktree administrado por Codex. Conservó el commit de servicio, el índice de 451.823 documentos, sus hashes y la política pública. Salud local/pública y una consulta de aceptación pasaron sin cambiar primer ID o score. Tras un reinicio completo, ambos LaunchAgents, Tailscale Funnel, la salud pública y una consulta fría se recuperaron sin reparación manual; el gate operacional quedó cerrado. Sigue siendo un servicio del Mac, no hosting cloud.

La ruta [[Browser-Semantic-Static-V4]] eliminó esa dependencia material para un
modo alternativo: Qwen3-Embedding se ejecuta en WebGPU y los 451.823 documentos
se consultan mediante shards estáticos fijados en Hugging Face. Chrome reprodujo
exactamente las cinco clasificaciones congeladas de cincuenta resultados desde
las URL públicas. La integración permanece default-off tras
`?semantic=browser-v4` porque la carga fría del modelo fp16 ronda 1,12 GiB; no
modifica retrieval, ranking, reranker ni la búsqueda federada predeterminada.

El [[Browser-Semantic-Product-Gate-V1]] midió esa URL pública con un perfil
Chrome desechable. Los siete gates pasaron sin POST al servicio del Mac y con
WebGPU Apple `metal-3` no fallback, pero la primera consulta tardó 194,611 s y
transfirió 1.297.598.732 bytes. La repetición en sesión tardó 1,305 s y la
consulta distinta tras recarga 49,956 s. Es evidencia de independencia técnica
en un solo dispositivo, no compatibilidad general; el modo sigue apagado por
defecto. El consentimiento explícito con divulgación del costo fue desplegado
temporalmente como `En este navegador · beta`, pero se retiró de la interfaz
pública el 2026-10-27 por decisión de producto. Los artefactos browser V4 y su
evidencia histórica se conservan; ya no existe una ruta pública seleccionable ni
una activación por parámetro URL desde `js/app.js`.

La producción federada aplica ahora [[Author-Intent-Ranking-V1]]: una
coincidencia fuerte en `authors` precede menciones del nombre en títulos. La
regla es determinista, trazable mediante la señal `A` y conservadora para no
activar prioridad con términos temáticos aislados. Este cambio fue solicitado
como corrección de producto y no deriva de resultados Qwen, labels humanos ni
tuning experimental; no altera los artefactos congelados de `benchmark/qwen3`.

[[Remote-Author-Identity-V1]] amplía esa corrección sin usar la API de OpenAlex:
un índice remoto y shardeado, construido desde los snapshots fijados de
Hugging Face, permite resolver variantes y orden del nombre y anteponer obras
de autoría directa. Wikidata sólo aporta alias e identidad humana; ORCID se
conserva como evidencia del snapshot. El navegador descarga únicamente el
shard necesario y muestra selección explícita ante homónimos. La capa tiene
fallback federado, no descarga modelos o corpus completos y no modifica
`src/core/rank.js` ni los experimentos Qwen congelados.

[[Semantic-Federation-Author-Metadata-V1]] extiende después la ruta pública
`Semántica · alfa`: un índice inverso obra→autores completa los nombres de
autor para 362.019 obras del snapshot, y la consulta incorpora de forma
paralela candidatos acotados de Crossref, Internet Archive, CUCSH y el proveedor
OpenAlex Philosophy basado en el corpus propio. El núcleo semántico conserva su
orden; los candidatos externos se presentan como `Fuente` y no reciben un score
semántico inventado. La API de OpenAlex y el reranker permanecen desactivados.
El enriquecimiento carga shards con concurrencia acotada, reintentos y
conservación parcial: un fallo transitorio ya no borra los autores recuperados
en otros shards. `Autor no disponible` permanece válido cuando la relación no
existe en el snapshot fijado.

[[Multi-Author-Relationship-Search-V1]] corrige la asimetría de consultas como
`Kant y Hegel`: resuelve cada identidad por separado, presenta descripciones y
enlaces de Wikipedia/Wikidata/ORCID cuando existen y ordena primero los
documentos que mencionan a más autores de la consulta. La cobertura se calcula
sólo sobre título, abstract y autoría, con desempate por el orden previo. No usa
la API de OpenAlex, no cambia `src/core/rank.js` y no deriva de labels o
resultados Qwen.

La fase activa vuelve ahora al Modo Investigación. [[ResearchProject-Data-Contract-V1]] y [[Research-Mode-Flow-V1]] fueron aceptados como base del MVP el 2026-10-10: definen entidades, versionado, provenance, autoridad humana, persistencia local y la espiral completa. Autorizan crear fixtures, JSON Schema y pruebas en una rama aislada, pero todavía no cambios directos de producción.
