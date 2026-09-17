# Held-out multilingual A/B structural analysis

Structural only. No relevance labels are inferred. A=original-only; B=original plus safe multilingual expansion.

## Summary

- queries: 20
- rows: 800
- Top-10 shared query-document pairs: 166
- Top-10 union query-document pairs: 234
- mean Top-10 overlap per query: 8.3/10
- changed Top-10 query-document pairs: 68
- changed positions per side: 34
- mean Top-20 overlap per query: 15.8/20
- B Top-10 positions with translation provenance: 44/200
- B Top-10 translation-only positions: 30/200
- B-only Top-10 positions with translation provenance: 34
- median A/B save-time gap: 3.37s
- max A/B save-time gap: 22.96s

- English controls: mean overlap 10/10; changed pairs=0
- Non-English targets: mean overlap 7.88/10; changed pairs=68; B-only via translation=34

## Per query

| query | lang | control | A/B order | gap s | overlap@10 | changed | B translation@10 | B-only via translation |
|---|---|---|---|---:|---:|---:|---:|---:|
| val-es-01 · ética en inteligencia artificial | es | no | A→B | 4.04 | 10/10 | 0 | 0/10 | 0 |
| val-en-01 · ethics in artificial intelligence | en | yes | B→A | 1.90 | 10/10 | 0 | 0/10 | 0 |
| val-de-01 · Ethik in der künstlichen Intelligenz | de | no | A→B | 2.30 | 10/10 | 0 | 0/10 | 0 |
| val-fr-01 · éthique en intelligence artificielle | fr | no | B→A | 1.92 | 9/10 | 2 | 1/10 | 1 |
| val-pt-01 · ética em inteligência artificial | pt | no | A→B | 4.11 | 9/10 | 2 | 2/10 | 1 |
| val-es-02 · epistemología en psicología | es | no | B→A | 3.01 | 8/10 | 4 | 3/10 | 2 |
| val-en-02 · epistemology in psychology | en | yes | A→B | 2.02 | 10/10 | 0 | 0/10 | 0 |
| val-de-02 · Epistemologie in der Psychologie | de | no | B→A | 1.95 | 6/10 | 8 | 4/10 | 4 |
| val-fr-02 · épistémologie en psychologie | fr | no | A→B | 3.56 | 8/10 | 4 | 2/10 | 2 |
| val-pt-02 · epistemologia em psicologia | pt | no | B→A | 2.14 | 8/10 | 4 | 2/10 | 2 |
| val-es-03 · filosofía de la ciencia en física | es | no | A→B | 3.96 | 9/10 | 2 | 3/10 | 1 |
| val-en-03 · philosophy of science in physics | en | yes | B→A | 5.22 | 10/10 | 0 | 0/10 | 0 |
| val-de-03 · Wissenschaftstheorie in der Physik | de | no | A→B | 12.91 | 3/10 | 14 | 7/10 | 7 |
| val-fr-03 · philosophie des sciences en physique | fr | no | B→A | 18.65 | 3/10 | 14 | 8/10 | 7 |
| val-pt-03 · filosofia da ciência em física | pt | no | A→B | 5.65 | 9/10 | 2 | 1/10 | 1 |
| val-es-04 · lógica en lingüística | es | no | B→A | 1.46 | 7/10 | 6 | 5/10 | 3 |
| val-en-04 · logic in linguistics | en | yes | A→B | 3.19 | 10/10 | 0 | 0/10 | 0 |
| val-de-04 · Logik in der Linguistik | de | no | B→A | 4.97 | 10/10 | 0 | 0/10 | 0 |
| val-fr-04 · logique en linguistique | fr | no | A→B | 22.96 | 8/10 | 4 | 2/10 | 2 |
| val-pt-04 · lógica em linguística | pt | no | B→A | 1.83 | 9/10 | 2 | 4/10 | 1 |

## Audit requirement

Exact paired human ΔP@10 requires relevance labels only for the **68** changed query-document pairs. Shared Top-10 rows cancel exactly.

