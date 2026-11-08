"""RA12-C3 synthetic archive preflight checks; no network or HF writes."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts" / "research-atlas"
sys.path.insert(0, str(SCRIPTS))
from build_ra12_vector_hash_tiles import build
from validate_ra12_vector_hash_tiles import verify
from prepare_ra12_digest_publication import prepare, ReleaseError


def sha(data):
    return hashlib.sha256(data).hexdigest()


def fixture(folder):
    source_root = folder / "source"
    clusters = []
    for index, count in enumerate((4, 69)):
        content = bytes((index * 89 + i * 11) % 256 for i in range(count * 1024))
        name = f"clusters/cluster-{index:03d}.vectors.i8"
        location = source_root / name
        location.parent.mkdir(parents=True, exist_ok=True)
        location.write_bytes(content)
        clusters.append({"cluster": index, "count": count,
                         "vectors": {"path": name, "bytes": len(content), "sha256": sha(content)}})
    v4 = {
        "schema_version": "qwen3-browser-semantic-static-artifacts-v4",
        "document_count": 73, "dimension": 1024, "quantization": {"dtype": "int8"},
        "clusters": clusters
    }
    tree = folder / "tree"
    manifest, _budget = build(v4, "fixture-source-sha", source_root, tree, 2, False, True)
    audit = verify(v4, "fixture-source-sha", source_root, tree, True)
    report = {"status": "sha256-verified", "verifiedVectorShards": 2,
              "sourceManifestSha256": "fixture-source-sha"}
    supplemental = {
        "independent-audit.json": (json.dumps(audit) + "\n").encode(),
        "source-prefetch.json": (json.dumps(report) + "\n").encode()
    }
    names = {p.relative_to(folder).as_posix(): p.read_bytes()
             for p in tree.rglob("*") if p.is_file()}
    names.update(supplemental)
    archive = folder / "source.zip"
    with zipfile.ZipFile(archive, "w") as z:
        for name in sorted(names):
            z.writestr(name, names[name], compress_type=zipfile.ZIP_DEFLATED)
    config = {
        "source": {
            "artifactZipBytes": archive.stat().st_size,
            "artifactZipSha256": sha(archive.read_bytes()),
            "hashManifestSha256": sha((tree / "hash-manifest.json").read_bytes()),
            "v4Revision": "5a4a195085de54bf607a6c4397092ffb32716dcc",
            "v4ManifestSha256": "fixture-source-sha", "runId": 1, "artifactId": 2
        },
        "expected": {
            "documentCount": manifest["documentCount"],
            "clusterCount": manifest["clusterCount"],
            "tileCount": manifest["tileCount"],
            "digestBytes": manifest["digestsBytes"],
            "clusterIndexBytes": manifest["clusterIndexBytes"],
            "publicationFileCount": 2 * manifest["clusterCount"] + 2
        },
        "publication": {
            "targetPrefix": "research-atlas/qwen3-document-digests/v1/test",
            "manualDispatchOnly": True, "pullRequestNeverPublishes": True,
            "runtimeEnabled": False, "published": False
        }
    }
    return archive, config, names


class ReleaseTests(unittest.TestCase):
    def test_sha_verified_archive_stages_only_minimal_release_and_is_deterministic(self):
        with tempfile.TemporaryDirectory() as raw:
            folder = Path(raw)
            archive, config, _ = fixture(folder)
            first = prepare(archive, config, folder / "first", True)
            second = prepare(archive, config, folder / "second", True)
            self.assertEqual(first, second)
            self.assertEqual(first["vectors"], 73)
            self.assertEqual(first["fileCount"], 6)
            self.assertFalse(first["publishedToHf"])
            self.assertEqual(sorted(p.relative_to(folder / "first").as_posix()
                           for p in (folder / "first").rglob("*") if p.is_file()),
                sorted(p.relative_to(folder / "second").as_posix()
                           for p in (folder / "second").rglob("*") if p.is_file()))
            self.assertTrue(json.loads((folder / "first/release-provenance.json").read_text())
                            ["syntheticFixture"])

    def test_tampered_tile_rejected_and_no_output_created(self):
        with tempfile.TemporaryDirectory() as raw:
            folder=Path(raw)
            archive, config, names=fixture(folder)
            name="tree/digests/cluster-001.sha256.bin"
            data=bytearray(names[name])
            data[3]^=3
            names[name]=bytes(data)
            with zipfile.ZipFile(archive,"w") as z:
                for member, content in names.items():
                    z.writestr(member,content)
            with self.assertRaisesRegex(ReleaseError, "SHA/size mismatch"):
                prepare(archive, config, folder / "out", True)
            self.assertFalse((folder/"out").exists())

    def test_path_traversal_fails_closed(self):
        with tempfile.TemporaryDirectory() as raw:
            folder=Path(raw)
            archive, config, names=fixture(folder)
            names["../unsafe.txt"]=b"never"
            with zipfile.ZipFile(archive,"w") as z:
                for member, content in names.items():
                    z.writestr(member,content)
            with self.assertRaisesRegex(ReleaseError, "Unsafe archive"):
                prepare(archive, config, folder/"out", True)

    def test_missing_independent_audit_rejected(self):
        with tempfile.TemporaryDirectory() as raw:
            folder=Path(raw)
            archive, config, names=fixture(folder)
            del names["independent-audit.json"]
            with zipfile.ZipFile(archive,"w") as z:
                for member, content in names.items():
                    z.writestr(member,content)
            with self.assertRaisesRegex(ReleaseError, "Missing/ambiguous original"):
                prepare(archive,config,folder/"out",True)


if __name__ == "__main__":
    unittest.main()
