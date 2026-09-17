# Qwen3 reranker calibration — development set

> These 100 human-labeled pairs are development data for Qwen calibration/model selection. They are not an independent validation set for Qwen.

- Pairs: 100
- Human relevant (>=2): 60
- Human non-relevant (<2): 40
- Qwen ROC AUC: 0.920833
- Qwen average precision: 0.933997
- Qwen Spearman vs 0–3 human relevance: 0.723966

## Binary comparison

| System | Threshold | Accuracy | Precision | Recall | F1 | Balanced acc. | Kappa |
|---|---:|---:|---:|---:|---:|---:|---:|
| Qwen | 0.5 | 0.82 | 0.808824 | 0.916667 | 0.859375 | 0.795833 | 0.612069 |
| Qwen (dev best F1) | 0.679178715 | 0.87 | 0.898305 | 0.883333 | 0.890756 | 0.866667 | 0.73029 |
| Historical AI silver composite | relevance >= 2 | 0.5 | 0.589286 | 0.55 | 0.568966 | 0.4875 | -0.02459 |

## Historical AI coverage

- Composite rows: 100
- Ranking-v2 label used when available: 91
- Baseline fallback label used: 9
- Baseline-only matched comparison rows: 82
- Ranking-v2 matched comparison rows: 91

The composite is a convenience comparison because the human audit was sampled from the union of baseline and ranking-v2 pools. Separate matched-subset comparisons are retained in the JSON report.

## Interpretation boundary

- The best-F1 threshold is tuned on these same 100 human labels and must not be treated as independent validation performance.
- The human audit sample was drawn from the union of baseline and ranking-v2 pools, so neither historical silver file covers all 100 pairs by itself.
- The historical composite uses ranking-v2 silver when that pair exists and baseline silver only as a documented fallback.
- Qwen raw scores remain immutable; this report does not rewrite or discretize the raw score store.
- No production ranking code is changed by this analysis.

