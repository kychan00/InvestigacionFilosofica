# T2DA — Corroboración institucional post-Aleph para tesis MEF

**Fecha:** 5 de noviembre de 2026  
**Programa objetivo:** `program:udg:mae-estudios-filosoficos`  
**Base:** T2CY + T2CZ / PR #191

## Por qué cambia la estrategia

T2CZ agotó la consulta exacta del lote MEF contra Aleph/UDG01:

- 11 entradas;
- 0 identidades work-level confirmadas;
- 0 holdings;
- dos autores con falsos positivos de libros;
- nueve sin candidatos adjudicables.

T2DA cambia de proveedor. La nueva evidencia principal es una publicación
institucional de la Universidad de Guadalajara:

**¿Es ese un buen argumento?** (2021)

RIUdeG conserva el objeto estable:

- handle: `20.500.12104/112279`;
- tipo: libro;
- editorial: Editorial Universidad de Guadalajara;
- colección: Editorial Universidad de Guadalajara;
- sin ficheros asociados al objeto RIUdeG.

El propio registro institucional declara que al final del libro existe una
bibliografía completa de la producción del Cuerpo Académico
**Retórica, Lógica y Teoría de la Argumentación**, del Departamento de Filosofía.

## Separación de fuentes

T2DA no confunde el contenedor institucional con la copia textual usada para
inspeccionar la bibliografía.

### Contenedor institucional

- RIUdeG:
  https://www.riudg.udg.mx/handle/20.500.12104/112279?locale=es

Prueba la identidad institucional del **libro**, no la de cada tesis citada.

### Registro editorial oficial

- Editorial CUCSH:
  https://sige.cucsh.udg.mx/editorial/publicacion/es-ese-un-buen-argumento

### Testigo textual público

- copia pública indexada:
  https://www.academia.edu/71551518/El_debate_entre_Einstein_y_Bohr_sobre_la_completud_de_la_mec%C3%A1nica_cu%C3%A1ntica_entre_la_argumentacion_y_la_redescripcion

Su función es permitir auditar la bibliografía del libro. No se etiqueta como
fuente institucional ni se almacena el PDF.

## Discrepancia ISBN

Las fuentes no coinciden:

- RIUdeG Dublin Core: **978-607-571-436-3**;
- Editorial CUCSH: **978-607-571-438-7**;
- Agencia ISBN México / INDAUTOR: **978-607-571-438-7**.

T2DA conserva los tres valores y marca la discrepancia. No corrige RIUdeG por
intuición, aunque dos fuentes oficiales coincidan en el segundo ISBN.

## Seis tesis T2CY corroboradas por bibliografía UdeG

La bibliografía de la publicación UdeG cita explícitamente como
**“Tesis de maestría, Universidad de Guadalajara”** seis entradas ya conocidas
por T2CY:

1. Rómulo Daza y García / Rómulo Ramírez Daza y García — 2009;
2. Christian Jhovanny Cervantes Barraza — 2011;
3. Mauricio Morales Díaz — 2011;
4. Joaquín Galindo Castañeda — 2013;
5. Íker Javier Pulido Rodríguez — 2019;
6. Dalila Ayala Castillo — 2019.

Para cinco casos, el título coincide con T2CY tras normalización.

### Rómulo — autoridad resuelta, título todavía en variante

CUCSH publica una ficha oficial bajo el nombre:

**Rómulo Ramírez Daza y García**

Por ello T2DA resuelve la autoridad nominal del `sourceAuthor`
`Rómulo Daza y García` hacia esa forma completa.

No obstante, se preservan dos títulos fuente:

T2CY / CV de Fernando Leal:

**El dios de Aristóteles, necesidad y suficiencia de su planteamiento en
Metafísica XII, principalmente a contraluz de las tres Éticas: Una revisión
crítica**

Bibliografía UdeG:

**El Dios de Aristóteles: Necesidad y suficiencia de su planteamiento en
Metafísica XII principalmente, a contraluz de las tres éticas.**

La autoridad de autor queda resuelta; la variante de título no.

## Mauricio Morales Díaz

La bibliografía UdeG lo cita como tesis de maestría y Editorial CUCSH conserva
además *Guerra y racionalidad*. Su ficha editorial afirma que esa investigación
fue presentada bajo el título exacto de la tesis.

Esto crea una cadena institucional fuerte de **tesis citada → publicación
derivada**, pero sigue sin equivaler a:

- registro bibliográfico individual de tesis;
- handle de tesis;
- SYS de tesis;
- holding físico.

## Íker Javier Pulido Rodríguez

La bibliografía UdeG cita el título exacto como tesis de maestría. CUNorte/UdeG
confirma por separado que Íker posee la **Maestría en Estudios Filosóficos**.

