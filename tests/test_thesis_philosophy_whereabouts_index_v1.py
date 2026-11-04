"""Regression tests for T2CL Philosophy thesis whereabouts index."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/thesis/build_philosophy_whereabouts_index_v1.py"
spec=importlib.util.spec_from_file_location("whereabouts",SCRIPT)
mod=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)


class WhereaboutsIndexTest(unittest.TestCase):
    def cucsh(self):
        return {
            "schemaVersion":"thesis-cucsh-catalog-recon-v1",
            "revision":"fixture",
            "philosophyInventories":[{
                "program":"Licenciatura en Filosofía",
                "records":[
                    {
                        "title":"Ética y lenguaje",
                        "author":"Pérez López, Ana",
                        "coauthor":"",
                        "director":"Director Uno",
                        "year":"2020",
                        "program":"Licenciatura en Filosofía",
                        "recordUrl":"http://www.biblioteca.cucsh.udg.mx/?q=content/etica-y-lenguaje",
                        "catalogPageUrl":"http://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-licenciatura&page=1",
                    },
                    {
                        "title":"Femenidad y experiencia",
                        "author":"Castillo Ramírez, Guillermo",
                        "coauthor":"",
                        "director":"Director Dos",
                        "year":"2004",
                        "program":"Licenciatura en Filosofía",
                        "recordUrl":"http://www.biblioteca.cucsh.udg.mx/?q=content/femenidad-y-experiencia",
                        "catalogPageUrl":"http://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-licenciatura&page=2",
                    },
                ],
            }],
        }

    def philosophy(self):
        return {
            "schemaVersion":"thesis-philosophy-public-index-v1",
            "revision":"fixture",
            "sourceRelease":"thesis-effective-corpus-v2",
            "referenceOnly":True,
            "records":[
                {
                    "id":"thesis:work:00000001",
                    "canonicalWorkId":"thesis:work:00000001",
                    "title":"Ética y lenguaje",
                    "authors":["Pérez López, Ana"],
                    "directors":["Director Uno"],
                    "year":2020,
                    "program":"Licenciatura en Filosofía",
                    "programRef":"program:udg:lic-filosofia",
                    "degree":"licenciatura",
                    "sourceUrl":"https://hdl.handle.net/20.500.12104/99999",
                    "handle":"20.500.12104/99999",
                    "philosophyStatus":"include",
                    "philosophyRole":"program-core",
                },
                {
                    "id":"philosophy:reference:castillo",
                    "canonicalWorkId":None,
                    "title":"Feminidad y experiencia",
                    "authors":["Castillo Ramírez, Guillermo"],
                    "directors":[],
                    "year":2004,
                    "program":"Licenciatura en Filosofía",
                    "programRef":"program:udg:lic-filosofia",
                    "degree":"licenciatura",
                    "sourceUrl":"http://www.biblioteca.cucsh.udg.mx/?q=node/8243",
                    "handle":None,
                    "philosophyStatus":"include",
                    "philosophyRole":"program-core",
                },
                {
                    "id":"philosophy:reference:tics",
                    "canonicalWorkId":None,
                    "title":"Filosofía y TICS",
                    "authors":["García Magaña, José Luis"],
                    "directors":[],
                    "year":2012,
                    "program":"Maestría en Tecnologías para el Aprendizaje",
                    "programRef":None,
                    "degree":"maestria",
                    "sourceUrl":"https://philarchive.org/rec/ABC",
                    "handle":None,
                    "philosophyStatus":"include",
                    "philosophyRole":"philosophical-content",
                },
            ],
        }

    def test_union_and_exact_merge(self):
        out=mod.build_index(self.cucsh(),self.philosophy())
        self.assertEqual(out["metrics"]["cucshInventoryRecords"],2)
        self.assertEqual(out["metrics"]["t2ciRecords"],3)
        self.assertEqual(out["metrics"]["exactMerges"],1)
        self.assertEqual(out["metrics"]["records"],4)
        exact=next(row for row in out["records"] if row["title"]=="Ética y lenguaje")
        self.assertEqual(exact["canonicalWorkId"],"thesis:work:00000001")
        self.assertEqual(exact["whereaboutsStatus"],"digital")
        self.assertIsNone(exact["physicalLocation"])
        self.assertIsNotNone(exact["identity"]["cucsh"])

    def test_title_mismatch_is_review_not_auto_merge(self):
        out=mod.build_index(self.cucsh(),self.philosophy())
        castillo=[row for row in out["records"] if "Castillo" in " ".join(row["authors"])]
        self.assertEqual(len(castillo),2)
        self.assertTrue(all(row["reviewFlags"] for row in castillo))
        self.assertTrue(all(row["physicalLocation"] is None for row in castillo))

    def test_interdisciplinary_record_preserves_program(self):
        out=mod.build_index(self.cucsh(),self.philosophy())
        tics=next(row for row in out["records"] if row["title"]=="Filosofía y TICS")
        self.assertEqual(tics["program"],"Maestría en Tecnologías para el Aprendizaje")
        self.assertEqual(tics["philosophyRole"],"philosophical-content")
        self.assertEqual(tics["whereaboutsStatus"],"cataloged-location-unresolved")


if __name__=="__main__":
    unittest.main()
