#!/usr/bin/env python3
"""RA12-C3: verify a pinned RA12-C2 artifact and stage its minimal HF release.

Strictly read-only on the GitHub Actions archive. No Hugging Face mutations.
"""
from __future__ import annotations

import argparse
import hashlib
import json
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


def encode(value: dict) -> bytes:
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def parse_json(data: bytes, name: str) -> dict:
    try:
        value = json.loads(data)
    except (ValueError, UnicodeError) as exc:
        raise ReleaseError(f"Invalid JSON: {name}") from exc
    require(isinstance(value, dict), f"Expected object: {name}")
    return value


def prepare(archive: Path, config: dict, output: Path, fixture=False) -> dict:
    require(not output.exists(), "Release output path already exists")
    source = config["source"]
    expect = config["expected"]
    release = config["publication"]
    archive_bytes = archive.read_bytes()
    if not fixture:
        require(len(archive_bytes) == source["artifactZipBytes"], "Actions ZIP size changed")
        require(sha(archive_bytes) == source["artifactZipSha256"], "Pinned Actions ZIP SHA mismatch")
        require(release["manualDispatchOnly"] and release["pullRequestNeverPublishes"]
                and not release["runtimeEnabled"] and not release["published"],
                "Publication safety policy invalid")

    with zipfile.ZipFile(archive) as z:
        entries = [x for x in z.infolist() if not x.is_dir()]
        names = [x.filename for x in entries]
        require(len(names) == len(set(names)), "Duplicate archive member")
        require(len(entries) <= 540, "Unexpected archive member count")
        require(sum(x.file_size for x in entries) < 35_000_000,
                "Archive exceeds safe expanded-size budget")
        for entry in entries:
            path = PurePosixPath(entry.filename)
            require(not path.is_absolute()
                    and all(part not in ("", ".", "..") for part in path.parts)
                    and "\\" not in entry.filename, "Unsafe archive member path")
            require(((entry.external_attr >> 16) & 0o170000) != 0o120000,
                    "Symlinks are forbidden in source artifact")
        require(z.testzip() is None, "Corrupted ZIP payload")

        root_candidates = [
            name for name in names if name == "hash-manifest.json"
            or name.endswith("/tree/hash-manifest.json")
            or name == "tree/hash-manifest.json"
        ]
        require(len(root_candidates) == 1, "Expected one unambiguous digest-tree manifest")
        root_path = root_candidates[0]
        prefix = root_path[: -len("hash-manifest.json")]
        manifest_bytes = z.read(root_path)
        require(sha(manifest_bytes) == source["hashManifestSha256"],
                "Pinned digest root SHA mismatch")
        manifest = parse_json(manifest_bytes, root_path)
        require(manifest.get("schemaVersion") == "research-atlas-ra12c2-vector-digest-tree-v1"
                and manifest.get("status") == "generated-unpublished"
                and manifest.get("productionEnabled") is False
                and manifest.get("publishedToHf") is False,
                "Digest tree is not an unpublished real-source build")
        require(manifest["source"]["revision"] == source["v4Revision"]
                and manifest["source"]["manifestSha256"] == source["v4ManifestSha256"]
                and manifest["source"]["vectorShardsSourceSha256Verified"] is True,
                "V4 source SHA lineage changed")
        require((manifest["documentCount"], manifest["clusterCount"],
                 manifest["tileCount"], manifest["digestsBytes"],
                 manifest["clusterIndexBytes"], manifest["dimension"],
                 manifest["digestBytes"], manifest["tileVectors"]) ==
                (expect["documentCount"], expect["clusterCount"], expect["tileCount"],
                 expect["digestBytes"], expect["clusterIndexBytes"], 1024, 32, 64),
                "Unexpected digest tree size/format")
        audit_names = [n for n in names if n.endswith("/independent-audit.json")
                       or n == "independent-audit.json"]
        prefetch_names = [n for n in names if n.endswith("/source-prefetch.json")
                          or n == "source-prefetch.json"]
        require(len(audit_names) == len(prefetch_names) == 1,
                "Missing/ambiguous original source verification reports")
        audit = parse_json(z.read(audit_names[0]), "original independent audit")
        prefetch = parse_json(z.read(prefetch_names[0]), "original source prefetch")
        require(audit.get("status") == "pass"
                and audit.get("hashManifestSha256") == source["hashManifestSha256"]
                and audit.get("verifiedVectorCount") == expect["documentCount"]
                and audit.get("verifiedHashTiles") == expect["tileCount"]
                and audit.get("eachVectorDigestRecomputedFromSource") is True,
                "RA12-C2 independent verification did not pass")
        require(prefetch.get("status") == "sha256-verified"
                and prefetch.get("verifiedVectorShards") == expect["clusterCount"]
                and prefetch.get("sourceManifestSha256") == source["v4ManifestSha256"],
                "Original shard verification incomplete")

        clusters = manifest["clusters"]
        require(len(clusters) == expect["clusterCount"], "Missing clusters")
        target_members = {"hash-manifest.json": manifest_bytes}
        seen_clusters = set()
        totals = {"vectors": 0, "digestBytes": 0, "indexBytes": 0, "tiles": 0}
        for position, record in enumerate(clusters):
            idx = record["cluster"]
            require(type(idx) is int and idx == position
                    and idx not in seen_clusters, "Noncontiguous/duplicate cluster")
            seen_clusters.add(idx)
            index_name = f"indexes/cluster-{idx:03d}.json"
            digest_name = f"digests/cluster-{idx:03d}.sha256.bin"
            require(record["index"]["path"] == index_name
                    and record["digests"]["path"] == digest_name,
                    "Unexpected file in cluster inventory")
            index_bytes = z.read(prefix + index_name)
            digests = z.read(prefix + digest_name)
            for metadata, content in ((record["index"], index_bytes),
                                      (record["digests"], digests)):
                require(len(content) == metadata["bytes"]
                        and sha(content) == metadata["sha256"],
                        "Cluster payload SHA/size mismatch")
            index = parse_json(index_bytes, index_name)
            require(index["schemaVersion"] == "research-atlas-ra12c2-cluster-index-v1"
                    and index["cluster"] == idx
                    and index["count"] == record["count"]
                    and index["digests"] == record["digests"]
                    and index["digestBytes"] == 32
                    and index["tileVectors"] == 64
                    and index["vectorDimension"] == 1024,
                    "Cluster index/digest mapping changed")
            require(len(digests) == record["count"] * 32
                    and index["sourceVectorSha256"], "Digest layout/source hash invalid")
            expected_tiles = (record["count"] + 63) // 64
            require(len(index["tiles"]) == expected_tiles
                    and record["tileCount"] == expected_tiles,
                    "Missing digest tile")
            for tile_index, tile in enumerate(index["tiles"]):
                start_ordinal = tile_index * 64
                end_ordinal = min(record["count"], start_ordinal + 64)
                low, high = start_ordinal * 32, end_ordinal * 32
                piece = digests[low:high]
                require((tile["tile"], tile["firstOrdinal"], tile["count"],
                         tile["startByte"], tile["endByte"], tile["bytes"]) ==
                        (tile_index, start_ordinal, end_ordinal - start_ordinal,
                         low, high - 1, len(piece))
                        and sha(piece) == tile["sha256"],
                        "Digest tile hash/offset incorrect")
            target_members[index_name] = index_bytes
            target_members[digest_name] = digests
            totals["vectors"] += record["count"]
            totals["digestBytes"] += len(digests)
            totals["indexBytes"] += len(index_bytes)
            totals["tiles"] += len(index["tiles"])
        require(totals == {"vectors": expect["documentCount"],
                           "digestBytes": expect["digestBytes"],
                           "indexBytes": expect["clusterIndexBytes"],
                           "tiles": expect["tileCount"]},
                "Digest totals diverge from pinned evidence")
        authorized_auxiliary = {root_path, audit_names[0], prefetch_names[0]}
        for name in names:
            if name in authorized_auxiliary:
                continue
            if name.startswith(prefix) and name[len(prefix):] in target_members:
                continue
            if name.rsplit("/", 1)[-1] in {"budget-model.json", "build-summary.json"}:
                continue
            raise ReleaseError(f"Unexpected artifact member: {name}")

    staging = Path(tempfile.mkdtemp(prefix="ra12c3-release-", dir=output.parent))
    try:
        for name, payload in target_members.items():
            target = staging / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
        provenance = {
            "schemaVersion": "research-atlas-ra12c3-publication-provenance-v1",
            "state": "verified-candidate-not-proof-of-hf-publication",
            "sourceArtifactRunId": source["runId"],
            "sourceArtifactId": source["artifactId"],
            "sourceZipSha256": sha(archive_bytes),
            "rootManifestSha256": source["hashManifestSha256"],
            "sourceV4Revision": source["v4Revision"],
            "vectors": totals["vectors"],
            "hashTiles": totals["tiles"],
            "targetPrefix": release["targetPrefix"],
            "syntheticFixture": bool(fixture),
            "published": False,
            "atlasRuntimeEnabled": False
        }
        (staging / "release-provenance.json").write_bytes(encode(provenance))
        require(len(target_members) + 1 == expect["publicationFileCount"],
                "Publication file count changed")
        staging.rename(output)
        return {
            "schemaVersion": "research-atlas-ra12c3-preflight-result-v1",
            "status": "verified-unpublished-fixture" if fixture else "verified-unpublished",
            "sourceArchiveSha256": sha(archive_bytes),
            "rootManifestSha256": source["hashManifestSha256"],
            "fileCount": len(target_members) + 1,
            "vectors": totals["vectors"],
            "tiles": totals["tiles"],
            "publishedToHf": False,
            "runtimeEnabled": False
        }
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        config = parse_json(args.config.read_bytes(), "candidate config")
        require(config.get("schemaVersion") == "research-atlas-ra12c3-digest-publication-candidate-v1",
                "Unexpected candidate schema")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        result = prepare(args.archive, config, args.output)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (ReleaseError, OSError, ValueError, KeyError, TypeError,
            zipfile.BadZipFile, EOFError) as error:
        print(f"RA12-C3 preflight ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
