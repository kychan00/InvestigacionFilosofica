# Qwen3 browser semantic static v4

**Status:** static artifacts published and browser-validated
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
remains free, static and independent of an always-on laptop.

Machine-readable contract:
`benchmark/semantic-retrieval/browser-static-v4/preregistration.json`.

## Result

V4 passed every gate on 2026-10-10. Full-corpus mean Recall@10 was `0.96`, the
minimum query Recall@10 was `0.90`, and mean Recall@50 was `0.948`. Browser
embedding parity remained `0.999722` on average. The projected full vector
payload is 464,474,044 bytes; the largest 32-shard query selection was
69,356,076 bytes.

## Published static corpus

The deterministic build completed and its independent validator passed:

- 451,823 unique sequential vector IDs;
- 256 complete signed-int8 vector shards;
- 883 deterministic compressed metadata pages;
- 1,397 files and no missing or extra paths remotely;
- manifest SHA-256
  `0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa`.

The immutable public dataset revision is
`5a4a195085de54bf607a6c4397092ffb32716dcc`. A real Chrome run loaded the
published artifacts and exactly reproduced all 50 frozen V4 result IDs for all
five benchmark queries. This establishes that retrieval can run without the
Mac or a paid server once the query embedding model is cached or loaded in the
browser.

The browser model is still a roughly 1.12 GiB cold download. Any product
integration must therefore be explicit opt-in, show download/progress state,
and preserve the existing search path as the default and fallback. Production
and the existing public semantic service remain unchanged at this milestone.
