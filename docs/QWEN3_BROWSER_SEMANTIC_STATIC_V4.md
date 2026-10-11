# Qwen3 browser semantic static v4

**Status:** retrieval gate passed; static build authorized
**Frozen on:** 2026-10-10
**Production impact:** none

V4 is an adaptive engineering follow-up, not a confirmatory experiment. V3
established that fp16 WebGPU reproduces the canonical query embedding almost
exactly, while the 256-dimensional corpus representation lost too much ranking
information. V4 therefore keeps all 1,024 dimensions and changes nothing else.

Document vectors remain compressed from float32 to signed int8. The projected
complete vector-and-ID payload is 464,474,044 bytes (442.96 MiB), divided into
256 semantic shards. Each query selects exactly 32 shards. The browser model is
the same pinned 1,200,510,818-byte fp16 export validated in v3.

The greater download is an explicit product tradeoff, but the architecture
remains free, static and independent of an always-on laptop. V4 must still pass
the unchanged parity and retrieval-preservation gates before any full artifacts
are published or any production integration is considered.

Machine-readable contract:
`benchmark/semantic-retrieval/browser-static-v4/preregistration.json`.

## Result

V4 passed every gate on 2026-10-10. Full-corpus mean Recall@10 was `0.96`, the
minimum query Recall@10 was `0.90`, and mean Recall@50 was `0.948`. Browser
embedding parity remained `0.999722` on average. The projected full vector
payload is 464,474,044 bytes; the largest 32-shard query selection was
69,356,076 bytes.

The next authorized step is deterministic construction and independent hash
validation of the static vectors, centroids and compact metadata. Production
and the existing public semantic service remain unchanged.
