# Error analysis v1 — ranking baseline

This report is diagnostic. It uses the frozen silver benchmark and must not be presented as an independent test set.

## Baseline

- P@5: 0.444
- P@10: 0.434
- Recall@10: 0.5642
- nDCG@10: 0.5466
- MRR@10: 0.7064

## Error budget

- Top-10 false positives: 283/500
- Relevant documents trapped at ranks 11–20: 181
- Query-local swaps available inside the frozen pool: 125
- Oracle P@10 upper bound inside the frozen Top-20 pools: 0.684

## Worst queries

| Query | Lang | Intent | P@10 | nDCG@10 | FP Top10 | Relevant 11–20 | Swaps |
|---|---|---|---:|---:|---:|---:|---:|
| Ontologie in der Informatik | de | interdisciplinary-challenge | 0 | 0 | 10 | 2 | 2 |
| alterity in Levinas | en | philosopher-concept | 0 | 0.1527 | 10 | 1 | 1 |
| phénoménologie en soins infirmiers | fr | interdisciplinary-challenge | 0.1 | 0.4796 | 9 | 3 | 3 |
| Phenomenology of Spirit Hegel | en | work | 0.1 | 0.6589 | 9 | 2 | 2 |
| phenomenology in nursing | en | interdisciplinary-challenge | 0.1 | 1 | 9 | 0 | 0 |
| ontologie en informatique | fr | interdisciplinary-challenge | 0.2 | 0.187 | 8 | 2 | 2 |
| freedom in Kant | en | philosopher-concept | 0.2 | 0.2983 | 8 | 2 | 2 |
| altérité chez Levinas | fr | philosopher-concept | 0.2 | 0.3264 | 8 | 3 | 3 |
| Phänomenologie in der Pflege | de | interdisciplinary-challenge | 0.2 | 0.3358 | 8 | 3 | 3 |
| Intentionalität bei Husserl | de | philosopher-concept | 0.2 | 0.3462 | 8 | 0 | 0 |
| Tugendethik bei Aristoteles | de | philosopher-concept | 0.2 | 0.3568 | 8 | 1 | 1 |
| substance in Spinoza | en | philosopher-concept | 0.2 | 0.4034 | 8 | 6 | 6 |
| Phénoménologie de l'esprit Hegel | fr | work | 0.2 | 0.4132 | 8 | 1 | 1 |
| Phänomenologie des Geistes Hegel | de | work | 0.2 | 0.4911 | 8 | 0 | 0 |
| Alterität bei Levinas | de | philosopher-concept | 0.2 | 0.8175 | 8 | 0 | 0 |

## Provider diagnostics

| Provider | Top10 rows | P@10-like precision | False positives | Relevant 11–20 |
|---|---:|---:|---:|---:|
| Crossref | 359 | 0.429 | 205 | 44 |
| OpenAlex Philosophy | 86 | 0.186 | 70 | 60 |
| Internet Archive | 49 | 0.8367 | 8 | 35 |
| CUCSH Filosofía | 6 | 1 | 0 | 42 |

## Feature diagnostics

| Slice | Rows in Top10 | Relevant | Precision |
|---|---:|---:|---:|
| title coverage >= 0.75 | 276 | 138 | 0.5 |
| title coverage 0.50-0.74 | 143 | 53 | 0.3706 |
| title coverage < 0.50 | 81 | 26 | 0.321 |
| abstract present | 166 | 139 | 0.8373 |
| abstract missing | 334 | 78 | 0.2335 |
| same language | 151 | 48 | 0.3179 |
| different/unknown language | 349 | 169 | 0.4842 |

## Methodological note

The oracle upper bound only asks how many currently misplaced relevant documents could replace false positives within each frozen Top-20 pool. It is not a proposed production algorithm and does not use documents outside the frozen candidate pool.
