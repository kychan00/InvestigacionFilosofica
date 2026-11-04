# T2CQ — Revisión de discrepancias entre CUCSH y Aleph

## Punto de partida confirmado
T2CN validó cinco paraderos físicos, T2CO consultó 38 referencias nuevas
sin identidades exactas confirmadas y T2CP detectó y reparó una pérdida de
campos bibliográficos. Tras la reparación, en las primeras ocho referencias
se inspeccionaron 17 candidatos Aleph y **todos tenían título distinto**.
Esto demuestra una discrepancia con los candidatos recibidos, no ausencia
de la tesis en la red bibliotecaria.

## Pregunta
¿Qué referencia original de CUCSH produce qué candidatos de Aleph y en qué
difieren las identidades que no se pueden fusionar automáticamente?

## Instrumento
`scripts/thesis/audit_philosophy_aleph_discrepancies_t2cq.py` reusa
el resolvedor exacto T2CO sin modificarlo y captura únicamente campos
bibliográficos de los registros candidatos efectivamente abiertos:
- identificador T2CL de la referencia CUCSH;
- título, autor, año y programa original;
- número de sistema del candidato Aleph;
- título y autor observados;
- presencia de evidencia de tesis;
- coincidencia de tokens completos del autor;
- discrepancias de título, autor o número de sistema;
- estado `resolved`, `unresolved` o `ambiguous` de T2CO.

Cada candidato discrepante lleva `reviewOnly: true`,
`sameWorkConfirmed: false` y `physicalLocationConfirmed: false`.
Aunque el registro Aleph tenga holdings, **no se le atribuyen a la
referencia CUCSH** hasta una adjudicación institucional o bibliográfica
posterior. Sólo los metadatos de candidatos revisables se exportan; no
se guardan hojas HTML, cookies, sesiones, libros completos ni PDFs.

## Selección y ejecución
La cola reproduce exactamente el orden T2CO `nonseed-decade-round-robin-offset-v1`,
excluye los seeds verificados y las referencias con flags de revisión.
En PR, el workflow `.github/workflows/thesis-aleph-discrepancy-t2cq.yml`
reconstruye el índice T2CL de fuentes verificadas y examina las primeras
ocho referencias. En despacho manual puede ejecutar lotes de 1 a 40.

El artifact `discrepancy-review.json` es evidencia **para curaduría**,
no un nuevo índice publicado. Las búsquedas sin resultado y los
desbordamientos quedan identificados separadamente. No se infiere
que una obra desapareció por falta de resultados `WTI` o `WAU`.

## Priorización curatorial posterior
1. Diferencias de una letra con mismo autor completo: solicitar
   corroboración de catálogo original y ficha Aleph; **nunca auto-merge**.
2. Mismo autor con obra distinta: mantener obras separadas.
3. Diferente autor: investigar sólo si hay evidencia institucional concreta.
4. Sin candidatos Aleph: corroborar con catálogo CUCSH, coordinación de
   Filosofía, fondos de La Normal y Belenes, sin inventar paradero.
5. Múltiples identidades exactas o desbordamiento: revisión manual con
   número de sistema y registro completo.

## Fuentes institucionales complementarias
- Sistema Universitario de Bibliotecas, catálogos:
  https://bibliotecas.udg.mx/catalogos-en-linea
- Biblioteca CUCSH, catálogo de tesis:
  http://www.biblioteca.cucsh.udg.mx/catalogo-de-tesis
- Información del traslado parcial:
  https://www.cucsh.udg.mx/noticias/parte-del-acervo-de-la-biblioteca-manuel-rodriguez-lapuente-se-traslada-cucsh-belenes

La comunicación con bibliotecas no está efectuada en T2CQ. Los registros
de Control Escolar (45 grados de Maestría en Estudios Filosóficos y 22
de Doctor/Doctora en Humanidades 2018–2025) siguen siendo contadores
de cobertura y no identidades de tesis.

## Restricciones
No tocar Program Authority, scope, Effective Corpus V1/V2, admission
policies ni UI pública. No promover holdings no reconciliados. Mantener
referencias institutional-only sin inventar PDFs. Se abrirá PR independiente
y sólo se publicará tras merge y verificación SHA/Actions/URL.
