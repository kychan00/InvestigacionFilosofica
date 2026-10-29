---
type: product-architecture
project: InvestigacionFilosofica
status: deployed
updated: 2026-10-29
---

# Author Works Navigation V1

## Problema

Los nombres de autor aparecían como metadata estática. La búsqueda podía
identificar a una persona y anteponer obras de autoría directa, pero no ofrecía
una transición explícita desde un resultado o un perfil hacia el corpus
exclusivo de esa identidad.

## Decisión de producto

Todo nombre de autor presentado en una tarjeta o perfil es ahora una acción:

```text
clic en autor
→ nueva pestaña con URL compartible
→ identidad exacta del registro cuando existe
→ shard remoto de obras del autor
→ deduplicación por identidad bibliográfica
→ vista exclusiva de autoría directa
```

La vista sustituye la consulta visible y su interpretación, conserva filtros
de año, idioma, fuente y tipo, y elimina la paginación federada. Por tanto no
mezcla comentarios sobre el autor con obras atribuidas directamente a él.

La navegación conserva además en memoria el conjunto de resultados que la
originó. La vista exclusiva presenta `Volver a <consulta>` y restaura consulta,
interpretación, motor y resultados previos sin ejecutar otra petición de red.
Una búsqueda nueva invalida ese estado transitorio para evitar regresar a un
contexto obsoleto.

Desde el 2026-10-29, la navegación normal usa un enlace real con
`target="_blank"`: la pestaña de resultados permanece intacta y la vista de
autor se abre aparte. La URL transporta nombre, ID de OpenAlex y ORCID en
parámetros separados; también puede copiarse o compartirse y reconstruye la
vista al cargarse directamente.

## Resolución de identidad

La prioridad de identificación es:

1. ID OpenAlex de autor presente en el registro del corpus propio;
2. identidad ya resuelta por [[Remote-Author-Identity-V1]];
3. resolución por nombre y selección explícita ante homónimos.

El navegador consulta únicamente los shards necesarios de `author-index-v2`.
No usa la API de OpenAlex, no descarga el corpus completo y no ejecuta un
modelo generativo o reranker.

## Contrato de presentación

- los resultados exclusivos usan `retrievalMode = author-index`;
- cada tarjeta declara `Autoría directa confirmada en el corpus`;
- el estado de búsqueda declara el número y la identidad seleccionada;
- el panel de identidad declara `Mostrando únicamente obras de autoría directa`;
- no aparece `Cargar más resultados` de OpenAlex/Crossref;
- el lote está acotado a las primeras cincuenta obras publicables del shard;
- si el índice no resuelve con precisión un nombre, no se inventa identidad.

## Verificación pública

Sobre `Kant y Hegel`, un clic en `Immanuel Kant` produjo:

- 50 obras de autoría directa;
- una sola fuente: `OpenAlex Philosophy`;
- cero botones de paginación federada;
- interpretación nueva sin residuos de Hegel;
- identidad y biografía de Kant conservadas.

Un clic en `Miguel Giusti` desde la primera tarjeta produjo tres obras de
autoría directa, todas con identidad normalizada y ORCID preservado. Esta
segunda prueba verifica la navegación desde resultados, no sólo desde perfiles
biográficos.

En la release posterior, el recorrido público `Kant y Hegel → Miguel Giusti →
Volver a Kant y Hegel` restauró 38 resultados, los dos perfiles filosóficos y
el texto original de la consulta sin repetir la recuperación federada.

La verificación final abrió `Miguel Giusti` en una segunda pestaña con ID
OpenAlex `5015026668` y ORCID `0000-0002-9837-9981`, mientras la pestaña de
origen conservó la consulta y sus veinte tarjetas visibles.

## Linaje de despliegue

- Implementación: `6329d8ee7fa12850d22226434478f52d1b5ebaa6`.
- PR `#27`; merge `7f184319d6ae481c9dff0db4dca8ba2232c8a790`.
- Corrección de contexto: `e815f0b`; PR `#28`; merge
  `bd9b961237ec04bf8a971572b1b2d36fe4d0db36`.
- Invalidación explícita de caché de assets: `5fbe6c8`; PR `#29`; merge
  `62af9f738de1c56fd137cba1dad3b65df0e6e80c`.
- GitHub Pages definitivo: workflow `40942214479`.
- Suite: 103/103 pruebas JavaScript.
- Navegación de retorno: `292fdaa`; PR `#30`; merge
  `32c3ee8753a17b4190b8fe1f984b4beda0ec1944`.
- GitHub Pages con retorno de contexto: workflow `40965168441`.
- Apertura en pestaña nueva: `b688c63`; PR `#31`; merge
  `7966a9b7e2753e2698523b559ca7d9768bf04312`; workflow `40965813613`.
- Corrección de tipos de identificador y caché: `59e253b`, `f73a979`; PR
  `#32`; merge `f6c143abb4b5113cd98db7d5547b3d5e97f90f83`; workflow
  `40966105688`.

## Límites y separación experimental

- El índice entrega hasta cincuenta obras por autor; no afirma exhaustividad
  bibliográfica absoluta.
- La autoría refleja el snapshot fijado de OpenAlex Philosophy y puede contener
  errores de fuente que requieren corrección upstream, no inferencia local.
- La función es navegación determinista de producto. No cambia
  `src/core/rank.js`, retrieval, scores, reranker ni artefactos congelados de
  `benchmark/qwen3`.

