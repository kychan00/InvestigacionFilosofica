---
type: product-architecture
project: InvestigacionFilosofica
status: deployed
updated: 2026-10-29
---

# Universal Author Pages V1

## Decisión

Las páginas de autor no se construyen ni se mantienen una por una. Existe una
sola plantilla pública `view=author` que se genera bajo demanda a partir de la
identidad solicitada y las fuentes disponibles.

```text
nombre, ID u ORCID
→ resolver identidad
→ recuperar autoría directa
→ deduplicar evidencia bibliográfica
→ resumir cronología y metadata
→ renderizar la plantilla universal
```

Los nombres concretos usados durante el desarrollo son casos de prueba, no una
lista permitida ni reglas especiales.

## Cascada de resolución

1. Si la navegación conserva un ID del snapshot OpenAlex Philosophy, ese ID
   tiene prioridad y carga sólo su shard remoto de obras.
2. Sin ID, el nombre se normaliza de forma independiente de acentos, orden y
   puntuación; el índice de aliases intenta resolver la identidad.
3. Wikidata puede aportar aliases, descripción y Wikipedia cuando la identidad
   humana coincide con el mismo autor; ORCID se conserva como evidencia exacta.
4. Si existen homónimos sin evidencia suficiente, la interfaz exige selección y
   no elige una persona en silencio.
5. Si el snapshot no contiene al autor, Crossref e Internet Archive se consultan
   en paralelo mediante sus APIs públicas ya integradas.
6. La salida federada acepta únicamente coincidencia exacta de la firma completa
   del nombre o del ORCID. Coincidencias parciales de apellido se descartan.
7. Las obras se deduplican por DOI, ISBN o una huella bibliográfica normalizada
   de título, año y autores antes de alimentar la misma plantilla.

## Contrato de cobertura

«Universal» significa que el mecanismo es general para cualquier autor
resoluble por el snapshot o los catálogos federados; no significa que exista un
HTML preconstruido para cada persona ni que las fuentes mundiales sean
exhaustivas. Una persona ausente de todas las fuentes, una API temporalmente
caída o un homónimo sin evidencia suficiente puede producir ausencia o pedir
desambiguación.

La vista distingue explícitamente:

- `corpus propio`: identidad y autoría directa procedentes del snapshot fijado;
- `catálogo federado`: coincidencias exactas obtenidas en Crossref y/o Internet
  Archive, con aviso de no exhaustividad.

## Coste y privacidad operativa

- No usa la API de OpenAlex.
- No descarga modelos ni el corpus completo en el navegador.
- El corpus propio carga únicamente shards pequeños asociados al autor.
- Las fuentes federadas se consultan sólo cuando el índice propio no resuelve la
  identidad.
- No existe una base local manual de páginas ni mantenimiento por autor.

## Navegación móvil

Los nombres de autor conservan `target=_blank` como enlace nativo en escritorio.
En un contexto móvil, el gesto táctil intenta abrir de forma síncrona un nuevo
contexto y elimina la referencia `opener`. Si un navegador integrado o webview
bloquea pestañas, la navegación continúa en la pestaña actual en vez de perder
el toque. Esta degradación conserva acceso a la página del autor aunque el host
móvil no implemente múltiples pestañas.

## Verificación pública

La suite aprobó inicialmente 113/113 pruebas, incluidas identidades sintéticas arbitrarias
para demostrar que no existe una lista codificada de autores.

La corrección móvil amplió la suite a 117/117 y cubrió detección táctil,
apertura de contexto nuevo, eliminación de `opener`, conservación de clics con
modificadores y fallback a la pestaña actual cuando el webview bloquea popups.

El smoke público comprobó tres caminos no usados como excepciones:

- `Kwame Anthony Appiah`: ocho obras desde el corpus propio;
- `Ingala Emma`: normalización a `Emma Ingala` y siete obras desde Crossref;
- `Zambrano María`: cuatro obras desde Internet Archive.

Las páginas conservaron la misma estructura editorial, procedencia visible y
aviso correcto de cobertura.

## Linaje

- Implementación: `a3a70f2`.
- PR: `#36`.
- Merge: `d0c48a8188965e6965953c113d22f3e742c3f00a`.
- GitHub Pages: workflow `40985963509`.
- Navegación móvil: implementación `d378542`; PR `#37`; merge
  `97629f3dc93f725fb9d740f87242b8e3b92f05a9`; workflow `41011270245`.

## Separación experimental

Este cambio es ingeniería de navegación y presentación. No modifica
`src/core/rank.js`, el retrieval principal, Qwen, el reranker, scores, labels ni
artefactos congelados de `benchmark/qwen3`.
