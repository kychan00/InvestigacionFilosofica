# T2CL — Índice Maestro de Paradero de tesis filosóficas UdeG

## Objetivo

Construir una sola superficie de reconciliación para responder una pregunta más útil que “¿está digitalizada?”:

> **¿Esta tesis existe y dónde puede consultarse?**

T2CL une referencias bibliográficas verificadas sin modificar el corpus efectivo ni la admisión canónica.

## Entradas

1. Catálogo de Tesis CUCSH, inventario vivo de programas filosóficos.
2. Vista Filosofía T2CI, construida desde Effective Corpus V2 + suplementos oficiales + curaduría.
3. En fases posteriores, OPAC/holdings, Control Escolar y registros administrativos.

## Estados de paradero

- `digital`: existe una ubicación digital institucional verificable (handle/RIUdeG).
- `physical-confirmed`: OPAC/holdings confirma biblioteca y ejemplar físico.
- `both`: ubicación digital y física verificadas.
- `cataloged-location-unresolved`: existe una referencia institucional, pero todavía no se conoce la ubicación exacta del ejemplar.
- `administrative-only`: existe evidencia administrativa de grado/titulación sin identidad bibliográfica suficiente.

T2CL V1 **no puede producir** `physical-confirmed` ni `both`. Esos estados quedan bloqueados hasta incorporar evidencia explícita del OPAC/holdings.

## Reconciliación

La fusión automática sólo ocurre cuando coinciden exactamente:

- título normalizado;
- primer autor normalizado;
- año válido;
- programa normalizado.

Título parecido no basta.

Si autor + año + programa coinciden pero el título difiere, se generan `reviewFlags` y ambos registros permanecen separados. El caso Guillermo Castillo Ramírez (`femenidad` / `feminidad`) debe aparecer aquí como candidato de revisión, no como auto-merge.

## Programa

Los programas reales nunca se relabelan.

Una tesis de Maestría en Tecnologías para el Aprendizaje puede aparecer en la vista Filosofía por curaduría temática, pero su programa sigue siendo Maestría en Tecnologías para el Aprendizaje.

## Identidad

La ficha T2CL admite simultáneamente:

- `canonicalWorkId`;
- handle RIUdeG;
- identidad/URL de registro CUCSH;
- posteriormente número de sistema ALEPH/OPAC.

La coexistencia de identificadores es evidencia de reconciliación, no duplicación.

## Reference-only

T2CL conserva sólo metadatos y referencias. No descarga ni persiste PDFs, bitstreams o texto completo.

## Fase siguiente

T2CM deberá consultar OPAC/holdings para el índice T2CL y completar, cuando sea posible:

- biblioteca;
- sede;
- colección;
- signatura;
- número de sistema;
- disponibilidad física.

Sólo entonces una referencia podrá pasar de `cataloged-location-unresolved` a `physical-confirmed` o `both`.
