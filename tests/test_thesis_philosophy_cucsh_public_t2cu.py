"""T2CU public projection: official CUCSH inventory, deduplicated and reference-only."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/thesis/merge_philosophy_cucsh_inventory_t2cu.py"
spec=importlib.util.spec_from_file_location("t2cu",SCRIPT)
mod=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)

def base():
    return {
        "schemaVersion":"thesis-philosophy-public-index-v1",
        "revision":"2026-11-04.t2ct-v1",
        "sourceRelease":"thesis-effective-corpus-v2",
        "referenceOnly":True,
        "canonicalAdmissionMutation":False,
        "preserveActualProgram":True,
        "doctoralPolicy":{"exactDoctorateProgramPresent":False},
        "documentedPhilosophyPrograms":[
            {"programRef":"program:udg:lic-filosofia","name":"Licenciatura en Filosofía","records":1,"include":1,"review":0},
            {"programRef":"program:udg:mae-estudios-filosoficos","name":"Maestría en Estudios Filosóficos","records":0,"include":0,"review":0},
            {"programRef":"program:udg:mae-filosofia-historica","name":"Maestría en Filosofía","records":0,"include":0,"review":0},
        ],
        "metrics":{"records":1,"byStatus":{"include":1},"byRole":{"program-core":1},"actualProgramsRepresented":1,"corroboratedReviewRecords":0},
        "actualProgramsRepresented":["Licenciatura en Filosofía"],
        "records":[{
            "id":"existing",
            "canonicalWorkId":None,
            "title":"ANÁLISIS DESCRIPTIVO SOBRE A MODIFICACIÓN CURRICULAR",
            "authors":["GUILLERMO VARGAS CURIEL"],
            "directors":[],
            "year":2006,
            "program":"Licenciatura en Filosofía",
            "programRef":"program:udg:lic-filosofia",
            "degree":"licenciatura",
            "unit":"CUCSH",
            "abstractExcerpt":"",
            "keywords":[],
            "sourceUrl":"https://www.biblioteca.cucsh.udg.mx/?q=node%2F8243",
            "handle":None,
            "philosophyStatus":"include",
            "philosophyRole":"program-core",
            "classificationSource":"official-program-evidence",
            "philosophyEvidence":"fixture",
            "validationTier":"official",
            "sourceKind":"official-supplement",
            "sourceLabel":"Biblioteca CUCSH",
            "evidenceUrls":[],
        }],
    }

def report():
    rows=[
        {
            "title":"ANÁLISIS DESCRIPTIVO SOBRE A MODIFICACIÓN CURRICULAR",
            "author":"GUILLERMO VARGAS CURIEL","coauthor":"","director":"",
            "year":"2006","program":"Licenciatura en Filosofía",
            "recordUrl":"http://www.biblioteca.cucsh.udg.mx/?q=content/analisis-descriptivo",
            "catalogPageUrl":"http://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-licenciatura&page=0",
        },
        {
            "title":"\"EL ENUNCIADO DESDE LA PERSPECTIVA DE MICHEL FOUCAULT\".",
            "author":"ISMAEL JIMÉNEZ ALVARADO","coauthor":"ENSAYO","director":"NO TIENE",
            "year":"2011","program":"Licenciatura en Filosofía",
            "recordUrl":"http://www.biblioteca.cucsh.udg.mx/?q=content/el-enunciado-0",
            "catalogPageUrl":"http://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-licenciatura&page=0",
        },
        {
            "title":"EL ENUNCIADO DESDE LA PERSPECTIVA DE MICHEL FOUCAULT",
            "author":"ISMAEL JIMENEZ ALVARADO","coauthor":"","director":"",
            "year":"2011","program":"Licenciatura en Filosofía",
            "recordUrl":"http://www.biblioteca.cucsh.udg.mx/?q=content/el-enunciado",
            "catalogPageUrl":"http://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-licenciatura&page=6",
        },
        {
            "title":"ALEXANDER VON HUMBOLDT: UN ENSAYO SOBRE LA ANTROPOLOGÍA FILOSÓFICA DE LO MEXICANO",
            "author":"AMMIELMISRAIM GARCÍA DIOSDADO","coauthor":"TESIS","director":"JOSÉ MARÍA NAVA PRECIADO",
            "year":"2015","program":"Licenciatura en Filosofía",
            "recordUrl":"http://www.biblioteca.cucsh.udg.mx/?q=content/alexander-von-humboldt",
            "catalogPageUrl":"http://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-licenciatura&page=1",
        },
    ]
    return {
        "schemaVersion":"thesis-cucsh-catalog-recon-v1",
        "revision":"2026-11-04.t2cj-v3",
        "referenceOnly":True,
        "rawHtmlPersisted":False,
        "philosophyInventories":[{"program":"Licenciatura en Filosofía","records":rows}],
    }

class T2CUTests(unittest.TestCase):
    def test_collapses_catalog_duplicate_and_merges_existing(self):
        out=mod.merge(base(),report())
        self.assertEqual(out["revision"],"2026-11-04.t2cu-v1")
        self.assertEqual(out["metrics"]["records"],3)
        inv=out["cucshHistoricalInventory"]
        self.assertEqual(inv["sourceRows"],4)
        self.assertEqual(inv["uniqueBibliographicIdentities"],3)
        self.assertEqual(inv["duplicateSourceRowsCollapsed"],1)
        self.assertEqual(inv["duplicateGroups"],1)
        self.assertEqual(inv["exactMergesWithT2CT"],1)
        self.assertEqual(inv["newPublicReferences"],2)
        self.assertFalse(inv["physicalHoldingsClaimed"])

    def test_new_records_are_exact_program_core_without_holding_claim(self):
        out=mod.merge(base(),report())
        humm=next(r for r in out["records"] if "HUMBOLDT" in r["title"])
        self.assertEqual(humm["programRef"],"program:udg:lic-filosofia")
        self.assertEqual(humm["philosophyStatus"],"include")
        self.assertEqual(humm["philosophyRole"],"program-core")
        self.assertEqual(humm["validationTier"],"official-cucsh-library-record")
        self.assertTrue(humm["sourceUrl"].startswith("https://www.biblioteca.cucsh.udg.mx/"))
        self.assertNotIn("physicalLocation",humm)
        self.assertEqual(humm["directors"],["JOSÉ MARÍA NAVA PRECIADO"])

    def test_existing_record_receives_cucsh_evidence_without_duplicate(self):
        out=mod.merge(base(),report())
        row=next(r for r in out["records"] if r["id"]=="existing")
        self.assertIn("cucshCatalog",row)
        self.assertTrue(any("analisis-descriptivo" in u for u in row["evidenceUrls"]))
        self.assertEqual(sum(r["id"]=="existing" for r in out["records"]),1)

    def test_malformed_year_and_shifted_director_remain_unverified(self):
        bad=report()
        bad["philosophyInventories"][0]["records"].append({
            "title":"LA EDUCACIÓN COMO NECESIDAD PARA EL HOMBRE",
            "author":"MARÍA GUADALUPE CASTAÑEDA NAVA","coauthor":"",
            "director":"2003","year":"208","program":"Licenciatura en Filosofía",
            "recordUrl":"http://www.biblioteca.cucsh.udg.mx/?q=content/la-educacion-como-necesidad-para-el-hombre",
            "catalogPageUrl":"http://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-licenciatura&page=12",
        })
        out=mod.merge(base(),bad)
        row=next(r for r in out["records"] if r["title"]=="LA EDUCACIÓN COMO NECESIDAD PARA EL HOMBRE")
        self.assertIsNone(row["year"])
        self.assertEqual(row["dateQuality"],"unknown")
        self.assertEqual(row["directors"],[])
        self.assertEqual(row["cucshCatalog"]["directorRaw"],"2003")
        self.assertIn("invalid-or-missing-year",row["cucshCatalog"]["dataQualityFlags"])
        self.assertEqual(out["cucshHistoricalInventory"]["unknownYearReferences"],1)
        self.assertIsNone(mod.public_director("NO TIENE"))
        self.assertIsNone(mod.public_director("2003"))

    def test_legacy_http_is_upgraded_only_for_cucsh(self):
        self.assertEqual(
            mod.safe_cucsh_url("http://www.biblioteca.cucsh.udg.mx/?q=content/x"),
            "https://www.biblioteca.cucsh.udg.mx/?q=content/x",
        )
        self.assertIsNone(mod.safe_cucsh_url("https://evil.example/?q=content/x"))
        self.assertIsNone(mod.safe_cucsh_url("https://www.biblioteca.cucsh.udg.mx/download/x"))

    def test_rejects_non_reference_only_report(self):
        bad=report(); bad["referenceOnly"]=False
        with self.assertRaises(ValueError):
            mod.merge(base(),bad)

if __name__=="__main__":
    unittest.main()
