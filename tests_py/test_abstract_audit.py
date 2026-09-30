from __future__ import annotations

import json
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except ImportError:
    pa = None
    pq = None

from semantic_retrieval.abstract_audit import _smoke_inputs, audit_abstracts
from semantic_retrieval.config import RetrievalSettings


@unittest.skipIf(pa is None, "optional Arrow dependency is not installed")
class AbstractAuditTests(unittest.TestCase):
    def test_smoke_inputs_resolve_manifest_relative_shard_paths(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            shards = root / "embeddings" / "shards"
            shards.mkdir(parents=True)
            original = {
                "work_id": 7,
                "title": "Modal imagination",
                "abstract": "A sufficiently informative abstract.",
                "ontology_keyword_id": "modality",
            }
            pq.write_table(
                pa.Table.from_pylist(
                    [
                        {
                            "vector_id": 0,
                            "id": "openalex-W7",
                            "abstract": original["abstract"],
                            "original_json": json.dumps(original),
                        }
                    ]
                ),
                shards / "part-0.parquet",
            )
            (root / "embeddings" / "manifest.json").write_text(
                '{"shards":[{"file":"shards/part-0.parquet"}]}',
                encoding="utf-8",
            )

            result = _smoke_inputs(root, 1)

            self.assertEqual(len(result["documents"]), 1)
            self.assertTrue(result["documents"][0]["abstract_block_present"])
            self.assertIn(
                "Keywords:\nmodality", result["documents"][0]["embedding_input"]
            )

    def test_counts_bins_breakdowns_and_samples_match_retrieval_eligibility(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.parquet"
            rows = [
                {
                    "work_id": 1,
                    "title": "Full abstract",
                    "abstract": "a" * 250,
                    "publication_year": 2020,
                    "language": "en",
                    "type": "article",
                    "tier": "CORE",
                    "document_role": "SCHOLARLY",
                },
                {
                    "work_id": 2,
                    "title": "Short abstract",
                    "abstract": " short   text ",
                    "publication_year": 2021,
                    "language": "es",
                    "type": "book",
                    "tier": "PROBABLE",
                    "document_role": "SCHOLARLY",
                },
                {
                    "work_id": 3,
                    "title": "Missing abstract",
                    "abstract": None,
                    "publication_year": 2021,
                    "language": "es",
                    "type": "article",
                    "tier": "CORE",
                    "document_role": "SCHOLARLY",
                },
                {
                    "work_id": 4,
                    "title": "Excluded tier",
                    "abstract": "a" * 400,
                    "publication_year": 2022,
                    "language": "en",
                    "type": "article",
                    "tier": "BORDERLINE",
                    "document_role": "SCHOLARLY",
                },
                {
                    "work_id": 5,
                    "title": "Excluded role",
                    "abstract": "a" * 400,
                    "publication_year": 2022,
                    "language": "en",
                    "type": "article",
                    "tier": "CORE",
                    "document_role": "PARATEXT",
                },
            ]
            pq.write_table(pa.Table.from_pylist(rows), source)
            output = root / "abstract-audit.json"
            settings = replace(RetrievalSettings(), artifacts_dir=root / "artifacts")

            with patch(
                "semantic_retrieval.abstract_audit.HuggingFaceDocumentSource.download",
                return_value=source,
            ):
                report = audit_abstracts(
                    settings,
                    output_path=output,
                    sample_size=2,
                    seed=7,
                    batch_size=2,
                    progress_interval=0,
                )

            self.assertEqual(report["counts"]["total_rows"], 5)
            self.assertEqual(report["counts"]["eligible_rows"], 3)
            self.assertEqual(report["counts"]["with_abstract"], 2)
            self.assertEqual(report["counts"]["without_abstract"], 1)
            self.assertEqual(report["length_bins"]["0"], 1)
            self.assertEqual(report["length_bins"]["1-49"], 1)
            self.assertEqual(report["length_bins"]["200-499"], 1)
            self.assertEqual(
                report["abstract_lengths_nonempty"][
                    "minimum_useful_characters_observed"
                ],
                250,
            )
            self.assertEqual(report["samples"]["with_abstract"]["rows"], 2)
            self.assertEqual(report["samples"]["without_abstract"]["rows"], 1)
            self.assertEqual(report["samples"]["short_abstract"]["rows"], 1)
            self.assertFalse(report["gate"]["mass_embedding_build_allowed"])
            self.assertTrue(output.is_file())

    def test_final_decision_requires_a_reason(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.parquet"
            pq.write_table(
                pa.Table.from_pylist(
                    [
                        {
                            "work_id": 1,
                            "title": "Title",
                            "abstract": None,
                            "publication_year": 2020,
                            "language": "en",
                            "type": "article",
                            "tier": "CORE",
                            "document_role": "SCHOLARLY",
                        }
                    ]
                ),
                source,
            )
            settings = replace(RetrievalSettings(), artifacts_dir=root / "artifacts")
            with (
                patch(
                    "semantic_retrieval.abstract_audit.HuggingFaceDocumentSource.download",
                    return_value=source,
                ),
                self.assertRaisesRegex(ValueError, "requires a reason"),
            ):
                audit_abstracts(
                    settings,
                    output_path=root / "report.json",
                    decision="NEEDS_ENRICHMENT",
                    progress_interval=0,
                )


if __name__ == "__main__":
    unittest.main()
