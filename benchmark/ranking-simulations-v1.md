# Ranking simulations v1

Development-only simulation over the frozen silver benchmark. It is not an independent test and must not be presented as one.

> No profile uses abstract presence because the AI silver judge itself consumed abstracts; boosting abstract availability here would risk optimizing to judge availability rather than true relevance.

| Profile | P@5 | P@10 | ΔP@10 | Recall@10 | nDCG@10 | MRR@10 | P@10 improved/worsened queries |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline | 0.444 | 0.434 | 0 | 0.5642 | 0.5466 | 0.7064 | 0/0 |
| title_light | 0.46 | 0.434 | 0 | 0.5581 | 0.5571 | 0.7224 | 2/1 |
| curated_light | 0.472 | 0.452 | 0.018 | 0.6146 | 0.5631 | 0.7049 | 10/1 |
| title_curated | 0.488 | 0.456 | 0.022 | 0.596 | 0.579 | 0.7405 | 10/0 |
| cautious_crossref | 0.528 | 0.466 | 0.032 | 0.6369 | 0.6038 | 0.7499 | 17/3 |
| crossref_lowcov_075 | 0.516 | 0.464 | 0.03 | 0.6315 | 0.5958 | 0.7439 | 14/1 |
| crossref_lowcov_050 | 0.508 | 0.462 | 0.028 | 0.6282 | 0.5937 | 0.7454 | 12/0 |

## Profiles

- **baseline**: Frozen production order; no adjustment.
- **title_light**: Small title-query coverage boost only.
- **curated_light**: Small source prior for CUCSH and Internet Archive.
- **title_curated**: Title coverage plus small CUCSH/Internet Archive source prior.
- **cautious_crossref**: Title+curated profile and a very small unconditional Crossref penalty.
- **crossref_lowcov_075**: Title+curated profile; penalize Crossref only when original-query title coverage is below 0.75.
- **crossref_lowcov_050**: Title+curated profile; penalize Crossref only when original-query title coverage is below 0.50.

## By language — P@10

| Profile | es | en | de | fr | pt |
|---|---:|---:|---:|---:|---:|
| baseline | 0.6 | 0.23 | 0.29 | 0.39 | 0.66 |
| title_light | 0.6 | 0.21 | 0.29 | 0.39 | 0.68 |
| curated_light | 0.61 | 0.28 | 0.3 | 0.42 | 0.65 |
| title_curated | 0.62 | 0.24 | 0.3 | 0.42 | 0.7 |
| cautious_crossref | 0.62 | 0.26 | 0.31 | 0.44 | 0.7 |
| crossref_lowcov_075 | 0.63 | 0.25 | 0.31 | 0.43 | 0.7 |
| crossref_lowcov_050 | 0.63 | 0.25 | 0.31 | 0.42 | 0.7 |

## By intent — P@10

| Profile | philosopher-concept | work | interdisciplinary-challenge |
|---|---:|---:|---:|
| baseline | 0.49 | 0.44 | 0.26 |
| title_light | 0.4833 | 0.45 | 0.27 |
| curated_light | 0.51 | 0.45 | 0.28 |
| title_curated | 0.5033 | 0.48 | 0.29 |
| cautious_crossref | 0.5133 | 0.47 | 0.32 |
| crossref_lowcov_075 | 0.51 | 0.48 | 0.31 |
| crossref_lowcov_050 | 0.5067 | 0.48 | 0.31 |
