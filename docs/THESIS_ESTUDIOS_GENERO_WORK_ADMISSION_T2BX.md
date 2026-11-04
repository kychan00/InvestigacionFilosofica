# T2BX — Activación individual de admisión · Estudios de Género 001

## Alcance y procedencia

Esta fase convierte la decisión candidata aprobada mediante merge manual de [#158](https://github.com/kychan00/InvestigacionFilosofica/pull/158) en una **proyección efectiva y reversible de admisión por obra**. No reclasifica la Maestría en Estudios de Género ni presume que una decisión de una tesis autoriza las futuras tesis del programa.

- Merge aprobado: `71f58709f727d7e7b3b081bc5bc3e89cb75b3ce3`.
- Head académico aprobado: `eb73b297c6eedd13f70e71fde9d5a763e135e350`.
- Obra: `thesis:work:00002062`, Alejandra López Pérez.
- Identificador institucional: `20.500.12104/112718`.
- Registro RIUdeG: https://riudg.udg.mx/handle/20.500.12104/112718
- Fuente primaria: https://riudg.udg.mx/bitstream/20.500.12104/112718/1/MCUCSH10741FT.pdf
- PDF de 219 páginas, SHA-256: `8ad834865aa3b34a34dd7cf205b8528d6b7dd6b8a87a1a584d35d84404b2bcd2`.

La revisión de fundamento disciplinario, marco teórico, objeto, método y evidencia primaria permanece en `docs/THESIS_ESTUDIOS_GENERO_ADJUDICATION_T2BW.md`. T2BX no reinterpreta una fuente nueva ni cambia el juicio académico: implementa su consecuencia individual, previamente validada.

## Decisión concreta

Regla: `thesis:work:00002062`: **REVIEW → INCLUDE**.

La fase no permite por defecto cambiar una sola obra distinta. El registro `scripts/thesis/config/work-admission-decisions-v1.json` liga de forma explícita:

- identificador canónico;
- programa institucional;
- handle RIUdeG;
- registro fuente;
- estado anterior y posterior;
- hash y URL del documento primario;
- lote de adjudicación y argumento;
- PR y SHA de la aprobación humana;
- contrato de reversión.

El código no hace matching por título, abstract, palabras clave, similitud, unidad académica ni por pertenencia a la maestría. Comprueba el identificador exacto y la evidencia vinculada antes de aplicar.

## Resultado proyectado

Corpus congelado: **27,576**.

| Estado | Antes de T2BX | Snapshot activado |
| --- | ---: | ---: |
| INCLUDE | 560 | **561** |
| REVIEW | 194 | **193** |
| QUARANTINE | 18,971 | 18,971 |
| EXCLUDE | 7,849 | 7,849 |
| REJECT_SOURCE | 2 | 2 |
| Total | 27,576 | 27,576 |

La maestría completa conserva AcademicProgramAuthority `REVIEW`, V47. Scope Policy V5 y Metadata Confidence V5 permanecen iguales.

**Importante:** estos son conteos del **snapshot activado por la fase**, no una declaración de que la aplicación pública ya lo consume. El corpus congelado original y los workflows históricos no se sobrescriben. Un cambio de consumo/publicación requiere un PR de integración específico, verificar GitHub Actions, el SHA desplegado y la ruta pública.

## Arquitectura de seguridad

El módulo `scripts/thesis/apply_work_admission_decisions_v1.py` actúa únicamente sobre una proyección de corpus ya resuelta con autoridades vigentes.

1. Comprueba el esquema y la aprobación de #158.
2. Verifica que el programa de la obra continúe en `REVIEW`.
3. Verifica que el candidato incluya evidencia de PDF oficial y que el hash coincida.
4. Verifica ID, programa, handle, SourceRecordRef y que la metadata permita la autoridad.
5. Exige que la obra de origen permanezca `REVIEW`.
6. Cambia únicamente esa obra a `INCLUDE`, registrando el motivo, la decisión y el SHA de aprobación.
7. Conserva 27,576 obras y todos los datos de las restantes 27,575.
8. Admite `--reverse` que restaura `REVIEW` sólo cuando la decisión activa coincide en ID y revisión.

Una segunda aplicación accidental y un rollback sin la decisión exacta deben fallar.

## Pruebas de calidad

`tests/test_thesis_work_admission_activation_t2bx.py` incluye casos positivos y vetos contra:

- duplicar la aplicación;
- cambiar el workId;
- handle incorrecto;
- SourceRecord faltante;
- applicability bloqueada;
- candidata sin evidencia primaria;
- merge no aprobado;
- reclasificación programática;
- decisiones duplicadas;
- reversión inexacta.

El workflow `thesis-work-admission-activation-t2bx.yml` reproduce el corpus completo, consulta en GitHub el merge de #158, aplica el registro y revierte la mutación para verificar identidad exacta del conjunto de obras. Genera un artefacto comprimido del snapshot activado con SHA-256 y reportes de antes/después.

## Estado de publicación

T2BX crea y prueba un artefacto de activación sin sustituir el dataset publicado ni modificar el runtime. **No se declara desplegado el Atlas de Tesis ni un cambio de búsqueda pública hasta que una fase de integración valide el consumo real y el SHA de despliegue.**

La siguiente fase deberá evaluar esa conexión sin interferir con los contratos históricos, así como reconciliar las colas de revisión con las decisiones work-level ya activadas.
