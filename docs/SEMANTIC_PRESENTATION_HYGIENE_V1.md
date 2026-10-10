# Semantic presentation hygiene V1

Status: prospective, experimental and not connected to production.

## Contract

The layer receives an ordered list of result dictionaries and returns a new
presentation list. It never mutates the source records.

- HTML entities are decoded and literal HTML tags are stripped only in
  `display.title` and `display.abstract`.
- A missing title receives the display-only fallback `Sin título`; the source
  title remains empty.
- Only `exact_identity` groups may collapse.
- `probable_same_work` is never collapsed.
- The first source result remains the representative, preserving the ranking
  decision rather than recomputing it.
- Every member ID, source rank and available score remains in
  `work_identity.members`.
- No model, human label, threshold tuning or score blending is used.

Exact identity retains the previously frozen definition: shared normalized DOI
or exact normalized title, year and abstract.

## Validation design

Synthetic tests cover exact collapse, probable non-collapse, display-only HTML
cleanup, missing-title fallback, score provenance, immutability and overlap
rejection.

The held-out material is fixed prospectively as ranks 11–15 from the existing
full-index hybrid benchmark. Every selected ID must be absent from the frozen
public Top 10 smoke. The input artifact and excluded smoke are fingerprinted in
metadata. The held-out rows contain no relevance labels.

The first held-out execution was rejected before freeze because member
`source_rank` values were relative to the five-row slice instead of the
original benchmark ranks. Its outputs are preserved as an invalid attempt. The
correction changes provenance numbering only; it does not change identity,
sanitization, collapse policy, scores or source order.

## Outputs

`scripts/retrieval/build_presentation_hygiene.py` writes JSON/JSONL/logs only:

- `presented-results.jsonl`;
- `summary.json`;
- `metadata.json`;
- `run.log`.

The output directory must not already exist. The runner refuses any overlap
with the excluded Top 10 IDs.

## Boundary

Passing this validation demonstrates deterministic transformation and
provenance preservation. It does not establish ranking quality and does not by
itself authorize API or frontend integration.
