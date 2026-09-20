# Qwen3 512-token development ranking comparison

- Status: failed
- Reference max length: 4096
- Candidate max length: 512
- Queries: 50
- Query-document pairs: 1000

## Primary gate

Exact Top-10 membership equality: 44/50

PASS requires: 50/50

Primary gate passed: false

## Secondary metrics

- Top-5 membership equal queries: 44/50
- Top-5 changed queries: 6/50
- Top-5 symmetric-difference memberships: 12
- Top-10 membership equal queries: 44/50
- Top-10 changed queries: 6/50
- Top-10 symmetric-difference memberships: 12
- Mean Top-10 overlap: 9.88
- Minimum Top-10 overlap: 9
- Mean absolute rank shift: 0.17
- Maximum absolute rank shift: 8
- Same-rank documents: 870/1000
- Score Pearson correlation: 0.9986107663826347
- Score Spearman correlation: 0.9986620602308067

## Boundaries

This is a development-only truncation comparison. No human relevance labels, fresh ranking holdout, model inference, browser q8 inference, or production ranking changes are part of this analysis.
