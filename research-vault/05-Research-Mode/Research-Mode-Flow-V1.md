---
type: workflow-contract
project: InvestigacionFilosofica
version: 1.0.0-draft
status: proposed
updated: 2026-10-10
---

# Modo Investigación · flujo V1

## Propósito

Este flujo convierte el método conceptual del proyecto en estados verificables
sin fingir que la investigación es lineal. Cada paso produce un artefacto
persistente; el investigador puede retroceder, crear una revisión y volver a
buscar sin borrar la historia anterior.

## Máquina de estados

```text
forming
  → scoping
  → problematizing
  → questioning
  → designing
  → building_corpus
  → reading
  → synthesizing
  → hypothesizing
  → testing
  → protocol_ready

cualquier estado posterior a questioning
  → revisión de pregunta, alcance o método
  → nueva búsqueda y nueva vuelta de la espiral
```

`archived` es un estado administrativo. `completed` no significa que el
problema filosófico esté resuelto, sino que el investigador cerró una versión
del protocolo o producto.

## Flujo completo

### 1. Inquietud · `forming`

Entrada: texto libre, términos iniciales y motivación.

El sistema puede detectar ambigüedades y proponer referentes, pero conserva la
entrada original. Salida: `intake` y primer borrador de `Problem`.

Gate humano: confirmar que la dificultad formulada representa la inquietud.

### 2. Delimitación · `scoping`

Se explicitan inclusiones, exclusiones, periodos, autores, obras, tradiciones,
lenguas y conceptos por definir.

Salida: primera `ScopeRevision`.

Gate humano: aceptar qué queda dentro y fuera, con razones.

### 3. Problematización · `problematizing`

Se distinguen tensiones, presupuestos, explicaciones rivales, cambios de
sentido y asunto en juego. El sistema organiza preguntas parciales alrededor
de una dificultad, no genera una lista arbitraria.

Salida: `Problem` revisado, tensiones y preguntas secundarias propuestas.

Gate humano: elegir qué tensión organiza la investigación.

### 4. Pregunta · `questioning`

El investigador formula o acepta una pregunta central. El diagnóstico explica
ambigüedades, decisiones pendientes y corpus implicado sin producir una
calificación numérica.

Salida: `Question` activa y razones de su formulación.

Gate humano: aceptación explícita de la pregunta. Éste es el mínimo requerido
para generar un plan de búsqueda.

### 5. Disciplinas · `designing`

Se registra disciplina principal, disciplinas auxiliares, aporte, función y
límite de transferencia. Una disciplina externa no determina por sí sola una
conclusión filosófica que sus métodos no autorizan.

Salida: `DisciplineContribution[]`.

Gate humano: justificar cada incorporación disciplinar.

### 6. Método · `designing`

Se seleccionan operaciones —delimitar, analizar, sintetizar, ordenar,
cuestionar, problematizar, historicizar, comparar, reconstruir o integrar— y
se declara qué evidencia requiere cada una.

Salida: `MethodPlan` versionado.

Gate humano: aceptar el plan y sus límites.

### 7. Plan de búsqueda · `building_corpus`

La pregunta, el alcance y las disciplinas generan un `QueryPlan`: consulta
principal, variantes conceptuales, idiomas, subconsultas disciplinares y
filtros. El plan conserva el motor solicitado y el realmente utilizado.

Salida: consultas ejecutables y trazables.

Gate humano: puede editar o descartar cualquier consulta derivada.

### 8. Corpus · `building_corpus`

La búsqueda federada o semántica devuelve candidatos. El sistema puede
explicar por qué aparecieron; el investigador decide inclusión, exclusión y rol
documental.

Salida: `CorpusEntry[]` con decisiones y razones.

Gate humano: ningún documento entra al corpus aceptado sólo por score.

### 9. Lectura y evidencia · `reading`

El investigador registra notas, pasajes, secciones y paráfrasis con locator.
El sistema puede proponer claims o relaciones, indicando si sólo dispone de
metadata, abstract o texto completo.

Salida: `Evidence[]` y propuestas de `Claim`.

Gate humano: confirmar atribuciones e interpretaciones antes de usarlas como
base del estado del arte.

### 10. Estado del arte · `synthesizing`

Se construyen posiciones, argumentos, controversias, cronología y aperturas.
Cada afirmación conserva evidencia y capa epistémica.

