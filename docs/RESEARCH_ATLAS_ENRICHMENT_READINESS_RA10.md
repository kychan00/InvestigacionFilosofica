# RA10 — Enrichment Readiness y publicación condicionada

## Estado

**Fase RA10 — gate previo a activar Author Authority y Related Work masivos en el Atlas principal.**

RA9 ya integró:

`SearchResponse → Resultados ⇄ Atlas`

RA10 no rompe ese flujo.

Su objetivo es impedir que el Atlas promueva evidencia todavía no publicada o no auditada.

---

## 1. Hallazgo de estado

### Author Authority

La release fuente real existe:

- tag: `author-index-v3`;
- asset: `author-index-v3.tar.gz`;
- SHA-256:
  `f04eb636744f4cce7f694b1d64eab19acfbccae7a5b588b4f6102e1006930e7d`.

El benchmark masivo documentado está verde:

- false merges deterministas: 0;
- false splits por ORCID compartido: 0;
- perfiles perdidos: 0;
- cobertura fuente exacta.

Pero el gate humano V1 todavía no está cerrado.

Falta versionar:

`benchmark/author-authority/human-audit-v1/judgments.jsonl`

con los 100 pares juzgados.

Por tanto:

> Author Authority masivo NO se activa todavía en el navegador.

---

## 2. Human Authority Audit

El sample congelado contiene:

- 100 pares;
- 200 perfiles;
- 13 merges automáticos;
- SHA-256:
  `6265acd4e74f62719fab813078b33146ad363236244d4ff2a7c58c3e6cbdd585`.

La publicación futura exige:

- todos los pares juzgados;
- mínimo 80 resueltos;
- los 13 merges automáticos resueltos;
- falseMergeCount = 0.

Un solo false merge bloquea.

---

## 3. Related Work

El runtime shardeado existe.

El full index todavía no existe como artefacto publicado.

El builder maestro exige exactamente:

### FAISS

`31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68`

### Metadata SQLite

`e32ad6066434f7fba9cd4df9211c6e45461e34c27bf5d113ccaa581fcf59d0`

### Static V4 manifest

`0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa`

La documentación actual no contiene una URL pública recuperable del FAISS maestro exacto.

Por tanto:

> no se reconstruye el full index desde un sustituto.

---

## 4. Dataset de publicación

Los enriquecimientos derivados se publicarán dentro del dataset existente:

`CristianPelayo/openalex-philosophy`

en Hugging Face.

Esto mantiene juntos:

- corpus filosófico;
- metadata estática;
- índices derivados;
- genealogía de revisiones.

No cambia la fuente canónica del corpus.

---

## 5. Readiness manifest

Archivo:

`benchmark/research-atlas/v10/enrichment-readiness.json`

Describe por separado:

- fuente;
- benchmark;
- auditoría;
- full build;
- publicación.

El estado actual es válido pero bloqueado.

---

## 6. Evaluador

Módulo:

`src/core/research-atlas-enrichment-readiness.js`

Funciones:

- `validateResearchAtlasEnrichmentReadiness()`;
- `evaluateResearchAtlasEnrichmentReadiness()`;
- `assertResearchAtlasEnrichmentActivation()`.

La última función debe fallar si producción intenta activar una capa no lista.

---

## 7. Dos gates distintos

RA10 distingue:

### prepublicationReady

Significa que el artefacto ya puede construirse/publicarse con seguridad.

### ready

Significa que además:

- está publicado;
- tiene revisión inmutable;
- manifest está pinneado por SHA;
- registry está pinneado cuando aplica.

Un artefacto no entra al navegador sólo porque pudo construirse localmente.

---

## 8. Estado actual de Author Authority

Bloqueos pre-publicación:

- human-audit-judgments-not-versioned;
- human-audit-gate-not-passed;
- human-audit-zero-false-merges-not-established.

Bloqueos de runtime adicionales:

- authority-artifact-not-published;
- authority-publication-not-pinned.

---

## 9. Estado actual de Related Work

Bloqueos pre-publicación:

- original-faiss-not-recoverable;
- full-related-work-index-not-built;
- full-related-work-index-not-validated;
- full-related-work-manifest-not-pinned.

Bloqueos de runtime adicionales:

- related-work-artifact-not-published;
- related-work-publication-not-pinned.

---

## 10. Publicador Hugging Face

Script:

`scripts/research-atlas/publish_enrichment_to_hf.py`

Sólo acepta destinos bajo:

`research-atlas/`

El script:

1. exige `manifest.json`;
2. calcula SHA-256 del manifest;
3. calcula SHA-256 de registry cuando existe;
4. sube la carpeta completa;
5. exige que Hugging Face devuelva un commit OID;
6. guarda evidencia en JSON.

El commit OID debe usarse después como revisión inmutable.

---

## 11. Token

El workflow de publicación utiliza:

`HF_TOKEN`

como GitHub Actions secret.

RA10 no contiene el token.

RA10 no intenta leerlo.

Si no existe, la publicación falla antes de afirmar éxito.

---

## 12. Workflow Authority

Archivo:

`.github/workflows/research-atlas-authority-publish-v1.yml`

Es manual.

Secuencia:

1. exige `judgments.jsonl`;
2. descarga `author-index-v3`;
3. verifica SHA;
4. reconstruye el packet humano congelado;
5. analiza juicios;
6. bloquea false merges;
7. construye 256 shards de autoridad;
8. valida manifest/registry;
9. publica en Hugging Face;
10. conserva evidencia.

---

## 13. Ruta futura Authority

Destino conceptual:

`research-atlas/author-authority/v1/<build-sha>/`

Luego se debe fijar:

- Hugging Face commit OID;
- baseUrl `resolve/<oid>/...`;
- manifest SHA;
- registry SHA.

Sólo después:

`authorAuthority.ready = true`.

---

## 14. Related Work no se publica todavía

RA10 no crea un workflow que fabrique el full Related Work Index con un FAISS diferente.

Primero hay que recuperar o republicar el FAISS original exacto.

La política es:

`SHA correcto o no hay build`.

---

## 15. Producción RA9

Mientras RA10 permanezca bloqueado:

- autores continúan como AuthorMention cuando no existe autoridad cargada;
- lexical-neighbor permanece disponible;
- semantic-neighbor sólo aparece con evidencia real;
- no se inventa Related Work L1;
- Resultados ⇄ Atlas sigue funcionando.

---

## 16. Gate RA10

RA10 se cierra cuando:

1. readiness config es válido;
2. estado actual se reporta BLOCKED;
3. activar Authority hoy lanza error;
4. activar Related Work hoy lanza error;
5. configuración futura completa puede pasar;
6. publicación sin revisión/checksum es inválida;
7. workflow Authority exige auditoría humana;
8. publicador sólo usa `CristianPelayo/openalex-philosophy` por default;
9. CI no requiere secretos;
10. suite completa permanece verde.

---

## 17. Próximos desbloqueos

### Authority

El siguiente acto no es programático:

> completar los 100 juicios humanos.

Después puede ejecutarse el workflow de publicación.

### Related Work

El siguiente acto técnico es:

> localizar el FAISS maestro con SHA
> `31b82528...`

o republicar exactamente esos bytes.

Sólo entonces se ejecuta full build, validación y publicación.

---

## 18. Regla epistemológica

RA10 formaliza una idea simple:

> que podamos dibujar una relación no significa que tengamos derecho a afirmarla.

El Atlas puede permanecer incompleto.

No puede permanecer ambiguamente “completo” usando evidencia no auditada.
