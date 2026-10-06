from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except ImportError:
    pa = None
    pq = None

from semantic_retrieval.abstract_enrichment import (
    TARGET_SCHEMA_VERSION,
    _safe_request_url,
    capture_openalex_abstracts,
    deterministic_sample_indices,
    fetch_openalex_batch,
    iter_missing_abstract_targets,
    normalize_openalex_id,
    read_targets,
    reconstruct_abstract,
    sha256_file,
)


class AbstractReconstructionTests(unittest.TestCase):
    def test_evenly_spaced_sample_indices_include_both_ends(self):
        self.assertEqual(deterministic_sample_indices(10, 4), [0, 3, 6, 9])
        self.assertEqual(deterministic_sample_indices(10, 1), [0])

    def test_normalizes_supported_openalex_id_forms(self):
        self.assertEqual(normalize_openalex_id(123), "W123")
        self.assertEqual(normalize_openalex_id("W123"), "W123")
        self.assertEqual(
            normalize_openalex_id("https://openalex.org/W123"), "W123"
        )

    def test_reconstructs_inverted_index_in_position_order(self):
        result = reconstruct_abstract(
            {"world": [1], "Hello": [0], "again": [3], "world.": [2]}
        )
        self.assertEqual(result, "Hello world world. again")

    def test_rejects_duplicate_positions(self):
        with self.assertRaisesRegex(ValueError, "Duplicate positions"):
            reconstruct_abstract({"one": [0], "two": [0]})

    def test_request_url_is_bounded_and_has_no_credentials(self):
        url = _safe_request_url(["W1", "https://openalex.org/W2"])
        self.assertIn("openalex_id%3AW1%7CW2", url)
        self.assertIn("abstract_inverted_index", url)
        self.assertNotIn("api_key", url)

    def test_api_key_is_sent_only_as_bearer_header(self):
        class FakeResponse:
            status = 200
            headers = {}

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return json.dumps(
                    {
                        "results": [
                            {
                                "id": "https://openalex.org/W1",
                                "abstract_inverted_index": {"Text": [0]},
                                "updated_date": "2026-10-05T00:00:00Z",
                            }
                        ]
                    }
                ).encode()

        with patch(
            "semantic_retrieval.abstract_enrichment.urllib.request.urlopen",
            return_value=FakeResponse(),
        ) as urlopen:
            result = fetch_openalex_batch(["W1"], api_key="secret-value")

        request = urlopen.call_args.args[0]
        self.assertEqual(request.get_header("Authorization"), "Bearer secret-value")
        self.assertNotIn("secret-value", request.full_url)
        self.assertEqual(result["rows"][0]["abstract"], "Text")


@unittest.skipIf(pa is None, "optional Arrow dependency is not installed")
class AbstractTargetTests(unittest.TestCase):
    def test_targets_only_eligible_rows_with_missing_abstracts(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "source.parquet"
            pq.write_table(
                pa.Table.from_pylist(
                    [
                        {
                            "work_id": 1,
                            "abstract": None,
                            "tier": "CORE",
                            "document_role": "SCHOLARLY",
                        },
                        {
                            "work_id": 2,
                            "abstract": " present ",
                            "tier": "CORE",
                            "document_role": "SCHOLARLY",
                        },
                        {
                            "work_id": 3,
                            "abstract": "   ",
                            "tier": "PROBABLE",
                            "document_role": "SCHOLARLY",
                        },
                        {
                            "work_id": 4,
                            "abstract": None,
                            "tier": "BORDERLINE",
                            "document_role": "SCHOLARLY",
                        },
                        {
                            "work_id": 5,
                            "abstract": None,
                            "tier": "CORE",
                            "document_role": "PARATEXT",
                        },
                    ]
                ),
                path,
            )

            targets = list(iter_missing_abstract_targets(path, batch_size=2))

            self.assertEqual([row["openalex_id"] for row in targets], ["W1", "W3"])
            self.assertEqual([row["sequence"] for row in targets], [0, 1])

    def test_read_targets_validates_schema_and_limit(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "targets.jsonl"
            rows = [
                {
                    "schema_version": TARGET_SCHEMA_VERSION,
                    "sequence": index,
                    "work_id": index + 1,
                    "openalex_id": f"W{index + 1}",
                }
                for index in range(3)
            ]
            path.write_text(
                "".join(json.dumps(row) + "\n" for row in rows),
                encoding="utf-8",
            )

            loaded = read_targets(path, limit=2)

            self.assertEqual(len(loaded), 2)
            self.assertEqual(loaded[1]["openalex_id"], "W2")

    def test_capture_is_bounded_resumable_and_preserves_target_order(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            targets_path = root / "targets.jsonl"
            targets = [
                {
                    "schema_version": TARGET_SCHEMA_VERSION,
                    "sequence": index,
                    "work_id": index + 1,
                    "openalex_id": f"W{index + 1}",
                }
                for index in range(3)
            ]
            targets_path.write_text(
                "".join(json.dumps(row) + "\n" for row in targets),
                encoding="utf-8",
            )
            calls: list[list[str]] = []

            def fake_fetch(ids, **kwargs):
                del kwargs
                ids = list(ids)
                calls.append(ids)
                rows = [
                    {
                        "openalex_id": openalex_id,
                        "found": True,
                        "abstract": f"Abstract for {openalex_id}",
                        "abstract_length": 15,
                        "source_updated_date": "2026-10-05T00:00:00Z",
                    }
                    for openalex_id in ids
                ]
                payload = json.dumps({"results": rows}).encode()
                return {
                    "requested_at": "2026-10-05T00:00:00Z",
                    "safe_url": "https://api.openalex.org/works?safe=true",
                    "status": 200,
                    "headers": {"x-ratelimit-remaining": "9999"},
                    "response_bytes": payload,
                    "rows": rows,
                }

            first = capture_openalex_abstracts(
                targets_path=targets_path,
                output_dir=root / "capture",
                expected_targets_sha256=sha256_file(targets_path),
                api_key="secret-not-persisted",
                batch_size=2,
                max_new_batches=1,
                fetch_batch=fake_fetch,
            )
            self.assertEqual(first["status"], "partial")
            self.assertEqual(first["progress"]["captured_batches"], 1)

            second = capture_openalex_abstracts(
                targets_path=targets_path,
                output_dir=root / "capture",
                expected_targets_sha256=sha256_file(targets_path),
                api_key="secret-not-persisted",
                batch_size=2,
                fetch_batch=fake_fetch,
            )

            self.assertEqual(second["status"], "complete")
            self.assertEqual(second["started_at"], first["started_at"])
            self.assertEqual(calls, [["W1", "W2"], ["W3"]])
            capture_rows = [
                json.loads(line)
                for line in Path(second["capture"]["path"])
                .read_text(encoding="utf-8")
                .splitlines()
            ]
            self.assertEqual(
                [row["openalex_id"] for row in capture_rows],
                ["W1", "W2", "W3"],
            )
            manifest_text = (root / "capture" / "manifest.json").read_text()
            self.assertNotIn("secret-not-persisted", manifest_text)


if __name__ == "__main__":
    unittest.main()
