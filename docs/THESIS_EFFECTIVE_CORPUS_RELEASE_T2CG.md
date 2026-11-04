# T2CG — Effective Corpus V2: release inmutable y migración pública

## Propósito

T2CG convierte el candidato reproducible de T2CF en la segunda release
inmutable del corpus efectivo de tesis y migra deliberadamente los consumidores
públicos a esa release.

La release V1 **no se modifica ni se sobrescribe**. Continúa siendo la base
histórica verificable.

## Lineage

1. `thesis-effective-corpus-v1`
   - 27,576 obras;
   - 561 INCLUDE;
   - 193 REVIEW.
2. T2CC
   - activa únicamente `thesis:work:00024461`.
3. T2CE / PR #169
   - aprueba cuatro referencias de programa filosófico exacto.
4. T2CF / PR #170
   - compone ambos deltas;
   - 27,580 obras;
   - 566 INCLUDE;
   - 192 REVIEW;
   - JSON SHA-256
     `f8792c73471f2a54bb4ec8b38d41f4b366b16caedb4a29286f704e85c8038e13`;
   - gzip SHA-256
     `f3a162b8de5fe371898dcf60afbf2b6383b444d56bd5709a3d4634e813255b01`.
5. T2CG
   - publica `thesis-effective-corpus-v2`;
   - verifica de nuevo la composición;
   - migra `tesis.html` y el Atlas al corpus V2.

## Reconstrucción

El workflow de Pages no depende del artifact efímero de T2CF para futuras
ejecuciones. En cada despliegue:

1. descarga y verifica la release V1;
2. recompone V2 mediante el builder T2CF ya aprobado;
3. exige los hashes exactos de V2;
4. crea la release V2 si aún no existe, o la verifica si ya existe;
5. vuelve a descargar los assets publicados;
6. verifica manifest, checksums, lineage y root release manifest;
7. sólo entonces construye los consumidores públicos.

El artifact T2CF se conserva en el contrato como evidencia histórica:
`13335683726`, digest
`8a5878e8ca504e54ea0d7c0cae9dea88c1454ac2b8f2952be090d150c45ea7ff`.

## Revisiones separadas

V2 distingue dos conceptos que V1 podía representar con una sola revisión:

- `effectiveAdmissionRevision = 2026-11-04.t2cf-v1`: composición efectiva
  completa del snapshot;
- `workAdmissionDecisionRevision = 2026-11-03.t2cc-v2`: última revisión de
  decisiones explícitas work-level.

Esto evita atribuir las cuatro nuevas tesis filosóficas a una decisión DCTS.

## Publicación de tesis

El índice público continúa usando el esquema `thesis-demo-index-v1`, pero su
`sourceRelease` pasa a `thesis-effective-corpus-v2`.

Resultado esperado:

- 566 referencias INCLUDE;
- 27,580 obras canónicas en el corpus fuente;
- sólo metadatos bibliográficos;
- enlaces oficiales institucionales;
- ningún PDF alojado.

Los hosts oficiales permitidos se amplían únicamente para las fuentes UdeG
incorporadas en T2CE: Editorial UdeG y CUCSH.

## Atlas

El Atlas conserva su método experimental V1 y la ruta
`data/theses/atlas-v1`. No se afirma que haya una nueva metodología.

Lo que cambia es la fuente:

- `sourceRelease = thesis-effective-corpus-v2`;
- `expectedNodes = 566`;
- el contrato exacto del Atlas queda nuevamente hash-pinneado en su manifest.

La posición sigue calculándose únicamente con título normalizado.

## Inmutabilidad y rollback

- V1 permanece intacta y descargable.
- V2 se crea una sola vez y después sólo se verifica.
- No se usa `gh release upload --clobber`.
- Un rollback de Pages puede volver a apuntar al contrato V1 sin reescribir
  ninguna release.
- Si los hashes recompuestos no coinciden con T2CF, el deploy falla antes de
  crear o servir V2.
