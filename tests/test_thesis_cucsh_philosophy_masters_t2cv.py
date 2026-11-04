"""T2CV: recover Philosophy master's rows locally from the unfiltered CUCSH catalogue."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/thesis/recover_cucsh_philosophy_masters_t2cv.py"
spec=importlib.util.spec_from_file_location("t2cv",SCRIPT)
mod=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)

class T2CVTests(unittest.TestCase):
    def test_last_page_discovery_uses_catalog_links(self):
        parsed={"safeLinks":[
            {"text":"2","url":"http://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-maestria&page=1"},
            {"text":"última »","url":"http://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-maestria&page=238"},
        ]}
        self.assertEqual(mod.page_indexes(parsed),[1,238])

    def test_unfiltered_rows_select_current_and_historical_philosophy(self):
        parsed={
            "safeLinks":[
                {"text":"Tesis actual","url":"http://www.biblioteca.cucsh.udg.mx/?q=content/tesis-actual"},
                {"text":"Tesis vieja","url":"http://www.biblioteca.cucsh.udg.mx/?q=content/tesis-vieja"},
            ],
            "_allRows":[
                ["Titulo","Autor","Coautor","Director y asesor de tesis","Año","Maestria"],
                ["Tesis actual","Ana Pérez","","Dra. Directora","2024","Maestría en Estudios Filosóficos"],
                ["Tesis vieja","Luis López","","","2005","Maestría En Filosofía"],
                ["Otra tesis","Otro Autor","","","2020","Maestría en Historia de México"],
            ],
        }
        rows=mod.records_from_page(parsed,page_url="http://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-maestria&page=0")
        selected,duplicates=mod.unique_program_records(rows)
        self.assertEqual(len(rows),3)
        self.assertEqual(len(selected),2)
        self.assertEqual(len(duplicates),0)
        by_life={r["lifecycle"]:r for r in selected}
        self.assertEqual(by_life["current"]["programRef"],"program:udg:mae-estudios-filosoficos")
        self.assertEqual(by_life["historical"]["programRef"],"program:udg:mae-filosofia-historica")
        self.assertTrue(by_life["current"]["recordUrl"].endswith("q=content/tesis-actual"))

    def test_duplicate_rows_collapse_without_identity_inference(self):
        rows=[
            {"title":"La razón","author":"Ana Pérez","year":2020,"programRaw":"Maestría en Estudios Filosóficos","recordUrl":"https://www.biblioteca.cucsh.udg.mx/?q=content/a"},
            {"title":"LA RAZÓN","author":"ANA PÉREZ","year":2020,"programRaw":"Maestría en Estudios Filosóficos","recordUrl":"https://www.biblioteca.cucsh.udg.mx/?q=content/b"},
        ]
        selected,duplicates=mod.unique_program_records(rows)
        self.assertEqual(len(selected),1)
        self.assertEqual(len(duplicates),1)

    def test_control_school_counts_are_counts_not_thesis_identities(self):
        report={
            "schemaVersion":"thesis-control-school-degree-recon-v1",
            "files":[
                {"year":"2024","sheets":[{"name":"A","relevantRows":[
                    {"row":1,"values":["","MAESTRA EN ESTUDIOS FILOSÓFICOS","1",""],"signals":["philosophy-masters"]},
                    {"row":2,"values":["","MAESTRO EN ESTUDIOS FILOSÓFICOS","7",""],"signals":["philosophy-masters"]},
                ]}]},
                {"year":"2025","sheets":[{"name":"B","relevantRows":[
                    {"row":3,"values":["","MAESTRO EN ESTUDIOS FILOSÓFICOS","7.0",""],"signals":["philosophy-masters"]},
                ]}]},
            ],
        }
        out=mod.control_school_counts(report)
        self.assertEqual(out["byYear"]["2024"]["degrees"],8)
        self.assertEqual(out["total2018_2025"],15)

    def test_build_report_keeps_counts_separate_from_catalog_identity(self):
        filtered={
            "schemaVersion":"thesis-cucsh-catalog-recon-v1",
            "philosophyInventories":[
                {"program":"Maestría en Estudios Filosóficos","count":0},
                {"program":"Maestría En Filosofía","count":0},
            ],
        }
        control={
            "schemaVersion":"thesis-control-school-degree-recon-v1",
            "files":[{"year":"2024","sheets":[{"name":"A","relevantRows":[
                {"row":1,"values":["","MAESTRO EN ESTUDIOS FILOSÓFICOS","8",""],"signals":["philosophy-masters"]},
            ]}]}],
        }
        official={"seedRecords":[{
            "title":"Tesis actual","authors":["Ana Pérez"],"year":2024,
            "program":"Maestría en Estudios Filosóficos"
        }]}
        curated={"records":[{
            "title":"Tesis no hallada","authors":["Adriel Ejemplo"],"year":None,
            "actualProgram":"Maestría en Estudios Filosóficos","status":"review"
        }]}
        crawl={
            "pagesFetched":2,"lastPageIndex":1,"pageEvidence":[],
            "rows":[
                {"title":"Tesis actual","author":"Ana Pérez","year":2024,"programRaw":"Maestría en Estudios Filosóficos","recordUrl":"https://www.biblioteca.cucsh.udg.mx/?q=content/a"},
                {"title":"Tesis vieja","author":"Luis López","year":2005,"programRaw":"Maestría En Filosofía","recordUrl":"https://www.biblioteca.cucsh.udg.mx/?q=content/b"},
            ],
        }
        out=mod.build_report(crawl=crawl,filtered_report=filtered,control_report=control,official=official,curated=curated)
        self.assertTrue(out["referenceOnly"])
        self.assertFalse(out["physicalHoldingsClaimed"])
        self.assertFalse(out["degreeCountsCreateThesisIdentities"])
        self.assertEqual(out["metrics"]["currentProgramUnique"],1)
        self.assertEqual(out["metrics"]["historicalProgramUnique"],1)
        self.assertEqual(out["metrics"]["controlSchoolDegrees2018_2025"],8)
        self.assertEqual(out["metrics"]["knownPublicSeeds"],2)
        self.assertEqual(out["metrics"]["knownPublicSeedsMatchedInCatalog"],1)
        self.assertEqual(out["metrics"]["philosophyLikeProgramLabels"],2)\n        self.assertEqual(out["metrics"]["philosophyLikeRows"],2)\n
if __name__=="__main__":
    unittest.main()
