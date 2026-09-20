# Qwen3 1024-token development ranking comparison

- Status: passed
- Reference max length: 4096
- Candidate max length: 1024
- Queries: 50
- Query-document pairs: 1000

## Primary gate

Exact Top-10 membership equality: 50/50

PASS requires: 50/50

Primary gate passed: true

## Secondary metrics

- Top-5 membership equal queries: 48/50
- Top-5 changed queries: 2/50
- Top-5 symmetric-difference memberships: 4
- Top-10 membership equal queries: 50/50
- Top-10 changed queries: 0/50
- Top-10 symmetric-difference memberships: 0
- Mean Top-10 overlap: 10
- Minimum Top-10 overlap: 10
- Mean absolute rank shift: 0.02
- Maximum absolute rank shift: 5
- Same-rank documents: 986/1000
- Score Pearson correlation: 0.9992102080368596
- Score Spearman correlation: 0.9998963645450404

## Boundaries

This is a development-only truncation comparison. No human relevance labels, fresh ranking holdout, model inference, browser q8 inference, or production ranking changes are part of this analysis.
