from __future__ import annotations

import gzip
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
    WorkMetadata,
)
from validate_related_work_index_v1 import validate_artifact  # noqa: E402
from authority_work_map_v1 import (  # noqa: E402
    AuthorityWorkInfo,
    AuthorityWorkMap,
    build_work_authority_info_index,
)


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

    def test_authority_mapping_survives_non_openalex_representative(self) -> None:
        metadata = [
            WorkMetadata(
                vector_id=0,
                identity="doi:10.1000/shared",
                openalex_identity=None,
                topics=(),
                year=2020,
            ),
            WorkMetadata(
                vector_id=1,
                identity="doi:10.1000/shared",
                openalex_identity="openalex:W777",
                topics=(),
                year=2020,
            ),
        ]
        _, representatives = representative_vector_ids(metadata)
        authority_map = AuthorityWorkMap(
            manifest={
                "schemaVersion": "authority-work-map-v1",
            },
            works={
                "openalex:W777": AuthorityWorkInfo(
                    work_identity="openalex:W777",
                    author_count=1,
                    unresolved_count=0,
                    authority_refs=("authority:canonical",),
                ),
            },
        )

        index = build_work_authority_info_index(
            metadata,
            authority_map,
            representatives,
        )

        self.assertIn(0, index)
        self.assertEqual(
            index[0].authority_refs,
            ("authority:canonical",),
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

    def _authority_map(self) -> AuthorityWorkMap:
        return AuthorityWorkMap(
            manifest={
                "schemaVersion": "authority-work-map-v1",
                "buildRevision": "authority-fixture",
                "source": {
                    "authorityGraph": {
                        "buildRevision": "authority-graph-fixture",
                    },
                },
                "counts": {
                    "worksMapped": 3,
                },
            },
            works={
                "openalex:W1001": AuthorityWorkInfo(
                    work_identity="openalex:W1001",
                    author_count=2,
                    unresolved_count=0,
                    authority_refs=("authority:a", "authority:b"),
                ),
                "openalex:W1004": AuthorityWorkInfo(
                    work_identity="openalex:W1004",
                    author_count=2,
                    unresolved_count=0,
                    authority_refs=("authority:a", "authority:c"),
                ),
                "openalex:W1006": AuthorityWorkInfo(
                    work_identity="openalex:W1006",
                    author_count=1,
                    unresolved_count=0,
                    authority_refs=("authority:a",),
                ),
            },
        )

    def _row_for_seed(
        self,
        artifact: Path,
        seed_identity: str,
    ) -> dict:
        manifest = json.loads(
            (artifact / "manifest.json").read_text(encoding="utf-8")
        )
        for record in manifest["shards"]:
            path = artifact / record["path"]
            with gzip.open(path, "rt", encoding="utf-8") as handle:
                for line in handle:
                    if not line.strip():
                        continue
                    row = json.loads(line)
                    if row["s"] == seed_identity:
                        return row
        raise AssertionError(f"Seed not found: {seed_identity}")

    def test_authority_graph_adds_nonsemantic_candidates(self) -> None:
        authority_map = self._authority_map()

        def provider(seed_vector_ids):
            output = {}
            for vector_id in seed_vector_ids:
                output[int(vector_id)] = [
                    (int(vector_id), 1.0),
                    (1, 0.90),
                ]
            return output

        with tempfile.TemporaryDirectory() as temporary:
            artifact = Path(temporary) / "authority-artifact"

            build_from_neighbor_provider(
                metadata=self.metadata,
                neighbor_provider=provider,
                output_dir=artifact,
                source={"mode": "authority-fixture"},
                neighbors_per_seed=1,
                authority_neighbors_per_seed=2,
                authority_work_map=authority_map,
                search_multiplier=2,
                shard_count=8,
                batch_size=2,
                minimum_semantic_score=0.5,
            )

            report = validate_artifact(artifact)
            self.assertEqual(report["status"], "pass")

            row = self._row_for_seed(
                artifact,
                "doi:10.1000/seed",
            )
            by_target = {
                neighbor["t"]: neighbor
                for neighbor in row["n"]
            }

            self.assertIn("openalex:W1006", by_target)
            self.assertIn("openalex:W1004", by_target)

            solo_target = by_target["openalex:W1006"]
            self.assertNotIn(
                "semantic-affinity",
                solo_target["r"],
            )
            self.assertIn(
                "same-author",
                solo_target["r"],
            )
            self.assertNotIn(
                "shared-coauthor",
                solo_target["r"],
            )
            self.assertEqual(
                solo_target["e"]["authorityRefs"],
                ["authority:a"],
            )

            collaborative_target = by_target["openalex:W1004"]
            self.assertIn(
                "same-author",
                collaborative_target["r"],
            )
            self.assertIn(
                "shared-coauthor",
                collaborative_target["r"],
            )
            self.assertEqual(
                collaborative_target["e"]["sharedAuthorityRefs"],
                ["authority:a"],
            )

            manifest = json.loads(
                (artifact / "manifest.json").read_text(encoding="utf-8")
            )
            self.assertIn(
                "same-author",
                manifest["relations"]["generated"],
            )
            self.assertIn(
                "shared-coauthor",
                manifest["relations"]["generated"],
            )
            self.assertEqual(
                manifest["relations"]["not_generated_without_authority_graph"],
                [],
            )
            self.assertGreater(
                manifest["totals"]["authority_only_edges"],
                0,
            )

    def test_authority_only_edge_expands_to_bibliographic_evidence(self) -> None:
        neighbor = {
            "t": "openalex:W1004",
            "v": 3,
            "r": [
                "same-author",
                "shared-coauthor",
            ],
            "e": {
                "authorityRefs": ["authority:a"],
                "sharedAuthorityRefs": ["authority:a"],
            },
        }

        edge = expand_compact_edge(
            "doi:10.1000/seed",
            0,
            neighbor,
        )

        self.assertEqual(
            edge["signals"],
            {
                "author": 1.0,
                "coauthor": 1.0,
            },
        )
        self.assertEqual(
            edge["evidence"][0]["class"],
            "bibliographic",
        )
        self.assertTrue(
            edge["evidence"][0]["structuredIdentity"],
        )
        self.assertEqual(
            edge["evidence"][0]["authorityRefs"],
            ["authority:a"],
        )
        self.assertEqual(
            edge["evidence"][1]["sharedAuthorityRefs"],
            ["authority:a"],
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
