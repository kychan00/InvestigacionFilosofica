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
    API_CAPTURE_SCHEMA_VERSION,
    TARGET_SCHEMA_VERSION,
    sha256_file,
)
from semantic_retrieval.config import RetrievalSettings
from semantic_retrieval.corpus_enrichment import build_enriched_corpus


@unittest.skipIf(pa is None, "optional Arrow dependency is not installed")
class CorpusEnrichmentTests(unittest.TestCase):
    def test_fills_only_missing_abstracts_and_preserves_every_other_value(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source_path = root / "v3.2.parquet"
            source_rows = [
                {
                    "work_id": 1,
                    "title": "Needs abstract",
                    "abstract": None,
                    "tier": "CORE",
                    "document_role": "SCHOLARLY",
                },
                {
                    "work_id": 2,
                    "title": "Still missing",
                    "abstract": None,
                    "tier": "PROBABLE",
                    "document_role": "SCHOLARLY",
                },
                {
                    "work_id": 3,
                    "title": "Already present",
                    "abstract": "Original abstract",
                    "tier": "CORE",
                    "document_role": "SCHOLARLY",
                },
            ]
            pq.write_table(pa.Table.from_pylist(source_rows), source_path)

            targets_path = root / "targets.jsonl"
            target_rows = [
                {
                    "schema_version": TARGET_SCHEMA_VERSION,
                    "sequence": index,
                    "work_id": index + 1,
                    "openalex_id": f"W{index + 1}",
                }
                for index in range(2)
            ]
            targets_path.write_text(
                "".join(json.dumps(row) + "\n" for row in target_rows),
                encoding="utf-8",
            )

            capture_path = root / "capture.jsonl"
            capture_rows = [
                {
                    "openalex_id": "W1",
                    "found": True,
                    "abstract": "Recovered abstract",
                    "abstract_length": len("Recovered abstract"),
                    "source_updated_date": "2026-10-05T00:00:00Z",
                },
                {
                    "openalex_id": "W2",
                    "found": False,
                    "abstract": None,
                    "abstract_length": 0,
                    "source_updated_date": None,
                },
            ]
            capture_path.write_text(
                "".join(json.dumps(row) + "\n" for row in capture_rows),
                encoding="utf-8",
            )
            manifest_path = root / "manifest.json"
            manifest_path.write_text(
                json.dumps(
                    {
                        "schema_version": API_CAPTURE_SCHEMA_VERSION,
                        "status": "complete",
                        "started_at": "2026-10-05T00:00:00Z",
                        "updated_at": "2026-10-05T01:00:00Z",
                        "targets": {"sha256": sha256_file(targets_path)},
                        "capture": {
                            "rows": 2,
                            "sha256": sha256_file(capture_path),
                        },
                    }
                ),
                encoding="utf-8",
            )
            output_path = root / "v3.3.parquet"
            metadata_path = root / "v3.3.metadata.json"

            with patch(
                "semantic_retrieval.corpus_enrichment.HuggingFaceDocumentSource.download",
                return_value=source_path,
            ):
                metadata = build_enriched_corpus(
                    RetrievalSettings(),
                    targets_path=targets_path,
                    capture_path=capture_path,
                    capture_manifest_path=manifest_path,
                    expected_targets_sha256=sha256_file(targets_path),
                    expected_source_sha256=sha256_file(source_path),
                    output_path=output_path,
                    metadata_path=metadata_path,
                    batch_size=2,
                )

            output_rows = pq.read_table(output_path).to_pylist()
            self.assertEqual(output_rows[0]["abstract"], "Recovered abstract")
            self.assertIsNone(output_rows[1]["abstract"])
            self.assertEqual(output_rows[2]["abstract"], "Original abstract")
            self.assertEqual(
                [{key: value for key, value in row.items() if key != "abstract"}
                 for row in output_rows],
                [{key: value for key, value in row.items() if key != "abstract"}
                 for row in source_rows],
            )
            self.assertEqual(metadata["validation"]["abstracts_filled"], 1)
            self.assertEqual(metadata["validation"]["targets_still_missing"], 1)
            self.assertTrue(metadata["gate"]["publication_allowed"])


if __name__ == "__main__":
    unittest.main()
