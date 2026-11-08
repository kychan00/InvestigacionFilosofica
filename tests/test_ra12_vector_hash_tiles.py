"""RA12-C2 fail-closed offline tree and independent source validator tests."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts" / "research-atlas"
sys.path.insert(0, str(SCRIPTS))

from build_ra12_vector_hash_tiles import build, model_budgets, TILE_VECTORS
from validate_ra12_vector_hash_tiles import verify


def digest(x):
    return hashlib.sha256(x).hexdigest()


def fixture(folder: Path):
    root = folder / "source"
    clusters = []
    for cluster, count in enumerate([3, 70]):
        contents = bytes((cluster * 61 + index * 17) % 256 for index in range(count * 1024))
        relative = f"clusters/cluster-{cluster:03d}.vectors.i8"
        file = root / relative
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(contents)
        clusters.append({
            "cluster": cluster,
            "count": count,
            "vectors": {
                "path": relative, "bytes": len(contents),
                "sha256": digest(contents)
            }
        })
    manifest = {
        "schema_version": "qwen3-browser-semantic-static-artifacts-v4",
        "dimension": 1024,
        "document_count": 73,
        "quantization": {"dtype": "int8"},
        "routing": {"cluster_count": 2},
        "clusters": clusters,
        "metadata": {
            "pages": [{"path": "unused.jsonl.gz", "count": 73}]
        }
    }
    return manifest, root


class DigestTreeTest(unittest.TestCase):
    def test_all_73_vectors_are_independently_verified_and_tiles_cover_last_partial(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            source, root = fixture(folder)
            output = folder / "tree"
            manifest, budget = build(source, "fixture-manifest-sha", root, output,
                                     workers=2, fetch_missing=False, fixture=True)
            self.assertEqual(manifest["documentCount"], 73)
            self.assertEqual(manifest["digestsBytes"], 73 * 32)
            self.assertEqual(manifest["tileCount"], 3)
            self.assertEqual(budget["status"], "fixture-not-a-real-budget-model")
            proof = verify(source, "fixture-manifest-sha", root, output, fixture=True)
            self.assertEqual(proof["verifiedVectorCount"], 73)
            self.assertEqual(proof["verifiedHashTiles"], 3)
            index = json.loads((output / "indexes/cluster-001.json").read_text())
            self.assertEqual([x["count"] for x in index["tiles"]], [64, 6])
            self.assertEqual(index["tiles"][-1]["bytes"], 192)
            self.assertEqual(index["tiles"][-1]["endByte"], 70 * 32 - 1)
            self.assertFalse(manifest["productionEnabled"])

    def test_repeat_build_is_byte_identical(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            source, root = fixture(folder)
            a = folder / "a"
            b = folder / "b"
            build(source, "fixture-sha", root, a, 1, False, True)
            build(source, "fixture-sha", root, b, 2, False, True)
            names_a = sorted(p.relative_to(a) for p in a.rglob("*") if p.is_file())
            names_b = sorted(p.relative_to(b) for p in b.rglob("*") if p.is_file())
            self.assertEqual(names_a, names_b)
            for name in names_a:
                self.assertEqual((a / name).read_bytes(), (b / name).read_bytes())

    def test_tampered_hash_tree_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            source, root = fixture(folder)
            output = folder / "tree"
            build(source, "fixture-sha", root, output, 2, False, True)
            part = output / "digests/cluster-001.sha256.bin"
            original = part.read_bytes()
            part.write_bytes(original[:30] + bytes([original[30] ^ 1]) + original[31:])
            with self.assertRaisesRegex(ValueError, "Digest file byte/hash mismatch"):
                verify(source, "fixture-sha", root, output, True)

    def test_tampered_vector_source_is_rejected_before_generating_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            source, root = fixture(folder)
            file = root / "clusters/cluster-000.vectors.i8"
            data = bytearray(file.read_bytes())
            data[100] ^= 3
            file.write_bytes(data)
            with self.assertRaisesRegex(Exception, "size/hash mismatch"):
                build(source, "fixture-sha", root, folder / "tree", 2, False, True)
            self.assertFalse((folder / "tree").exists())

    def test_cold_budget_adds_manifest_indexes_tiles_and_vectors_separately(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            source, root = fixture(folder)
            # This additional manifest has 256 REAL-shaped clusters represented
            # only as counts: it models budgets, not fabricated search responses.
            physical = {
                "clusters": [
                    {"cluster": i, "count": 1000 + i,
                     "vectors": {"bytes": (1000 + i) * 1024}}
                    for i in range(256)
                ]
            }
            index = {"clusters": [
                {"cluster": i, "index": {"bytes": 8000}} for i in range(256)
            ]}
            model = model_budgets(physical, index, 50000)
            self.assertEqual(len(model["scenarios"]), 6)
            self.assertTrue(all(p["notRealFederatedSearchResults"] for p in model["scenarios"]))
            dispersed = next(p for p in model["scenarios"] if p["cohort"] == "dispersed-50")
            self.assertEqual(dispersed["works"], 50)
            self.assertEqual(dispersed["uniqueClusters"], 50)
            self.assertEqual(dispersed["payloadBytesVectorSlices"], 51200)
            self.assertGreater(dispersed["modeledColdPayloadBytes"], 51200)
            clustered = next(p for p in model["scenarios"] if p["cohort"] == "clustered-50")
            self.assertEqual(clustered["uniqueHashTiles"], 1)
            self.assertLess(clustered["modeledColdPayloadBytes"], dispersed["modeledColdPayloadBytes"])


if __name__ == "__main__":
    unittest.main()
