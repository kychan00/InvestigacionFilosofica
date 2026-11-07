# RA11 — Work-Centric Topology

## Estado

**Fase RA11 — la obra, no la identidad del autor, es la unidad estructural del Atlas.**

RA11 formaliza una simplificación importante:

> El Atlas puede construir un territorio de investigación útil a partir de las obras y de su contenido textual sin esperar una resolución exhaustiva de identidad de autores.

Author Authority deja de ser un gate de lanzamiento.

---

## 1. Regla central

```text
obra
├── título
├── abstract
├── metadata
└── embedding semántico cuando existe
        │
        ▼
   topología obra↔obra
```

Los autores son una capa secundaria.

---

## 2. Qué deja de ser obligatorio

El Atlas central NO requiere:

- auditoría humana de 100 pares de autores;
- publicación del Author Authority Graph;
- full Related Work Index;
- resolución de todos los nombres;
- ORCID para cada autor.

Esos sistemas permanecen disponibles como enriquecimientos futuros.

---

## 3. Qué sí permanece obligatorio

Para construir un WorkNode:

- identidad canónica de obra;
- título;
- procedencia;
- estado de descubrimiento.

El abstract es preferido, pero su ausencia no invalida la obra.

---

## 4. Nueva similitud textual

El antiguo fallback:

`title-token-jaccard-v1`

se reemplaza por:

`title-abstract-tfidf-v1`

Representación:

`weighted-tfidf-title-abstract`

Pesos:

- título = 2;
- abstract = 1.

El título recibe mayor peso para evitar que un abstract largo domine completamente la representación.

---

## 5. TF-IDF

Para el conjunto de obras de la sesión:

1. normalizar texto;
2. tokenizar;
3. eliminar stopwords comunes;
4. acumular frecuencia ponderada por campo;
5. calcular IDF dentro de la sesión;
6. construir vector sparse;
7. normalizar por norma L2;
8. calcular coseno obra↔obra.

La relación sigue usando el edge type histórico:

`lexical-neighbor`

para no romper contratos RA1–RA10.

Pero la UI ahora la nombra:

**Similitud textual · título + abstract**

---

## 6. Transparencia cuando falta abstract

Cada evidencia contiene:

- `leftTextCoverage.hasAbstract`;
- `rightTextCoverage.hasAbstract`;
- longitud de abstract;
- `abstractBacked`.

Por tanto una arista puede declarar claramente:

- título + abstract;
- sólo título.

El Atlas no finge cobertura textual que no existe.

---

## 7. Prioridad semántica

Cuando una pareja ya tiene:

`semantic-neighbor`

con:

- modelo;
- revisión;
- métrica;
- score;

el fallback textual no se agrega para esa pareja.

Prioridad:

```text
Qwen3 semantic-neighbor
          >
title+abstract textual-neighbor
```

---

## 8. Qwen3

El modelo preferido sigue siendo:

`Qwen/Qwen3-Embedding-0.6B`

y la métrica:

`cosine`.

RA11 no descarga el modelo silenciosamente.

Los embeddings Qwen3 ya publicados en Browser Static V4 podrán alimentar una fase posterior de pairwise similarity sin convertir Author Authority en dependencia.

---

## 9. Corpus V3.3

El corpus semántico fijado contiene:

- 451,823 documentos elegibles;
- 290,375 con abstract;
- cobertura de abstract = 64.267%.

Por tanto title+abstract puede operar con cobertura sustancial, aunque no total.

La ausencia de abstract permanece visible.

---

## 10. Autores

Un nombre reportado por una fuente puede mostrarse como:

**Autor reportado por la fuente**

sin resolver su identidad global.

Esto NO autoriza:

- fusionar dos personas por nombre;
- crear same-author por igualdad nominal;
- crear coauthor identity por coincidencia de strings.

Author Authority sólo se necesita para esas afirmaciones fuertes.

---

## 11. Vocabulario

Antes:

- mención no resuelta;
- mención provisional.

RA11 distingue la función de presentación de la función de identidad.

Ahora:

- autor reportado por fuente;
- identidad ambigua cuando corresponde.

La falta de resolución ya no se presenta como un defecto del Atlas.

---

## 12. Policy gate

Archivo:

`benchmark/research-atlas/v11/work-centric-policy.json`

Módulo:

`src/core/research-atlas-work-centric-policy.js`

El gate exige:

- `entity = work`;
- Authority no bloqueante;
- Related Work no bloqueante;
- título obligatorio;
- abstract preferido;
- TF-IDF title+abstract como fallback;
- Qwen3/coseno como prioridad semántica;
- prohibición de fusionar personas sólo por nombre.

---

## 13. Estado de RA10

RA10 no se elimina.

Su función cambia de interpretación:

> RA10 gobierna enriquecimientos opcionales de identidad y Related Work, no el permiso para lanzar el Atlas central.

Los workflows de auditoría humana siguen siendo útiles si se quiere activar:

- AuthorityPerson global;
- same-author confirmado;
- coauthor identity;
- shared-coauthor.

---

## 14. Main Atlas

RA9 continúa usando un único SearchResponse.

RA11 no añade llamadas de red.

La topología textual se calcula sobre los WorkNodes ya presentes.

---

## 15. OpenAlex Philosophy

Sin cambios de procedencia:

`CristianPelayo/openalex-philosophy`

en Hugging Face.

La API client-side de OpenAlex continúa deshabilitada.

---

## 16. Límite actual

La búsqueda federada ligera de OpenAlex Philosophy V3.2 todavía no transporta abstracts.

Por ello:

- modo semántico y fuentes con abstract pueden usar título + abstract;
- obras sin abstract usan sólo título;
- diagnostics registra esa diferencia.

Una siguiente fase puede publicar un lookup ligero hacia los vectores Static V4 o un search artifact V3.3 sin cambiar este contrato.

---

## 17. Próxima fase

**RA12 — Qwen3 Work Vector Lookup.**

Objetivo:

> mapear OpenAlex Work ID → vector_id + cluster del Browser Static V4 para recuperar únicamente los vectores de las obras visibles y calcular pairwise cosine en el Atlas.

Esto permitiría:

- semantic-neighbor obra↔obra real;
- cero auditoría humana;
- cero descarga del modelo Qwen3;
- reutilizar los 451,823 embeddings ya publicados;
- mantener title+abstract TF-IDF como fallback.

---

## 18. Gate RA11

RA11 queda cerrado cuando:

1. WorkNode conserva abstract;
2. Related Work expanded node conserva abstract;
3. textual fallback usa TF-IDF title+abstract;
4. evidencia declara cobertura de abstract;
5. semantic-neighbor sigue teniendo prioridad;
6. autores pueden mostrarse sin Authority;
7. nombres no se fusionan por igualdad;
8. policy report marca coreAtlasReady;
9. RA8 product gate sigue verde;
10. `npm test` sigue verde.
