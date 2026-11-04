# T2CO — Barrido estricto y paginado de paradero Aleph

## Propósito
Ampliar la cobertura del Índice Maestro T2CL sin alterar la admisión canónica,
Effective Corpus V1/V2 ni la vista pública T2CI. Este trabajo **no publica**
nuevas tesis ni holdings: produce evidencia de reconciliación verificable.

## Base
- T2CL: 233 referencias filosóficas únicas al corte; 217 proceden de CUCSH.
- T2CM: tres números Aleph con holdings institucionales verificados.
- T2CN: piloto estratificado de 24; cinco resueltas (tres seeds y dos nuevas).
- El barrido T2CO excluye seeds ya confirmadas de su cola para dedicar las
  consultas a referencias todavía sin número Aleph. Conservarlas como controles
  de regresión de T2CN; no contarlas de nuevo como descubrimientos T2CO.
- Las referencias con `reviewFlags`, ubicación ya conocida o metadatos
  insuficientes permanecen fuera de resolución automática.

## Algoritmo reproducible
1. Reconstruir en CI el índice T2CL desde las fuentes institucionales, previa
   verificación criptográfica del release Effective Corpus V2.
2. Ordenar referencias elegibles en round-robin por década, con desempates
   estables por año, título normalizado e ID.
3. Seleccionar `--offset N --limit M`; `1 <= M <= 40`. Los offsets se refieren
   al orden **de una misma revisión del índice**. Para reanudar, conservar
   `inputRevision`, métricas y artifact del lote anterior.
4. Reutilizar una sesión Aleph. Buscar por título `WTI` (N/Y), autor
   `WAU` (Y), y términos distintivos del título `WTI` sólo para descubrir
   candidatos. No usar `WFM=TESIS`.
5. Abrir cada candidato por SYS (`func=direct`), comprobar título normalizado
   exacto, tokens completos del autor, identidad SYS no contradictoria y
   `Nota de tesis` o `Base lógica: Tesis`.
6. Aceptar sólo si existe **exactamente un registro válido**. Consultar
   `item-global` y registrar metadatos de biblioteca, colección, signatura,
   estatus y disponibilidad cuando estén presentes.
7. Más de ocho candidatos por consulta se registra como **desbordamiento de
   descubrimiento**, no como prueba de múltiples tesis idénticas. Si la unión
   de candidatos acotados supera ocho, el caso queda `unresolved` sin
   truncar candidatos. Varias identidades bibliográficas exactas -> `ambiguous`.
   La falta de una identidad exacta -> `unresolved`. Los errores transitorios
   no prueban inexistencia. Una identidad exacta validada puede resolverse
   aunque otra consulta amplia se haya desbordado; esta limitación queda
   explícita en `attempts` para auditoría posterior.

## Salida y privacidad
El JSON `thesis-philosophy-holdings-batch-v1` contiene `offset`, `limit`,
`inputRevision`, métricas y decisiones por ID original. No contiene
cookies, credenciales, sesiones Aleph, páginas HTML, PDFs ni texto completo.
Las excepciones HTTP nunca se guardan literalmente porque podrían revelar
una URL dinámica de sesión.

No se fusionan resultados directamente con T2CL ni se publica `physical-confirmed`
hasta una fase posterior de reconciliación durable con pruebas de identidad,
provenance, duplicados y control de versiones.

## Operación
Workflow: `.github/workflows/thesis-philosophy-holdings-t2co.yml`.
En PR se ejecutan tests y un lote vivo pequeño de control. El despacho manual
acepta `offset` y `limit` para recorrer la cola en tandas controladas.
Cada lote debe guardar su artifact antes de pasar al siguiente. Si cambia el
índice de origen, recalcular la cola antes de reutilizar offsets.

## Pendientes
- Revisar los primeros lotes reales y causas de no-resolución.
- Reconciliar los holdings T2CN + T2CO con los 233 sin perder referencias,
  y después crear una nueva versión pública del Índice Maestro.
- Dar prioridad posterior a Maestría en Estudios Filosóficos y a Doctorado
  en Humanidades / línea Pensamiento, conservando siempre el programa real.
