# T2AP — Medicina Veterinaria y Zootecnia · Program Authority V26

## Decisión

Se registra una sola AcademicProgramAuthority para tres formas institucionalmente defendibles:

- `Licenciatura en Medicina Veterinaria Zootecnista`
- `Licenciatura en Médico Veterinario y Zootecnista`
- `Licenciatura en Medicina Veterinaria y Zootecnia`

Program ref:

`program:udg:lic-medicina-veterinaria-zootecnia`

Canonical name:

`Licenciatura en Medicina Veterinaria y Zootecnia`

Admission:

`EXCLUDE`

Registry revision:

`2026-11-02.v26`

## Una línea programática, tres formas defendibles

La agrupación no se basa sólo en semejanza textual.

### Nombre vigente y clasificación institucional

La Guía de Carreras UdeG publica:

`Licenciatura en Medicina Veterinaria y Zootecnia`

y la clasifica en:

`Ciencias Biológico Agropecuarias`

La ofrece en:

- CUCBA;
- CUALTOS;
- CUSUR.

Fuente:

`https://guiadecarreras.udg.mx/index.php/oferta_academica/licenciatura-en-medicina-veterinaria-y-zootecnia`

### CUCBA

CUCBA publica el mismo nombre canónico y describe formación en:

- salud animal;
- medicina preventiva;
- diagnóstico y tratamiento;
- salud pública veterinaria;
- zoonosis;
- producción animal;
- genética, nutrición, reproducción y sanidad.

Fuente:

`https://www.cucba.udg.mx/contenido/licenciatura-en-medicina-veterinaria-y-zootecnia-0`

### CUSur

La página institucional se titula:

`Licenciatura en Médico Veterinario y Zootecnista`

y dentro de esa misma página identifica el programa como:

`Licenciatura en Medicina Veterinaria y Zootecnia`

Esto constituye evidencia directa de equivalencia nominal dentro del mismo programa.

Fuente:

`https://www.cusur.udg.mx/es/licenciatura-en-medico-veterinario-y-zootecnista`

La historia institucional de CUSur documenta además que la carrera de:

`Médico Veterinario y Zootecnista`

se estableció en Ciudad Guzmán en 1980.

Fuente:

`https://www.cusur.udg.mx/es/sites/default/files/adjuntos/25_aniversario-cusur_historia.pdf`

### Sistema Institucional de Estadísticas

La matrícula UdeG usa el mismo código programático:

`5082100001`

para la:

`Licenciatura en Medicina Veterinaria y Zootecnia`

en:

- CUCBA;
- CUSUR;
- CUALTOS.

Fuente:

`https://sie.udg.mx/listados/matricula`

### Variante histórica CUCBA

RIUdeG conserva tesis de CUCBA cuyo `dc.degree.name` es:

`LICENCIATURA EN MEDICINA VETERINARIA ZOOTECNISTA`

mientras el objeto académico y la denominación profesional corresponden a Medicina Veterinaria y Zootecnia / Médico Veterinario Zootecnista.

Ejemplo:

`https://www.riudg.udg.mx/handle/20.500.12104/21362`

Por tanto esta variante se trata como alias histórico de la misma línea.

## Scope

La clasificación oficial actual es:

`Ciencias Biológico Agropecuarias`

y los objetivos institucionales se concentran en:

- salud animal;
- salud pública e inocuidad;
- producción animal;
- diagnóstico;
- prevención;
- zootecnia;
- bienestar animal.

Puede existir formación ética, social y humanista, pero no cambia la identidad programática principal.

Bajo:

`targetScope = humanities-only`

la autoridad corresponde a:

`EXCLUDE`

## Full inventory

Frozen artifact:

`13099541204`

Canonical works:

**27,576**

SHA-256:

`65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`

Aliases V26 observados:

### Licenciatura en Medicina Veterinaria Zootecnista

**1,340**

### Licenciatura en Médico Veterinario y Zootecnista

**155**

### Licenciatura en Medicina Veterinaria y Zootecnia

**1**

Aggregate:

**1,496**

## Metadata Confidence V3

T2AO aisló 3 structural conflicts dentro del grupo histórico de 1,340.

Esos records tienen:

- confidenceState = `conflicted`;
- authorityApplicability = `blocked`.

Por tanto:

`V26 EXCLUDE + blocked → QUARANTINE`

Todos los demás records V26:

`V26 EXCLUDE + allowed → EXCLUDE`

Expected aggregate:

- observed: **1,496**
- blocked: **3**
- applicable: **1,493**
- EXCLUDE: **1,493**
- QUARANTINE: **3**

## El cuarto raw label NO se incorpora

El full corpus contiene además:

`Licenciatura en Veterinario y Zootecnista`

con:

**5 works**

Todas están en:

`CUCS`

y el propio RIUdeG las lista con ese nombre.

Sin embargo:

1. no se encontró una fuente institucional UdeG que reconozca ese nombre exacto como programa;
2. no coincide con los centros institucionalmente asociados a la línea veterinaria actual;
3. el audit no ofrece una identidad programática alternativa confirmada;
4. sus títulos aparentan dominios médicos humanos, pero **el contenido temático no se utiliza para reasignarlas**.

Por tanto la decisión correcta es:

`HOLD / unresolved`

Estas 5:

- no son aliases V26;
- no reciben EXCLUDE de V26;
- conservan `programRef = null`;
- permanecen QUARANTINE.

Referencia RIUdeG del conjunto:

`https://riudg.udg.mx/browse?type=author&value=LICENCIATURA+EN+VETERINARIO+Y+ZOOTECNISTA`

## Impacto esperado

### Historical CUCBA raw group

1,340 total:

- 1,337 EXCLUDE
- 3 QUARANTINE

Queue:

`metadata-review / metadata-confidence-review`

### CUSur alias

155:

- 155 EXCLUDE
- 0 QUARANTINE

No debe permanecer en Queue después de reproyección.

### Current CUALTOS alias

1:

- 1 EXCLUDE

No debe permanecer en Queue.

### Held CUCS group

5:

- 5 QUARANTINE
- programRef = null
- queueState = unresolved

## Invariantes

T2AP no modifica:

- Program Metadata Evidence Confidence V3;
- Institution Authority V2;
- Scope Policy V2;
- Admission Gate precedence;
- Boundary Closure V2;
- T2T;
- T2Y.

Tampoco convierte el grupo held de 5 en Veterinary por similitud textual o temática.

## Resultado metodológico

T2AP separa correctamente:

### Autoridad institucional demostrada

1,496 works → V26

### Metadata conflictiva dentro de autoridad demostrada

3 works → QUARANTINE

### Alias no demostrado

5 works → unresolved / QUARANTINE

Así V26 amplía cobertura sin sacrificar el principio central:

`program institutional identity > lexical similarity or thesis topic`
