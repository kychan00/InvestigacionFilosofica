# Semantic presentation hygiene held-out V1

Status: `HELDOUT_VALIDATION_PASSED_NO_PRODUCTION_CHANGE`.

## Contract

- Runner commit: `104800c40375062ab6144964bdf6b1ec67301aa1`.
- Source: ranks 11–15 of the existing full-index hybrid benchmark.
- Exclusion: every ID in the frozen public Top 10 smoke.
- Source documents: 25 across five queries.
- Human labels: none.
- Collapse policy: exact identity only.
- Probable identity: never collapse.
- Display cleanup: HTML entities and literal tags only.
- Missing title: display-only `Sin título` fallback.

## Validation result

- excluded-ID overlap: 0;
- source IDs preserved: 25/25;
- original source ranks preserved: 11–15;
- scores modified: 0;
- source order recomputed: no;
- exact groups in held-out slice: 0;
- false collapses: 0;
- metadata findings in held-out slice: 0.

The held-out slice therefore exercised the no-op path: every result remained a
singleton and the transform preserved the complete source result. Synthetic
tests separately exercise exact collapse, probable non-collapse, HTML cleanup,
missing-title fallback, immutability and score provenance. The full suite passed
44 tests.

## Corrected provenance

The first execution was rejected because member `source_rank` values were
relative to the five-row slice. It is preserved under
`presentation-hygiene-heldout-v1-invalid-attempt-1/`. The correction was frozen
before this accepted execution and preserves the original ranks 11–15.

## Hashes

- source hybrid JSONL:
  `f2df77553c47caa8d9b3ba6595f895489d6ce397415937e31f524cd8ef40e928`;
- excluded public smoke JSONL:
  `ad2f581a1c5714721b088ff24c716876c86bdba6b531abc6200349875cf0490e`;
- presented results JSONL:
  `8168219296c924c846c0bc7bb367d05c6aaa1be95b792145b9394297c0094651`;
- summary JSON:
  `373e719bc390171de05d9facc18304d159b9f196a75e8a48a32499f9c63d3b8d`.

## Boundary

This validates deterministic transformation and provenance on a small held-out
slice. It does not measure relevance, prove corpus-wide duplicate safety or
authorize API/frontend integration.
