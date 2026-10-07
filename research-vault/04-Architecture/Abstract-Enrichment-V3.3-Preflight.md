---
type: architecture-gate
area: retrieval
status: completed
updated: 2026-10-06
---

# Preflight de enriquecimiento de abstracts V3.3

## Propósito

Después del gate [[Abstract-Coverage-V3.2]], este preflight determina si los 244.353 abstracts faltantes pueden recuperarse de manera selectiva y reproducible antes de construir una nueva versión del corpus.

No modifica V3.2, no publica V3.3, no cambia producción y no genera embeddings masivos.

## Target set congelable

El builder releyó el Parquet V3.2 fijado con la misma regla de elegibilidad de semantic retrieval y seleccionó exclusivamente filas cuyo abstract normalizado está vacío.

Resultado:

- 244.353 targets;
- 244.353 OpenAlex IDs únicos;
- orden idéntico al artifact V3.2 fijado;
- secuencia contigua desde cero;
- JSONL SHA-256 `5f8b3e278200bd002418c8b0174ee323fbecbf495a25e7d45f21c6df8b2862ab`.

El JSONL permanece fuera de Git. El código y el reporte técnico canónicos pertenecen al worktree de semantic retrieval.

## Ruta de snapshot inmutable

Se fijó:

`Mearman/OpenAlex@ef02effac13bfbd0991612f444cebcef8a882453`

El subset `data/works/abstracts/` contiene 2.127 Parquet y 177.328.395.882 bytes. Su esquema real es:

- `work_id: int64`;
- `word: string`;
- `positions: list<int64>`.

La clave de join es `work_id`; el abstract se reconstruye ordenando palabras por posición.

Una muestra determinista de ocho shards encontró targets en 50 de 59 row groups. Aunque las columnas de ID sólo ocuparon 6,59 MB comprimidos, los grupos relevantes contenían 430,35 MB de 484,01 MB de tokens y posiciones: 88,915%. Sin índices de página, localizar IDs es barato, pero recuperar su texto exige leer casi todo el contenido de los grupos.

La extrapolación operativa es de aproximadamente 157,7 GB transferidos. No es una medición completa ni una estimación estadística de cobertura; sirve para descartar que un JOIN local selectivo sea barato.

## Ruta de API viva

Un único request acotado consultó los primeros cien targets mediante filtro OR de OpenAlex y seleccionó sólo ID, índice invertido y fecha de actualización.

Resultado:

- HTTP 200;
- 100 IDs solicitados;
- 78 IDs devueltos;
- 41 abstracts reconstruibles;
- un crédito utilizado;
- límite no autenticado reportado: 1.000 créditos diarios.

Los cien targets siguen orden de fuente; no son una muestra aleatoria. El 41% observado no debe extrapolarse como tasa global de recuperación.

El barrido completo requiere 2.444 lotes de cien. Es selectivo y práctico con credenciales adecuadas, pero la API es mutable: preservar respuestas, timestamps y hashes no equivale a fijar una revisión del mirror.

## Tensión de provenance

Las dos rutas satisfacen propiedades distintas:

| Ruta | Ventaja | Coste epistemológico u operativo |
| --- | --- | --- |
| Snapshot fijado | Fuente inmutable y reconstruible | Lectura casi completa de ~177 GB |
| API timestamped | Adquisición selectiva | Fuente viva; cambia el contrato de provenance |

No se debe sustituir una por otra en silencio. La elección debe quedar explícita antes de adquirir el conjunto completo.

## Resolución posterior

La ruta API timestamped fue adoptada prospectivamente. La captura completa, el
builder de corpus, la publicación fijada, la auditoría y el smoke real quedaron
completados sin sustituir fuentes durante la ejecución. El resultado se
documenta en [[Abstract-Coverage-V3.3]].

## Gate histórico

`SOURCE_DECISION_REQUIRED`

Hasta decidir la ruta:

- no ejecutar los 2.443 lotes API restantes;
- no publicar V3.3;
- no cambiar `RETRIEVAL_DATASET_REVISION`;
- no construir 451.823 embeddings;
- mantener el PR semántico en draft.

Estas restricciones describen el estado de este preflight antes de la decisión;
ya no son el gate vigente. El gate actual es `PASS`, con el build masivo aún no
iniciado por falta de almacenamiento local seguro.

## Canonicalidad

Esta nota registra la razón metodológica. Los scripts, tests, JSON/JSONL, hashes detallados y reportes reproducibles permanecen canónicos en el worktree de código bajo `semantic_retrieval/`, `scripts/retrieval/`, `tests_py/`, `docs/` y `artifacts/semantic-retrieval/`.
