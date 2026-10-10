# Semantic corpus identity audit v1

This gate measures exact duplicate identities across the frozen V3.3 metadata
database before presentation hygiene can be connected to the serving API.

## Frozen policy

- Open the source SQLite database as read-only and immutable.
- Exact identity means either a normalized DOI or the exact normalized tuple
  title + year + abstract.
- Never infer probable identity from title similarity.
- Flag a repeated DOI for review when its members disagree on normalized
  title/year or exact normalized content.
- Do not run embedding or reranker inference.
- Do not use human labels.
- Do not modify scores, ranking, retrieval, production, or the source corpus.

The runner verifies the complete source database SHA-256 and expected document
count before accepting a run. It writes only JSON, JSONL, and a log.

## Outputs

- `duplicate-groups.jsonl`: every connected exact-identity component, including
  all member identifiers and bibliographic provenance.
- `review-sample.jsonl`: the first 25 groups ordered by deterministic group ID.
- `summary.json`: corpus, hygiene, duplicate, collapse, and conflict counts.
- `metadata.json`: frozen inputs, runner commit, plan, and output hashes.
- `run.log`: start, every 50,000 scanned records, and completion.

The audit result is evidence for a later serving decision. Passing this gate
does not authorize an API or production change.
