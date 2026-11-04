# T2CH — Hotfix de contratos runtime V2 en Tesis/Atlas

## Incidente

La verificación pública posterior a T2CG abrió correctamente `tesis.html` y `atlas.html`, pero ambos consumidores bloquearon los datos que Pages ya servía desde `thesis-effective-corpus-v2`.

El buscador mostraba el fallback fail-closed y el Atlas mostraba “ATLAS NO DISPONIBLE”.

## Causa raíz

T2CG migró los builders, manifests, release, datos públicos y copy principal a V2/566, pero quedaron contratos runtime históricos en:

- `src/core/thesis-demo-search.js`: exigía `thesis-effective-corpus-v1` y 561 registros.
- `src/core/thesis-atlas.js`: exigía `thesis-effective-corpus-v1` y 561 nodos.
- la allowlist runtime del buscador no incluía las fuentes oficiales añadidas por T2CE/T2CG.
- `tesis.html` conservaba dos textos estáticos V1/27,576.

Los guardrails fail-closed funcionaron como estaban diseñados: rechazaron un payload que no coincidía con su contrato local obsoleto.

## Alcance del hotfix

T2CH no cambia:

- Effective Corpus V2;
- hashes o releases;
- Program Authority;
- decisiones de admisión;
- topología del Atlas;
- número de nodos;
- política reference-only.

T2CH sólo sincroniza los consumidores del navegador con el release ya aprobado:

- demo: V2 / 566;
- Atlas: V2 / 566;
- allowlist runtime equivalente a la política del builder para CUCSH/Editorial UdeG;
- regla CUCSH root-query restringida a `?q=node/<número>`;
- copy de tesis sin número canónico estático;
- cache-busting de módulos para evitar servir validadores V1 almacenados.

## Validación previa

Sobre el artifact exacto de Pages del run `41858844412`:

- demo index: 566 registros, `sourceRelease=thesis-effective-corpus-v2`, `totalCanonical=27580`;
- Atlas: 566 nodos, `sourceRelease=thesis-effective-corpus-v2`, `referenceOnly=true`;
- manifest Atlas: `pdfCopies=0`.

Pruebas dirigidas del hotfix:

- `node --test tests/thesis-demo.test.mjs tests/thesis-atlas.test.mjs` → 10/10 PASS;
- validación directa de los JSON desplegados con los nuevos validadores → demo 566 PASS, Atlas 566 PASS.

## Cierre requerido

Después del merge y del workflow de Pages se debe volver a abrir:

- `/tesis.html`;
- `/atlas.html`;
- `/data/theses/demo-v1/index.json`;
- `/data/theses/atlas-v1/manifest.json`;
- `/data/theses/effective-corpus-v2/manifest.json`.

Sólo entonces registrar T2CG/T2CH como producción pública HTTP verificada.
