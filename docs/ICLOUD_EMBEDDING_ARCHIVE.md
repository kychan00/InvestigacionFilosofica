# Free iCloud embedding archive

**Local date:** 2026-10-09

**100-document gate:** `PASS`

**Full V3.3 build:** `PASS`

## Purpose

This path keeps the semantic retrieval build free of paid compute and avoids
accumulating every embedding shard on the workstation. Qwen3 inference still
runs locally on Apple MPS. Each completed, closed shard is moved to iCloud,
verified, evicted from local storage and represented by its iCloud placeholder.

The workflow does not place model weights in Git or iCloud and does not change
production, existing retrieval or `src/core/rank.js`.

## Safety contract

For every file, the runner performs this sequence:

1. compute the local SHA-256;
2. move the closed shard into the configured iCloud tree;
3. wait until macOS reports `isUploaded=true`, no active upload and no conflict;
4. verify the uploaded file SHA-256;
5. evict only the local iCloud copy with
   `FileManager.evictUbiquitousItem`;
6. request a fresh download with
   `FileManager.startDownloadingUbiquitousItem`;
7. verify the downloaded SHA-256;
8. evict the verified local copy again.

The tool never calls ordinary deletion on the iCloud target. It refuses unsafe
relative paths, symlinks, conflicting destination content, unconfirmed uploads
and unresolved iCloud conflicts.

The local embedding `manifest.json` and `state.sqlite3` remain present because
they are the resumable build state. Verified copies are also archived to
iCloud. Completed shard files are the only items moved out of the local shard
directory.

## Frozen inputs

- Dataset: `CristianPelayo/openalex-philosophy`.
- Revision: `1c59478b679f5836ef6e8dce28b2d725d04f8e02`.
- File: `v3.3/philosophy-corpus-v3-3-full.parquet`.
- Embedding model: `Qwen/Qwen3-Embedding-0.6B`.
- Model revision: `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`.
- Dimension: 1,024.
- Device: Apple MPS.
- Embedding batch size: 1.

## Preflight result

A 54-byte probe completed upload, eviction, download, hash verification and a
second eviction. Its SHA-256 was
`7b1c03aa949706330e84acdbf286c2aa8a81982c710dce8108cfa9e940c7a36d`.

A second probe exercised the move-source path. After the verified roundtrip,
the source no longer existed locally and the iCloud placeholder reported:

- `isUbiquitous=true`;
- `isUploaded=true`;
- `isUploading=false`;
- no unresolved conflicts;
- downloading status `NotDownloaded`;
- zero allocated local blocks.

## 100-document smoke

Qwen3 embedded the first 100 eligible V3.3 documents in 46.00 seconds. The
builder produced four Parquet shards plus its manifest and SQLite state:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `manifest.json` | 1,673 | `90af4d8d28f3a6f1269b6ea99492d83c2480ae40e561f86e87a8460df5371738` |
| `part-000000000000-000000000030.parquet` | 262,467 | `386ca31bbb93adbe78d3c330bc96d921e2f48c8d1e61682fbbcdab1a32b6b5e2` |
| `part-000000000031-000000000047.parquet` | 151,950 | `5eaf006b29bca3bc96832ee24c44e966623eed343857a2a0c4c558411cfb88b1` |
| `part-000000000048-000000000077.parquet` | 250,440 | `2feb4b79274a473802054b4675716caffd67a4852e27db43f8db710a2d4a8b09` |
| `part-000000000078-000000000099.parquet` | 188,657 | `2f3065899799c4ac6c5a68f048b776cc126bce8ea48b502fa6dc71fe36d64505` |
| `state.sqlite3` | 36,864 | `1ce6b6bd81e33545fec89d1eaa305f1125e8b7a5cf7db7795c2cac915a9b3a8c` |

All six files passed upload, eviction, redownload and exact hash comparison.
They total 892,051 logical bytes and occupy zero allocated local blocks in the
iCloud tree after the final eviction.

The streaming runner then recovered the existing manifest, moved the four
local shards to a fresh iCloud prefix, confirmed 100 unchanged documents and
archived verified manifest/state copies. Only the two small resumable-state
files remained in the local `embeddings/` directory.

## Full V3.3 build result

The guarded build completed on 2026-10-09 with the frozen V3.3 corpus and model
contracts. It produced embeddings for all 451,823 eligible documents in 402
ordered Parquet shards. The final shard contains vector IDs 450,626 through
451,822 and has SHA-256
`d5414b7857246dba55cde84899e2c75c98f6177eb9b8032a9dca08c13d6e3256`.

Independent final checks confirmed:

- SQLite contains exactly 451,823 embedded documents;
- the manifest declares 451,823 rows across exactly 402 shards;
- 402 shard receipts exist and match the manifest set;
- the canonical iCloud shard directory contains exactly 402 placeholders;
- all canonical placeholders occupy zero local blocks after final eviction;
- the local working shard directory contains no completed shard files;
- the archived SQLite state has SHA-256
  `79302121abbd35c54136b2cc8d238a562e8964b5737bdd77a935f2aca3401af1`;
- the local manifest has SHA-256
  `1facaac58b4e4113d9d40ffceeb93ee64f3e35755a701b7dd6433a0b8339af44`;
- the final summary reports exact roundtrip hashes and final eviction for every
  file archived in the completing run.

One duplicate file created during manual web recovery was removed from the
canonical shard namespace without deleting it: it remains quarantined under
`recovery-unreferenced/`. It is not referenced by the manifest, receipts or
resumable state and therefore cannot enter index construction.

The completed shards contain 2,829,334,705 logical bytes. Their local allocation
is zero after eviction. The workstation retained approximately 54 GiB free at
final validation; encrypted swap remained below the safety threshold.

## Commands

Single-file roundtrip:

```bash
.venv-retrieval/bin/python scripts/retrieval/icloud_roundtrip.py SOURCE \
  --icloud-root "$HOME/Library/Mobile Documents/com~apple~CloudDocs" \
  --target InvestigacionFilosofica/semantic-retrieval/v3.3/PATH \
  --receipt artifacts/semantic-retrieval/icloud-receipt.json
```

Incremental embedding build after a restart and a fresh disk check:

```bash
RETRIEVAL_DEVICE=mps EMBEDDING_BATCH_SIZE=1 \
  .venv-retrieval/bin/python scripts/retrieval/build_embeddings_to_icloud.py \
  --artifacts-dir artifacts/semantic-retrieval/full-v3.3-icloud \
  --icloud-root "$HOME/Library/Mobile Documents/com~apple~CloudDocs" \
  --target-prefix InvestigacionFilosofica/semantic-retrieval/v3.3/full \
  --source-batch-size 2048 \
  --confirm-full-build
```

This exact guarded command completed the full build. The persistent full-corpus
index was then built and validated from the frozen manifest and verified iCloud
shards; see `docs/SEMANTIC_INDEX_V3_3.md`. The 402 source shards were evicted
again after index construction and occupy zero local blocks. No production
integration is implied by either result.
