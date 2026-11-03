"""T2BL regression: historical identity is not Humanities admission."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))
import build_canonical_corpus_v1 as canonical
import audit_mca_arte_comunicacion_evidence_v1 as audit


class McaArteComunicacionHoldTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (ROOT / "scripts/thesis/config/"
             "mca-arte-comunicacion-evidence-hold-v1.json")
            .read_text(encoding="utf-8")
        )

    def test_all_historical_exact_aliases_stay_review(self):
        target = next(
            p for p in self.registry["programs"]
            if p["id"] == self.baseline["authorityRef"]
        )
        self.assertEqual(target["admissionState"], "review")
        self.assertEqual(target["lifecycleState"], "historical")
        self.assertEqual(target["observedCount"], 13)
        for raw in [target["canonicalName"], *target["aliases"]]:
            with self.subTest(raw=raw):
                decision = canonical.resolve_program(raw, self.registry)
                self.assertEqual(decision["programRef"], target["id"])
                self.assertEqual(decision["admissionState"], "review")

    def test_no_inheritance_from_generic_mca_or_siblings(self):
        generic = canonical.resolve_program(
            "Maestría En Ciencias De La Arquitectura", self.registry
        )
        self.assertEqual(generic["admissionState"], "include")
        for label in (
            "Maestría En Arquitectura; Orientacion Urbanismo Y Desarrollo",
            "Maestría En Arquitectura; Edificacion Arquitectonica",
            "Maestría En Arquitectura; Orientacion Teoria Y Critica De La Arquitectura",
        ):
            with self.subTest(label=label):
                result = canonical.resolve_program(label, self.registry)
                self.assertEqual(result["admissionState"], "review")
                self.assertNotEqual(
                    result["programRef"], self.baseline["authorityRef"]
                )

    def test_frozen_policy_and_scope(self):
        self.assertEqual(
            self.registry["registryRevision"], self.baseline["registryRevision"]
        )
        scope = json.loads(
            (ROOT / "scripts/thesis/config/scope-boundary-matrix-v1.json")
            .read_text(encoding="utf-8")
        )
        metadata = json.loads(
            (ROOT / "scripts/thesis/config/"
             "program-metadata-evidence-confidence-v1.json")
            .read_text(encoding="utf-8")
        )
        self.assertEqual(
            scope["policyRevision"], self.baseline["scopePolicyRevision"]
        )
        self.assertEqual(
            metadata["policyRevision"], self.baseline["metadataConfidenceRevision"]
        )
        self.assertEqual(scope["targetScope"], "humanities-only")

    def test_report_verifier_rejects_unjustified_include(self):
        raw = "Maestría En Arquitectura; Orientacion Arte Y Comunicacion"
        b = json.loads(json.dumps(self.baseline))
        b["expected"]["corpusWorks"] = 13
        b["expected"]["globalAdmission"] = {"review": 13}
        rows = [
            {
                "programRef": b["authorityRef"],
                "programRaw": raw,
                "academicUnitRaw": "CUAAD",
                "admissionStatus": "review",
                "programMetadataEvidence": {"authorityApplicability": "allowed"},
            }
            for _ in range(13)
        ]
        rows[0]["admissionStatus"] = "include"
        corpus = {"works": rows}
        with self.assertRaises(AssertionError):
            audit.build_report(corpus, {"items": []}, self.registry, b)


if __name__ == "__main__":
    unittest.main()
