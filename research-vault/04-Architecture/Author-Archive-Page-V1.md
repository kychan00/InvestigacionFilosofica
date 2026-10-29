---
type: product-architecture
project: InvestigacionFilosofica
status: deployed
updated: 2026-10-29
---

# Author Archive Page V1

## Problema

[[Author-Works-Navigation-V1]] resolvió la transición desde un nombre de autor
hacia sus obras de autoría directa, pero la vista resultante seguía pareciendo
una búsqueda filtrada. No ofrecía una página intelectual propia para reconocer
la identidad, comprender el alcance del corpus visible ni recorrer su
bibliografía como un archivo.

## Decisión de producto

La ruta compartible `view=author` presenta ahora una página dedicada:

```text
identidad exacta del corpus
→ perfil humano contrastado
→ resumen bibliográfico
→ mapa léxico descriptivo
→ cronología
→ idiomas y tipos documentales
→ obras de autoría directa
```

El encabezado separa nombre, breve descripción biográfica y evidencias de
identidad. Wikipedia y Wikidata se usan únicamente cuando la identidad externa
coincide con el ID exacto del autor en el snapshot; ORCID conserva la evidencia
del corpus. Ante fallo o discrepancia externa, la página mantiene la identidad
exacta y las obras sin inventar una biografía.

## Contrato de presentación

- La página muestra el conteo de obras registrado por el índice y cuántas están
  cargadas en la vista.
- El periodo visible se deriva sólo de años bibliográficos presentes.
- Idiomas y tipos documentales se cuentan sobre las obras cargadas.
- La cronología agrupa por década sin inferir periodos intelectuales.
- Los «enfoques visibles» son frecuencias deterministas de palabras en títulos.
  Se rotulan explícitamente como indicadores automáticos, no como labels
  humanos ni interpretación exhaustiva de la obra.
- La bibliografía conserva IDs y enlaces originales y sólo contiene autoría
  directa confirmada por el índice remoto.
- La vista no usa un LLM generativo, no descarga el corpus completo y no
  necesita la API de OpenAlex.

## Corrección de la ruta compartible

El índice JSONL conserva IDs de autor numéricos, mientras que los parámetros de
URL se reconstruyen como texto. La primera publicación comparaba ambos tipos de
forma estricta y una carga directa podía mostrar cero obras. La corrección
normaliza ambos lados para comparar la misma identidad sin alterar los IDs
originales.

La ruta directa también solicita el perfil verificable. Ese perfil sólo se
acepta si su autor resuelto conserva el mismo ID exacto; de lo contrario se
vuelve a la identidad del corpus. Esta regla evita que una página compartida
asigne la biografía de un homónimo.

## Verificación pública

La URL pública de Miguel Giusti reconstruyó desde cero:

- descripción `filósofo peruano`;
- enlaces a Wikipedia, Wikidata y ORCID;
- tres obras en el corpus y tres disponibles;
- periodo visible 2012–2026;
- dos idiomas y un tipo documental;
- cronología 2010s/2020s;
- tres tarjetas de autoría directa con sus enlaces OpenAlex.

La inspección visual confirmó un encabezado editorial propio, métricas
legibles, dos paneles de análisis, taxonomía y bibliografía sin el formulario ni
los filtros de una búsqueda ordinaria.

## Linaje de despliegue

- Página de archivo: `09333a6`; PR `#33`; merge
  `0da9fa8584bcc4fd595c3a4f6362632c141bf558`; workflow `40969819348`.
- Corrección de ruta y enriquecimiento seguro: `8a01f1b`; PR `#34`; merge
  `2f844082143bcfce5cf3100de9ffe2aefa5978f0`; workflow `40971188558`.
- Suite final: 107/107 pruebas JavaScript.

## Límites y separación experimental

- El resumen describe únicamente la porción publicable disponible en
  `author-index-v2`; no afirma exhaustividad bibliográfica universal.
- El mapa léxico no sustituye una biografía intelectual, clasificación temática
  curada o juicio filosófico.
- La función no modifica `src/core/rank.js`, retrieval, scores, reranker,
  contratos Qwen ni artefactos congelados de `benchmark/qwen3`.
- El código ejecutable y la verificación de producción permanecen en el
  repositorio principal; este documento es la capa conceptual e histórica.
