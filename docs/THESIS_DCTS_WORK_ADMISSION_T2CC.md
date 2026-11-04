# T2CC — Activación work-level DCTS con provenance individual V2

## Alcance y base de aprobación

T2CB/#163 quedó **fusionado manualmente** en `main` con merge SHA
`a66d1a14122d68953d75d6cbb6905715b49b785e`.
Su head académico aprobado es
`e88c30d20ab034389a0470f7bf1428258749d3a8`.
El deploy de Pages posterior a #163 terminó SUCCESS en el run
`41756675156` sobre el merge SHA citado.

T2CB aprobó las **candidatas disciplinarias**, no cambió admission.
T2CC aplica la consecuencia exacta de la candidata INCLUDE a una sola obra,
sin incorporar una decisión global de todo el doctorado.

- Obra: `thesis:work:00024461`.
- Autor: Ariel García Núñez.
- Título: *Mecanismos sociales en el hábitat popular latinoamericano. Metateoría, teoría y explicación*.
- Programa: `program:udg:doc-ciudad-territorio-sustentabilidad`, siempre `REVIEW`.
- Handle: `20.500.12104/84204`.
- SourceRecord: `source:thesis:riudg:8807d09b42022eb0ad32`.
- PDF oficial: https://www.riudg.udg.mx/bitstream/20.500.12104/84204/1/DCUAAD10072FT.pdf
- Páginas: **366**.
- PDF SHA-256: `b6ae86dfbeec25fc54507e1edb240e155d8f34bbb0c6a46953259064d1c71695`.
- Decisión: `REVIEW → INCLUDE`, por obra, reversiblemente.

La evaluación disciplinaria del texto completo y la procedencia de captura
permanecen documentadas en `docs/THESIS_DCTS_PRIMARY_SOURCE_CAPTURE_T2CB.md`.
Esta fase **no sustituye la lectura de fuente primaria** y no introduce
clasificación automatizada por título, abstract, keywords, embeddings o LLM.

La segunda obra aprobada en #163, `thesis:work:00024462`, queda
`retain-review`; la arquitectura **prohíbe activarla o excluirla** con
la evidencia disponible. Su origen continúa siendo la frontera
interdisciplinaria humanidades/urbanismo.

## Por qué se requiere un registro V2

El registro T2BX (`work-admission-decisions-v1.json`) situaba la aprobación
humana globalmente en PR #158 y el aplicador V1 validaba explícitamente el
head y el merge de Estudios de Género. Agregar DCTS a la lista antigua sin
cambiar el esquema sería conceptualmente incorrecto.

T2CC introduce, sin modificar los archivos antiguos:

- `scripts/thesis/config/work-admission-decisions-v2.json`;
- `scripts/thesis/apply_work_admission_decisions_v2.py`;
- `tests/test_thesis_work_admission_activation_t2cc.py`;
- `.github/workflows/thesis-dcts-work-admission-t2cc.yml`.

Cada decisión V2 conserva su **propio** `approval.pullRequest`,
`approval.mergeCommitSha` y `approval.approvedHeadSha`, además de
`workId`, `programRef`, `sourceRecordRef`, handle, PDF hash/URL,
archivo de candidata, estado previo/nuevo, justificación y reversión.

Los dos registros en el contrato son deliberadamente distintos:

1. `00002062`: `preserve-approved`, con revisión T2BX y aprobación #158;
   la obra debe encontrarse ya INCLUDE y conservar exactamente su objeto.
2. `00024461`: `activate-now`, con revisión T2CC y aprobación #163;
   debe encontrarse REVIEW en el corpus de entrada y cambiar únicamente ella.

El workflow comprueba en **GitHub en vivo** que cada PR fue realmente
fusionado y que su merge SHA y head SHA coinciden con el contrato.
El validador exige, además, el archivo oficial, el SHA-256, la identidad
canónica y el SourceRecord exacto; también comprueba que la autoridad
programática permanece REVIEW y la confianza de metadata permite aplicar
la autoridad.

La segunda aplicación es un error. Una reversión desde un estado no
coincidente o con provenance adulterada también es un error.

## Fuente de partida: release V1 inmutable

T2CC consume exclusivamente la release:

`thesis-effective-corpus-v1`

- JSON SHA-256:
  `0a4d24810d90f8e4c748abd0c8f3978afba6561eade46fcbf29f2bda6416b892`.
- Gzip SHA-256:
  `4e2484482be783bcb004f4a343cfede516806d56d4e56dffa4a6d20cfe3750c3`.
- Obras: 27,576.
- Estado: 561 INCLUDE / 193 REVIEW / 18,971 QUARANTINE /
  7,849 EXCLUDE / 2 REJECT_SOURCE.

Antes de usarla, CI ejecuta `verify-release` con el contrato T2BZ,
el manifest en raíz y los checksums de la release.

**No se sobrescribe** `work-admission-decisions-v1.json`,
`build_effective_corpus_v1.py`, `deploy.yml`, la release V1,
sus assets ni su manifest. Por tanto, las pruebas y cifras
históricas T2BX/T2BY/T2BZ siguen referidas exactamente a V1.

## Resultado proyectado de T2CC (artefacto, no producción)

| Estado | Effective V1 | Activación T2CC |
|---|---:|---:|
| INCLUDE | 561 | **562** |
| REVIEW | 193 | **192** |
| QUARANTINE | 18,971 | 18,971 |
| EXCLUDE | 7,849 | 7,849 |
| REJECT_SOURCE | 2 | 2 |
| Total | 27,576 | 27,576 |

La comparación de los 27,576 objetos debe producir **una sola diferencia**:
`thesis:work:00024461`. Tanto la obra de Estudios de Género
(`00002062`) como la obra DCTS `retain-review` (`00024462`)
permanecen idénticas. La revisión Program Authority continúa V47
y la proyección programática se mantiene en 560 INCLUDE / 194 REVIEW.

El workflow vuelve a aplicar la función de forma inversa y exige igualdad
integral con el objeto JSON de V1. El artefacto conserva un snapshot
comprimido, hash SHA-256, reporte de activación, reporte de reversión
y resumen con sus conteos y provenance.

## Publicación y siguiente fase

**T2CC no publica un nuevo dataset**: se limita a proponer y verificar
en un PR la activación work-level y un artefacto reproducible. El usuario
realiza el merge manual; ningún script crea ni mueve tags públicos.

Una fase posterior deberá construir una release **nueva e inmutable**
de corpus efectivo —V2 o equivalente— con hashes, manifest,
verificación del deploy de Pages y comprobación HTTP de las rutas públicas.
El nombre/versionado definitivo queda para esa fase.

Conservar `thesis-effective-corpus-v1` íntegra no es opcional: sigue
representando las 561 INCLUDE y 193 REVIEW publicadas por T2BZ.
