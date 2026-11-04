# T2CE — Tesis de Filosofía UdeG: cobertura institucional y vista curada V1

## Estado

Fase de **completitud de referencias**, todavía no una release pública.

T2CE no muta `thesis-effective-corpus-v1`, no cambia Program Authority y no
persiste PDFs, bitstreams, texto completo ni texto extraído. La salida sigue
marcada como `projection-not-release`.

## Problema

El snapshot congelado de 27,576 obras no expone toda la producción filosófica
que puede documentarse en fuentes institucionales y académicas. Además, una
vista útil de Filosofía necesita distinguir dos cosas que no deben confundirse:

1. tesis cuyo **programa académico es Filosofía**;
2. tesis de otros programas cuyo **objeto o marco teórico es filosófico de forma
   sustantiva**.

La primera categoría puede ampliar una proyección canónica mediante Program
Authority. La segunda no puede cambiar el programa real de la obra y se
representa en una vista curada separada.

## Capa A — núcleo canónico por programa exacto

La fuente viva principal de T2CE es **RIUdeG**, no la interfaz histórica de
Biblioteca CUCSH.

Se recorren las colecciones institucionales CUCSH:

- Licenciatura: `20.500.12104/20979`;
- Maestría: `20.500.12104/34966`;
- Doctorado: `20.500.12104/20540`.

Las tablas de colección permiten descubrir título, programa, unidad y tipo. Sólo
cuando el programa resuelve por alias exacto a una autoridad filosófica ya
aprobada se consulta el registro OAI/DIM del ítem:

- `program:udg:lic-filosofia`;
- `program:udg:mae-estudios-filosoficos`;
- `program:udg:mae-filosofia-historica`.

El registro OAI debe confirmar el mismo programa y resolver `INCLUDE`. Una
discordancia entre la tabla de colección y los metadatos OAI falla cerrado.

No se selecciona por título, abstract, keywords, embeddings ni similitud
semántica para determinar pertenencia programática.

## Capa B — vista curada de contenido filosófico

`philosophy-curated-content-v1.json` conserva decisiones interdisciplinarias
sin alterar el corpus canónico.

Cada registro mantiene:

- programa real observado;
- institución y unidad;
- fuente y su identificador estable;
- razón explícita de inclusión;
- estado `include` o `review`;
- nivel de validación;
- enlaces de referencia sin full text.

Una tesis de Física, Cine, Tecnología Educativa, Relaciones Internacionales o
Artes puede aparecer en esta vista si existe una decisión humana explícita y la
filosofía es un componente sustantivo del objeto, método o marco teórico. Eso
**no convierte su programa académico en Filosofía**.

La primera revisión curada contiene, entre otros:

- Alejandro Loera García — Nietzsche y eterno retorno — programa real:
  Maestría en Educación y Expresión para las Artes;
- Mauricio Orozco Rodríguez — Kierkegaard, existencia y melancolía — programa
  real: Maestría en Estudios Cinematográficos;
- José Luis García Magaña — Filosofía y TIC — programa real: Maestría en
  Tecnologías para el Aprendizaje;
- Israel Alejandro Romero Ramírez — Alain Badiou, identidad y diferencia —
  programa real: Maestría en Relaciones Económicas Internacionales y
  Cooperación;
- Salvador Daniel Escobedo — ontología de la relatividad — programa real:
  Licenciatura en Física.

También conserva decisiones manuales históricas provenientes de ALEPH por su
número de sistema, sin persistir URLs de sesión.

Los hallazgos secundarios que todavía carecen de reconciliación institucional
permanecen `review`. En V1 esto incluye a Daniel Galarza Santiago y Adriel
Manuel Hernández Guzmán. La cosecha RIUdeG puede promover evidencia
institucional exacta en una revisión posterior sin reescribir la historia de la
decisión.

## ALEPH

ALEPH deja de ser el mecanismo principal de cosecha. Se conserva únicamente
como **fuente histórica de validación y curaduría** cuando aporta una Nota de
tesis o un número de sistema útil.

Nunca se almacenan URLs de sesión de ALEPH. El identificador persistido es el
número de sistema y, cuando hace falta una superficie web, se referencia el
portal institucional general.

## Doctorado

CUCSH no presenta en la autoridad actual un programa separado llamado
“Doctorado en Filosofía”. Por eso:

- no se inventa esa autoridad;
- no se renombra `program:udg:doc-humanidades`;
- una tesis doctoral sólo puede entrar a una vista filosófica por evidencia
  obra-a-obra y decisión curatorial explícita;
- la presencia de palabras filosóficas en título o keywords no basta.

## Reconciliación del núcleo exacto

La proyección exige los bytes exactos de `thesis-effective-corpus-v1`:

- JSON SHA-256:
  `0a4d24810d90f8e4c748abd0c8f3978afba6561eade46fcbf29f2bda6416b892`;
- gzip SHA-256:
  `4e2484482be783bcb004f4a343cfede516806d56d4e56dffa4a6d20cfe3750c3`.

Cada referencia del núcleo se reconcilia siguiendo la jerarquía de evidencia
del proyecto:

1. **handle persistente compartido**;
2. si no existe coincidencia por handle, `título normalizado + primer
   thesis-author + programRef + año`.

RIUdeG contiene registros históricos sin `dc.date.issued` ni
`dc.date.submitted`. En esos casos no se convierte la fecha de acceso al
repositorio en una fecha de tesis: el handle permite identidad determinista y la
fecha permanece desconocida.

- una coincidencia: añade procedencia a la obra existente;
- cero coincidencias: construye una obra nueva en la proyección;
- más de una coincidencia: fail-closed y revisión humana.

No hay fuzzy matching.

La vista curada interdisciplinaria **no participa** en este mecanismo y no
puede crear una admisión canónica por contenido.

## Reference-only

Toda superficie T2CE rechaza enlaces públicos con:

- `.pdf`;
- `/bitstream`;
- `/download`.

Los artifacts contienen únicamente metadata, reportes, una proyección
bibliográfica y el índice curado. El proyecto no conserva tesis ni texto
íntegro.

## Publicación

T2CE sólo está listo para integrarse cuando:

1. pasan las pruebas focalizadas;
2. la cosecha RIUdeG finaliza;
3. la proyección exacta valida hashes e invariantes;
4. la vista curada valida todos sus enlaces y decisiones;
5. el guardrail reference-only pasa;
6. el PR queda verde.

Aun después del merge, la web pública sigue en V1 hasta crear una nueva release
inmutable y verificar manifest, hashes, Actions, Pages, SHA desplegado y rutas
públicas.
