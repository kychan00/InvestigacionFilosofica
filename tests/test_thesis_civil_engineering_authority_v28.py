"""T2AU exact Program Authority V28 regression gates."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))
import build_canonical_corpus_v1 as canonical


class TestCivilEngineeringAuthorityV28(unittest.TestCase):
    def test_exact_undergraduate_only(self):
        registry = canonical.load_program_registry()
        baseline = json.loads((ROOT / "scripts/thesis/config/civil-engineering-authority-v28-baseline-v1.json").read_text())
        self.assertEqual(baseline["registryRevision"], "2026-11-02.v28")
        self.assertGreaterEqual(
            int(registry["registryRevision"].rsplit(".v", 1)[1]),
            28,
        )
        matches = [p for p in registry["programs"] if p["id"] == baseline["programRef"]]
        self.assertEqual(len(matches), 1)
        p = matches[0]
        self.assertEqual(p["admissionState"], "exclude")
        self.assertEqual(p["level"], "licenciatura")
        self.assertEqual(p["academicUnits"], ["CUCEI"])
        self.assertEqual(len(p["aliases"]), 1)
        self.assertEqual(canonical.normalize_key(p["aliases"][0]), "licenciatura en ingenieria civil")
        all_aliases = [canonical.normalize_key(a) for a in p["aliases"]]
        self.assertFalse(any("maestria" in a for a in all_aliases))
        self.assertEqual(p["observedCount"], 1197)

    def test_metadata_confidence_policy_unchanged(self):
        policy = canonical.load_program_metadata_evidence_policy()
        self.assertEqual(policy["policyRevision"], "2026-11-02.v5")


if __name__ == "__main__":
    unittest.main()
