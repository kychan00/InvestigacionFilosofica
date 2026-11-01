# Human Authority Audit V1

## Estado

**Fase 3.5 — auditoría humana de identidad bibliográfica.**

Esta fase convierte el benchmark masivo de autoridad en una muestra humana reproducible antes de activar Author Profile V2.

No modifica todavía el runtime público ni publica Authority Graph shards en Pages.

---

## 1. Pregunta de investigación

El benchmark silver ya demostró que la política determinista actual produce:

- 0 false merges por anclas incompatibles;
- 0 false splits por ORCID compartido;
- cobertura completa del inventario fuente.

Eso no demuestra todavía que la partición corresponda a personas reales.

Human Authority Audit V1 pregunta:

> cuando una persona revisa evidencia bibliográfica de dos perfiles, ¿la relación actual del grafo coincide con el juicio humano?

---

## 2. Independencia del juicio humano

El archivo visible al revisor no contiene:

- ORCID como parte de la selección inicial;
- candidateRef;
- identity key;
- estrato de muestreo;
- relación actual del algoritmo;
- etiqueta silver;
- expectativa del benchmark.

El revisor recibe únicamente:

- audit_id;
- perfil izquierdo;
- perfil derecho;
- evidencia bibliográfica asociada.

La relación actual se conserva exclusivamente en `manifest.json` para calcular métricas después de cerrar la auditoría.

La IA, silver y el propio algoritmo no pueden escribir automáticamente `judgments.jsonl` y presentarlo como gold humano.

---

## 3. Muestra congelada

La muestra contiene exactamente:

- 100 pares;
- 200 OpenAlex Author IDs únicos.

Distribución interna, oculta durante la revisión:

- 13 merges automáticos por ORCID compartido;
- 20 homónimos con ORCID distintos;
- 34 homónimos sin ORCID;
- 33 homónimos mixtos, con un perfil anclado y otro sin ancla.

Los 13 merges automáticos son obligatorios porque constituyen todo el universo de fusiones multi-ID que la política V1 realiza en la release evaluada.

---

## 4. Huella criptográfica

La muestra visible se serializa como NDJSON determinista.

SHA-256 esperado:

`6265acd4e74f62719fab813078b33146ad363236244d4ff2a7c58c3e6cbdd585`

Si la misma release deja de producir exactamente esta muestra, el constructor falla.

Cambiar una pareja requiere publicar deliberadamente una nueva versión de la auditoría.

---

## 5. Procedencia

La muestra se deriva del benchmark verde asociado a:

- workflow run: `41343033423`;
- head SHA: `e0c14608268e00b4eadcb72d28b77d1c77b9c93c`;
- artifact: `author-authority-benchmark-v1`;
- artifact id: `13097947069`;
- release: `author-index-v3`;
- benchmark seed: `20261101`.

La release continúa fijada por el SHA-256 declarado en:

`benchmark/author-authority/v1/config.json`.

---

## 6. Evidencia presentada al revisor

Para cada uno de los 200 perfiles, el constructor extrae exclusivamente de la release estática:

- OpenAlex Author ID;
- nombres observados;
- ORCID observados;
- enlace público al perfil OpenAlex;
- enlaces ORCID;
- cantidad de obras observadas;
- rango temporal completo;
- hasta 12 obras representativas;
- año;
- idioma;
- tipo documental;
- posición de autor;
- corresponding flag;
- coautores de las obras mostradas.

No se llama a:

`api.openalex.org`.

La evidencia puede enlazar a páginas públicas para revisión manual, pero el paquete se construye con el snapshot fijado.

---

## 6.1 Filas de evidencia malformadas

El primer build contra la release real detectó al menos una fila NDJSON de `works/` truncada o sintácticamente inválida.

La auditoría no intenta reconstruir ni corregir ese contenido.

Durante la extracción de evidencia:

- una fila JSON válida se procesa normalmente;
- una fila malformada se omite únicamente de la evidencia visible;
- se incrementa `evidenceDiagnostics.invalidJsonRows`;
- se conserva una muestra acotada con ruta, número de línea, error y preview;
- el resto del paquete continúa construyéndose.

Esta tolerancia sólo se aplica a la capa de evidencia bibliográfica del revisor. No transforma una fila corrupta en una obra válida, no inventa títulos y no altera la muestra de identidad congelada.

Las filas malformadas quedan así **cuarentenadas y observables**, no reparadas silenciosamente.

---

## 7. Etiquetas permitidas

Cada par admite exactamente:

### same-person

La evidencia sostiene que los dos perfiles representan a la misma persona.

### different-person

La evidencia sostiene que representan personas distintas.

### unresolved

La evidencia no permite resolver la identidad con suficiente seguridad.

`unresolved` es un resultado válido y nunca se transforma automáticamente en una de las otras dos etiquetas.

---

## 8. Política de gate

