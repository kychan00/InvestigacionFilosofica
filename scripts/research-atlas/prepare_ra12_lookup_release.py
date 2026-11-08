#!/usr/bin/env python3
"""RA12-B3: verify the original Actions ZIP and prepare a minimal HF lookup release.

Offline, read-only on source artifact, zero Hugging Face writes.
Production releases require the pinned source and 451,823 validated OpenAlex IDs.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

PINNED_V4_MANIFEST_SHA256 = "0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa"
WORK_ID = re.compile(r"^W[1-9][0-9]*$")
PART_NAME = re.compile(r"^lookup/part-(\d{3})\.jsonl\.gz$")


class ReleaseError(ValueError):
    pass


def sha256(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()


def canonical_json(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def checked_json(contents: bytes, label: str) -> dict:
    try:
        value = json.loads(contents)
    except (UnicodeError, ValueError) as error:
        raise ReleaseError(f"Invalid {label} JSON") from error
    if not isinstance(value, dict):
        raise ReleaseError(f"Expected object: {label}")
    return value


def require(condition: bool, detail: str) -> None:
    if not condition:
        raise ReleaseError(detail)


def release_archive(archive: Path, config: dict, manifest: dict, output: Path, fixture: bool = False) -> dict:
    require(not output.exists(), "Release output already exists")
    expected_source = config["source"]
    expected_corpus = config["corpus"]
    release = config["release"]

    archive_bytes = archive.read_bytes()
    if not fixture:
        require(len(archive_bytes) == expected_source["archiveBytes"], "Actions artifact byte count changed")
        require(sha256(archive_bytes) == expected_source["archiveSha256"], "Actions artifact ZIP SHA-256 mismatch")
        require(sha256(canonical_json({})) != expected_corpus["sourceManifestSha256"],
                "Unexpected SHA guard issue")
        require(release["publicationRequiresManualDispatch"] is True
                and release["publicationEnabledByPullRequest"] is False
                and release["runtimeEnabled"] is False, "RA12-B3 safety gate changed")
        require(manifest.get("document_count") == 451823
                and manifest.get("dimension") == 1024
                and len(manifest.get("clusters", [])) == 256,
                "Wrong V4 source shape")

    with zipfile.ZipFile(archive) as source:
        infos = [entry for entry in source.infolist() if not entry.is_dir()]
        names = [entry.filename for entry in infos]
        require(len(names) == len(set(names)), "Duplicate ZIP entry")
        require(len(infos) <= 300, "Oversized ZIP inventory")
        require(sum(info.file_size for info in infos) <= 20_000_000,
                "Uncompressed ZIP too large")
        for info in infos:
            name = info.filename
            path = PurePosixPath(name)
            require(not path.is_absolute() and len(path.parts) in (1, 2) and
                    all(part not in ("", ".", "..") for part in path.parts) and
                    (name in {"lookup-manifest.json", "validation.json",
                              "sample-coverage.json", "sample-prefetch.json", "full-prefetch.json"}
                     or PART_NAME.fullmatch(name) is not None),
                    f"Unexpected or unsafe ZIP member: {name}")
            require(((info.external_attr >> 16) & 0o170000) != 0o120000,
                    f"ZIP symlink forbidden: {name}")
        require(all(name in names for name in
                    ("lookup-manifest.json", "validation.json", "full-prefetch.json")),
                "Missing audit proof files")
        require(source.testzip() is None, "Corrupt ZIP member")
        lookup = checked_json(source.read("lookup-manifest.json"), "lookup manifest")
        audit = checked_json(source.read("validation.json"), "independent validation")
        prefetch = checked_json(source.read("full-prefetch.json"), "V4 source verification")
        expected = expected_corpus
        require(lookup["schemaVersion"] == "research-atlas-qwen-document-lookup-v1",
                "Lookup schema mismatch")
        require(lookup["status"] == "generated-unpublished"
                and lookup["productionEnabled"] is False,
                "Only verified unpublished real lookup can be packaged")
        require(lookup["source"]["manifestSha256"] == expected["sourceManifestSha256"]
                and lookup["source"]["revision"] == expected["sourceRevision"]
                and lookup["source"]["dataset"] == expected["repository"],
                "Lookup V4 source lineage mismatch")
        require(lookup["coverage"]["documents"] == expected["sourceCount"]
                and lookup["coverage"]["eligibleUniqueWorkIds"] == expected["eligibleWorkIds"]
                and lookup["coverage"]["duplicateWorkIdRecords"] == 0
                and lookup["coverage"]["invalidExplicit"] == 0
                and lookup["coverage"]["conflictingFields"] == 0,
                "Unexpected source identity coverage")
        require(lookup["lookup"]["entryCount"] == expected["eligibleWorkIds"]
                and lookup["lookup"]["ambiguousWorkIdsExcluded"] == expected["ambiguousIds"],
                "Lookup counts disagree")
        require(audit["status"] == "pass"
                and audit["uniqueOpenAlexWorkIds"] == expected["eligibleWorkIds"]
                and audit["verifiedPartitions"] == expected["partitionCount"]
                and audit["verifiedLookupBytes"] == expected["partitionBytes"]
                and audit["sourceMetadataAndIdsVerified"] is True,
                "Independent real-corpus validation missing")
        require(prefetch["status"] == "verified"
                and prefetch["mode"] == "full-sources"
                and prefetch["assetsVerified"] == 1139
                and prefetch["sourceManifestSha256"] == expected["sourceManifestSha256"],
                "Source-asset verification missing")
        parts = lookup["lookup"]["partitions"]
        require(len(parts) == expected["partitionCount"], "Partition inventory count mismatch")
        require({p["prefix"] for p in parts} == set(range(expected["partitionCount"])),
                "Missing or repeated partition prefixes")
        require({p["path"] for p in parts} == set(names) - {
            "lookup-manifest.json", "validation.json", "sample-coverage.json",
            "sample-prefetch.json", "full-prefetch.json"
        }, "ZIP contains omitted or extra partitions")

        staging = Path(tempfile.mkdtemp(prefix="ra12b3-verified-", dir=output.parent))
        try:
            (staging / "lookup").mkdir()
            seen = set()
            byte_count = 0
            row_count = 0
            for part in sorted(parts, key=lambda item: item["prefix"]):
                prefix = part["prefix"]
                path = part["path"]
                require(path == f"lookup/part-{prefix:03d}.jsonl.gz",
                        "Unexpected partition name")
                content = source.read(path)
                require(len(content) == part["bytes"] and sha256(content) == part["sha256"],
                        f"Partition SHA/size mismatch: {path}")
                try:
                    decoded = gzip.decompress(content).decode("utf-8").splitlines()
                except (OSError, UnicodeError) as error:
                    raise ReleaseError(f"Invalid gzip partition: {path}") from error
                require(len(decoded) == part["count"], f"Wrong row count: {path}")
                previous_work = -1
                for line in decoded:
                    item = json.loads(line)
                    require(isinstance(item, list) and len(item) == 4,
                            "Invalid lookup row")
                    work, vector_id, cluster, ordinal = item
                    require(isinstance(work, str) and WORK_ID.fullmatch(work) is not None,
                            "Noncanonical OpenAlex ID")
                    numeric = int(work[1:])
                    require(numeric > previous_work and work not in seen,
                            "Duplicate/unsorted Work ID")
                    previous_work = numeric
                    seen.add(work)
                    require(hashlib.sha256(work.encode("ascii")).digest()[0] == prefix,
                            "Wrong hash partition")
                    require(type(vector_id) is int and 0 <= vector_id < expected["sourceCount"],
                            "Invalid vector ID")
                    require(type(cluster) is int and 0 <= cluster < len(manifest["clusters"]) and
                            type(ordinal) is int and 0 <= ordinal < manifest["clusters"][cluster]["count"],
                            "Invalid cluster / ordinal")
                    row_count += 1
                byte_count += len(content)
                (staging / path).write_bytes(content)
            require(byte_count == expected["partitionBytes"] and
                    row_count == expected["eligibleWorkIds"], "Lookup total size/count mismatch")
            (staging / "lookup-manifest.json").write_bytes(source.read("lookup-manifest.json"))
            provenance = {
                "schemaVersion": "research-atlas-ra12b3-release-provenance-v1",
                "state": "validated-candidate-not-proof-of-hf-publication",
                "syntheticFixture": bool(fixture),
                "sourceArtifactId": expected_source["artifactId"],
                "sourceRunId": expected_source["artifactRunId"],
                "sourceArchiveSha256": sha256(archive_bytes),
                "sourceDatasetRevision": expected["sourceRevision"],
                "sourceManifestSha256": expected["sourceManifestSha256"],
                "lookupEntries": row_count,
                "lookupPartitionBytes": byte_count,
                "targetPrefix": release["targetPrefix"],
                "published": False,
                "atlasRuntimeEnabled": False
            }
            (staging / "release-provenance.json").write_bytes(canonical_json(provenance))
            inventory = {
                "schemaVersion": "research-atlas-ra12b3-release-archive-v1",
                "status": "verified-candidate-not-published",
                "sourceArchiveSha256": sha256(archive_bytes),
                "files": [entry.name for entry in sorted(staging.rglob("*")) if entry.is_file()]
            }
            staging.rename(output)
            return inventory
        finally:
            if staging.exists():
                shutil.rmtree(staging)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--v4-manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--fixture", action="store_true", help="Test-only, release may never be published")
    args = parser.parse_args(argv)
    try:
        config = checked_json(args.config.read_bytes(), "RA12-B3 candidate")
        require(config.get("schemaVersion") == "research-atlas-ra12b3-lookup-release-candidate-v1",
                "Unexpected RA12-B3 candidate config")
        v4_raw = args.v4_manifest.read_bytes()
        if not args.fixture:
            require(sha256(v4_raw) == PINNED_V4_MANIFEST_SHA256,
                    "V4 manifest SHA mismatch")
        manifest = checked_json(v4_raw, "V4 manifest")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        result = release_archive(args.archive, config, manifest, args.output, fixture=args.fixture)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (ReleaseError, OSError, KeyError, TypeError, ValueError,
            zipfile.BadZipFile, EOFError) as error:
        print(f"RA12-B3 release ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
