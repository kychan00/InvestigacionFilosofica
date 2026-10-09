# Semantic reranker bounded V1

This directory contains the frozen human-facing package for the bounded
full-index semantic/reranker comparison preregistered in
`docs/SEMANTIC_RERANKER_BOUNDED_V1.md`.

## Shareable with a reviewer

- `blind-audit.jsonl`
- the judgment instructions in the preregistration

The 59 audit rows contain no condition, rank, score or membership provenance.
Judgment fields are blank.

## Internal provenance

- `freeze-metadata.json` records the hashes and completed execution contract.
- `runtime-metadata.json` is the exact runner-produced metadata.
- The A/B artifact remains outside Git under the ignored artifacts tree. Its
  SHA-256 is recorded, but its contents must not be shown to the reviewer until
  judgments are frozen.

No file in this directory changes production or authorizes deployment.
