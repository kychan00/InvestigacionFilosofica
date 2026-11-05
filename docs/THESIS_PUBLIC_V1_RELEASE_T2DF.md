# T2DF — Tesis UdeG · Versión pública 1.0

**Fecha de lanzamiento propuesta:** 5 de noviembre de 2026  
**Tag reservado:** `thesis-v1.0.0`  
**Superficie:** `/tesis.html`

## Decisión de release

El buscador de tesis deja de presentarse públicamente como una demostración y
pasa a denominarse:

**Tesis UdeG · Versión pública 1.0**

La promoción es editorial y de producto. No altera corpus, autoridades,
admisiones ni evidencia.

## Qué entra en V1

### Humanidades

La vista Humanidades consulta el **Effective Corpus V2**:

- 27,580 obras en el corpus efectivo;
- 566 INCLUDE;
- 192 REVIEW;
- 18,971 QUARANTINE;
- 7,849 EXCLUDE;
- 2 REJECT_SOURCE.

La interfaz pública principal muestra los registros admitidos según el contrato
vigente.

### Filosofía

La vista Filosofía conserva el índice público curado de **233 referencias**:

- 231 INCLUDE;
- 2 REVIEW;
- programas filosóficos documentados;
- cruces filosóficos curados;
- programa académico real preservado;
- inventario histórico CUCSH reconciliado;
- holdings físicos sólo cuando existe evidencia específica.

### Reference-only

V1 mantiene como política:

- 0 PDFs alojados;
- 0 bitstreams persistidos;
- 0 copias de tesis;
- enlaces hacia fuentes institucionales o referencias aprobadas;
- metadatos y procedencia verificable.

## Hallazgo documental de Filosofía

La V1 no afirma que la producción filosófica de UdeG esté completamente
digitalizada. Al contrario, documenta una brecha importante entre producción
académica conocida y representación digital pública.

Por ello la interfaz incluye:

- rutas oficiales de RIUdeG para incorporación de tesis;
- contacto de Biblioteca Central Dr. Manuel Rodríguez Lapuente;
- contacto de Coordinación de la Maestría en Estudios Filosóficos;
- una nota de protesta bibliográfica.

La regla editorial permanece:

**ausencia digital no equivale a inexistencia.**

## Contrato público V1

La página debe mostrar, de forma visible:

- `Tesis UdeG · Versión 1.0` en el título del documento;
- `VERSIÓN PÚBLICA 1.0 · NOVIEMBRE 2026`;
- `VERSIÓN PÚBLICA 1.0` en el bloque de release;
- metodología formulada como `Esta primera versión pública...`;
- pie `Tesis UdeG · Versión pública 1.0 · Noviembre de 2026`.

No deben reaparecer en copy visible:

- `EDICIÓN DE DEMOSTRACIÓN`;
- `Este primer demo`;
- `Estadísticas del demo`.

Los nombres internos históricos como:

- `thesis-demo.js`;
- `thesis-demo.css`;
- `demo-v1/index.json`;
- `#thesis-demo`;

pueden permanecer en V1 porque son identificadores de implementación y
renombrarlos no mejora la experiencia pública. Se difiere ese refactor para no
introducir riesgo innecesario en el release.

## Criterio de lanzamiento

El tag `thesis-v1.0.0` sólo debe crearse **después** de:

1. merge del PR T2DF a `main`;
2. checks de PR en SUCCESS sobre el head exacto;
3. GitHub Pages post-merge en SUCCESS;
4. verificación del SHA desplegado;
5. comprobación pública de `/tesis.html` y
   `/tesis.html?scope=philosophy`.

Hasta entonces el tag queda reservado, no creado.

## Fuera de alcance de V1

No bloquean el lanzamiento:

- digitalización completa de tesis históricas;
- resolución física de todos los holdings;
- incorporación de todas las tesis MEF faltantes;
- renombre de identificadores internos heredados del prototipo;
- automatización de aportes de egresados.

Esos puntos pertenecen a versiones posteriores o a trabajo institucional
externo.
