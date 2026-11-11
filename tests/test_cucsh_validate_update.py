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
    def run_validator(self, allow_incomplete):
        before = snapshot([
            record("prot:1", "Protrepsis", 2025),
            record("quad:1", "Quadripartita Ratio", 2025),
        ])
        after = snapshot([
            *before["records"],
            record("sync:1", "Sincronía", 1996, 1),
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

    def test_discovery_mode_reports_missing_issues_without_failing(self):
        result = self.run_validator(allow_incomplete=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("DISCOVERY WARNING", result.stdout)
        self.assertIn("incomplete Sincronía issue coverage", result.stdout)
        self.assertIn("CUCSH UPDATE VALIDATION: PASS", result.stdout)

    def test_release_mode_still_fails_incomplete_coverage(self):
        result = self.run_validator(allow_incomplete=False)
        self.assertNotEqual(result.returncode, 0)
        combined = result.stdout + result.stderr
        self.assertIn("CUCSH UPDATE VALIDATION: FAIL", combined)
        self.assertIn("incomplete Sincronía issue coverage", combined)


if __name__ == "__main__":
    unittest.main()
