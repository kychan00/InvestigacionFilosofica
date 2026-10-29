---
type: product-architecture
project: InvestigacionFilosofica
status: deployed
updated: 2026-10-28
---

# Semantic Federation and Author Metadata V1

## Propósito

Completar la ruta pública `Semántica · alfa` con dos capacidades que no estaban
presentes en la respuesta del servicio:

1. mostrar la autoría bibliográfica de los resultados del corpus OpenAlex
   Philosophy cuando el snapshot fijado contiene esa relación;
2. ampliar la recuperación con los motores académicos ya existentes, sin
   convertir sus resultados en falsos vecinos semánticos.

Esta es una integración de producto separada de la evaluación Qwen3. No usa
labels humanos, no modifica `src/core/rank.js` y no cambia ningún artefacto
congelado bajo `benchmark/qwen3`.

## Flujo desplegado

```text
consulta
├─ servicio semántico sobre 451.823 documentos
├─ resolución remota de identidad de autor
└─ recuperación complementaria acotada
   ├─ OpenAlex Philosophy desde el snapshot propio
   ├─ Crossref
   ├─ Internet Archive
   └─ CUCSH Filosofía

resultado semántico
→ enriquecimiento obra→autores desde shards estáticos
→ fusión por identidad bibliográfica/OpenAlex ID
→ núcleo semántico primero
→ fuentes complementarias después, rotuladas como `Fuente`
```

La API pública de OpenAlex permanece desactivada. El reranker también permanece
desactivado. Los documentos complementarios no reciben un `semantic_score`
inventado: la interfaz los distingue mediante
`Fuente académica complementaria · recuperación federada · sin reranker`.

## Autoría inversa

[[Remote-Author-Identity-V1]] publicó originalmente aliases y la relación
autor→obras. Para enriquecer una obra semántica era necesaria la dirección
inversa. `author-index-v2` añade 1.024 shards `work-authors/` con:

- ID OpenAlex de la obra;
- ID y nombre de cada autor;
- ORCID cuando existe en el snapshot;
- posición de autoría;
- indicador de autor de correspondencia.

El builder conserva exactamente las mismas revisiones fijadas:

- `Mearman/OpenAlex` @ `ef02effac13bfbd0991612f444cebcef8a882453`;
- `CristianPelayo/openalex-philosophy` @
  `5a4a195085de54bf607a6c4397092ffb32716dcc`;
- `v3.2/philosophy-corpus-v3-2-search.parquet`.

Conteos publicados:

- 451.823 obras en el corpus;
- 362.036 obras con authorship en el snapshot;
- 362.019 obras con autoría resuelta y publicable;
- 443.768 relaciones autor–obra resueltas;
- 1.024 shards de aliases, 1.024 de autor→obras y 1.024 de obra→autores.

La cobertura visible de autoría es 80,127838% del corpus. Cuando no existe una
relación publicable, la interfaz conserva `Autor no disponible`; no infiere ni
inventa un nombre.

## Artefactos y verificación

- Release inmutable: `author-index-v2`.
- Builder: workflow `40799110136`.
- Tar SHA-256:
  `7575c2da2972a4bf1cc6b142a87d0a1eb5cb5bf7976d61b8ca572061612ea9c9`.
- Manifest SHA-256:
  `f2f271bd8739e32df9dfae70b71089971a5ead7482c03497a444e58ca53ed7de`.
- Validación independiente: 3.072 de 3.072 archivos internos reprodujeron
  tamaño y SHA-256 del manifest.
- PR funcional: `#23`.
- Merge funcional: `63bb1515aad1f76c217cad171d772260fb6105bb`.
- PR de corrección del empaquetado Pages: `#24`.
- Merge de infraestructura: `9c391645aade2fa6a47dae4e35d9f97de5a272c3`.
- Deploy público validado: workflow `40800835187`.
- Suite: 98/98 pruebas JavaScript y 7/7 pruebas Python del builder.

El smoke público con `ontología y lógica en Quine` devolvió 24 resultados
híbridos. Los resultados del núcleo mostraron autores como Alfonso García
Marqués, Gary Kemp, Dagfinn Føllesdal y Joseph S. Ullian. Crossref y CUCSH
aparecieron después como fuentes complementarias y la interfaz declaró
explícitamente que no se aplicó reranker.

## Corrección de resiliencia del enriquecimiento

Una verificación posterior detectó que la primera implementación trataba la
carga de todos los shards requeridos como una operación indivisible. Un único
`503` o timeout transitorio de GitHub Pages hacía fallar el `Promise.all`
completo y dejaba todos los resultados de esa consulta con
`Autor no disponible`, incluso cuando los demás shards sí contenían autoría.

La corrección desplegada:

- limita la concurrencia a cuatro shards;
- reintenta cada shard hasta tres veces;
- evita reutilizar una respuesta `503` cacheada en los reintentos;
- conserva los autores recuperados aunque otro shard agote sus intentos;
- mantiene la cancelación explícita de la búsqueda.

La reproducción `estética trascendental Kant` pasó de 0/10 autores visibles a
7/10. Las tres obras restantes no tienen relación obra→autor en el snapshot
fijado y continúan mostrando correctamente `Autor no disponible`. La
verificación pública con la consulta en forma de pregunta mostró, entre otros,
a Juan Diego Moya, Plínio Junqueira Smith, François-Xavier Chenet, Flávio
Williges y John J. Callanan.

- PR de resiliencia: `#25`.
- Merge: `6cad155e93850bb7bca20d7f6d3c23196ae08530`.
- Deploy público: workflow `40803212204`.
- Suite: 99/99 pruebas JavaScript.

Esta corrección no amplía cobertura, no inventa autores y no modifica
retrieval, scores, orden semántico, reranker, `src/core/rank.js` ni artefactos
Qwen congelados.

## Límites

- La autoría depende del snapshot fijado: aproximadamente 19,9% del corpus no
  tiene una relación publicable en este índice.
- Esta fase no vuelve semánticos los resultados de Crossref, Internet Archive o
  CUCSH. Los añade como recuperación complementaria acotada y trazable.
- El núcleo semántico conserva su orden. No existe blending de scores ni tuning
  derivado del smoke público.
- La ruta semántica por servicio todavía depende de la disponibilidad del Mac;
  si falla, continúa el fallback tradicional ya documentado.
- El navegador descarga sólo los shards de autoría requeridos. No descarga el
  corpus completo, embeddings ni modelos de varios gigabytes.

## Próxima fase posible

Si se desea un ranking realmente unificado, debe abrirse un gate prospectivo
separado que puntúe únicamente un conjunto acotado de candidatos externos,
conserve sus scores originales y compare el efecto antes de cualquier promoción.
Este V1 no autoriza ni simula esa fase.
