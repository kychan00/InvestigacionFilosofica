from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from semantic_retrieval.corpus_identity_audit import audit_corpus_identity


class CorpusIdentityAuditTests(unittest.TestCase):
    def test_exact_groups_conflicts_and_findings_are_deterministic(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            database = Path(temp_dir) / "documents.sqlite3"
            connection = sqlite3.connect(database)
            connection.execute(
                """
                CREATE TABLE documents (
                    vector_id INTEGER PRIMARY KEY,
                    id TEXT NOT NULL UNIQUE,
                    title TEXT,
                    abstract TEXT,
                    year INTEGER,
                    doi TEXT,
                    source TEXT,
                    openalex_id TEXT,
                    crossref_id TEXT,
                    url TEXT
                )
                """
            )
            rows = [
                (0, "W1", "<i>Same &amp; Work</i>", "Shared", 2020, None),
                (1, "W2", "Same & Work", "Shared", 2020, None),
                (2, "W3", "DOI title one", "First", 2021, "doi:10.1/x"),
                (3, "W4", "DOI title two", "Second", 2022, "https://doi.org/10.1/X"),
                (4, "W5", "", "Bad â€™ bytes", 2023, None),
                (5, "W6", "Same & Work", "Different", 2020, None),
            ]
            connection.executemany(
                "INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, 'OpenAlex', NULL, NULL, NULL)",
                rows,
            )
            connection.commit()
            connection.close()
            before = database.read_bytes()

            groups, sample, summary = audit_corpus_identity(database, sample_size=10)

            self.assertEqual(database.read_bytes(), before)
            self.assertEqual(summary["source_document_count"], 6)
            self.assertEqual(summary["exact_duplicate_group_count"], 2)
            self.assertEqual(summary["doi_metadata_conflict_group_count"], 1)
            self.assertEqual(summary["metadata_finding_counts"]["missing_title"], 1)
            self.assertEqual(
                summary["metadata_finding_counts"]["literal_html_markup"], 1
            )
            self.assertEqual(
                summary["metadata_finding_counts"]["suspected_mojibake"], 1
            )
            content_group = next(
                group for group in groups if group["classification"] == "content_exact"
            )
            self.assertEqual(content_group["member_ids"], ["W1", "W2"])
            self.assertEqual(
                content_group["action"], "eligible_for_conservative_collapse"
            )
            doi_group = next(
                group for group in groups if group["classification"] == "doi_exact"
            )
            self.assertEqual(doi_group["member_ids"], ["W3", "W4"])
            self.assertEqual(doi_group["action"], "review_only_doi_metadata_conflict")
            self.assertEqual(
                sample, sorted(groups, key=lambda group: group["group_id"])
            )

    def test_progress_is_emitted_only_at_fifty_thousand_boundary(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            database = Path(temp_dir) / "documents.sqlite3"
            connection = sqlite3.connect(database)
            connection.execute(
                """
                CREATE TABLE documents (
                    vector_id INTEGER PRIMARY KEY,
                    id TEXT NOT NULL UNIQUE,
                    title TEXT,
                    abstract TEXT,
                    year INTEGER,
                    doi TEXT,
                    source TEXT,
                    openalex_id TEXT,
                    crossref_id TEXT,
                    url TEXT
                )
                """
            )
            connection.execute(
                "INSERT INTO documents VALUES (0, 'W1', 'Title', 'Abstract', 2020, NULL, NULL, NULL, NULL, NULL)"
            )
            connection.commit()
            connection.close()
            progress: list[int] = []
            audit_corpus_identity(database, progress=progress.append)
            self.assertEqual(progress, [])


if __name__ == "__main__":
    unittest.main()
