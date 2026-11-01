# Tesis Humanidades UdeG — Política de fuentes y admisión V1

## Estado

**T0 — política normativa.**

---

## 1. Objetivo

Definir qué fuentes pueden alimentar el corpus, qué significa “tesis UdeG” y cómo se decide que un programa pertenece al alcance humanístico.

---

## 2. Regla de institución

El corpus V1 contiene trabajos recepcionales cuyo grado fue otorgado por la **Universidad de Guadalajara** y cuyo programa esté admitido como humanístico.

Una plataforma alojada por UdeG no convierte automáticamente un trabajo externo en tesis UdeG.

---

## 3. Regla de disciplina

La admisión disciplinaria depende de **AcademicProgramAuthority**.

No depende de:

- título;
- resumen;
- palabras clave;
- autor;
- director;
- similitud semántica;
- clúster;
- modelo generativo.

---

## 4. Fuente primaria: RIUdeG

RIUdeG es la fuente institucional primaria para V1.

La documentación institucional establece:

- DSpace como plataforma;
- OAI-PMH como estándar de interoperabilidad;
- Dublin Core como base de intercambio;
- identificadores persistentes;
- soporte de cosecha selectiva;
- marcas temporales;
- resumption tokens;
- reporte de eliminaciones según configuración del repositorio.

La fase T1 deberá verificar experimentalmente el endpoint efectivo, Identify, ListMetadataFormats, ListSets, granularidad, deletedRecord, resumption tokens y conjuntos de tesis antes de implementar una cosecha completa.

No se codifica el endpoint por suposición en T0.

---

## 5. Fuente complementaria: UDGVirtual

La colección Tesis de UDGVirtual es complementaria.

La propia colección declara tesis de diversas universidades nacionales e internacionales. Por ello:

- colección = tesis no implica institución = UdeG;
- cada registro debe resolver institución otorgante;
- los roles incrustados en la cadena de autor deben normalizarse;
- el repositorio puede aportar registros útiles ausentes o mejor descritos en RIUdeG;
- la deduplicación se realiza después de conservar ambos SourceRecord.

---

## 6. Fuente de autoridad de programas

Jerarquía preferida:

1. páginas institucionales oficiales UdeG;
2. dictámenes y normatividad;
3. estructura oficial de divisiones/departamentos;
4. páginas oficiales de programa;
5. catálogos académicos oficiales;
6. metadatos de repositorio como evidencia secundaria;
7. decisiones de curaduría documentadas.

Un programa no se incorpora sólo porque un nombre se parece a otro.

---

## 7. Semilla V1

La División de Estudios Históricos y Humanos del CUCSH actúa como primera semilla de inclusión.

La semilla no limita futuras incorporaciones de:

- programas históricos;
- programas humanísticos de otras dependencias;
- especialidades;
- posgrados;
- programas interinstitucionales;
- programas renombrados.

Toda ampliación exige evidencia institucional y una nueva revisión del registro de autoridades de programas.

---

## 8. Estados de admisión

### INCLUDE

Programa e institución confirmados y dentro de alcance.

### REVIEW

Hay evidencia humanística razonable pero falta resolver identidad, vigencia o equivalencia.

### QUARANTINE

Metadatos insuficientes, programa desconocido o institución no resuelta.

### EXCLUDE

Programa resuelto fuera de Humanidades o institución externa.

### REJECT_SOURCE

El objeto no es un trabajo recepcional elegible.

Sólo INCLUDE entra en embeddings, atlas y estadísticas públicas principales.

---

## 9. Programas históricos

Un programa histórico puede admitirse aunque ya no exista.

La evidencia debe documentar:

- nombre observado;
- vigencia aproximada;
- relación con programa sucesor si existe;
- unidad académica;
- nivel;
- fuente.

No se reescribe el pasado usando exclusivamente el nombre contemporáneo.

---

## 10. Programas interinstitucionales

Se evalúan caso por caso.

Deben poder distinguir:

- participación de UdeG;
- institución que otorgó el grado;
- programa;
- sede o unidad;
- evidencia.

La participación de UdeG no basta si el grado fue otorgado por otra institución y el alcance V1 requiere tesis UdeG.

---

## 11. Tipología documental

Se admiten trabajos recepcionales que la fuente institucional trate como tesis o equivalente académico documentado para obtención de grado.

Casos no estándar permanecen REVIEW hasta definir una política específica.

No se admite por defecto:

- manual;
- artículo;
- ponencia;
- libro;
- material docente;
- documento “sobre cómo escribir una tesis”;
- recurso que aparece en una colección de tesis pero no es un trabajo recepcional.

---

## 12. Fechas

Se conserva:

- valor crudo;
- valor normalizado;
- precisión;
- calidad.

Estados de calidad:

- valid;
- suspicious;
- invalid;
- unknown.

Una fecha anómala no se corrige sin evidencia.

Puede excluirse de visualizaciones temporales sin borrar el trabajo.

---

## 13. Personas y roles

La política de fuente distingue:

- estudiante/autor del trabajo;
- director;
- codirector;
- asesor;
- otros roles.

Los nombres se envían a Author Authority Graph.

Los indicadores textuales de rol se conservan como evidencia.

---

## 14. Archivos y derechos

El corpus de descubrimiento se basa primero en metadatos.

No es requisito redistribuir PDFs.

Cada archivo mantiene:

- URL de origen;
- estado de acceso;
- metadatos técnicos cuando estén disponibles;
- derechos declarados por la fuente.

La UI debe enlazar al repositorio institucional y respetar las condiciones de acceso.

---

## 15. Actualización

La cosecha objetivo debe:

- usar snapshots;
- ser reproducible;
- validar antes/después;
- conservar el snapshot anterior ante fallo;
- detectar caídas anómalas de cobertura;
- registrar borrados;
- usar ventanas solapadas en incremental;
- registrar resumption tokens y stop reason;
- no modificar producción si la validación falla.

---

## 16. Calidad de fuente

Antes de promover una fuente o revisión se mide:

- completitud de identificadores;
- títulos;
- autores;
- programas;
- niveles;
- fechas;
- instituciones;
- abstracts;
- palabras clave;
- roles de dirección;
- estado de acceso.

Una fuente puede ser útil aunque carezca de algunos campos, pero sus limitaciones deben quedar en CoverageLedger.

---

## 17. Deduplicación entre fuentes

Orden de evidencia preferido:

1. identificador persistente compartido;
2. identificador institucional compartido;
3. relación explícita;
4. autor confirmado + título + programa/fecha compatible;
5. otras señales bibliográficas fuertes.

Título parecido por sí solo no fusiona.

---

## 18. Fuentes iniciales consultadas

- RIUdeG, lineamientos de interoperabilidad:
  https://www.riudg.udg.mx/info/politicas.jsp
- RIUdeG, colección institucional de tesis:
  https://www.riudg.udg.mx/handle/20.500.12104/9
- UDGVirtual, colección Tesis:
  https://biblioteca.udgvirtual.udg.mx/jspui/handle/123456789/6
- CUCSH, División de Estudios Históricos y Humanos:
  https://www.cucsh.udg.mx/node/6942
- CUCSH, estructura de la División:
  https://www.cucsh.udg.mx/index.php/division_departamentos/Divisi%C3%B3n%20de%20Estudios%20Hist%C3%B3ricos%20y%20Humanos/estructuradiv

Consultadas el 1 de noviembre de 2026.
