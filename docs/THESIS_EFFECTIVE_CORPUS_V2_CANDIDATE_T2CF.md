# T2CF — Effective Corpus V2 candidate

## Estado

T2CF construye un **candidato auditable**, no una release y no una publicación
de GitHub Pages.

La base sigue siendo la release inmutable
`thesis-effective-corpus-v1`, verificada por sus hashes exactos.

## Objetivo

Componer, por primera vez en un único snapshot, dos trabajos ya aprobados pero
hasta ahora separados:

1. la activación work-level de DCTS aprobada en T2CC;
2. las cuatro tesis de programa filosófico exacto aprobadas en T2CE.

La vista filosófica interdisciplinaria de T2CE continúa separada y no cambia la
admisión canónica de ningún trabajo.

## Entradas aprobadas

### Base V1

- 27,576 obras;
- 561 INCLUDE;
- 193 REVIEW;
- 18,971 QUARANTINE;
- 7,849 EXCLUDE;
- 2 REJECT_SOURCE.

Hashes:

- JSON:
  `0a4d24810d90f8e4c748abd0c8f3978afba6561eade46fcbf29f2bda6416b892`;
- gzip:
  `4e2484482be783bcb004f4a343cfede516806d56d4e56dffa4a6d20cfe3750c3`.

### DCTS / T2CC

Se reutiliza sin redefinir el contrato
`work-admission-decisions-v2.json`.

Sólo cambia una obra existente:

- `thesis:work:00024461`: REVIEW → INCLUDE.

Se preservan explícitamente:

- `thesis:work:00002062`: INCLUDE previamente aprobado;
- `thesis:work:00024462`: continúa REVIEW.

### Filosofía / T2CE

Se reutilizan las cuatro referencias oficiales de
`philosophy-official-supplement-v1.json`, aprobadas mediante PR #169:

- Guillermo Vargas Curiel;
- Carlos Itzcóatl Enciso Durán;
- Santiago Juárez Salazar;
- Guillermo Castillo Ramírez.

Estas cuatro obras no existían en V1 y reciben los IDs deterministas:

- `thesis:work:00027577`;
- `thesis:work:00027578`;
- `thesis:work:00027579`;
- `thesis:work:00027580`.

## Resultado esperado

El candidato T2CF debe contener exactamente:

- **27,580 obras**;
- **566 INCLUDE**;
- **192 REVIEW**;
- **18,971 QUARANTINE**;
- **7,849 EXCLUDE**;
- **2 REJECT_SOURCE**.

La diferencia respecto de V1 es exactamente:

- +1 INCLUDE / -1 REVIEW por DCTS;
- +4 obras INCLUDE de Filosofía.

Ninguna otra obra preexistente puede cambiar.

## Invariantes

El builder falla cerrado si:

- V1 no coincide byte-a-byte con sus hashes;
- Program Authority deja de ser V47;
- el contrato DCTS cambia;
- el conjunto de cuatro referencias filosóficas cambia;
- una referencia filosófica deja de resolver a un programa exacto autorizado;
- cambia cualquier obra de V1 distinta de `00024461`;
- `00024462` deja de ser REVIEW;
- `00002062` cambia;
- los cuatro nuevos IDs no son exactamente `27577–27580`;
- se intenta usar la vista interdisciplinaria como admisión canónica.

## Reference-only

T2CF no almacena PDFs ni texto completo. Los nuevos registros filosóficos deben
apuntar únicamente a páginas de referencia HTTPS y rechazan URLs con
`.pdf`, `/bitstream` o `/download`.

La evidencia histórica de DCTS permanece representada por hashes y procedencia
de aprobación ya incorporados al work-level decision; el candidato no empaqueta
el PDF utilizado en la auditoría anterior.

## Reproducibilidad

CI construye el candidato dos veces desde la misma release V1 y exige igualdad
byte-a-byte de:

- JSON del candidato;
- gzip determinista;
- reporte;
- archivos SHA-256.

## Publicación

T2CF **no**:

- crea `thesis-effective-corpus-v2`;
- modifica `thesis-effective-corpus-v1`;
- modifica `deploy.yml`;
- cambia el demo público de 561 tesis;
- cambia el Atlas público de 561 nodos.

Una fase posterior, sólo después de merge y nueva verificación humana, podrá
crear una release V2 inmutable y migrar deliberadamente Pages.
