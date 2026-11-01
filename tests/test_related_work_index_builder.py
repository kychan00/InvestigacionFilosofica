from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RELATED_SCRIPTS = ROOT / "scripts" / "related"
sys.path.insert(0, str(RELATED_SCRIPTS))

from build_related_work_index_v1 import (  # noqa: E402
    build_from_neighbor_provider,
    canonical_work_identity,
    expand_compact_edge,
    fixture_neighbor_provider,
    load_fixture_metadata,
    representative_vector_ids,
    shard_for_identity,
)
from validate_related_work_index_v1 import validate_artifact  # noqa: E402


FIXTURE_PATH = (
    ROOT
    / "benchmark"
    / "related-works"
    / "v1"
    / "index-builder-fixture.json"
)


class RelatedWorkIndexBuilderV1Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.payload = json.loads(
            FIXTURE_PATH.read_text(encoding="utf-8")
        )
        cls.metadata = load_fixture_metadata(cls.payload)

    def test_canonical_identity_prefers_doi_and_normalizes_case(self) -> None:
        first = canonical_work_identity(
            self.payload["documents"][0]
        )
        duplicate = canonical_work_identity(
            self.payload["documents"][2]
        )

        self.assertEqual(first, "doi:10.1000/seed")
        self.assertEqual(first, duplicate)

    def test_duplicate_seed_identity_uses_lowest_vector_id(self) -> None:
        ids, representatives = representative_vector_ids(
            self.metadata
        )

        self.assertEqual(len(ids), 5)
        self.assertNotIn(2, ids)
        self.assertEqual(
            representatives["doi:10.1000/seed"],
            0,
        )

    def test_hash_routing_is_stable(self) -> None:
        identity = "doi:10.1000/seed"

        self.assertEqual(
            shard_for_identity(identity, 8),
            shard_for_identity(identity, 8),
        )
        self.assertGreaterEqual(
            shard_for_identity(identity, 8),
            0,
        )
        self.assertLess(
            shard_for_identity(identity, 8),
            8,
        )

    def _build(self, output: Path) -> dict:
        return build_from_neighbor_provider(
            metadata=self.metadata,
            neighbor_provider=fixture_neighbor_provider(
                self.payload
            ),
            output_dir=output,
            source={
                "mode": "fixture",
                "fixture": "index-builder-fixture-v1",
            },
            neighbors_per_seed=3,
            search_multiplier=3,
            shard_count=8,
            batch_size=2,
            minimum_semantic_score=0.5,
        )

    def test_fixture_build_is_deterministic_and_valid(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = root / "first"
            second = root / "second"

            first_result = self._build(first)
            second_result = self._build(second)

            self.assertEqual(
                first_result["manifest_sha256"],
                second_result["manifest_sha256"],
            )

            first_manifest = json.loads(
                (first / "manifest.json").read_text(
                    encoding="utf-8"
                )
            )
            second_manifest = json.loads(
                (second / "manifest.json").read_text(
                    encoding="utf-8"
                )
            )

            self.assertEqual(first_manifest, second_manifest)
            self.assertEqual(
                first_manifest["document_count"],
                6,
            )
            self.assertEqual(
                first_manifest["unique_seed_count"],
                5,
            )
            self.assertEqual(
                first_manifest["totals"]["duplicate_seed_documents"],
                1,
            )
            self.assertEqual(
                first_manifest["totals"]["edges"],
                13,
            )
            self.assertEqual(
                first_manifest["partition"]["shard_count"],
                8,
            )

            report = validate_artifact(first)
            self.assertEqual(report["status"], "pass")
            self.assertEqual(report["unique_seed_count"], 5)
            self.assertEqual(report["edge_count"], 13)

            first_shards = {
                row["path"]: row["sha256"]
                for row in first_manifest["shards"]
            }
            second_shards = {
                row["path"]: row["sha256"]
                for row in second_manifest["shards"]
            }
            self.assertEqual(first_shards, second_shards)

    def test_compact_edges_expand_to_v1_semantics(self) -> None:
        seed = self.metadata[0]
        target = self.metadata[1]

        neighbor = {
            "t": target.identity,
            "v": target.vector_id,
            "s": 0.92,
            "r": [
                "semantic-affinity",
                "shared-topic",
            ],
            "e": {
                "semanticScore": 0.92,
                "topicIds": [
                    "openalex:T100"
                ],
            },
        }

        edge = expand_compact_edge(
            seed.identity,
            seed.vector_id,
            neighbor,
        )

        self.assertEqual(
            edge["id"],
            "rw:0:1",
        )
        self.assertEqual(
            edge["relationTypes"],
            [
                "semantic-affinity",
                "shared-topic",
            ],
        )
        self.assertEqual(
            edge["signals"],
            {
                "semantic": 0.92,
                "topic": 1.0,
            },
        )
        self.assertEqual(
            edge["evidence"][1]["topicIds"],
            ["openalex:T100"],
        )

    def test_validator_detects_tampered_shard(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            artifact = root / "artifact"
            self._build(artifact)

            manifest = json.loads(
                (artifact / "manifest.json").read_text(
                    encoding="utf-8"
                )
            )
            populated = next(
                row
                for row in manifest["shards"]
                if row["seed_count"]
            )
            shard = artifact / populated["path"]
            shard.write_bytes(
                shard.read_bytes() + b"tamper"
            )

            with self.assertRaisesRegex(
                RuntimeError,
                "Size mismatch|SHA-256 mismatch",
            ):
                validate_artifact(artifact)


if __name__ == "__main__":
    unittest.main()
