# Juez asistido por IA

La versión v1 del benchmark puede etiquetarse automáticamente como un **silver standard** usando modelos públicos de Hugging Face ejecutados localmente.

## Modelos

El juez usa dos señales independientes:

- `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` para clasificación zero-shot multilingüe de relevancia, disciplina y rol documental.
- `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` como reranker multilingüe independiente para detectar desacuerdos de relevancia.

El script resuelve y registra el SHA concreto de cada modelo al ejecutarse. Así, aunque la configuración use el nombre del repositorio, los metadatos finales conservan la revisión exacta descargada.

## Instalación

Se recomienda crear un entorno virtual separado del entorno del proyecto:

    python3 -m venv .venv-benchmark-ai
    source .venv-benchmark-ai/bin/activate
    python -m pip install --upgrade pip
    pip install -r requirements-benchmark-ai.txt

Los modelos se descargan desde Hugging Face la primera vez y después quedan en la caché local.

## Prueba corta

Antes de procesar los 1000 documentos:

    python3 scripts/benchmark/ai_judge.py --limit 10

Esto genera archivos `*-smoke-10` sin tocar el resultado final.

## Ejecución completa

    npm run benchmark:ai

El resultado se escribe en:

    benchmark/ai-judgments-v1.jsonl
    benchmark/ai-judgments-v1.meta.json

## Etiquetas

### Relevancia

- `0`: irrelevante
- `1`: tangencial
- `2`: relevante
- `3`: altamente relevante

La etiqueta final de relevancia proviene del modelo NLI. El reranker no fuerza la etiqueta: funciona como una señal independiente para detectar posibles desacuerdos.

### Disciplina

- `0`: no filosófico
- `1`: interdisciplinario o adyacente
- `2`: filosófico

### Rol documental

- `PRIMARY`
- `SCHOLARLY`
- `REVIEW`
- `EMPIRICAL_ADJACENT`
- `PARATEXT`
- `NOISE`
- `UNSURE`

Las predicciones de rol con confianza insuficiente se convierten en `UNSURE`.

## Revisión humana

Cada registro incluye `needs_human_review` y `review_reasons`.

Se marcan para revisión, entre otros casos:

- baja confianza NLI;
- ausencia de abstract;
- rol `UNSURE`;
- desacuerdo fuerte entre la etiqueta NLI y el percentil del reranker dentro de la misma consulta.

La intención no es presentar estos juicios como verdad humana. Son un **silver standard asistido por IA** que después puede auditarse con una muestra humana estratificada.
