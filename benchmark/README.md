# Benchmark humano de Investigación Filosófica

## Objetivo

Este benchmark mide la calidad de recuperación de Investigación Filosófica mediante juicios humanos.

No evalúa el valor filosófico intrínseco de una obra. Evalúa si un documento es pertinente para una consulta concreta y si el motor lo coloca en una posición útil.

## Diseño v1

La primera versión contiene 50 consultas:

- 5 idiomas;
- 10 consultas por idioma;
- 10 familias semánticas equivalentes;
- 2 familias de reto interdisciplinario.

Idiomas:

- español (`es`);
- inglés (`en`);
- alemán (`de`);
- francés (`fr`);
- portugués (`pt`).

## Escala de relevancia

### 0 — Irrelevante

Ruido, coincidencia accidental o documento sin relación sustantiva con la consulta.

### 1 — Adyacente

Relacionado sólo de manera tangencial, instrumental o interdisciplinaria.

### 2 — Relevante

Trata sustantivamente el filósofo, obra, concepto o problema solicitado.

### 3 — Altamente relevante

Está directamente centrado en la consulta. Puede ser una fuente primaria, estudio monográfico o artículo específicamente dedicado al problema.

## Disciplina

- `0`: no filosófico;
- `1`: interdisciplinario o ambiguo;
- `2`: filosófico.

La disciplina y la relevancia se evalúan por separado.

## Rol documental

Valores permitidos:

- `PRIMARY`
- `SCHOLARLY`
- `REVIEW`
- `EMPIRICAL_ADJACENT`
- `PARATEXT`
- `NOISE`
- `UNSURE`

## Formato de judgments.jsonl

Cada línea contiene un objeto JSON con:

    query_id
    record_id
    relevance
    discipline
    role
    notes

Ejemplo:

    {"query_id":"es-01","record_id":"doi:10.xxxx/example","relevance":3,"discipline":2,"role":"SCHOLARLY","notes":"Discute directamente la libertad kantiana."}

## Identificadores

Para `record_id` se prefiere:

1. DOI normalizado;
2. identificador OpenAlex;
3. identificador estable del proveedor;
4. identificador sintético conservado en el run.

## Runs

Los resultados congelados de una versión del buscador se guardan en:

    benchmark/runs/

Cada fila debe incluir al menos:

    query_id
    rank
    record_id
    title
    score

## Métricas previstas

- Precision@5
- Precision@10
- Recall@10
- nDCG@10
- MRR@10
- precisión disciplinaria@10

Para precisión y recall se considera relevante:

    relevance >= 2

nDCG conserva la escala graduada de 0 a 3.

## Limitación de Recall

No conocemos el universo absoluto de toda la literatura filosófica relevante existente.

Por ello, Recall@10 se calcula respecto al conjunto humano juzgado y no debe interpretarse como recall absoluto de toda la literatura académica mundial.

## Política de evaluación

Los primeros 10 resultados de una consulta deben estar completamente juzgados antes de producir métricas definitivas para esa consulta.

Los resultados no juzgados no se convierten automáticamente en irrelevantes.

El benchmark debe mantenerse independiente de cambios concretos del ranking. Si la política de juicio cambia sustantivamente, debe publicarse una nueva versión.
