from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RELATED = ROOT / "scripts" / "related"
sys.path.insert(0, str(RELATED))

from authority_work_map_v1 import (  # noqa: E402
    sha256_file,
    shard_for_work_identity,
)
from validate_authority_work_map_v1 import (  # noqa: E402
    validate_authority_work_map,
)


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


class AuthorityWorkMapValidatorTests(unittest.TestCase):
    def _fixture(self, root: Path) -> tuple[Path, Path, Path]:
        author_index = root / "author-index"
        authority = root / "authority"
        artifact = root / "map"

        author_manifest = author_index / "manifest.json"
        authority_manifest = authority / "manifest.json"
        registry = authority / "registry.json"

        write_json(
            author_manifest,
            {
                "schema_version": "remote-author-index-manifest-v1",
                "version": "author-index-v2",
            },
        )
        write_json(
            authority_manifest,
            {
                "schemaVersion": "author-authority-batch-manifest-v1",
                "buildRevision": "authority-fixture",
            },
        )
        write_json(
            registry,
            {
                "schemaVersion": "author-authority-registry-v1",
                "buildRevision": "authority-fixture",
            },
        )

        shard_count = 2
        rows_by_shard: list[list[dict]] = [[], []]

        row = {
            "w": "openalex:W100",
            "n": 1,
            "u": 0,
            "a": [
                {
                    "r": "authority:one",
                    "p": ["first"],
                    "i": ["1"],
                    "c": True,
                }
            ],
        }

        rows_by_shard[
            shard_for_work_identity(row["w"], shard_count)
        ].append(row)

        shard_records = []
        for shard in range(shard_count):
            path = artifact / "shards" / f"shard-{shard:02x}.jsonl"
            path.parent.mkdir(parents=True, exist_ok=True)
            payload = "".join(
                json.dumps(item, ensure_ascii=False, sort_keys=True) + "\n"
                for item in sorted(rows_by_shard[shard], key=lambda item: item["w"])
            )
            path.write_text(payload, encoding="utf-8")
            shard_records.append(
                {
                    "shard": shard,
                    "path": f"shards/shard-{shard:02x}.jsonl",
                    "rows": len(rows_by_shard[shard]),
                    "sizeBytes": path.stat().st_size,
                    "sha256": sha256_file(path),
                }
            )

        write_json(
            artifact / "manifest.json",
            {
                "schemaVersion": "authority-work-map-v1",
                "buildRevision": "map-fixture",
                "source": {
                    "authorIndex": {
                        "manifestSha256": sha256_file(author_manifest),
                    },
                    "authorityGraph": {
                        "manifestSha256": sha256_file(authority_manifest),
                        "registrySha256": sha256_file(registry),
                    },
                },
                "partition": {
                    "method": "sha256-first-byte-mod-shard-count",
                    "shardCount": shard_count,
                },
                "counts": {
                    "worksSeen": 2,
                    "worksMapped": 1,
                    "worksWithoutConfirmedAuthority": 1,
                    "rawAuthorMentions": 3,
                    "confirmedAuthorityMentions": 1,
                    "unresolvedAuthorMentions": 2,
                    "collapsedAuthorityMentions": 0,
                },
                "files": {
                    "shards": shard_records,
                },
            },
        )

        return author_index, authority, artifact

    def test_validates_source_hashes_and_count_arithmetic(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            author_index, authority, artifact = self._fixture(root)

            report = validate_authority_work_map(
                artifact,
                author_index_root=author_index,
                authority_root=authority,
            )

            self.assertEqual(report["status"], "pass")
            self.assertEqual(report["worksSeen"], 2)
            self.assertEqual(report["worksMapped"], 1)
            self.assertEqual(report["uniqueMappedWorks"], 1)
            self.assertEqual(report["confirmedAuthorityMentions"], 1)

    def test_rejects_source_hash_drift(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            author_index, authority, artifact = self._fixture(root)

            (author_index / "manifest.json").write_text(
                '{"changed":true}\n',
                encoding="utf-8",
            )

            with self.assertRaisesRegex(
                RuntimeError,
                "author-index manifest SHA-256",
            ):
                validate_authority_work_map(
                    artifact,
                    author_index_root=author_index,
                    authority_root=authority,
                )

    def test_rejects_tampered_map_shard(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            author_index, authority, artifact = self._fixture(root)

            manifest = json.loads(
                (artifact / "manifest.json").read_text(encoding="utf-8")
            )
            populated = next(
                record
                for record in manifest["files"]["shards"]
                if record["rows"]
            )
            path = artifact / populated["path"]
            path.write_text(
                path.read_text(encoding="utf-8") + "\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(
                RuntimeError,
                "size mismatch|hash mismatch",
            ):
                validate_authority_work_map(
                    artifact,
                    author_index_root=author_index,
                    authority_root=authority,
                )


if __name__ == "__main__":
    unittest.main()
