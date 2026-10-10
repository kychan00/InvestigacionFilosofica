# Semantic metadata hygiene and work identity audit V1

Status: prospective audit-only contract.

## Boundary

This layer inspects already returned result records. It does not modify the
source corpus, embeddings, FAISS index, semantic scores, candidate membership,
ranking order or production API.

No human relevance labels are inputs. Findings from the public smoke motivated
the engineering question but are not used to tune a model or threshold.

## Findings

The audit records, without rewriting source values:

- missing titles;
- literal HTML markup in title or abstract;
- conservative indicators of likely mojibake.

Source metadata and source IDs remain authoritative and unchanged. Display
sanitization is only a recommended downstream action.

## Duplicate identity

V1 deliberately separates two classes:

1. `exact_identity`: records share a normalized DOI or exact normalized
   title/year/abstract content. They are eligible for conservative presentation
   collapse while preserving every member ID.
2. `probable_same_work`: records share an exact normalized title and year, but
   not enough evidence for automatic collapse. They are review-only.

The first-ranked record is named as a possible representative solely to preserve
the source order. No score is recomputed and no representative is promoted.

## Outputs

`scripts/retrieval/audit_result_hygiene.py` accepts a frozen smoke JSONL and
writes only JSON, JSONL and log files:

- `findings.jsonl`;
- `duplicate-groups.jsonl`;
- `summary.json`;
- `metadata.json` with input/output hashes and runner commit;
- `run.log`.

An output directory must not already exist. The source is read-only.

## Promotion gate

This audit does not authorize a production change. Before integrating any
collapse or display cleanup, freeze a separate prospective contract, test it on
synthetic and held-out records, and verify that all original identifiers remain
accessible.
