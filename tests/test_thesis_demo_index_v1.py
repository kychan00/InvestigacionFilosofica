"""V1 thesis demo: reference-only index projection and source-link safety."""
from __future__ import annotations

import copy
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/thesis/build_thesis_demo_index_v1.py"
spec = importlib.util.spec_from_file_location("demo_index", SCRIPT)
demo = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(demo)


def fixture():
    contract = {
        "releaseTag": "thesis-effective-corpus-v1",
        "effectiveCorpusSchemaVersion": "thesis-effective-corpus-v1",
        "programAuthorityRevision": "2026-11-03.v47",
        "metadataConfidenceRevision": "2026-11-02.v5",
        "workAdmissionDecisionRevision": "2026-11-03.t2bx-v1",
        "effectiveCorpusGzipSha256": "b" * 64,
        "worksTotal": 3,
        "admissionCounts": {"include": 2, "review": 1},
    }
    common = {
        "programRef": "program:udg:filosofia",
        "programRaw": "Licenciatura en Filosofía",
        "academicUnitRaw": "CUCSH",
        "contributions": [
            {"role": "thesis-author", "rawName": "María Díaz"},
            {"role": "thesis-director", "rawName": "Ángel Pérez"},
        ],
        "date": {"value": "2021-07-20", "quality": "valid"},
        "keywords": ["hermenéutica"],
        "abstract": "Investigación filosófica sobre la interpretación.",
    }
    works = [
        {
            **common,
            "id": "thesis:work:00000001",
            "title": "Interpretación filosófica",
            "admissionStatus": "include",
            "persistentIdentifiers": [{
                "scheme": "handle",
                "normalizedValue": "20.500.12104/84204",
            }],
            "sourceRecordRefs": ["source:a"],
        },
        {
            **common,
            "id": "thesis:work:00000002",
            "title": "Lenguaje y género",
            "date": {"value": "1969-12-31", "quality": "suspicious"},
            "admissionStatus": "include",
            "persistentIdentifiers": [],
            "sourceRecordRefs": ["source:b"],
        },
        {
            **common,
            "id": "thesis:work:00000003",
            "title": "Investigación fuera de Humanidades",
            "admissionStatus": "review",
            "persistentIdentifiers": [],
            "sourceRecordRefs": [],
        },
    ]
    corpus = {
        "effectiveCorpusSchemaVersion": contract["effectiveCorpusSchemaVersion"],
        "programAuthorityRevision": contract["programAuthorityRevision"],
        "programMetadataEvidenceRevision": contract["metadataConfidenceRevision"],
        "effectiveAdmissionRevision": contract["workAdmissionDecisionRevision"],
        "works": works,
        "sourceRecords": [{
            "id": "source:b",
            "rawFields": {"dc.identifier.uri": [
                "https://riudg.udg.mx/handle/20.500.12104/84205",
            ]},
        }],
        "programAuthorities": [{
            "id": "program:udg:filosofia",
            "canonicalName": "Licenciatura en Filosofía",
            "level": "licenciatura",
        }],
    }
    return corpus, contract


class ThesisDemoIndexV1Test(unittest.TestCase):
    def test_only_included_works_and_verified_links(self):
        corpus, contract = fixture()
        before = copy.deepcopy(corpus)
        result = demo.build_index(corpus, contract)
        self.assertEqual(corpus, before)
        self.assertEqual(result["totalIncluded"], 2)
        self.assertEqual(result["totalCanonical"], 3)
        self.assertEqual(result["sourceRelease"], "thesis-effective-corpus-v1")
        self.assertTrue(result["referenceOnly"])
        ids = {x["id"] for x in result["records"]}
        self.assertEqual(ids, {"thesis:work:00000001", "thesis:work:00000002"})
        first = next(x for x in result["records"] if x["id"].endswith("1"))
        second = next(x for x in result["records"] if x["id"].endswith("2"))
        self.assertEqual(first["sourceUrl"], "https://hdl.handle.net/20.500.12104/84204")
        self.assertEqual(first["authors"], ["María Díaz"])
        self.assertEqual(first["directors"], ["Ángel Pérez"])
        self.assertEqual(second["sourceUrl"], "https://riudg.udg.mx/handle/20.500.12104/84205")
        self.assertIsNone(second["year"])

    def test_rejects_pdf_and_noninstitutional_urls(self):
        unsafe = [
            "https://riudg.udg.mx/bitstream/20.500.12104/84204/1/source.pdf",
            "https://evil.example/handle/84204",
            "http://riudg.udg.mx/handle/84204",
            "javascript:alert(1)",
            "https://riudg.udg.mx/download",
            "https://riudg.udg.mx/bitstreams/84204",
        ]
        for url in unsafe:
            with self.subTest(url=url):
                self.assertIsNone(demo.safe_institutional_url(url))

    def test_short_abstract_and_no_document_payload(self):
        corpus, contract = fixture()
        corpus["works"][0]["abstract"] = "a" * 5000
        corpus["works"][0]["documentText"] = "PRIVATE FULL MANUSCRIPT"
        corpus["works"][0]["pdfBytes"] = "PRIVATE PDF"
        row = demo.build_index(corpus, contract)["records"][0]
        self.assertLessEqual(len(row["abstractExcerpt"]), 460)
        self.assertNotIn("documentText", row)
        self.assertNotIn("pdfBytes", row)
        self.assertNotIn("PRIVATE", str(row))

    def test_fails_closed_on_admission_or_revision_mismatch(self):
        corpus, contract = fixture()
        contract["admissionCounts"]["include"] = 3
        with self.assertRaisesRegex(ValueError, "admission counts"):
            demo.build_index(corpus, contract)
        corpus, contract = fixture()
        corpus["programAuthorityRevision"] = "unapproved"
        with self.assertRaisesRegex(ValueError, "Program Authority"):
            demo.build_index(corpus, contract)

    def test_blocked_handle_uses_no_guessed_link(self):
        corpus, contract = fixture()
        corpus["works"][0]["persistentIdentifiers"] = [{
            "scheme": "handle",
            "normalizedValue": "../../private",
        }]
        result = demo.build_index(corpus, contract)
        first = next(x for x in result["records"] if x["id"].endswith("1"))
        self.assertIsNone(first["sourceUrl"])
        self.assertIsNone(first["handle"])

    def test_uses_current_pinned_authority_metadata_for_degree(self):
        corpus, contract = fixture()
        corpus["programAuthorities"] = []
        registry = {
            "registryRevision": "2026-11-03.v47",
            "programs": [
                {"id": "program:udg:filosofia",
                 "canonicalName": "Licenciatura en Filosofía",
                 "level": "licenciatura"},
            ],
        }
        data = demo.build_index(corpus, contract, registry=registry)
        self.assertEqual({x["degree"] for x in data["records"]}, {"licenciatura"})
        registry["registryRevision"] = "outdated"
        with self.assertRaisesRegex(ValueError, "Demo registry Program Authority"):
            demo.build_index(corpus, contract, registry=registry)

    def test_duplicate_ids_are_rejected(self):
        corpus, contract = fixture()
        corpus["works"][1]["id"] = corpus["works"][0]["id"]
        with self.assertRaisesRegex(ValueError, "Duplicate work ID"):
            demo.build_index(corpus, contract)


if __name__ == "__main__":
    unittest.main()
