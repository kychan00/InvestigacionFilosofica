# Semantic metadata hygiene and work-identity audit V1

Status: `AUDIT_COMPLETE_NO_PRODUCTION_CHANGE`.

## Lineage

- Frozen runner commit: `39c5b21c8a688c27207a64b24dbd58268271dd56`.
- Source: `benchmark/semantic-retrieval/public-smoke-v1/results.jsonl`.
- Source SHA-256:
  `ad2f581a1c5714721b088ff24c716876c86bdba6b531abc6200349875cf0490e`.
- Queries: 5.
- Result records: 50.
- Human labels used: no.
- Scores or order modified: no.

## Result

The audit found five metadata findings:

- one missing title;
- one field with literal HTML markup;
- three fields with suspected mojibake, distributed across two documents.

It also found:

- one `exact_identity` group with two OpenAlex IDs. The records have exact
  normalized title, year and abstract content and are eligible for a future
  conservative presentation collapse;
- one `probable_same_work` group with three OpenAlex IDs, including the exact
  pair. It shares normalized title and year but remains review-only.

The first-ranked record is listed as representative only to preserve the
source order. No record was promoted, removed or rewritten, and every source ID
remains present in the frozen smoke.

## Outputs

- `findings.jsonl`: field-level anomaly receipts.
- `duplicate-groups.jsonl`: exact and probable work-identity groups.
- `summary.json`: aggregate counts and non-mutation assertions.
- `metadata.json`: runner commit and input/output SHA-256 hashes.
- `run.log`: bounded execution receipt.

## Interpretation

This is an engineering audit, not a relevance evaluation. It does not authorize
production integration, score changes, model tuning or automatic collapse of
the probable group. A production-facing hygiene layer requires a separately
frozen prospective contract and validation on records not used to design this
audit.
