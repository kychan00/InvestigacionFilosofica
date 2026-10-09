# Instrucciones para la revisión ciega

El archivo a completar es `blind-audit.jsonl`. Contiene 59 pares
consulta-documento. No contiene información sobre el orden de los sistemas,
rangos ni scores.

## Escala

- `3`: relevancia directa y central; el documento aborda explícitamente la
  pregunta, problema, autor, argumento o relación solicitada.
- `2`: relevancia clara y sustantiva; aporta material útil aunque no responda
  de manera central o completa.
- `1`: relación tangencial, contextual o demasiado general.
- `0`: irrelevante para la consulta.

## Abstención

Use `"abstain": true` sólo cuando título, abstract y metadata sean
insuficientes para juzgar razonablemente. En ese caso deje `relevance` en
`null` y explique brevemente el motivo en `note`.

Si no se abstiene:

- escriba un entero de 0 a 3 en `relevance`;
- escriba `false` en `abstain`;
- `note` puede permanecer en `null` o contener una observación breve.

## Reglas de integridad

- No cambie `item_id`, `query_id`, `query` ni `document`.
- No cambie el orden de las 59 líneas.
- No agregue ni elimine líneas.
- No intente localizar o consultar los artefactos A/B internos.
- Juzgue cada par por su contenido académico, no por prestigio, idioma o
  preferencia personal por una tradición filosófica.
- Devuelva el archivo como JSONL válido, una línea JSON por ítem.

El análisis se hará únicamente después de validar y congelar el retorno
completo.
