# Ranking v2 comparison

AI-silver comparison. Both pools are judged with the same AI policy/models, but this is not human-gold validation.

| Metric | Baseline | Ranking v2 | Delta |
|---|---:|---:|---:|
| precision5 | 0.444 | 0.5 | 0.056 |
| precision10 | 0.434 | 0.468 | 0.034 |
| recall10 | 0.5642 | 0.6055 | 0.0413 |
| ndcg10 | 0.5466 | 0.5692 | 0.0226 |
| mrr10 | 0.7064 | 0.7539 | 0.0475 |
| philosophyPrecision10 | 0.392 | 0.412 | 0.02 |

## P@10 by language

| Language | Baseline | Ranking v2 | Delta |
|---|---:|---:|---:|
| es | 0.6 | 0.63 | 0.03 |
| en | 0.23 | 0.26 | 0.03 |
| de | 0.29 | 0.32 | 0.03 |
| fr | 0.39 | 0.43 | 0.04 |
| pt | 0.66 | 0.7 | 0.04 |

## P@10 by intent

| Intent | Baseline | Ranking v2 | Delta |
|---|---:|---:|---:|
| philosopher-concept | 0.49 | 0.5033 | 0.0133 |
| work | 0.44 | 0.52 | 0.08 |
| interdisciplinary-challenge | 0.26 | 0.31 | 0.05 |

## Per-query P@10

- Improved: 16
- Worsened: 5
- Tied: 29

| Query | Lang | Intent | Baseline | Ranking v2 | Delta |
|---|---|---|---:|---:|---:|
| de-02 | de | work | 0.4 | 0.3 | -0.1 |
| en-03 | en | philosopher-concept | 0.4 | 0.3 | -0.1 |
| en-04 | en | philosopher-concept | 0.4 | 0.3 | -0.1 |
| de-07 | de | philosopher-concept | 0.3 | 0.2 | -0.1 |
| es-10 | es | interdisciplinary-challenge | 0.4 | 0.3 | -0.1 |
| en-01 | en | philosopher-concept | 0.2 | 0.3 | 0.1 |
| fr-01 | fr | philosopher-concept | 0.4 | 0.5 | 0.1 |
| fr-02 | fr | work | 0.8 | 0.9 | 0.1 |
| pt-03 | pt | philosopher-concept | 0.7 | 0.8 | 0.1 |
| en-05 | en | philosopher-concept | 0 | 0.1 | 0.1 |
| de-08 | de | work | 0.2 | 0.3 | 0.1 |
| fr-08 | fr | work | 0.2 | 0.3 | 0.1 |
| en-09 | en | interdisciplinary-challenge | 0.1 | 0.2 | 0.1 |
| pt-09 | pt | interdisciplinary-challenge | 0.5 | 0.6 | 0.1 |
| de-10 | de | interdisciplinary-challenge | 0 | 0.1 | 0.1 |
| fr-10 | fr | interdisciplinary-challenge | 0.2 | 0.3 | 0.1 |
| es-02 | es | work | 0.4 | 0.6 | 0.2 |
| pt-02 | pt | work | 0.5 | 0.7 | 0.2 |
| en-08 | en | work | 0.1 | 0.3 | 0.2 |
| es-09 | es | interdisciplinary-challenge | 0.3 | 0.5 | 0.2 |
| de-03 | de | philosopher-concept | 0.2 | 0.5 | 0.3 |
