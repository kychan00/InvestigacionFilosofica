from __future__ import annotations

import gzip
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
THESIS_DIR = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS_DIR))

MODULE_PATH = THESIS_DIR / "harvest_real_corpus_v1.py"
spec = importlib.util.spec_from_file_location("thesis_harvest", MODULE_PATH)
harvest = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(harvest)

canonical = harvest.canonical


class ThesisRealHarvestTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry(
            THESIS_DIR / "config" / "program-authority-v1.json"
        )

    def test_parse_riudg_list_records_preserves_tombstone_and_token(self):
        payload = (
            THESIS_DIR / "fixtures" / "riudg-list-records-page.xml"
        ).read_bytes()
        page = harvest.parse_riudg_list_records(
            payload,
            source_url="https://example.test/oai",
        )
        self.assertEqual(len(page["records"]), 1)
        self.assertEqual(len(page["tombstones"]), 1)
        self.assertEqual(page["nextToken"], "token-page-2")
        self.assertEqual(page["cursor"], "0")
        self.assertEqual(page["completeListSize"], "27431")
        self.assertEqual(
            page["tombstones"][0]["providerRecordId"],
            "oai:riudg.udg.mx:20.500.12104/deleted-1",
        )

    def test_parse_udgvirtual_browse_filters_structural_handles(self):
        html = (
            THESIS_DIR / "fixtures" / "udgvirtual-browse-page.html"
        ).read_text(encoding="utf-8")
        parsed = harvest.parse_udgvirtual_browse(html)
        self.assertEqual(parsed["handles"], ["1001", "1002", "1003"])
        self.assertEqual(parsed["reportedTotal"], 147)

    def test_observed_catalog_groups_program_variants(self):
        record_a = canonical.source_record(
            provider="riudg",
            provider_record_id="a",
            source_url=None,
            raw_fields={
                "dc.title": ["A"],
                "dc.degree.name": ["Licenciatura en Historia"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUCSH"],
            },
            raw_payload="a",
        )
        record_b = canonical.source_record(
            provider="riudg",
            provider_record_id="b",
            source_url=None,
            raw_fields={
                "dc.title": ["B"],
                "dc.degree.name": ["LICENCIATURA EN HISTORIA"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUCSH"],
            },
            raw_payload="b",
        )
        corpus = canonical.build_corpus(
            [record_a, record_b],
            self.registry,
            reference_year=2026,
        )
        catalog = harvest.observed_catalog(corpus)
        self.assertEqual(len(catalog["programs"]), 1)
        row = catalog["programs"][0]
        self.assertEqual(row["count"], 2)
        self.assertEqual(row["programRefs"], {"program:udg:lic-historia": 2})
        self.assertEqual(row["admissionStatuses"], {"include": 2})
        self.assertEqual(catalog["academicUnits"], {"CUCSH": 2})

    def test_coverage_ledger_reports_core_field_ratios(self):
        record = canonical.source_record(
            provider="riudg",
            provider_record_id="c",
            source_url=None,
            raw_fields={
                "dc.title": ["C"],
                "dc.contributor.author": ["Autora, Ana"],
                "dc.contributor.director": ["Director, Diego"],
                "dc.degree.name": ["Licenciatura en Filosofía"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.date.issued": ["2025"],
            },
            raw_payload="c",
        )
        corpus = canonical.build_corpus(
            [record],
            self.registry,
            reference_year=2026,
        )
        ledger = harvest.coverage_ledger(
            riudg={
                "status": "partial",
                "stopReason": "max-records",
                "completeListSize": 27431,
                "records": [record],
                "tombstones": [],
                "pages": [{}],
                "from": None,
                "until": None,
            },
            udgvirtual={
                "status": "partial",
                "stopReason": "max-records",
                "reportedTotal": 147,
                "enumeratedHandles": 147,
                "selectedHandles": 0,
                "records": [],
                "failures": [],
                "browsePages": [{}, {}],
            },
            corpus=corpus,
            started_at="2026-11-01T00:00:00Z",
            finished_at="2026-11-01T00:01:00Z",
        )
        self.assertEqual(ledger["corpus"]["works"], 1)
        self.assertEqual(ledger["fieldCoverage"]["title"]["ratio"], 1.0)
        self.assertEqual(ledger["fieldCoverage"]["author"]["ratio"], 1.0)
        self.assertEqual(ledger["fieldCoverage"]["director"]["ratio"], 1.0)

    def test_deterministic_gzip_output(self):
        payload = {"b": 2, "a": [1, 2, 3]}
        with tempfile.TemporaryDirectory() as tmp:
            first = pathlib.Path(tmp) / "first.json.gz"
            second = pathlib.Path(tmp) / "second.json.gz"
            harvest.write_json_gz(first, payload)
            harvest.write_json_gz(second, payload)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with gzip.open(first, "rt", encoding="utf-8") as handle:
                decoded = json.load(handle)
            self.assertEqual(decoded, payload)

    def test_jsonl_gzip_is_readable_and_stable(self):
        rows = [{"id": "b", "n": 2}, {"id": "a", "n": 1}]
        with tempfile.TemporaryDirectory() as tmp:
            first = pathlib.Path(tmp) / "first.jsonl.gz"
            second = pathlib.Path(tmp) / "second.jsonl.gz"
            harvest.write_jsonl_gz(first, rows)
            harvest.write_jsonl_gz(second, rows)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with gzip.open(first, "rt", encoding="utf-8") as handle:
                decoded = [json.loads(line) for line in handle if line.strip()]
            self.assertEqual(decoded, rows)

    def test_manifest_hashes_artifacts_and_excludes_itself(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = pathlib.Path(tmp)
            harvest.write_json(output / "coverage-ledger.json", {"ok": True})
            harvest.write_json(output / "observed-authorities.json", {"programs": []})
            corpus = {
                "programAuthorityRevision": "thesis-humanities-program-authority-v1",
                "metrics": {
                    "sourceRecords": 0,
                    "works": 0,
                    "worksByAdmission": {},
                    "providers": {},
                    "dateQuality": {},
                    "identityDecisions": {},
                },
            }
            ledger = {
                "schemaVersion": "thesis-coverage-ledger-v1",
                "finishedAt": "2026-11-01T00:00:00Z",
            }
            manifest = harvest.build_manifest(
                output,
                mode="sample",
                corpus=corpus,
                ledger=ledger,
            )
            paths = {item["path"] for item in manifest["files"]}
            self.assertEqual(
                paths,
                {"coverage-ledger.json", "observed-authorities.json"},
            )
            self.assertNotIn("manifest.json", paths)


if __name__ == "__main__":
    unittest.main()
