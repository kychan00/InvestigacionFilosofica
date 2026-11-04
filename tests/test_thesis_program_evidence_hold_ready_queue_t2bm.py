"""T2BM: evidence hold is a scheduling decision, never thesis admission."""
import json
import sys
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))
import build_canonical_corpus_v1 as canonical
import build_program_curation_queue_v1 as queue

class EvidenceHoldTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.policy = json.loads(
            (ROOT / "scripts/thesis/config/program-evidence-holds-v1.json")
            .read_text(encoding="utf-8")
        )
        cls.hold = cls.policy["holds"][0]["programRef"]
        cls.other = "program:udg:test-ready-humanities-review"

    def make_queue(self, policy=None):
        rows = []
        obs = []
        for raw, ref, n in [
            ("Maestría En Arquitectura; Orientacion Arte Y Comunicacion", self.hold, 7),
            ("Maestría en Estudios Aplicados", self.other, 1)
        ]:
            rows.extend([{
                "programRaw": raw, "academicUnitRaw": "CUAAD",
                "admissionStatus": "review", "programRef": ref,
                "date": {"value": "2002", "quality": "valid"},
                "programMetadataEvidence": {
                    "authorityApplicability": "allowed", "confidenceState": "unassessed"
                }
            } for _ in range(n)])
            obs.append({
                "normalizedKey": canonical.normalize_key(raw),
                "count": n, "variants": {raw: n}, "providers": {"riudg": n},
                "admissionStatuses": {"review": n}, "programRefs": {ref: n}
            })
        registry = json.loads(json.dumps(self.registry))
        registry["programs"].append({
            "id": self.other,
            "canonicalName": "Maestría en Estudios Aplicados",
            "aliases": ["Maestría en Estudios Aplicados"],
            "admissionState": "review",
            "observedCount": 1,
            "lifecycleState": "current",
            "evidence": [],
        })
        return queue.build_queue(
            {"programs": obs}, {"works": rows}, registry,
            work_review_policy={"programs": []},
            evidence_hold_policy=self.policy if policy is None else policy,
        )

    def test_ready_skips_hold_but_retains_legacy_queue(self):
        q = self.make_queue()
        self.assertEqual(q["metrics"]["humanitiesActionQueueItems"], 2)
        self.assertEqual(q["metrics"]["humanitiesActionWorks"], 8)
        self.assertEqual(q["metrics"]["evidenceHoldWorks"], 7)
        self.assertEqual(q["metrics"]["humanitiesReadyWorks"], 1)
        self.assertEqual(q["nextHumanitiesAction"]["authority"]["id"], self.hold)
        self.assertEqual(q["nextHumanitiesReadyAction"]["authority"]["id"], self.other)
        self.assertEqual(q["evidenceHoldItems"][0]["authority"]["admissionState"], "review")
        self.assertEqual(q["humanitiesReadyItems"][0]["authority"]["admissionState"], "review")

    def test_invalid_holds_fail_closed(self):
        for change in ("unknown", "duplicate", "scope"):
            p = json.loads(json.dumps(self.policy))
            if change == "unknown":
                p["holds"][0]["programRef"] = "program:udg:nonexistent"
            elif change == "duplicate":
                p["holds"].append(dict(p["holds"][0]))
            else:
                p["targetScope"] = "all-disciplines"
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.make_queue(p)

    def test_no_hold_preserves_full_ready_queue(self):
        q = self.make_queue({"targetScope": "humanities-only", "holds": []})
        self.assertEqual(q["metrics"]["humanitiesReadyWorks"], 8)
        self.assertEqual(q["metrics"]["evidenceHoldWorks"], 0)
        self.assertEqual(q["nextHumanitiesReadyAction"]["authority"]["id"], self.hold)

    def test_target_scope_and_review_unchanged(self):
        self.assertEqual(self.policy["targetScope"], "humanities-only")
        p = next(p for p in self.registry["programs"] if p["id"] == self.hold)
        self.assertEqual(p["admissionState"], "review")
        self.assertEqual(p["observedCount"], 13)

if __name__ == "__main__":
    unittest.main()
