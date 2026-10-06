# Abstract coverage audit: OpenAlex Philosophy V3.3

**Date:** 2026-10-05

**Gate:** `PASS`

**Mass embedding build:** allowed only after the V3.3 real-model smoke

## Published contract

- Dataset: `CristianPelayo/openalex-philosophy`.
- Revision: `1c59478b679f5836ef6e8dce28b2d725d04f8e02`.
- Artifact: `v3.3/philosophy-corpus-v3-3-full.parquet`.
- Artifact SHA-256:
  `e01658d196516988b7f62efe2d4aa502a440b063cb0d1fa4b1d15fd99aaa2b47`.
- Artifact size: 368,307,196 bytes.
- Eligibility: `CORE` or `PROBABLE`, excluding `LOW_QUALITY` and `PARATEXT`.
- Capture JSONL SHA-256:
  `960e2d3dbeba746fb85219662b308e317a27c2a8165284212cb04a80802be1ac`.
- Raw-batch archive SHA-256:
  `e0faffebe4dcab5c9152047c516126964c488f303892f5663a1e08d7fd45dbcc`.

All V3.3 files and lineage were created in one Hugging Face commit. Remote LFS
sizes and SHA-256 values match the validated local artifacts.

## Capture result

The frozen API acquisition ran 2,444 consecutive batches over 244,353 unique
targets in V3.2 source order:

| Measure | Count |
| --- | ---: |
| Target IDs | 244,353 |
| IDs returned by current OpenAlex | 230,038 |
| Reconstructable abstracts | 82,905 |
| Missing ID or no abstract | 161,448 |
| HTTP status across batches | 200 only |

Every raw response, normalized batch, batch metadata file and hash is preserved
in `v3.3/lineage/`. Independent validation reproduced membership, order,
counts and hashes and confirmed that no API credential was persisted.

## Corpus invariants

The builder started from the pinned V3.2 artifact and changed only empty
`abstract` cells for the 82,905 captured IDs.

Independent validation confirmed:

- 822,445 rows before and after;
- identical Arrow schema;
- identical row order;
- exact equality of every non-abstract column;
- every existing non-empty abstract preserved;
- 82,905 target abstracts filled;
- 161,448 targets still missing.

## Coverage

| Measure | V3.2 | V3.3 |
| --- | ---: | ---: |
| Eligible rows | 451,823 | 451,823 |
| With non-empty abstract | 207,470 | 290,375 |
| Without abstract | 244,353 | 161,448 |
| Coverage | 45.918% | 64.267% |
| Abstract at least 200 characters | 200,265 | 279,535 |

Of V3.3 non-empty abstracts, 96.267% contain at least 200 normalized
characters. Useful-length coverage is 61.868% of all eligible records.

| Length bin | V3.3 count |
| --- | ---: |
| 0 | 161,448 |
| 1–49 | 2,844 |
| 50–199 | 7,996 |
| 200–499 | 34,786 |
| 500–999 | 102,679 |
| 1000+ | 142,070 |

## Manual sample review

The seeded 50-item samples showed no systematic inverted-index reconstruction
corruption. Full abstracts are predominantly substantive scholarly summaries,
with some source-level repository descriptions, book reviews and metadata-rich
records. The 1–199 character sample remains mostly previews, access notices,
repository notes and bibliographic fragments; it should be treated as
suspicious source text, not as guaranteed abstract content.

The remaining 161,448 empty records and 10,840 short records are retained
explicitly. They are not silently replaced, generated, translated or removed.

## Gate decision

`PASS`

The timestamped API capture exhausted the frozen target set without alternative
source substitution. It increased coverage by 82,905 records, preserved all
V3.2 invariants and did not introduce systematic reconstruction corruption.
The complete generated audit has SHA-256
`89e7b3f9fcb6dbd1f639a178e5426824110da1659a5678905e692337ea51574b`.

This PASS approves V3.3 as semantic retrieval input. It does not approve a
production ranking change. The next required gate is a 20–100 document
real-model smoke from the pinned V3.3 revision; only after that passes may the
offline full embedding job begin.
