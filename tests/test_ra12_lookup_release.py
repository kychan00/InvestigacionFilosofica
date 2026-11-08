"""RA12-B3 synthetic ZIP tests; no Hugging Face connection and no real publication."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "research-atlas"))
from prepare_ra12_lookup_release import release_archive, ReleaseError


def encode(value):
    return (json.dumps(value, separators=(",", ":"), sort_keys=True) + "\n").encode()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def work_for_prefix(prefix):
    for value in range(1, 100000):
        candidate = f"W{value}"
        if hashlib.sha256(candidate.encode()).digest()[0] == prefix:
            return candidate
    raise AssertionError("Missing hash prefix fixture")


def fixture(folder: Path):
    works = [work_for_prefix(0), work_for_prefix(1)]
    rows = [[works[0], 0, 0, 0], [works[1], 1, 1, 0]]
    parts = []
    assets = {}
    for index, item in enumerate(rows):
        data = gzip.compress(encode(item), mtime=0)
        name = f"lookup/part-{index:03d}.jsonl.gz"
        assets[name] = data
        parts.append({"prefix": index, "path": name,
                      "bytes": len(data), "sha256": sha(data), "count": 1})
    asset_count = sum(p["bytes"] for p in parts)
    revision = "5a4a195085de54bf607a6c4397092ffb32716dcc"
    manifest_sha = "fixture-manifest"
    source_repo = "CristianPelayo/openalex-philosophy"
    lookup = {
        "schemaVersion": "research-atlas-qwen-document-lookup-v1",
        "status": "generated-unpublished",
        "productionEnabled": False,
        "source": {"revision": revision, "manifestSha256": manifest_sha,
                   "dataset": source_repo},
        "coverage": {"documents": 2, "eligibleUniqueWorkIds": 2,
                     "duplicateWorkIdRecords": 0, "invalidExplicit": 0,
                     "conflictingFields": 0},
        "lookup": {"entryCount": 2, "ambiguousWorkIdsExcluded": 0,
                   "partitions": parts}
    }
    assets["lookup-manifest.json"] = encode(lookup)
    assets["validation.json"] = encode({
        "status": "pass", "uniqueOpenAlexWorkIds": 2, "verifiedPartitions": 2,
        "verifiedLookupBytes": asset_count, "sourceMetadataAndIdsVerified": True
    })
    assets["full-prefetch.json"] = encode({
        "status": "verified", "mode": "full-sources",
        "assetsVerified": 1139, "sourceManifestSha256": manifest_sha
    })
    archive = folder / "artifact.zip"
    with zipfile.ZipFile(archive, "w") as z:
        for path, body in assets.items():
            z.writestr(path, body, compress_type=zipfile.ZIP_STORED)
    config = {
        "source": {"archiveBytes": archive.stat().st_size,
                   "archiveSha256": sha(archive.read_bytes()),
                   "artifactId": 123, "artifactRunId": 456},
        "corpus": {"sourceManifestSha256": manifest_sha, "sourceRevision": revision,
                   "repository": source_repo, "sourceCount": 2, "eligibleWorkIds": 2,
                   "ambiguousIds": 0, "partitionCount": 2,
                   "partitionBytes": asset_count},
        "release": {"publicationRequiresManualDispatch": True,
                    "publicationEnabledByPullRequest": False,
                    "runtimeEnabled": False,
                    "targetPrefix": "research-atlas/qwen3-document-lookup/v1/test"}
    }
    v4 = {"document_count": 2, "dimension": 4,
          "clusters": [{"count": 1}, {"count": 1}]}
    return archive, config, v4, assets


class RA12B3ReleaseTest(unittest.TestCase):
    def test_minimal_release_is_deterministic_and_never_publishable_from_fixture(self):
        with tempfile.TemporaryDirectory() as base:
            folder = Path(base)
            artifact, cfg, v4, assets = fixture(folder)
            first = release_archive(artifact, cfg, v4, folder / "first", True)
            second = release_archive(artifact, cfg, v4, folder / "second", True)
            self.assertEqual(first, second)
            self.assertEqual(len(first["files"]), 4)
            self.assertEqual((folder / "first" / "lookup-manifest.json").read_bytes(),
                             assets["lookup-manifest.json"])
            provenance = json.loads((folder / "first" / "release-provenance.json").read_text())
            self.assertTrue(provenance["syntheticFixture"])
            self.assertFalse(provenance["atlasRuntimeEnabled"])

    def test_corrupt_partition_rejected_without_release_folder(self):
        with tempfile.TemporaryDirectory() as base:
            folder = Path(base)
            artifact, cfg, v4, assets = fixture(folder)
            assets["lookup/part-000.jsonl.gz"] = b"tampered"
            with zipfile.ZipFile(artifact, "w") as z:
                for path, body in assets.items():
                    z.writestr(path, body)
            output = folder / "reject"
            with self.assertRaisesRegex(ReleaseError, "Partition SHA/size mismatch"):
                release_archive(artifact, cfg, v4, output, True)
            self.assertFalse(output.exists())

    def test_extra_unsafe_zip_path_is_rejected(self):
        with tempfile.TemporaryDirectory() as base:
            folder = Path(base)
            artifact, cfg, v4, assets = fixture(folder)
            assets["../bad.txt"] = b"no"
            with zipfile.ZipFile(artifact, "w") as z:
                for path, body in assets.items():
                    z.writestr(path, body)
            with self.assertRaisesRegex(ReleaseError, "Unexpected or unsafe ZIP member"):
                release_archive(artifact, cfg, v4, folder / "reject", True)

    def test_duplicate_work_id_is_rejected(self):
        with tempfile.TemporaryDirectory() as base:
            folder = Path(base)
            artifact, cfg, v4, assets = fixture(folder)
            first = json.loads(gzip.decompress(assets["lookup/part-000.jsonl.gz"]).decode())
            # Same Work ID in a second partition: rejected (also wrong hash partition).
            row = [first[0], 1, 1, 0]
            changed = gzip.compress(encode(row), mtime=0)
            assets["lookup/part-001.jsonl.gz"] = changed
            lookup = json.loads(assets["lookup-manifest.json"])
            lookup["lookup"]["partitions"][1].update({
                "bytes": len(changed), "sha256": sha(changed)
            })
            assets["lookup-manifest.json"] = encode(lookup)
            cfg["corpus"]["partitionBytes"] = sum(p["bytes"] for p in lookup["lookup"]["partitions"])
            audit = json.loads(assets["validation.json"])
            audit["verifiedLookupBytes"] = cfg["corpus"]["partitionBytes"]
            assets["validation.json"] = encode(audit)
            with zipfile.ZipFile(artifact, "w") as z:
                for path, body in assets.items():
                    z.writestr(path, body)
            with self.assertRaisesRegex(ReleaseError, "Duplicate/unsorted Work ID"):
                release_archive(artifact, cfg, v4, folder / "reject", True)


if __name__ == "__main__":
    unittest.main()
