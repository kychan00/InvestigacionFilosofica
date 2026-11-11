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