V1 mantiene una política asimétrica.

### False merge

Si el grafo fusionó dos perfiles y el humano determina `different-person`:

- cuenta como false merge;
- un solo caso bloquea el gate.

Umbral:

`falseMergeCount = 0`

### False split

Si el grafo mantuvo dos perfiles separados y el humano determina `same-person`:

- cuenta como false split;
- se reporta como deuda de cobertura;
- no activa automáticamente una fusión;
- no bloquea V1 por sí solo.

Esta asimetría mantiene el principio central:

> una identidad incompleta es preferible a mezclar obras de dos personas distintas.

---

## 9. Cobertura mínima humana

Para considerar válido el reporte:

- los 100 pares deben estar juzgados;
- mínimo 80 deben recibir una relación resuelta;
- los 13 merges automáticos deben recibir un juicio resuelto;
- false merges = 0.

Si un merge automático queda `unresolved`, el gate permanece cerrado.

---

## 10. Golden set humano

Una vez finalizada la auditoría:

`npm run benchmark:authority:audit:analyze`

produce:

- `human-audit-report.json`;
- `human-gold-v1.jsonl`.

El gold contiene únicamente:

- `same-person`;
- `different-person`.

Los casos `unresolved` se conservan en el reporte, pero no se promueven a verdad de referencia.

El gold no conserva la decisión previa del algoritmo.

---

## 11. Paquete reproducible

El comando:

`npm run benchmark:authority:audit:build -- --input <author-index-v2>`

genera en:

`artifacts/author-authority-human-audit-v1/`

los archivos:

- `source-benchmark-report.json`;
- `sample.jsonl`;
- `manifest.json`;
- `evidence.json`;
- `judgments.template.jsonl`.

---

## 12. Interfaz de revisión

Con el paquete construido:

`npm run benchmark:authority:audit`

abre un servidor local en:

`http://127.0.0.1:4177/benchmark/author-authority/human-audit-v1/review.html`

La interfaz muestra:

- dos expedientes en paralelo;
- enlaces bibliográficos;
- obras;
- coautores;
- periodo observado;
- tres decisiones posibles;
- notas;
- progreso;
- guardado inmediato.

Atajos:

- `S`: misma persona;
- `D`: personas distintas;
- `U`: no concluyente;
- flechas: navegación.

---

## 13. Persistencia

El progreso local vive en:

`benchmark/author-authority/human-audit-v1/.progress.json`

y está ignorado por Git.

Al finalizar los 100 pares, el servidor escribe:

`benchmark/author-authority/human-audit-v1/judgments.jsonl`.

Ese archivo sí representa la auditoría terminada y puede versionarse después de revisar su contenido.

---

## 14. CI

Workflow:

`.github/workflows/author-authority-human-audit-v1.yml`

El gate automatizado:

1. ejecuta pruebas unitarias;
2. descarga `author-index-v3`;
3. verifica el checksum;
4. ejecuta nuevamente el benchmark masivo;
5. reconstruye la muestra humana;
6. verifica el SHA-256 congelado;
7. comprueba 100 pares y 200 perfiles;
8. comprueba que el sample visible sea ciego;
9. comprueba que evidence no revele la decisión del algoritmo;
10. publica el paquete completo como artifact.

CI construye el material de revisión.

CI no fabrica juicios humanos.

---

## 15. Métricas humanas

El análisis calcula:

- pares juzgados;
- pares resueltos;
- unresolved;
- agreement rate;
- false merge count;
- false split count;
- human false merge rate;
- human false split rate;
- métricas por estrato;
- lista de desacuerdos.

El false merge rate usa únicamente merges automáticos con juicio humano resuelto.

---

## 16. Interpretación

Un gate humano verde significa que:

- todos los merges automáticos de la muestra fueron revisados;
- ninguno fue refutado por juicio humano;
- existe suficiente cobertura humana para estimar fragmentación;
- los casos dudosos permanecen explícitos.

No significa que:

- 215 mil perfiles hayan sido auditados individualmente;
- OpenAlex sea infalible;
- todos los false splits hayan sido corregidos;
- la bibliografía ya sea exhaustiva.

---

## 17. Siguiente fase

Después de completar y versionar los juicios humanos, la siguiente decisión arquitectónica debe basarse en el resultado real:

### Si falseMergeCount > 0

- bloquear Author Profile V2;
- corregir Identity Resolution;
- reconstruir batch;
- repetir benchmark y auditoría.

### Si falseMergeCount = 0 pero existen false splits

- conservar seguridad;
- estudiar reglas de merge adicionales basadas en evidencia B/C;
- usar los false splits humanos como fixtures;
- no convertir similitud nominal en regla de fusión.

### Si el gate humano pasa

Entonces puede comenzar **Author Profile V2**, consumiendo AuthorityPerson estable y mostrando incertidumbre/coverage de forma explícita.