La combinación confirma fuertemente persona + tesis UdeG + programa, pero aún
no produce un identificador work-level de la tesis.

## Nuevas tesis de maestría detectadas

La misma bibliografía institucional aporta cuatro citas de tesis de maestría
UdeG que no estaban en T2CY:

### Adriel Manuel Hernández Guzmán — 2011

**El Estado propuesto por Platón en la República es una utopía**

Un perfil controlado por el autor declara que cursó la Maestría en Estudios
Filosóficos en UdeG. Como esa segunda pieza no es institucional, T2DA lo deja
como:

`new-master-thesis-mef-candidate-noninstitutional-program`

### Zariá Casillas Olivares — 2018

**Razonamientos y argumentaciones de niñas y niños sobre discriminación por
orientación sexual**

Este caso demuestra por qué “tesis de maestría UdeG” no significa “MEF”.
Una nota oficial UdeG y el CV de Fernando Leal identifican el programa como
**Maestría en Ciencias Sociales**.

Decisión:

`exclude-from-mef-program`

La tesis sigue siendo una tesis UdeG válida; simplemente queda fuera del
subconjunto MEF.

### Mario Damián Del Muro Silva — 2019

**Análisis retórico del discurso político: Figuras a través del Twitter en la
elección presidencial 2018 en México**

La bibliografía institucional la cita como tesis de maestría UdeG. Una biografía
oficial de Editorial Universidad de Guadalajara identifica a Mario Damián del
Muro Silva como **Maestro en Estudios Filosóficos por la UdeG**.

T2DA lo incorpora como nuevo candidato MEF nominal:

`new-mef-thesis-cross-source-corroborated`

Todavía no es `institutional-work-confirmed`, pues no existe en esta fase un
handle/SYS/ficha individual de la tesis.

### Jesús Octavio Campos Ramos — 2021

**El presupuesto de la unificación del concepto y del ser en Dios en el
argumento ontológico de San Anselmo, según Hegel**

La bibliografía UdeG la identifica como tesis de maestría UdeG. Una publicación
posterior en *Sincronía* confirma identidad autoral y continuidad temática sobre
el argumento ontológico, pero no especifica el programa de maestría.

Estado:

`new-master-thesis-program-unresolved`

No se cuenta como MEF.

## Exclusión de trabajo en curso

La bibliografía registra además:

**Joel Alejandro Franco Ramírez — La verdad lógica en P. Maddy y C. Peacock**

pero lo marca explícitamente **“en curso”**.

No se cuenta como tesis concluida.

## Marcela Castillo Villegas

La Universidad de Caldas publica un perfil institucional que une explícitamente:

- Marcela Castillo Villegas;
- Maestría en Estudios Filosóficos;
- Universidad de Guadalajara;
- trabajo de grado: *Forma y contenido de los textos filósóficos*.

Esto constituye una corroboración institucional externa de persona + programa +
trabajo de grado. Se preserva la grafía `filósóficos` de esa fuente como
variante. No se convierte en identificador work-level UdeG.

## Resultado T2DA

- T2CY input: **11**;
- identidades work-level heredadas de T2CZ: **0**;
- solapamientos T2CY corroborados por bibliografía institucional: **6**;
- coincidencias exactas de título: **5**;
- variantes de título: **1**;
- autoridades de autor resueltas: **1**;
- nuevas citas completas de tesis de maestría UdeG: **4**;
- nuevo candidato MEF con programa institucionalmente corroborado: **1**;
- nuevo candidato MEF con programa sólo autoral: **1**;
- nuevo caso confirmado fuera de MEF: **1**;
- nuevo caso con programa sin resolver: **1**;
- trabajos de maestría en curso excluidos: **1**;
- corroboraciones institucionales externas de trabajo de grado: **1**;
- identificadores institucionales específicos de tesis nuevos: **0**;
- holdings físicos nuevos: **0**;
- fichas públicas nuevas: **0**.

## Siguiente fase

T2DB debe priorizar:

1. **Mario Damián del Muro Silva**, por tener tesis UdeG + programa MEF en dos
   fuentes oficiales;
2. **Adriel Manuel Hernández Guzmán**, para sustituir la declaración autoral de
   programa por una fuente institucional;
3. **Jesús Octavio Campos Ramos**, para determinar el programa;
4. búsqueda de identificadores work-level para las seis tesis T2CY ya
   corroboradas por bibliografía UdeG;
5. no volver a Aleph para el mismo lote salvo que aparezca un SYS nuevo desde
   otra fuente.

T2DA no modifica Effective Corpus V2, Program Authority ni la vista pública.
