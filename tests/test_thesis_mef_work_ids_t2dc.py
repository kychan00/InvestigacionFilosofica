"""T2DC: exhaustive RIUdeG OAI metadata scan for thesis work identities."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/thesis/scan_riudg_mef_work_ids_t2dc.py"
T2DB = ROOT / "scripts/thesis/config/mef-program-resolution-t2db.json"

spec = importlib.util.spec_from_file_location("t2dc", SCRIPT)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)


def record(title, author, handle=None, program="Maestría en Estudios Filosóficos"):
    raw = {
        "dc.title": [title],
        "dc.contributor.author": [author],
        "dc.degree.name": [program],
        "dc.date.issued": ["2019"],
        "dc.type": ["Tesis de maestría"],
    }
    if handle:
        raw["dc.identifier.uri"] = [f"https://hdl.handle.net/{handle}"]
    return {
        "providerRecordId": f"oai:riudg:{handle or title[:8]}",
        "rawFields": raw,
    }


class T2DCTests(unittest.TestCase):
    def setUp(self):
        self.t2db = json.loads(T2DB.read_text(encoding="utf-8"))

    def fake_fetcher(self, pages):
        state = {"index": 0}

        def fetcher(*, token=None):
            index = state["index"]
            state["index"] += 1
            return pages[index]

        return fetcher

    def test_exact_mario_title_author_handle_confirms_work(self):
        mario = next(
            row for row in self.t2db["priorityCases"]
            if row["author"] == "Mario Damián Del Muro Silva"
        )
        pages = [{
            "records": [
                record(
                    mario["title"],
                    "Del Muro Silva, Mario Damián",
                    "20.500.12104/999001",
                )
            ],
            "tombstones": [],
            "nextToken": None,
            "completeListSize": "1",
        }]
        out = mod.scan(
            self.t2db,
            page_fetcher=self.fake_fetcher(pages),
            max_pages=5,
            delay_seconds=0,
        )
        mario_out = next(
            row for row in out["results"]
            if row["author"] == "Mario Damián Del Muro Silva"
        )
        self.assertEqual(mario_out["status"], "institutional-work-confirmed")
        self.assertTrue(mario_out["institutionalWorkIdentityConfirmed"])
        self.assertEqual(
            mario_out["selectedWork"]["handles"],
            ["20.500.12104/999001"],
        )

    def test_adriel_title_variant_can_match_exact_author(self):
        adriel = next(
            row for row in self.t2db["priorityCases"]
            if row["author"] == "Adriel Manuel Hernández Guzmán"
        )
        pages = [{
            "records": [
                record(
                    adriel["titleVariant"],
                    "Hernández Guzmán, Adriel Manuel",
                    "20.500.12104/999002",
                )
            ],
            "tombstones": [],
            "nextToken": None,
            "completeListSize": "1",
        }]
        out = mod.scan(
            self.t2db,
            page_fetcher=self.fake_fetcher(pages),
            max_pages=5,
            delay_seconds=0,
        )
        row = next(
            item for item in out["results"]
            if item["author"] == "Adriel Manuel Hernández Guzmán"
        )
        self.assertEqual(row["status"], "institutional-work-confirmed")
        self.assertEqual(len(row["exactTitleAuthor"]), 1)

    def test_title_only_candidate_never_confirms_work(self):
        mario = next(
            row for row in self.t2db["priorityCases"]
            if row["author"] == "Mario Damián Del Muro Silva"
        )
        pages = [{
            "records": [
                record(
                    mario["title"],
                    "Otra Persona",
                    "20.500.12104/999003",
                )
            ],
            "tombstones": [],
            "nextToken": None,
            "completeListSize": "1",
        }]
        out = mod.scan(
            self.t2db,
            page_fetcher=self.fake_fetcher(pages),
            max_pages=5,
            delay_seconds=0,
        )
        row = next(
            item for item in out["results"]
            if item["author"] == "Mario Damián Del Muro Silva"
        )
        self.assertEqual(row["status"], "not-found-in-completed-oai-scan")
        self.assertFalse(row["institutionalWorkIdentityConfirmed"])
        self.assertEqual(len(row["titleOnly"]), 1)

    def test_completed_negative_scan_is_not_nonexistence_claim(self):
        pages = [
            {
                "records": [record("Unrelated A", "Persona A")],
                "tombstones": [],
                "nextToken": "token-2",
                "completeListSize": "2",
            },
            {
                "records": [record("Unrelated B", "Persona B")],
                "tombstones": [],
                "nextToken": None,
                "completeListSize": "2",
            },
        ]
        out = mod.scan(
            self.t2db,
            page_fetcher=self.fake_fetcher(pages),
            max_pages=5,
            delay_seconds=0,
        )
        self.assertTrue(out["scan"]["completed"])
        self.assertFalse(out["negativeResultMeansNonexistence"])
        self.assertEqual(out["metrics"]["institutionalWorkIdentitiesConfirmed"], 0)
        self.assertTrue(
            all(
                row["status"] == "not-found-in-completed-oai-scan"
                for row in out["results"]
            )
        )

    def test_page_cap_marks_scan_incomplete(self):
        pages = [{
            "records": [record("Unrelated", "Persona")],
            "tombstones": [],
            "nextToken": "more",
            "completeListSize": "50000",
        }]
        out = mod.scan(
            self.t2db,
            page_fetcher=self.fake_fetcher(pages),
            max_pages=1,
            delay_seconds=0,
        )
        self.assertFalse(out["scan"]["completed"])
        self.assertTrue(all(row["status"] == "scan-incomplete" for row in out["results"]))

    def test_output_never_claims_physical_holding(self):
        pages = [{
            "records": [],
            "tombstones": [],
            "nextToken": None,
            "completeListSize": "0",
        }]
        out = mod.scan(
            self.t2db,
            page_fetcher=self.fake_fetcher(pages),
            max_pages=5,
            delay_seconds=0,
        )
        self.assertEqual(out["metrics"]["physicalHoldingsConfirmed"], 0)
        self.assertTrue(all(row["physicalHoldingConfirmed"] is False for row in out["results"]))


if __name__ == "__main__":
    unittest.main()