Salida: matriz de posiciones y borrador narrativo trazable.

Gate humano: distinguir descripción del corpus, inferencia y juicio propio.

### 11. Genealogía · `synthesizing`

Se modelan transformaciones concretas entre problemas, conceptos, posiciones
y argumentos. La cronología ordena, pero no sustituye las relaciones
filosóficas.

Salida: `Relation[]`, genealogía y problemas abiertos.

Gate humano: aceptar cada relación interpretativa relevante.

### 12. Hipótesis · `hypothesizing`

El investigador formula una respuesta provisional. El sistema organiza
evidencia favorable, contraria y supuestos sin apropiarse de la autoría.

Salida: `HypothesisRevision` activa.

Gate humano: sólo el investigador puede crear la versión aceptada.

### 13. Examen adversarial · `testing`

Se buscan objeciones, contraejemplos, hipótesis rivales y evidencia ausente en
el corpus. El resultado puede conservar, revisar, rechazar o dejar sin resolver
la hipótesis.

Salida: `AdversarialTest` y propuestas de revisión.

Gate humano: decidir la respuesta y si comienza otra vuelta de la espiral.

### 14. Protocolo · `protocol_ready`

Se consolida pregunta, alcance, método, corpus, hipótesis, límites, trazabilidad
y estructura de escritura.

Salida: protocolo versionado y exportaciones JSON/Markdown.

Gate humano: declarar cerrada esa versión del proyecto.

## Reglas de transición

1. Nunca se borra una revisión que ya produjo búsquedas, decisiones de corpus
   o interpretaciones.
2. Cambiar pregunta, alcance o método crea una revisión y marca como
   potencialmente desactualizados los artefactos derivados.
3. Desactualizado no significa eliminado: el investigador decide reutilizar,
   revisar o descartar.
4. La búsqueda puede ejecutarse desde `questioning`, pero el estado del arte
   requiere pregunta, alcance, método y corpus aceptados.
5. La hipótesis puede aparecer temprano como nota, pero sólo se vuelve
   `HypothesisRevision` aceptada por acción humana.
6. Toda salida generada registra la revisión exacta de sus inputs.

## Autoridad por tipo de acción

### El sistema puede hacer automáticamente

- validar estructura y referencias;
- detectar campos faltantes o artefactos desactualizados;
- conservar historial;
- ejecutar consultas aprobadas;
- importar metadata bibliográfica;
- calcular scores y ordenar candidatos bajo contratos existentes.

### La IA puede proponer

- reformulaciones de pregunta;
- conceptos, tensiones y subpreguntas;
- consultas y vocabulario multilingüe;
- claims, relaciones, objeciones y síntesis;
- diagnósticos metodológicos y límites.

Toda propuesta queda marcada como tal y enlazada a inputs, modelo y evidencia.

### Sólo el investigador puede aceptar

- problema y pregunta central;
- alcance y disciplinas;
- método;
- inclusión o exclusión del corpus;
- atribuciones interpretativas importantes;
- hipótesis propia;
- cierre de una revisión del proyecto.

## Primer corte implementable

El MVP no necesita construir todavía toda la genealogía. El recorrido mínimo
vertical es:

```text
crear proyecto
→ registrar inquietud
→ aceptar problema y pregunta
→ definir alcance, disciplinas y método
→ generar y editar consulta
→ buscar
→ seleccionar corpus
→ registrar evidencia/notas
→ formular hipótesis
→ exportar e importar sin pérdida
```

Este corte valida la unidad `Problem`, la agencia humana, el versionado, la
trazabilidad y la reutilización del buscador sin comprometerse aún con una UI
completa de controversias o genealogía.

## Gate de salida del diseño

Antes de tocar producción deben existir:

- contrato V1 revisado y aceptado;
- diagrama de estados revisado;
- un proyecto mínimo de ejemplo;
- un proyecto completo de ejemplo con dos revisiones de pregunta;
- JSON Schema y validador en una rama aislada;
- pruebas de invariantes y round-trip;
- decisión de migración de esquema;
- decisión UX sobre cuándo y cómo se solicita aceptación humana.

## Relacionado

- [[ResearchProject-Data-Contract-V1]]
- [[Research-Mode]]
- [[Research-Mode-Architecture]]
- [[Research-Process]]
- [[Question-Formation]]
- [[Research-Spiral]]
