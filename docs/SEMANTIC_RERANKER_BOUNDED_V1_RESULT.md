# Bounded full-index reranker comparison V1: inference freeze

**Local date:** 2026-10-09

**Status:** inference complete; blank blind audit frozen

The preregistered runner was frozen in
`385cf12476cc7fc030cfdb5e1b5b15a93fa4b494` before loading the reranker.
Its output-free preflight verified the query set, full index, metadata database,
Apple MPS device, batch size and absence of output files.

The single official execution completed:

- five fixed queries;
- 12 semantic candidates per query;
- 60 Qwen3 reranker pairs;
- batch size 1 on Apple MPS;
- 153.818 seconds total;
- five internal A/B rows;
- 59 unique blind union items.

No human label was available during retrieval or inference. Model weights
remained in the external Hugging Face cache.

## Frozen hashes

- Internal A/B JSONL:
  `2787efeb33c301ea3c83081fafffd3622073f01ad08e9f97f6b43eb0525c276a`.
- Blind audit JSONL:
  `53c68d09804c87d7764c8c4ca1698fb1c0898d12a41f98f4d0103ba841bfbcb4`.
- Exact runtime metadata:
  `99b855b42ddf178c9a5f43eea12e095492943952a5a0ca2326c23977ed17e0f2`.

The public blind package is under
`benchmark/semantic-retrieval/reranker-bounded-v1/`. Independent checks
confirmed 59 unique item IDs, blank judgments and absence of condition, rank,
semantic score, lexical score, reranker score and candidate-pool provenance.

The internal A/B contents remain under ignored artifacts and must not be shown
to the reviewer. No effect metric may be computed until the 59 judgments are
returned and frozen.

This milestone does not alter production, existing retrieval or the frontend.
