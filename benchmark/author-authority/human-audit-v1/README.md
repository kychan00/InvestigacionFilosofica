# Human Authority Audit V1

Auditoría humana ciega de identidad bibliográfica previa a Author Profile V2.

## Flujo local

1. Obtenga y extraiga la release `author-index-v3`.
2. Construya el paquete:

`npm run benchmark:authority:audit:build -- --input <ruta>/author-index-v2`

3. Inicie el revisor:

`npm run benchmark:authority:audit`

4. Abra:

`http://127.0.0.1:4177/benchmark/author-authority/human-audit-v1/review.html`

5. Juzgue los 100 pares.
6. Finalice la auditoría.
7. Analice:

`npm run benchmark:authority:audit:analyze`

## Etiquetas

- `same-person`
- `different-person`
- `unresolved`

No fuerce una resolución cuando la evidencia no alcance.

## Blinding

El navegador no recibe el estrato, la relación actual del grafo ni candidateRef.

ORCID, obras y coautores se presentan como evidencia bibliográfica; no se presenta ninguna etiqueta derivada de ellos.

## Archivos

Configuración:

`config.json`

Progreso local ignorado:

`.progress.json`

Salida humana final:

`judgments.jsonl`

Los juicios humanos no son generados por CI ni por el Identity Resolution Engine.
