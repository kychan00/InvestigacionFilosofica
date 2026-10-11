# Qwen3 browser semantic static v4 result

**Decision:** `PASS`
**Executed:** 2026-10-10
**Artifact status:** published and browser-validated
**Production impact:** none

V4 retained all 1,024 dimensions, quantized frozen document vectors to signed
int8 and kept the 256-cluster/32-probe routing design. Every frozen gate passed.

| Gate | Observation |
| --- | --- |
| Browser execution | fp16 WebGPU, Apple `metal-3`, non-fallback |
| Embedding parity | mean cosine `0.999722`; minimum `0.999697` |
| Prototype retrieval | mean Recall@10 `0.96`; mean Recall@50 `0.96` |
| Full-corpus retrieval | mean Recall@10 `0.96`; minimum `0.90`; mean Recall@50 `0.948` |
| Static payload | vectors `464,474,044` bytes; centroids `1,048,576` bytes; maximum selected shards `69,356,076` bytes |

The result authorizes immutable static artifact construction and browser
validation. It does not by itself authorize a production switch. The fp16
model's 1,200,510,818-byte cold download remains a significant usability
tradeoff that must be shown to users before any later opt-in integration.

Recall measures identifier overlap against the exact frozen FAISS ranking. It
is not a human relevance score. No human labels, reranker or generative model
were used.

## Static artifact publication

The deterministic builder reconstructed the frozen 451,823-document FAISS
corpus, retained all 1,024 normalized dimensions, quantized document vectors
to signed int8 and emitted 256 immutable semantic shards plus 883 deterministic
gzip JSONL metadata pages. The manifest SHA-256 is
`0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa`.

The public Hugging Face dataset revision is
`5a4a195085de54bf607a6c4397092ffb32716dcc`. Its tree contains exactly the
1,397 files declared by the manifest, with no missing, extra or size-mismatched
files. Chrome then loaded the public centroids, shards and metadata and exactly
reproduced the 50 frozen V4 result IDs for every one of the five benchmark
queries.

Canonical records in this directory:

- `artifact-manifest.json`: full immutable file inventory and hashes;
- `artifact-validation.json`: independent local content/ranking validation;
- `browser-search-local.json`: real-browser validation against local files;
- `browser-search-remote.json`: real-browser validation against public files;
- `publication.json`: immutable remote location and publication lineage.

Model weights were not uploaded or committed. The browser continues to load
the pinned upstream ONNX model directly from its model repository. The new
search loader is not wired into production in this commit.
