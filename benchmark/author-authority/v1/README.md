# Benchmark de Author Authority V1

Este directorio define el gate de identidad previo a Author Profile V2.

## Capas

### Gold

Casos humanos explícitos y verificables.

La versión inicial sólo usa identidades ya documentadas dentro del repositorio. No se inventan IDs ni se presenta una inferencia automática como gold humano.

### Silver

Invariantes deterministas evaluadas sobre **toda la release author-index-v3**:

- IDs OpenAlex con el mismo ORCID válido deben converger;
- un candidate group no puede mezclar dos anclas deterministas distintas;
- un ORCID contradictorio en un mismo OpenAlex Author ID se cuarentena.

### Stress / auditoría

Muestras reproducibles de:

- homónimos con ORCID distinto;
- homónimos sin ancla;
- colisiones mixtas;
- nombres con diacríticos;
- iniciales;
- nombres de tres o más tokens;
- candidate groups con múltiples OpenAlex Author IDs.

Estas muestras no son automáticamente verdad humana. Sirven para auditoría posterior.

## Gate V1

Bloquea si:

- falla cualquier caso gold;
- aparece un false merge silver;
- aparece un false split silver por ORCID;
- el escaneo no cubre exactamente los autores resueltos declarados por el manifest fuente.

## Dataset fijado

La configuración pinnea:

- release GitHub;
- SHA-256 del tarball;
- revisión OpenAlex snapshot;
- revisión del corpus filosófico.

El benchmark no usa api.openalex.org.
