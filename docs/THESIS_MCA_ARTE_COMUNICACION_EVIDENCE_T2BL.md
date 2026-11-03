# T2BL — MCA: orientación histórica Arte y Comunicación · auditoría de evidencia (HOLD)

## Alcance de la fase

El corpus del buscador es **exclusivamente de Humanidades**. En T2BL no se presupone que una
orientación histórica pertenece a Humanidades por contener `Arte` en el nombre, por adscripción
al CUAAD o por el tema de una tesis. Las decisiones son institucionales y programáticas.

## Evidencia primaria confirmada

1. Los [antecedentes oficiales del CUAAD](https://cuaad.udg.mx/oferta/maestrias/mca/antecedentes-historicos)
   identifican `Arte y Comunicación` entre las orientaciones de la MCA aprobadas mediante
   el dictamen **I/99/722** (3 de marzo de 1999). Señalan su supresión junto con otras
   orientaciones en la reconfiguración del programa, con efecto en 2006 B.
2. El [Cuarto Informe de Actividades 1998–1999 de la UdeG](https://cgpe.udg.mx/sites/default/files/adjuntos/4_informe_1998-1999.pdf)
   confirma `Arte y comunicación` como **área terminal de Ciencias de la Arquitectura**
   dentro del CUAAD. No la presenta como una maestría independiente en Artes.

Estas fuentes prueban **identidad histórica**, **adscripción institucional** y **existencia formal**.
No prueban por sí solas un núcleo curricular humanístico que justifique INCLUDE.

## Evidencia contextual (no decisoria)

La revista institucional [Zincografía del CUAAD](https://zincografia.cuaad.udg.mx/index.php/ZC/article/view/129)
consigna una egresada de la orientación dedicada al estudio del arte mexicano del siglo XX.
Eso demuestra una trayectoria humanística posible, pero **la trayectoria de una persona no
es prueba del alcance curricular de toda la orientación**. También hay tesis con temas
de arte, arquitectura, educación y medios digitales: sus títulos y resúmenes no deciden
si el programa debe admitirse.

## Inventario congelado

- Autoridad: `program:udg:mae-ciencias-arquitectura-arte-comunicacion`.
- Program Authority: `2026-11-02.v41`.
- Identidad: `historical`, 13 obras de la MCA, observadas entre 1998–2005.
- Primer grupo de la cola: `maestria en arquitectura orientacion arte y comunicacion`.
- Primer grupo: **7 obras** de 1998–2004, CUAAD, 7 REVIEW, 0 blocked.
- Sus dos variantes exactas: `Maestría En Arquitectura; Orientacion Arte Y Comunicacion` (6),
  `Maestría En Arquitectura, Orientacion Arte Y Comunicacion` (1).
- Inventario full confirmado: **7 variantes exactas, 5 claves normalizadas**.
  Las siete variantes y sus frecuencias son:
  - `Maestría En Arquitectura; Orientacion Arte Y Comunicacion`: 6;
  - `Maestría En Arquitectura, Orientacion Arte Y Comunicacion`: 1;
  - `Maestría En Arquitectura; Orientacion En Arte Y Comunicacion`: 1;
  - `Maestría En Ciencias De La Arquitectura Con Orientación En Arte Y Comunicación`: 2;
  - `Maestría En Ciencias De La Arquitectura Orientación En Arte Y Comunicación`: 1;
  - `Maestría En Ciencias De La Arquitectura, Orientacion En Arte Y Comunicacion`: 1;
  - `Maestría En Ciencias De La Arquitectura, Orientación Arte Y Comunicación`: 1.

Esta distribución se congela en el baseline y se verifica íntegramente por normalized key
y variante exacta en el full de 27,576 obras. Ninguna se convierte en INCLUDE.

Los años, conteos y rutas se contrastan contra el **full baseline congelado de 27,576 obras**.
La auditoría registra únicamente metadata programática agregada; no utiliza texto de las
tesis para emitir admisión, no crea fuzzy aliases ni fusiona obras por título o autor.

## Decisión T2BL: HOLD / REVIEW

**No hay base documental suficiente para convertir 13 REVIEW → INCLUDE.**
**Tampoco hay prueba institucional suficiente para EXCLUDE a toda la orientación.**
Por tanto, T2BL **preserva REVIEW sin delta** y mantiene la orientación pendiente de
decisión humana. No se incrementa artificialmente Program Authority a V42.

Para cerrar el expediente hacen falta fuentes de época directamente vinculadas a
la orientación, preferentemente el **dictamen I/99/722 completo con anexos** o
el **plan de estudios 1995–2003** (materias, perfil de egreso, objetivos,
líneas de investigación). Debe permitir decidir si la orientación está principalmente
centrada en historia, crítica, teoría y estudios del arte —o si en cambio se centra
en diseño, técnicas de comunicación o producción arquitectónica aplicada—.

## Invariantes y controles

- Alcance `humanities-only` intacto; Scope Policy V5 intacta.
- Metadata Confidence V5 intacta; Program Authority V41 intacta.
- MCA genérica de etapa segura no transfiere su INCLUDE a Arte y Comunicación.
- Urbanismo y Desarrollo, Edificación Arquitectónica y Teoría y Crítica mantienen
  autoridades históricas separadas, sin propagación automática.
- DCTS y Boundary Closure no cambian.
- El resultado esperado sigue siendo 559 INCLUDE, 254 REVIEW, 18,971 QUARANTINE,
  7,790 EXCLUDE, 2 REJECT_SOURCE, total 27,576.
- Cola esperada: 22 grupos / 102 obras; work-level DCTS 1 / 152.

## Evidencia ejecutable

Archivos de esta fase:

- `scripts/thesis/config/mca-arte-comunicacion-evidence-hold-v1.json`;
- `scripts/thesis/audit_mca_arte_comunicacion_evidence_v1.py`;
- `tests/test_thesis_mca_arte_comunicacion_evidence_hold_v1.py`;
- `.github/workflows/thesis-mca-arte-comunicacion-evidence-t2bl.yml`.

El workflow toma el baseline completo, reproyecta V41 y V5, comprueba la cohorte y
publica un reporte de auditoría **sin modificar admission**. Su éxito no equivale
a autorización para INCLUDE; confirma que la clasificación permanece conservadora.
