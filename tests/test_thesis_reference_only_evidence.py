"""Verify a thesis-audit Actions artifact never contains PDF or full text."""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/thesis/stage_reference_only_evidence_v1.py"
spec = importlib.util.spec_from_file_location("reference_evidence", SCRIPT)
stager = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(stager)


class ReferenceOnlyEvidenceTest(unittest.TestCase):
    def test_stages_metadata_only_and_scrubs_raw_captures(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            source = base / "t2cb"
            export = base / "export"
            (source / "capture/thesis-work-00024461").mkdir(parents=True)
            (source / "ledger").mkdir()
            summary = {"captured": 1, "captures": [
                {"workId": "thesis:work:00024461",
                 "sha256": "a" * 64, "pages": 366,
                 "finalUrl": "https://www.riudg.udg.mx/bitstream/example.pdf"}
            ]}
            (source / "capture/capture-summary.json").write_text(
                json.dumps(summary), encoding="utf-8"
            )
            (source / "ledger/adjudication-ledger.json").write_text(
                '{"admissionChangeRequested":false}', encoding="utf-8"
            )
            raw = source / "capture/thesis-work-00024461"
            (raw / "source.pdf").write_bytes(b"%PDF-1.7\nprivate full document")
            (raw / "primary-source.txt").write_text(
                "private extracted thesis full text", encoding="utf-8"
            )
            (raw / "viewer-response.bin").write_bytes(b"raw viewer content")
            staged = stager.stage_evidence(source, export)
            self.assertEqual(staged, [
                "capture/capture-summary.json",
                "ledger/adjudication-ledger.json",
            ])
            self.assertEqual(
                sorted(p.relative_to(export).as_posix()
                       for p in export.rglob("*") if p.is_file()),
                sorted(staged),
            )
            stager.destroy_ephemeral_capture(source)
            self.assertFalse(raw.exists())
            self.assertTrue((source / "capture/capture-summary.json").exists())
            self.assertEqual(
                json.loads((export / "capture/capture-summary.json").read_text()),
                summary,
            )
            self.assertFalse(any(
                p.suffix in {".pdf", ".txt", ".bin"}
                for p in export.rglob("*") if p.is_file()
            ))

    def test_refuses_pdf_disguised_as_json(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "t2cb"
            (source / "capture").mkdir(parents=True)
            (source / "capture/capture-summary.json").write_bytes(
                b"%PDF-1.7\nunsafe bytes"
            )
            export = Path(temp) / "export"
            with self.assertRaisesRegex(ValueError, "PDF payload disguised"):
                stager.stage_evidence(source, export)
            self.assertFalse(export.exists())

    def test_refuses_fulltext_payload_disguised_as_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "t2cb"
            (source / "capture").mkdir(parents=True)
            (source / "capture/capture-summary.json").write_text(
                '{"captures":[{"fullText":"the full manuscript"}]}',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "Full-text payload key"):
                stager.stage_evidence(source, Path(temp) / "export")

    def test_no_unallowlisted_files_and_never_overwrite_export(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "t2cb"
            (source / "capture").mkdir(parents=True)
            (source / "capture/capture-summary.json").write_text(
                '{"captured":1}', encoding="utf-8"
            )
            (source / "capture/full-thesis.pdf").write_bytes(b"%PDF-1.7")
            export = Path(temp) / "export"
            stager.stage_evidence(source, export)
            self.assertEqual(
                [p.name for p in export.rglob("*") if p.is_file()],
                ["capture-summary.json"],
            )
            with self.assertRaisesRegex(ValueError, "must not preexist"):
                stager.stage_evidence(source, export)

    def test_fail_closed_if_no_allowed_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "t2cb"
            source.mkdir()
            with self.assertRaisesRegex(ValueError, "No reference-only evidence"):
                stager.stage_evidence(source, Path(temp) / "export")


if __name__ == "__main__":
    unittest.main()
