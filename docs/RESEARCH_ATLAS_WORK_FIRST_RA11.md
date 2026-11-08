# RA11 — Work-first topology

## Decisión

El Atlas de Investigación ya no depende de Author Authority ni de Related Work para construir su territorio base.

La entidad primaria es la obra.

```text
Work
  ↓
title + abstract
  ↓
TF-IDF cosine
  ↓
Work ↔ Work
```

Author Authority, Related Work y Qwen3 quedan como enriquecimientos opcionales.

---

## 1. Qué cambió

RA10 trataba Authority y Related Work como capas que todavía no podían activarse en producción porque sus gates fuertes no estaban cerrados.

RA11 aclara una distinción más importante:

> que una capa de enriquecimiento esté bloqueada no significa que el Atlas base esté bloqueado.

El mapa puede construirse sin resolver identidades personales.

---

## 2. Topología primaria

La geometría principal se construye con WorkNode.

Método:

`title-abstract-tfidf-cosine-v1`

Edge type conservado por compatibilidad:

`lexical-neighbor`

Label de producto:

`Similitud título + abstract`

---

## 3. Abstract

El assembler conserva ahora:

`WorkNode.abstract`

cuando el SearchResult lo contiene.

Esto ocurre especialmente en resultados semánticos y fuentes que ya entregan abstract.

OpenAlex Philosophy tradicional usa un parquet ligero y actualmente puede entregar:

`abstract = null`

En ese caso RA11 no busca un abstract adicional.

Aplica:

`title-only`

de forma explícita.

---

## 4. Pesos

Default:

- título: 2;
- abstract: 1.

La intención es impedir que un abstract largo borre la señal del título.

---

## 5. Representación

Para cada conjunto query-scoped:

1. normalizar texto;
2. eliminar stopwords básicas;
3. conservar Unicode;
4. calcular document frequency;
5. aplicar TF-IDF;
6. normalizar L2;
7. calcular cosine por pares;
8. conservar topK 3 por obra;
9. máximo 36 aristas.

No existe aprendizaje online.

No se descarga un modelo.

---

## 6. Qwen3

Qwen3 no desaparece.

Si una pareja tiene evidencia real:

`semantic-neighbor`

ésta tiene prioridad sobre la similitud documental.

RA11 no duplica una pareja con:

`lexical-neighbor`

cuando ya existe:

`semantic-neighbor`

La geometría conserva:

```text
Qwen3 semantic-neighbor
        >
title + abstract similarity
        >
Related Work estructural
```

---

## 7. Autores

Los autores dejan de ser un gate de topología.

Sin Author Authority:

`nombre reportado → AuthorMention`

Con autoridad futura:

`AuthorityPerson`

Pero ninguna de las dos capas mueve el territorio Work↔Work.

---

## 8. Auditoría humana

La auditoría humana de 100 pares sigue siendo útil si se desea publicar afirmaciones de identidad personal.

No es necesaria para afirmar:

> estas dos obras son textualmente próximas dentro de esta consulta.

Por tanto:

`humanAuditRequired = false`

para el Atlas base.

---

## 9. Related Work

El full Related Work Index sigue siendo valioso para expansión L1 y relaciones tipadas.

Pero ya no es requisito de lanzamiento.

`relatedWorkRequired = false`

para topología base.

---

## 10. Límites epistemológicos

La similitud título + abstract puede justificar:

- proximidad textual;
- vocabulario compartido;
- vecindad dentro del territorio de la consulta.

No puede justificar por sí sola:

- influencia;
- respuesta;
- cita;
- escuela;
- controversia;
- misma persona autora.

---

## 11. SearchResponse único

RA11 no cambia RA9.

```text
SearchResponse
   ├── Resultados
   └── Atlas
```

No hay segunda búsqueda.

No hay descarga de abstracts para el Atlas.

No hay llamada adicional a OpenAlex.

---

## 12. Cobertura visible

El Atlas principal muestra cuántas obras del snapshot tienen abstract.

Ejemplo:

`20 obras · 14 con abstract · autores como capa secundaria`

Esto hace visible cuándo una relación pudo usar título + abstract y cuándo tuvo que degradar a título.

---

## 13. Compatibilidad

Se conserva el edge type:

`lexical-neighbor`

para no romper:

- layout RA5;
- view model;
- filtros de capa;
- product gate;
- fixtures históricos.

Lo que cambia es el método y la evidencia.

---

## 14. RA10 después de RA11

RA10 sigue vigente como gate de enriquecimientos.

Pero queda reinterpretado:

- Author Authority readiness → gate para afirmar identidad;
- Related Work readiness → gate para expansión tipada;
- ninguno bloquea el Atlas base.

---

## 15. Gate RA11

RA11 se considera completo cuando:

1. WorkNode conserva abstract;
2. títulos distintos pueden conectarse por abstracts próximos;
3. ausencia de abstract cae a título;
4. Qwen3 explícito tiene prioridad;
5. orden de nodos no cambia las aristas;
6. Authority no es requerido por runtime;
7. Related Work no es requerido por runtime;
8. UI dice «Título + abstract»;
9. product gate permanece verde;
10. suite completa permanece verde.

---

## 16. Resultado

El Atlas deja de preguntar primero:

> ¿quién es exactamente esta persona?

y pregunta primero:

> ¿qué obras están cerca entre sí y por qué?

Esa es la topología adecuada para Investigación Filosófica.
