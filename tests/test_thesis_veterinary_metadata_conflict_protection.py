from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
THESIS_DIR = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS_DIR))


def load_module(name: str, filename: str):
    path = THESIS_DIR / filename
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


canonical = load_module(
    "veterinary_conflict_canonical",
    "build_canonical_corpus_v1.py",
)


class VeterinaryMetadataConflictProtectionV3Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy = canonical.load_program_metadata_evidence_policy(
            THESIS_DIR
            / "config"
            / "program-metadata-evidence-confidence-v1.json"
        )

    def record(self, provider_record_id: str, program: str):
        return canonical.source_record(
            provider="riudg",
            provider_record_id=provider_record_id,
            source_url=None,
            raw_fields={
                "dc.title": ["Fixture"],
                "dc.degree.name": [program],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.date.accessioned": ["2015-09-09T12:00:00Z"],
                "dc.date.submitted": ["1991"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload=provider_record_id,
        )

    def evidence(self, provider_record_id: str, program: str):
        return canonical.evaluate_program_metadata_evidence(
            self.record(provider_record_id, program),
            program,
            self.policy,
        )

    def test_policy_revision_is_v3(self):
        self.assertEqual(
            self.policy["policyRevision"],
            "2026-11-02.v3",
        )

    def test_new_veterinary_dentistry_pair_is_blocked_symmetrically(self):
        veterinary = self.evidence(
            "oai:riudg.udg.mx:20.500.12104/21606",
            "LICENCIATURA EN MEDICINA VETERINARIA ZOOTECNISTA",
        )
        dentistry = self.evidence(
            "oai:riudg.udg.mx:20.500.12104/33113",
            "LICENCIATURA EN ODONTOLOGÍA",
        )

        for evidence in (veterinary, dentistry):
            self.assertEqual(evidence["confidenceState"], "conflicted")
            self.assertEqual(
                evidence["authorityApplicability"],
                "blocked",
            )
            self.assertEqual(
                evidence["matchedRuleId"],
                "riudg-structural-program-metadata-conflicts-v1",
            )

    def test_new_veterinary_psychology_pair_is_blocked_symmetrically(self):
        veterinary = self.evidence(
            "oai:riudg.udg.mx:20.500.12104/21949",
            "LICENCIATURA EN MEDICINA VETERINARIA ZOOTECNISTA",
        )
        psychology = self.evidence(
            "oai:riudg.udg.mx:20.500.12104/33882",
            "LICENCIATURA EN PSICOLOGÍA",
        )

        self.assertEqual(veterinary["confidenceState"], "conflicted")
        self.assertEqual(psychology["confidenceState"], "conflicted")
        self.assertEqual(
            psychology["matchedRuleId"],
            "riudg-structural-program-metadata-conflicts-v1",
        )

    def test_existing_veterinary_medicine_pair_remains_conflicted(self):
        veterinary = self.evidence(
            "oai:riudg.udg.mx:20.500.12104/21932",
            "LICENCIATURA EN MEDICINA VETERINARIA ZOOTECNISTA",
        )
        self.assertEqual(veterinary["confidenceState"], "conflicted")
        self.assertEqual(veterinary["authorityApplicability"], "blocked")

    def test_unlisted_veterinary_record_remains_unassessed(self):
        evidence = self.evidence(
            "oai:riudg.udg.mx:20.500.12104/999999",
            "LICENCIATURA EN MEDICINA VETERINARIA ZOOTECNISTA",
        )
        self.assertEqual(evidence["confidenceState"], "unassessed")
        self.assertEqual(evidence["authorityApplicability"], "allowed")
        self.assertIsNone(evidence["matchedRuleId"])


if __name__ == "__main__":
    unittest.main()
