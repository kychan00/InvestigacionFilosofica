from __future__ import annotations

import gzip
import importlib.util
import json
import sqlite3
from pathlib import Path
import tempfile
import unittest

import numpy as np


MODULE_PATH = (
    Path(__file__).parents[1]
    / "scripts/retrieval/build_browser_static_v4_artifacts.py"
)
SPEC = importlib.util.spec_from_file_location("browser_static_v4_builder", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class BrowserStaticV4ArtifactsTest(unittest.TestCase):
    def test_quantization_contract(self):
        values = np.asarray([[-1.0, -0.5, 0.0, 0.5, 1.0]], dtype=np.float32)
        np.testing.assert_array_equal(
            MODULE.quantize(values), [[-127, -64, 0, 64, 127]]
        )

    def test_normalization_contract(self):
        values = np.asarray([[3.0, 4.0], [0.0, 0.0]], dtype=np.float32)
        output = MODULE.normalized(values)
        np.testing.assert_allclose(output[0], [0.6, 0.8])
        np.testing.assert_allclose(output[1], [0.0, 0.0])

    def test_metadata_page_is_deterministic_and_preserves_identifiers(self):
        with tempfile.TemporaryDirectory() as temporary_name:
            root = Path(temporary_name)
            database = root / "documents.sqlite3"
            connection = sqlite3.connect(database)
            connection.execute(
                """
                CREATE TABLE documents (
                    vector_id INTEGER PRIMARY KEY, id TEXT, title TEXT, abstract TEXT,
                    authors_json TEXT, year INTEGER, topics_json TEXT,
                    keywords_json TEXT, journal TEXT, language TEXT, doi TEXT,
                    source TEXT, publication_type TEXT, openalex_id TEXT,
                    crossref_id TEXT, url TEXT
                )
                """
            )
            connection.execute(
                "INSERT INTO documents VALUES (0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    "openalex-W1", "Título", "Resumen", '["Autora"]', 2026,
                    '["Ontología"]', '["Quine"]', "Revista", "es", "10/x",
                    "OpenAlex", "article", "W1", "crossref-1", "https://example.test",
                ),
            )
            connection.commit()
            connection.close()

            first = root / "first"
            second = root / "second"
            pages_a, count_a = MODULE.write_metadata_pages(database, first, root)
            pages_b, count_b = MODULE.write_metadata_pages(database, second, root)
            self.assertEqual((count_a, count_b), (1, 1))
            self.assertEqual(
                MODULE.sha256_file(root / pages_a[0]["path"]),
                MODULE.sha256_file(root / pages_b[0]["path"]),
            )
            with gzip.open(root / pages_a[0]["path"], "rt", encoding="utf-8") as handle:
                row = json.loads(handle.readline())
            self.assertEqual(row["id"], "openalex-W1")
            self.assertEqual(row["openalex_id"], "W1")
            self.assertEqual(row["crossref_id"], "crossref-1")
            self.assertEqual(row["authors"], ["Autora"])


if __name__ == "__main__":
    unittest.main()
