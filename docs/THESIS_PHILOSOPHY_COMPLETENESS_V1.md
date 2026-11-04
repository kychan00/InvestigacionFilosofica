# T2CE — Tesis de Filosofía UdeG: cobertura institucional complementaria V1

## Estado

Fase de **completitud de referencias**, todavía no una release pública. No muta \`thesis-effective-corpus-v1\`, no cambia Program Authority y no persiste PDFs, bitstreams, texto completo ni texto extraído.

## Por qué existe

El snapshot congelado de 27,576 obras sólo contiene tres obras cuyo programa explícito es Filosofía: una de Licenciatura en Filosofía y dos de la Maestría histórica en Filosofía. Sin embargo, fuentes oficiales UdeG/CUCSH documentan tesis adicionales que no quedaron expuestas por el harvest RIUdeG congelado.

Ejemplos verificados:

- Guillermo Castillo Ramírez — *El debate sobre el sufragio femenino en la prensa Tapatía (1946-1955): las construcciones de masculinidad y feminidad* — Licenciatura en Filosofía — 2004.
- Guillermo Vargas Curiel — *Análisis descriptivo sobre a modificación curricular a la Licenciatura en Filosofía de la Universidad de Guadalajara en 1996 desde la perspectiva del pensamiento complejo* — Licenciatura en Filosofía — 2006.
- Carlos Itzcóatl Enciso Durán — *Entre la moral y lo político. Una reflexión desde el realismo político contemporáneo* — Maestría en Estudios Filosóficos — 2024.
- Santiago Juárez Salazar — *Una lectura del epicureísmo desde la teoría crítica* — Maestría en Estudios Filosóficos — 2024.

## Cobertura

El crawler recorre las vistas institucionales de tesis de **licenciatura y maestría** de la Biblioteca Central Dr. Manuel Rodríguez Lapuente y selecciona exclusivamente programas que resuelven por alias exacto a:

- \`program:udg:lic-filosofia\`;
- \`program:udg:mae-estudios-filosoficos\`;
- \`program:udg:mae-filosofia-historica\`.

No se selecciona por título, abstract, keywords, embeddings ni similitud semántica.

## Doctorado

La oferta institucional vigente de CUCSH no presenta un programa separado llamado “Doctorado en Filosofía”. El programa doctoral humanístico es el **Doctorado en Humanidades**, con ejes Pensamiento, Cultura y Lenguaje y con la filosofía entre sus disciplinas de investigación.

Por eso:

- no se inventa una autoridad “Doctorado en Filosofía”;
- no se renombra \`program:udg:doc-humanidades\`;
- sus tesis continúan en el corpus humanístico existente;
- una futura vista “Filosofía doctoral” deberá clasificarlas obra por obra con evidencia institucional explícita y reversible.

## Reconciliación

La proyección exige los bytes exactos de \`thesis-effective-corpus-v1\`:

- JSON SHA-256: \`0a4d24810d90f8e4c748abd0c8f3978afba6561eade46fcbf29f2bda6416b892\`;
- gzip SHA-256: \`4e2484482be783bcb004f4a343cfede516806d56d4e56dffa4a6d20cfe3750c3\`.

Cada referencia complementaria se compara mediante:

\`título normalizado + primer thesis-author + programRef + año\`

- una coincidencia: añade procedencia a la obra existente;
- cero coincidencias: crea una nueva obra con el builder canónico y Work ID Registry;
- más de una coincidencia: fail-closed y revisión humana.

No hay fuzzy matching.

## Reference-only

Toda URL pública con \`.pdf\`, \`/bitstream\` o \`/download\` se rechaza. Los artifacts contienen sólo metadata, reportes y una proyección de referencias.

## Publicación

El resultado de T2CE es \`projection-not-release\`. La web pública sigue en V1 hasta crear una nueva release inmutable y verificar hashes, manifest, CI, Pages y SHA desplegado.
