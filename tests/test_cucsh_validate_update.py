#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "scripts" / "cucsh" / "validate_update.py"


def record(identifier, journal, year, issue_number=None):
    row = {
        "id": identifier,
        "title": f"Record {identifier}",
        "year": year,
        "journal": journal,
        "authors": ["Test Author"],
        "urls": {},
    }
    if issue_number is not None:
        row["issueNumber"] = issue_number
    return row


def snapshot(records):
    return {
        "schemaVersion": 1,
        "provider": "CUCSH Filosofía",
        "records": records,
    }


class CucshValidateUpdateTest(unittest.TestCase):
    def run_validator(self, allow_incomplete, sincronia_records=None):
        before = snapshot([
            record("prot:1", "Protrepsis", 2025),
            record("quad:1", "Quadripartita Ratio", 2025),
        ])
        after = snapshot([
            *before["records"],
            *(sincronia_records if sincronia_records is not None else [
                record("sync:1", "Sincronía", 1996, 1),
            ]),
        ])

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            before_path = root / "before.json"
            after_path = root / "after.json"
            before_path.write_text(json.dumps(before), encoding="utf-8")
            after_path.write_text(json.dumps(after), encoding="utf-8")

            command = [
                "python3",
                str(VALIDATOR),
                "--before",
                str(before_path),
                "--after",
                str(after_path),
            ]
            if allow_incomplete:
                command.append("--allow-incomplete-sincronia")

            return subprocess.run(
                command,
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )


    def test_one_article_per_issue_does_not_pass_release(
        self,
    ):
        # Old validator checked only that each issue number existed.
        # The same data now fails against observed historical floors.
        rows = [
            record(
                f"sync:{issue}",
                "Sincronía",
                1996 + (issue - 1) // 2,
                issue,
            )
            for issue in range(1, 91)
        ]
        result = self.run_validator(
            allow_incomplete=False,
            sincronia_records=rows,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "historical article counts fell below",
            result.stdout + result.stderr,
        )

    def test_author_metadata_regression_blocks_discovery_too(self):
        original = snapshot([
            record("prot:1", "Protrepsis", 2025),
            record("quad:1", "Quadripartita Ratio", 2025),
            {
                **record("sync:original", "Sincronía", 1997, 3),
                "authors": [{"name": "Helen Galkina"}],
                "legacyOriginal": True,
            },
        ])
        after = snapshot([
            *original["records"][:2],
            {
                **original["records"][2],
                "authors": [],
            },
        ])
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            before_file = path / "before.json"
            after_file = path / "after.json"
            before_file.write_text(json.dumps(original), encoding="utf-8")
            after_file.write_text(json.dumps(after), encoding="utf-8")
            result = subprocess.run(
                [
                    "python3", str(VALIDATOR),
                    "--before", str(before_file),
                    "--after", str(after_file),
                    "--allow-incomplete-sincronia",
                ],
                cwd=ROOT, capture_output=True, text=True, check=False,
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "previously verified Sincronía authors disappeared",
            result.stdout + result.stderr,
        )

    def test_title_provenance_reversion_is_blocked(self):
        row = {
            **record("sync:protected", "Sincronía", 1996, 1),
            "legacyOriginal": True,
            "legacyTitleEncodingEvidence": {
                "auditRunId": 43032349081,
                "previousTitle": "Filosof\ufffda",
            },
        }
        baseline = snapshot([
            record("prot:1", "Protrepsis", 2025),
            record("quad:1", "Quadripartita Ratio", 2025),
            row,
        ])
        after = snapshot([
            *baseline["records"][:2],
            {**row, "title": "Filosof\ufffda"},
        ])
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            before_path = root / "before.json"
            after_path = root / "after.json"
            before_path.write_text(json.dumps(baseline), encoding="utf-8")
            after_path.write_text(json.dumps(after), encoding="utf-8")
            result = subprocess.run(
                ["python3", str(VALIDATOR), "--before", str(before_path),
                 "--after", str(after_path), "--allow-incomplete-sincronia"],
                cwd=ROOT, text=True, capture_output=True, check=False,
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "verified Sincronía title repairs changed",
            result.stdout + result.stderr,
        )

    def test_issue17_author_index_reconstruction_preserves_encoding_provenance(self):
        from scripts.cucsh.validate_update import (
            safe_issue17_index_label_reconstruction,
        )

        original = {
            **record("sync:issue17", "Sincronía", 2000, 17),
            "title": "Campos Rodríguez , Patricia",
            "titleVariants": ["Campos Rodríguez , Patricia"],
            "authors": [],
            "legacyOriginal": True,
            "urls": {"canonical": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/camposr.htm"},
            "legacyTitleEncodingEvidence": {
                "kind": "original-issue-index-article-url-and-title",
                "auditRunId": 43032349081,
                "sourceIndexUrl": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/camposr.htm",
                "previousTitle": "Campos Rodr�guez , Patricia",
            },
        }
        updated = {
            **original,
            "title": "Una mujer empresaria de principios de siglo",
            "titleVariants": ["Una mujer empresaria de principios de siglo"],
            "authors": [{"name": "Patricia Campos Rodríguez"}],
            "legacyIndexMislabelEvidence": {
                "kind": "original-issue-index-used-author-names-instead-of-title",
                "auditRunId": 9876,
                "sourceIssueUrl": "https://dialnet.unirioja.es/ejemplar/547854",
                "dialnetArticleId": "dialnet:7425237",
                "sourceUrl": "https://dialnet.unirioja.es/servlet/articulo?codigo=7425237",
                "previousTitle": "Campos Rodríguez , Patricia",
                "score": 1.0,
                "priorIndexEncodingEvidencePreserved": True,
            },
        }
        self.assertTrue(safe_issue17_index_label_reconstruction(original, updated))
        tampered = {**updated, "legacyTitleEncodingEvidence": {"kind": "changed"}}
        self.assertFalse(safe_issue17_index_label_reconstruction(original, tampered))
        wrong_issue = {**updated, "issueNumber": 18}
        self.assertFalse(safe_issue17_index_label_reconstruction(original, wrong_issue))

        baseline = snapshot([
            record("prot:1", "Protrepsis", 2025),
            record("quad:1", "Quadripartita Ratio", 2025), original,
        ])
        after = snapshot([*baseline["records"][:2], updated])
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            before_path, after_path = root / "before.json", root / "after.json"
            before_path.write_text(json.dumps(baseline), encoding="utf-8")
            after_path.write_text(json.dumps(after), encoding="utf-8")
            process = subprocess.run(
                ["python3", str(VALIDATOR), "--before", str(before_path),
                 "--after", str(after_path), "--allow-incomplete-sincronia"],
                cwd=ROOT, text=True, capture_output=True, check=False,
            )
        self.assertEqual(process.returncode, 0, process.stdout + process.stderr)

    def test_issue44_cannot_regress_below_verified_ten(self):
        from scripts.cucsh.validate_update import (
            SINCRONIA_HISTORICAL_OBSERVED_MINIMUM,
        )
        self.assertEqual(
            SINCRONIA_HISTORICAL_OBSERVED_MINIMUM[44],
            10,
        )

    def test_discovery_mode_reports_missing_issues_without_failing(self):
        result = self.run_validator(allow_incomplete=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("DISCOVERY WARNING", result.stdout)
        self.assertIn("incomplete Sincronía issue coverage", result.stdout)
        self.assertIn("CUCSH UPDATE VALIDATION: PASS", result.stdout)

    def test_release_workflow_blocks_preserved_source(
        self,
    ):
        workflow = (
            ROOT / ".github" / "workflows" / "cucsh-harvest.yml"
        ).read_text(encoding="utf-8")
        self.assertIn("if grep -q 'status=preserved'", workflow)
        self.assertIn('if [ "${{ inputs.mode }}" = "release" ]; then', workflow)
        self.assertIn("CUCSH release blocked", workflow)
        self.assertIn("exit 1", workflow)

    def test_release_accepts_observed_baselines_through_issue_60(
        self,
    ):
        # Ensure the coverage counter includes issues 52-60, not only 1-51.
        from scripts.cucsh.validate_update import (
            SINCRONIA_HISTORICAL_OBSERVED_MINIMUM,
        )

        rows = [
            record(
                f"sync:{issue}:{index}",
                "Sincronía",
                1996 + (issue - 1) // 3,
                issue,
            )
            for issue, floor in SINCRONIA_HISTORICAL_OBSERVED_MINIMUM.items()
            for index in range(floor)
        ]
        rows.extend(
            record(f"sync:{issue}:modern", "Sincronía", 2026, issue)
            for issue in range(61, 91)
        )
        result = self.run_validator(
            allow_incomplete=False,
            sincronia_records=rows,
        )
        self.assertEqual(
            result.returncode,
            0,
            result.stdout + result.stderr,
        )

    def test_release_mode_still_fails_incomplete_coverage(self):
        result = self.run_validator(allow_incomplete=False)
        self.assertNotEqual(result.returncode, 0)
        combined = result.stdout + result.stderr
        self.assertIn("CUCSH UPDATE VALIDATION: FAIL", combined)
        self.assertIn("incomplete Sincronía issue coverage", combined)


if __name__ == "__main__":
    unittest.main()
