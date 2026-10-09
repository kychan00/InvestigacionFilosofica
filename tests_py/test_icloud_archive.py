from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from semantic_retrieval.icloud_archive import roundtrip_archive, sha256_file


class FakeICloudController:
    def __init__(self):
        self.calls: list[tuple[str, Path]] = []

    def status(self, path: Path):
        self.calls.append(("status", path))
        return {"exists": True, "isUbiquitous": True, "isUploaded": True}

    def wait_uploaded(self, path: Path, timeout_seconds: int):
        self.calls.append(("wait_uploaded", path))
        return {"exists": True, "isUbiquitous": True, "isUploaded": True}

    def evict(self, path: Path):
        self.calls.append(("evict", path))
        return {"exists": True, "isUbiquitous": True, "isUploaded": True}

    def download(self, path: Path, timeout_seconds: int):
        self.calls.append(("download", path))
        return {"exists": True, "isUbiquitous": True, "isUploaded": True}


class ICloudArchiveTests(unittest.TestCase):
    def test_roundtrip_preserves_hash_and_uses_safe_sequence(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.bin"
            source.write_bytes(b"semantic retrieval artifact\n")
            icloud = root / "icloud"
            icloud.mkdir()
            controller = FakeICloudController()

            result = roundtrip_archive(
                source,
                icloud_root=icloud,
                relative_target=Path("v3.3/shards/part-000.parquet"),
                controller=controller,
                evict_after_verify=True,
            )

            target = icloud / "v3.3/shards/part-000.parquet"
            self.assertEqual(result["sha256"], sha256_file(source))
            self.assertEqual(sha256_file(target), sha256_file(source))
            self.assertTrue(result["roundtrip_hash_equal"])
            self.assertEqual(
                [name for name, _path in controller.calls],
                ["wait_uploaded", "evict", "download", "status", "evict"],
            )

    def test_refuses_escape_and_overwrite(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.bin"
            source.write_bytes(b"first")
            icloud = root / "icloud"
            icloud.mkdir()
            controller = FakeICloudController()

            with self.assertRaises(ValueError):
                roundtrip_archive(
                    source,
                    icloud_root=icloud,
                    relative_target=Path("../escape.bin"),
                    controller=controller,
                )

            target = icloud / "existing.bin"
            target.write_bytes(b"different")
            with self.assertRaises(FileExistsError):
                roundtrip_archive(
                    source,
                    icloud_root=icloud,
                    relative_target=Path("existing.bin"),
                    controller=controller,
                )

    def test_move_source_keeps_verified_icloud_copy_only(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.bin"
            source.write_bytes(b"move after verification")
            expected_hash = sha256_file(source)
            icloud = root / "icloud"
            icloud.mkdir()

            result = roundtrip_archive(
                source,
                icloud_root=icloud,
                relative_target=Path("v3.3/shard.parquet"),
                controller=FakeICloudController(),
                move_source=True,
            )

            target = icloud / "v3.3/shard.parquet"
            self.assertFalse(source.exists())
            self.assertEqual(sha256_file(target), expected_hash)
            self.assertTrue(result["source_moved"])


if __name__ == "__main__":
    unittest.main()
