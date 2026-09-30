# Qwen3 reranker — fresh holdout validation

> Fresh 100-pair multilingual holdout. Qwen scores and binary predictions were frozen before the human judgments were frozen. The candidate threshold was fixed from development and was not retuned on this holdout.

- Pairs: 100
- Human relevant (>=2): 80
- Human non-relevant (<2): 20
- Frozen threshold: 0.679178715
- ROC AUC: 0.90625
- Average precision: 0.977982
- Spearman vs human 0–3: 0.590891

## Frozen-threshold performance

| Accuracy | Precision | Recall | Specificity | F1 | Balanced acc. | Kappa | TP | FP | TN | FN |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.83 | 0.970149 | 0.8125 | 0.9 | 0.884354 | 0.85625 | 0.572864 | 65 | 2 | 18 | 15 |

## Development reference

- Development best-F1 threshold: 0.679178715
- Development F1 at that threshold: 0.890756
- Fresh holdout F1 at the frozen same threshold: 0.884354
- F1 delta (holdout - development): -0.006402

## Breakdown by intent

- interdisciplinary-challenge: n=25, F1=0.6875, precision=0.916667, recall=0.55, balanced_accuracy=0.675
- philosopher-concept: n=50, F1=0.944444, precision=0.971429, recall=0.918919, balanced_accuracy=0.920998
- work: n=25, F1=0.930233, precision=1, recall=0.869565, balanced_accuracy=0.934783

## Error profile

- False positives: 2
- False negatives: 15
- Full error rows, language/family breakdowns, and immutable source hashes are preserved in the JSON report.

## Interpretation boundaries

- The threshold was selected only on development labels and was not retuned on this holdout.
- Human judgments were frozen after Qwen raw scores and predictions were frozen.
- The holdout has 80% binary-positive human labels, so accuracy and average precision should be interpreted alongside specificity, balanced accuracy, kappa, ROC AUC, and the confusion matrix.
- One human adjudicator supplied the labels.
- The adjudicator used some external bibliographic/source checking while judging individual cases; the judgment metadata records this protocol note.
- Before manual adjudication, the adjudicator had previously seen document titles/abstracts during a dataset check, but not Qwen outputs, retrieval ranks, production scores, or provider provenance.
- This validates the Qwen relevance classifier/score on the sampled query-document pairs; it does not by itself validate an end-to-end production reranking integration.

