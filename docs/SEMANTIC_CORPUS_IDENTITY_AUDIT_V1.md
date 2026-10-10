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

## Frozen V3.3 result

The frozen runner commit is `3b5e21ff32c2dd831ea6dd1c2a5fe6ecbf1e0ee9`.
It audited all 451,823 records from metadata database SHA-256
`e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0`.

The result contains 9,266 exact-content groups and 21,351 member records. A
conservative presentation collapse would remove 12,085 repeated rows while
retaining every source ID and score in provenance. The largest component has
471 members. There are no DOI records in this corpus version, so DOI conflict
behavior was tested synthetically but was not exercised by the full run.

Metadata findings across the corpus are:

- 12,284 literal HTML findings;
- 1,767 suspected mojibake findings;
- 751 missing titles.

Independent validation found every source row, reproduced every exact-content
hash, confirmed that no member ID belongs to two groups, and found no author
metadata variation or non-empty author conflict inside a group. It found 935
groups with publication-type variation; this reinforces the requirement to
retain every member's provenance rather than rewrite the canonical metadata.

An initial invocation used an incorrectly transcribed expected database hash
and stopped at the hash gate before creating the output directory or scanning
documents. The accepted run used the hash already recorded by the index and
public-serving receipts.

Frozen output hashes:

- `duplicate-groups.jsonl`:
  `37d7b465fe92f366db5e3261baa40079f2ae08b05a5102279d8813f20683191a`
- `review-sample.jsonl`:
  `d2823e5b75a32bdf0700de0385b566a9a7091ad7a285bd26b3999983957e996d`
- `summary.json`:
  `1d7adbb990be413631f8bbd978e2ad1e2205445a9cf9e474ee8d549610b9c65a`
- `run.log`:
  `7ebe235821a09c559eae60f21975fa3e7aedb9482b67a6ebfdac12c9e28d9918`

Status: corpus-wide identity gate passed. Serving integration remains a
separate, default-off change and is not authorized by this result alone.
