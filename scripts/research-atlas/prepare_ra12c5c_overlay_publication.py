#!/usr/bin/env python3
"""RA12-C5-C: verify the exact C5-B artifact and stage a minimal immutable HF release.

No model inference, no federated re-search and no Hugging Face writes happen here.
The original vector/index/metadata bytes are copied unchanged; only small lookup,
browser-reference and provenance files are deterministically derived.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import shutil
import sys
import tempfile
import zipfile


class ReleaseError(ValueError):
    pass


def require(value, message):
    if not value:
        raise ReleaseError(message)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encode(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def json_obj(data: bytes, name: str) -> dict:
    try:
        value = json.loads(data)
    except (ValueError, UnicodeError) as exc:
        raise ReleaseError("Invalid JSON: " + name) from exc
    require(isinstance(value, dict), "Expected JSON object: " + name)
    return value


def jsonl_gzip(data: bytes, name: str) -> list[dict]:
    try:
        rows = [json.loads(line) for line in gzip.decompress(data).decode("utf-8").splitlines() if line.strip()]
    except (OSError, ValueError, UnicodeError) as exc:
        raise ReleaseError("Invalid gzip JSONL: " + name) from exc
    require(all(isinstance(row, dict) for row in rows), "Non-object JSONL row: " + name)
    return rows


def cosine(left: bytes, right: bytes) -> float:
    require(len(left) == len(right) == 1024, "Cosine inputs must be 1024 bytes")
    aa = bb = dot = 0
    for ra, rb in zip(left, right):
        a = ra if ra < 128 else ra - 256
        b = rb if rb < 128 else rb - 256
        dot += a * b
        aa += a * a
        bb += b * b
    require(aa > 0 and bb > 0, "Zero-norm int8 vector")
    score = dot / math.sqrt(aa * bb)
    require(math.isfinite(score), "Non-finite cosine")
    return max(-1.0, min(1.0, score))


def prepare(archive: Path, config: dict, output: Path, fixture=False) -> dict:
    require(not output.exists(), "Release output path already exists")
    require(config.get("schemaVersion") == "research-atlas-ra12c5c-overlay-publication-candidate-v1",
            "Wrong C5-C config schema")
    source, expected, publication = config["source"], config["expected"], config["publication"]
    raw_zip = archive.read_bytes()
    if not fixture:
        require(len(raw_zip) == source["artifactZipBytes"], "Pinned Actions ZIP size changed")
        require(sha(raw_zip) == source["artifactZipSha256"], "Pinned Actions ZIP SHA mismatch")
    require(publication["manualDispatchOnly"] is True
            and publication["pullRequestNeverPublishes"] is True
            and publication["runtimeEnabled"] is False
            and publication["semanticNeighborEnabled"] is False
            and publication["published"] is False,
            "Publication safety policy invalid")

    allowed = {
        "seed/overlay-metadata.jsonl.gz", "seed-summary.json", "seed/seed-report.json",
        "doi-authority-report.json", "overlay/manifest.json", "overlay/overlay-metadata.jsonl.gz",
        "overlay/v4-compatibility-audit.json", "overlay/vector-digests.sha256.bin",
        "overlay/vector-index.jsonl.gz", "overlay/vectors.i8", "build-summary.json",
        "independent-audit.json"
    }
    with zipfile.ZipFile(archive) as z:
        entries = [x for x in z.infolist() if not x.is_dir()]
        names = [x.filename for x in entries]
        require(len(names) == len(set(names)), "Duplicate archive member")
        require(set(names) == allowed, "Unexpected or missing source artifact member")
        require(sum(x.file_size for x in entries) < 1_000_000, "Expanded artifact exceeds safety budget")
        for entry in entries:
            path = PurePosixPath(entry.filename)
            require(not path.is_absolute() and all(p not in ("", ".", "..") for p in path.parts)
                    and "\\" not in entry.filename, "Unsafe archive path")
            require(((entry.external_attr >> 16) & 0o170000) != 0o120000, "Symlink forbidden")
        require(z.testzip() is None, "Corrupted source ZIP")

        manifest_bytes = z.read("overlay/manifest.json")
        require(fixture or sha(manifest_bytes) == source["overlayManifestSha256"],
                "Pinned overlay manifest SHA mismatch")
        manifest = json_obj(manifest_bytes, "overlay/manifest.json")
        require(manifest.get("schemaVersion") == "research-atlas-ra12c5b-semantic-overlay-v1"
                and manifest.get("status") == "built-unpublished"
                and manifest.get("productionEnabled") is False
                and manifest.get("publishedToHf") is False,
                "Overlay is not the C5-B unpublished artifact")
        require(manifest.get("documentCount") == expected["documentCount"]
                and manifest.get("dimension") == expected["dimension"], "Overlay cardinality changed")
        require(manifest.get("embedding", {}).get("model") == "Qwen/Qwen3-Embedding-0.6B"
                and manifest.get("embedding", {}).get("revision") == "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3"
                and manifest.get("embedding", {}).get("documentsUseInstruction") is False,
                "Qwen embedding contract changed")
        require(manifest.get("v4Compatibility", {}).get("passed") is True,
                "V4 compatibility did not pass")

        originals = {
            "manifest.json": manifest_bytes,
            "vectors.i8": z.read("overlay/vectors.i8"),
            "vector-digests.sha256.bin": z.read("overlay/vector-digests.sha256.bin"),
            "vector-index.jsonl.gz": z.read("overlay/vector-index.jsonl.gz"),
            "overlay-metadata.jsonl.gz": z.read("overlay/overlay-metadata.jsonl.gz"),
            "v4-compatibility-audit.json": z.read("overlay/v4-compatibility-audit.json"),
        }
        map_key = {"vectors.i8":"vectors", "vector-digests.sha256.bin":"digests",
                   "vector-index.jsonl.gz":"index", "overlay-metadata.jsonl.gz":"metadata"}
        for name, key in map_key.items():
            detail = manifest["artifacts"][key]
            require(detail["path"] == name and len(originals[name]) == detail["bytes"]
                    and sha(originals[name]) == detail["sha256"], "Artifact SHA/size mismatch: " + name)
            if not fixture:
                require(detail["sha256"] == expected["artifacts"][key], "Pinned artifact SHA changed: " + key)
        require(len(originals["vectors.i8"]) == expected["vectorBytes"]
                and len(originals["vector-digests.sha256.bin"]) == expected["digestBytes"]
                and len(originals["vector-index.jsonl.gz"]) == expected["indexBytes"]
                and len(originals["overlay-metadata.jsonl.gz"]) == expected["metadataBytes"],
                "Pinned artifact byte counts changed")
        compatibility = json_obj(originals["v4-compatibility-audit.json"], "compatibility")
        require(sha(originals["v4-compatibility-audit.json"]) == manifest["v4Compatibility"]["auditSha256"]
                and compatibility.get("passed") is True
                and compatibility.get("controlCount") == 8,
                "V4 compatibility audit invalid")
        independent = json_obj(z.read("independent-audit.json"), "independent audit")
        require(independent.get("status") == "pass"
                and independent.get("documents") == expected["documentCount"]
                and independent.get("uniqueVectorSha256") == expected["uniqueVectorSha256"]
                and independent.get("duplicateVectorSha256") == expected["duplicateVectorSha256"]
                and independent.get("publishableAbstractBodies") == 0
                and independent.get("productionEnabled") is False
                and independent.get("publishedToHf") is False,
                "C5-B independent audit failed")
        seed = json_obj(z.read("seed/seed-report.json"), "seed report")
        require(seed.get("candidateCount") == expected["documentCount"]
                and seed.get("rawAbstractIncludedInPublishableMetadata") is False
                and seed.get("productionEnabled") is False
                and seed.get("publishedToHf") is False, "Seed privacy/product boundary failed")

        index_rows = jsonl_gzip(originals["vector-index.jsonl.gz"], "index")
        metadata_rows = jsonl_gzip(originals["overlay-metadata.jsonl.gz"], "metadata")
        count = expected["documentCount"]
        require(len(index_rows) == len(metadata_rows) == count, "Ordinal record count mismatch")
        digests, vectors = originals["vector-digests.sha256.bin"], originals["vectors.i8"]
        identities, vector_hashes, lookup_rows = set(), set(), []
        forbidden = {"abstract", "documentText", "fullText", "pdf", "authors", "topics", "keywords"}
        for ordinal in range(count):
            idx, meta = index_rows[ordinal], metadata_rows[ordinal]
            identity = idx.get("identity")
            require(idx.get("ordinal") == meta.get("ordinal") == ordinal
                    and identity and meta.get("identity") == identity and identity not in identities,
                    "Ordinal/identity lineage mismatch")
            identities.add(identity)
            require(not forbidden.intersection(meta), "Publishable metadata contains forbidden source text")
            piece = vectors[ordinal*1024:(ordinal+1)*1024]
            digest = hashlib.sha256(piece).digest()
            require(digest == digests[ordinal*32:(ordinal+1)*32]
                    and idx.get("vectorSha256") == digest.hex(), "Per-vector digest mismatch")
            vector_hashes.add(digest.hex())
            lookup_rows.append({"identity": identity, "ordinal": ordinal, "vectorSha256": digest.hex()})
        require(len(identities) == count
                and len(vector_hashes) == expected["uniqueVectorSha256"], "Identity/vector uniqueness changed")

    manifest_sha = sha(manifest_bytes)
    lookup = {
        "schemaVersion": "research-atlas-ra12c5c-overlay-identity-lookup-v1",
        "sourceManifestSha256": manifest_sha,
        "documentCount": expected["documentCount"], "dimension": 1024,
        "vectorsSha256": sha(originals["vectors.i8"]),
        "digestsSha256": sha(originals["vector-digests.sha256.bin"]),
        "records": lookup_rows, "productionEnabled": False
    }
    lookup_bytes = encode(lookup)
    pair_ordinals = ((0, 1), (2, 3), (4, 5))
    browser_reference = {
        "schemaVersion": "research-atlas-ra12c5c-browser-reference-v1",
        "sourceManifestSha256": manifest_sha,
        "overlaySamples": [0, 1, 2, 3, 4, 5],
        "overlayCosine": [
            {"ordinals": [a, b], "referenceCosine": cosine(
                originals["vectors.i8"][a*1024:(a+1)*1024],
                originals["vectors.i8"][b*1024:(b+1)*1024])}
            for a, b in pair_ordinals
        ],
        "v4Samples": [
            {"cluster": compatibility["cases"][0]["cluster"], "ordinal": compatibility["cases"][0]["ordinal"]},
            {"cluster": compatibility["cases"][4]["cluster"], "ordinal": compatibility["cases"][4]["ordinal"]}
        ],
        "crossPairs": [
            {"v4Sample": 0, "overlayOrdinal": 0},
            {"v4Sample": 1, "overlayOrdinal": 1}
        ],
        "productionEnabled": False
    }
    reference_bytes = encode(browser_reference)
    staging = Path(tempfile.mkdtemp(prefix="ra12c5c-release-", dir=output.parent))
    try:
        for name, content in originals.items():
            (staging / name).write_bytes(content)
        (staging / "identity-lookup.json").write_bytes(lookup_bytes)
        (staging / "browser-reference.json").write_bytes(reference_bytes)
        files_before_provenance = {
            p.relative_to(staging).as_posix(): {"bytes": p.stat().st_size, "sha256": sha(p.read_bytes())}
            for p in staging.rglob("*") if p.is_file()
        }
        provenance = {
            "schemaVersion": "research-atlas-ra12c5c-publication-provenance-v1",
            "state": "verified-candidate-not-proof-of-hf-publication",
            "sourceArtifactRunId": source["runId"], "sourceArtifactId": source["artifactId"],
            "sourceZipSha256": sha(raw_zip), "overlayManifestSha256": manifest_sha,
            "targetPrefix": publication["targetPrefix"], "documents": expected["documentCount"],
            "files": files_before_provenance, "syntheticFixture": bool(fixture),
            "published": False, "atlasRuntimeEnabled": False, "semanticNeighborEnabled": False
        }
        (staging / "release-provenance.json").write_bytes(encode(provenance))
        files = [p for p in staging.rglob("*") if p.is_file()]
        require(len(files) == expected["publicationFileCount"], "Publication file count changed")
        staging.rename(output)
        return {
            "schemaVersion": "research-atlas-ra12c5c-preflight-result-v1",
            "status": "verified-unpublished-fixture" if fixture else "verified-unpublished",
            "sourceArchiveSha256": sha(raw_zip), "overlayManifestSha256": manifest_sha,
            "documents": expected["documentCount"], "publicationFiles": len(files),
            "lookupSha256": sha(lookup_bytes), "browserReferenceSha256": sha(reference_bytes),
            "uniqueVectorSha256": len(vector_hashes), "duplicateVectorSha256": count-len(vector_hashes),
            "publishedToHf": False, "runtimeEnabled": False, "semanticNeighborEnabled": False
        }
    finally:
        if staging.exists(): shutil.rmtree(staging)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--archive", required=True, type=Path)
    p.add_argument("--config", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--fixture", action="store_true")
    args = p.parse_args()
    try:
        config = json.loads(args.config.read_text(encoding="utf-8"))
        result = prepare(args.archive, config, args.output, args.fixture)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (ReleaseError, OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile) as error:
        print("RA12-C5-C preflight ERROR:", error, file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
