"""T2DA: institutional bibliography evidence stays below thesis work-level identity."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/thesis/validate_mef_post_aleph_corroboration_t2da.py"
LEDGER = ROOT / "scripts/thesis/config/mef-post-aleph-corroboration-t2da.json"
T2CY = ROOT / "scripts/thesis/config/mef-supervision-evidence-t2cy.json"
T2CZ = ROOT / "scripts/thesis/config/mef-aleph-resolution-t2cz-baseline.json"
spec = importlib.util.spec_from_file_location("t2da", SCRIPT)
mod = importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)


class T2DATests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(LEDGER.read_text(encoding="utf-8"))
        self.t2cy = json.loads(T2CY.read_text(encoding="utf-8"))
        self.t2cz = json.loads(T2CZ.read_text(encoding="utf-8"))

    def validate(self, data=None):
        return mod.validate(data or self.data, self.t2cy, self.t2cz)

    def test_real_ledger_metrics(self):
        m = self.validate()
        self.assertEqual(m["t2cyInputRecords"], 11)
        self.assertEqual(m["t2cyInstitutionalBibliographyOverlaps"], 6)
        self.assertEqual(m["t2cyExactBibliographyTitleMatches"], 5)
        self.assertEqual(m["t2cyTitleVariantReviews"], 1)
        self.assertEqual(m["authorAuthoritiesResolved"], 1)
        self.assertEqual(m["discoveredCompletedMasterThesisCitations"], 4)
        self.assertEqual(m["newMefCandidatesInstitutionalProgramConfirmed"], 1)
        self.assertEqual(m["newMefCandidatesNoninstitutionalProgramCorroboration"], 1)
        self.assertEqual(m["newOutsideMefConfirmed"], 1)
        self.assertEqual(m["newProgramUnresolved"], 1)
        self.assertEqual(m["institutionalWorkIdentitiesConfirmed"], 0)
        self.assertEqual(m["physicalHoldingsConfirmed"], 0)
        self.assertEqual(m["publicRecordsAdded"], 0)

    def test_romulo_authority_resolved_but_title_variant_preserved(self):
        row = next(r for r in self.data["t2cyCorroborations"] if r["sourceAuthor"] == "Rómulo Daza y García")
        self.assertEqual(row["resolvedCanonicalName"], "Rómulo Ramírez Daza y García")
        self.assertTrue(row["authorAuthorityResolved"])
        self.assertTrue(row["titleVariantReview"])
        self.assertNotEqual(mod.norm(row["t2cyTitle"]), mod.norm(row["bibliographyTitle"]))
        self.assertFalse(row["institutionalWorkIdentityConfirmed"])

    def test_mario_is_new_mef_candidate_not_work_identity(self):
        row = next(r for r in self.data["discoveredMasterThesisCitations"] if r["author"] == "Mario Damián Del Muro Silva")
        self.assertEqual(row["programAdjudication"], "mef-institutionally-corroborated")
        self.assertTrue(row["mefProgramInstitutionallyConfirmed"])
        self.assertTrue(row["mefProgramCandidate"])
        self.assertFalse(row["institutionalWorkIdentityConfirmed"])
        self.assertEqual(row["decision"], "new-mef-thesis-cross-source-corroborated")

    def test_zaria_master_thesis_is_explicitly_outside_mef(self):
        row = next(r for r in self.data["discoveredMasterThesisCitations"] if r["author"] == "Zariá Casillas Olivares")
        self.assertEqual(row["programAdjudication"], "outside-mef-confirmed")
        self.assertFalse(row["mefProgramCandidate"])
        self.assertEqual(row["decision"], "exclude-from-mef-program")

    def test_source_book_handle_cannot_be_reused_as_thesis_handle(self):
        handle = self.data["sourceObject"]["institutionalContainer"]["handle"]
        self.assertTrue(handle.endswith("/112279"))
        for row in self.data["t2cyCorroborations"]:
            self.assertIsNone(row["thesisSpecificHandle"])
        bad = json.loads(json.dumps(self.data))
        bad["t2cyCorroborations"][0]["thesisSpecificHandle"] = handle
        with self.assertRaises(ValueError):
            self.validate(bad)

    def test_isbn_discrepancy_is_not_silently_corrected(self):
        d = self.data["sourceObject"]["isbnDiscrepancy"]
        self.assertNotEqual(d["riudgValue"], d["officialEditorialValue"])
        self.assertEqual(d["officialEditorialValue"], d["isbnAuthorityValue"])
        bad = json.loads(json.dumps(self.data))
        bad["sourceObject"]["isbnDiscrepancy"]["riudgValue"] = d["officialEditorialValue"]
        with self.assertRaises(ValueError):
            self.validate(bad)

    def test_marcela_external_profile_does_not_create_udg_work_identifier(self):
        row = self.data["externalInstitutionalWorkCorroborations"][0]
        self.assertEqual(row["resolvedName"], "Marcela Castillo Villegas")
        self.assertTrue(row["spellingVariantReview"])
        self.assertFalse(row["institutionalWorkIdentityConfirmed"])

    def test_in_course_thesis_is_excluded(self):
        row = self.data["excludedInCourse"][0]
        self.assertEqual(row["author"], "Joel Alejandro Franco Ramírez")
        self.assertEqual(row["statusInSource"], "en curso")
        self.assertEqual(row["decision"], "exclude-not-completed")

    def test_public_text_witness_cannot_be_institutionalized(self):
        bad = json.loads(json.dumps(self.data))
        bad["sourceObject"]["publicTextWitness"]["role"] = "institutional-container-only"
        with self.assertRaises(ValueError):
            self.validate(bad)


if __name__ == "__main__":
    unittest.main()
