# T2BM — Evidence HOLD y continuidad de la cola de Humanidades

## Contexto
T2BL confirmó 13 tesis de Arte y Comunicación como 13 REVIEW, distribuidas en
**5 claves normalizadas y 7 variantes textuales exactas**. Falta evidencia curricular
primaria del dictamen I/99/722, o plan histórico equivalente. Las cinco claves
encabezan la cola y repetirían la misma investigación sin nuevos documentos.

## Decisión técnica y editorial
Un HOLD es **una decisión de agenda de investigación, no de admisión**.
`scripts/thesis/config/program-evidence-holds-v1.json` documenta la autoridad
histórica que está a la espera de evidencia: `program:udg:mae-ciencias-arquitectura-arte-comunicacion`.
Mantiene el estado REVIEW y todas las tesis en el corpus. No cambia ni el orden
de `humanitiesActionItems` ni `nextHumanitiesAction` (compatibilidad con V41).

Los campos nuevos son:
- `evidenceHoldItems`: registros REVIEW documentados y pendientes;
- `humanitiesReadyItems`: cola humanística sin los HOLD;
- **`nextHumanitiesReadyAction`**: nuevo cursor que se debe usar para
  iniciar una fase con autoridad distinta;
- métricas de ambos conjuntos, separadas de las métricas legacy.

Se exige `programRef` exacto, autoridad existente con `admissionState=review`,
auditoría ya realizada y prueba curricular faltante. Si una autoridad deja REVIEW
sin retirar su HOLD, la validación debe fallar cerrada. No se clasifica por
títulos, resúmenes, keywords, embeddings, departamento o nombre de programa.

## Contrato full V41
- Total: **27,576** tesis.
- 559 INCLUDE · 254 REVIEW · 18,971 QUARANTINE · 7,790 EXCLUDE · 2 REJECT_SOURCE.
- Cola legacy: **22 grupos / 102 tesis**.
- HOLD Arte y Comunicación: **5 grupos / 13 tesis**, todos REVIEW.
- Cola disponible: **17 grupos / 89 tesis**.
- Work-level DCTS: **1 grupo / 152 tesis**, sin cambios.
- Scope Policy V5 y Metadata Confidence V5, sin cambios.
- Autoridad MCA histórica y sus alias, sin cambios.

## Precaución histórica Urbanismo y Desarrollo
CUAAD documenta la **orientación MCA Urbanismo y Desarrollo** en 1999
([antecedentes](https://cuaad.udg.mx/oferta/maestrias/mca/antecedentes-historicos)).
A la vez, la UdeG presenta una **Maestría en Urbanismo y Desarrollo** como
programa educativo separado en PIFI 3.0 (2003, página impresa 61)
([documento](https://cgpe.udg.mx/sites/default/files/prodes_cuaad_ica3.0_0.pdf)).
Esta última figura en el área de Ingeniería y Tecnología, y en PIFI 3.1 (2004)
como Ciencias Sociales y Administrativas
([documento](https://cgpe.udg.mx/sites/default/files/prodescuaad2004.pdf)).
**No se deben fusionar esos dos programas**, ni transferir una decisión de
EXCLUDE a la orientación MCA sin evidencia sobre su identidad exacta.

## Validación
`tests/test_thesis_program_evidence_hold_ready_queue_t2bm.py` comprueba
que una autoridad en HOLD sigue REVIEW, conserva su lugar en la cola legacy
y es omitida sólo por el cursor nuevo; pruebas negativas cubren entradas
duplicadas, referencias inexistentes y scope incorrecto. El workflow
`thesis-program-evidence-hold-t2bm.yml` reproyecta el full congelado y
emite un reporte con el nuevo cursor, sin publicar datos de obras individuales.
